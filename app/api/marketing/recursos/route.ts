import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'

type MarketingResourceRow = {
  id: string
  parent_id: string | null
  is_folder: boolean
  name: string
  file_path: string | null
  file_url: string | null
  mime_type: string | null
  file_size: number | null
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
}

/**
 * GET /api/marketing/recursos?parent_id=<uuid|null>
 *
 * Lists the immediate children of a folder (or the root when parent_id is
 * null/missing). Returns folders first, then files, alphabetically sorted.
 */
export async function GET(request: Request) {
  const auth = await requirePermission('marketing')
  if (!auth.authorized) return auth.response

  const { searchParams } = new URL(request.url)
  const rawParent = searchParams.get('parent_id')
  const parentId = rawParent && rawParent !== 'null' ? rawParent : null

  const supabase = await createClient()
  let q = supabase
    .from('marketing_resources' as any)
    .select('*')
    .order('is_folder', { ascending: false })
    .order('name', { ascending: true })

  q = parentId === null ? q.is('parent_id', null) : q.eq('parent_id', parentId)

  const { data, error } = await q
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Resolve breadcrumbs (path from root to current folder).
  const breadcrumbs: { id: string; name: string }[] = []
  let cursor: string | null = parentId
  // Cap at 32 levels to avoid pathological loops (shouldn't happen — CASCADE
  // FK + no app-level cycle creation — but defence in depth).
  for (let i = 0; cursor && i < 32; i++) {
    const { data: rowData, error: bcErr } = await supabase
      .from('marketing_resources' as any)
      .select('id, name, parent_id')
      .eq('id', cursor)
      .single()
    if (bcErr || !rowData) break
    const row = rowData as unknown as Pick<MarketingResourceRow, 'id' | 'name' | 'parent_id'>
    breadcrumbs.unshift({ id: row.id, name: row.name })
    cursor = row.parent_id
  }

  return NextResponse.json({ items: data || [], breadcrumbs })
}

const createFolderSchema = z.object({
  name: z.string().trim().min(1).max(120),
  parent_id: z.string().uuid().nullable().optional(),
})

/**
 * POST /api/marketing/recursos
 * Body: { name, parent_id?: uuid|null }
 * Creates a folder (`is_folder=true`) under the given parent.
 */
export async function POST(request: Request) {
  const auth = await requirePermission('marketing')
  if (!auth.authorized) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const parsed = createFolderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const supabase = await createClient()

  // Validate parent exists & is a folder (if provided)
  if (parsed.data.parent_id) {
    const { data: parentData, error: pErr } = await supabase
      .from('marketing_resources' as any)
      .select('id, is_folder')
      .eq('id', parsed.data.parent_id)
      .single()
    if (pErr || !parentData) {
      return NextResponse.json({ error: 'Pasta-pai não encontrada' }, { status: 404 })
    }
    const parent = parentData as unknown as Pick<MarketingResourceRow, 'id' | 'is_folder'>
    if (!parent.is_folder) {
      return NextResponse.json(
        { error: 'O destino não é uma pasta' },
        { status: 400 },
      )
    }
  }

  const { data, error } = await supabase
    .from('marketing_resources' as any)
    .insert({
      name: parsed.data.name,
      parent_id: parsed.data.parent_id ?? null,
      is_folder: true,
      created_by: auth.user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
