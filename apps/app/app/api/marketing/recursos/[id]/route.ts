import { NextResponse } from 'next/server'
import { z } from 'zod'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, requirePermission } from '@/lib/auth/permissions'
import { getR2Client, R2_BUCKET } from '@/lib/r2/client'

type MarketingResourceRow = {
  id: string
  parent_id: string | null
  is_folder: boolean
  name: string
  file_path: string | null
  file_url: string | null
  mime_type: string | null
  file_size: number | null
  scope: 'global' | 'personal'
  owner_id: string | null
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  parent_id: z.string().uuid().nullable().optional(),
})

/**
 * Load the row + authorize the caller. For personal rows the caller must be
 * the owner; for global rows we require the `marketing` permission.
 *
 * Returns either { row, userId } or a NextResponse to short-circuit.
 */
async function loadAndAuthorize(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('marketing_resources' as any)
    .select('id, scope, owner_id, is_folder, file_path, parent_id')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    return { error: NextResponse.json({ error: error.message }, { status: 500 }) }
  }
  if (!data) {
    return { error: NextResponse.json({ error: 'Não encontrado' }, { status: 404 }) }
  }
  const row = data as unknown as MarketingResourceRow

  if (row.scope === 'personal') {
    const auth = await requireAuth()
    if (!auth.authorized) return { error: auth.response }
    if (row.owner_id !== auth.user.id) {
      return { error: NextResponse.json({ error: 'Sem permissão' }, { status: 403 }) }
    }
    return { row, supabase, userId: auth.user.id }
  }

  const auth = await requirePermission('marketing')
  if (!auth.authorized) return { error: auth.response }
  return { row, supabase, userId: auth.user.id }
}

/**
 * PATCH /api/marketing/recursos/[id]
 * Body: { name?: string; parent_id?: uuid|null }
 * Renames or moves a folder/file. Personal items can only be moved within
 * the caller's own tree; global items can only be moved within the global tree.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await loadAndAuthorize(id)
  if ('error' in ctx) return ctx.error
  const { row, supabase } = ctx

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const updates: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) updates.name = parsed.data.name
  if (parsed.data.parent_id !== undefined) updates.parent_id = parsed.data.parent_id
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Sem alterações' }, { status: 400 })
  }

  // Prevent moving a folder into itself or any of its descendants, and
  // ensure the new parent is in the same scope/owner.
  if (updates.parent_id !== undefined && updates.parent_id !== null) {
    const target = String(updates.parent_id)
    if (target === id) {
      return NextResponse.json(
        { error: 'Não pode mover uma pasta para dentro de si própria' },
        { status: 400 },
      )
    }

    let cursor: string | null = target
    for (let i = 0; cursor && i < 32; i++) {
      if (cursor === id) {
        return NextResponse.json(
          { error: 'Destino é descendente da pasta a mover' },
          { status: 400 },
        )
      }
      let pq = supabase
        .from('marketing_resources' as any)
        .select('id, parent_id, is_folder, scope, owner_id')
        .eq('id', cursor)
        .eq('scope', row.scope)
      if (row.scope === 'personal' && row.owner_id) {
        pq = pq.eq('owner_id', row.owner_id)
      }
      const { data: parentData, error: pErr } = await pq.maybeSingle()
      if (pErr || !parentData) {
        return NextResponse.json(
          { error: 'Pasta-pai não encontrada no mesmo âmbito' },
          { status: 400 },
        )
      }
      const parent = parentData as unknown as Pick<
        MarketingResourceRow,
        'id' | 'parent_id' | 'is_folder'
      >
      if (i === 0 && !parent.is_folder) {
        return NextResponse.json(
          { error: 'O destino não é uma pasta' },
          { status: 400 },
        )
      }
      cursor = parent.parent_id
    }
  }

  const { data, error } = await supabase
    .from('marketing_resources' as any)
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/**
 * DELETE /api/marketing/recursos/[id]
 *
 * Recursively deletes a folder (or a single file). Removes any associated
 * R2 objects best-effort. The DB CASCADE handles row deletion; we collect
 * R2 keys *before* the delete so we can clean up storage afterward.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await loadAndAuthorize(id)
  if ('error' in ctx) return ctx.error
  const { supabase } = ctx

  // Walk the subtree to collect R2 keys (BFS, capped at 5000 nodes).
  const r2Keys: string[] = []
  const queue: string[] = [id]
  let visited = 0
  while (queue.length > 0 && visited < 5000) {
    const current = queue.shift()!
    visited++
    const { data: rowData } = await supabase
      .from('marketing_resources' as any)
      .select('id, is_folder, file_path')
      .eq('id', current)
      .maybeSingle()
    if (!rowData) continue
    const row = rowData as unknown as Pick<
      MarketingResourceRow,
      'id' | 'is_folder' | 'file_path'
    >
    if (!row.is_folder && row.file_path) r2Keys.push(row.file_path)
    if (row.is_folder) {
      const { data: childrenData } = await supabase
        .from('marketing_resources' as any)
        .select('id')
        .eq('parent_id', current)
      const children = (childrenData as unknown as { id: string }[] | null) || []
      for (const c of children) queue.push(c.id)
    }
  }

  // Delete the row — CASCADE removes descendants.
  const { error } = await supabase.from('marketing_resources' as any).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Best-effort R2 cleanup
  if (r2Keys.length > 0) {
    const s3 = getR2Client()
    await Promise.all(
      r2Keys.map((key) =>
        s3
          .send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
          .catch(() => {}),
      ),
    )
  }

  return NextResponse.json({ ok: true, removed_keys: r2Keys.length })
}
