import { NextResponse } from 'next/server'
import { z } from 'zod'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
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
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  parent_id: z.string().uuid().nullable().optional(),
})

/**
 * PATCH /api/marketing/recursos/[id]
 * Body: { name?: string; parent_id?: uuid|null }
 * Renames or moves a folder/file.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission('marketing')
  if (!auth.authorized) return auth.response

  const { id } = await params
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

  const supabase = await createClient()

  // Prevent moving a folder into itself or any of its descendants.
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
      const { data: parentData, error: pErr } = await supabase
        .from('marketing_resources' as any)
        .select('id, parent_id, is_folder')
        .eq('id', cursor)
        .single()
      if (pErr || !parentData) break
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
  const auth = await requirePermission('marketing')
  if (!auth.authorized) return auth.response

  const { id } = await params
  const supabase = await createClient()

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
      .single()
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
