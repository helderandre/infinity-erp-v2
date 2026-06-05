import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, requirePermission } from '@/lib/auth/permissions'

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
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
}

type Scope = 'global' | 'personal'

function parseScope(raw: string | null): Scope {
  return raw === 'personal' ? 'personal' : 'global'
}

/**
 * Authorize the caller for the given scope.
 *  - global   → requires `marketing` permission for mutations; reads for any authenticated user.
 *  - personal → only authentication required; the caller can only act on their own rows.
 *
 * Returns the auth result, or an error response.
 */
async function authorizeForScope(scope: Scope, mutating: boolean) {
  if (scope === 'personal') {
    return await requireAuth()
  }
  return mutating
    ? await requirePermission('marketing')
    : await requireAuth()
}

/**
 * GET /api/marketing/recursos?parent_id=<uuid|null>&scope=<global|personal>
 *
 * Lists the immediate children of a folder (or the root when parent_id is
 * null/missing). For scope=personal the caller's own owner_id is enforced.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const scope = parseScope(searchParams.get('scope'))
  const auth = await authorizeForScope(scope, false)
  if (!auth.authorized) return auth.response

  const rawParent = searchParams.get('parent_id')
  const parentId = rawParent && rawParent !== 'null' ? rawParent : null

  const supabase = await createClient()
  let q = supabase
    .from('marketing_resources' as any)
    .select('*')
    .eq('scope', scope)
    .order('is_folder', { ascending: false })
    .order('name', { ascending: true })

  if (scope === 'personal') {
    q = q.eq('owner_id', auth.user.id)
  }

  q = parentId === null ? q.is('parent_id', null) : q.eq('parent_id', parentId)

  const { data, error } = await q
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Resolve breadcrumbs (path from root to current folder), constrained to the
  // current scope (and owner, for personal) so a malicious parent_id cannot
  // leak names from someone else's tree.
  const breadcrumbs: { id: string; name: string }[] = []
  let cursor: string | null = parentId
  for (let i = 0; cursor && i < 32; i++) {
    let bcQuery = supabase
      .from('marketing_resources' as any)
      .select('id, name, parent_id, scope, owner_id')
      .eq('id', cursor)
      .eq('scope', scope)
    if (scope === 'personal') {
      bcQuery = bcQuery.eq('owner_id', auth.user.id)
    }
    const { data: rowData, error: bcErr } = await bcQuery.maybeSingle()
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
  scope: z.enum(['global', 'personal']).optional(),
})

/**
 * POST /api/marketing/recursos
 * Body: { name, parent_id?: uuid|null, scope?: 'global'|'personal' }
 * Creates a folder under the given parent. Personal folders are owned by
 * the caller; global folders require the `marketing` permission.
 */
export async function POST(request: Request) {
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

  const scope: Scope = parsed.data.scope ?? 'global'
  const auth = await authorizeForScope(scope, true)
  if (!auth.authorized) return auth.response

  const supabase = await createClient()

  // Validate parent exists, is a folder, and belongs to the same scope (and
  // owner, for personal).
  if (parsed.data.parent_id) {
    let parentQuery = supabase
      .from('marketing_resources' as any)
      .select('id, is_folder, scope, owner_id')
      .eq('id', parsed.data.parent_id)
      .eq('scope', scope)
    if (scope === 'personal') {
      parentQuery = parentQuery.eq('owner_id', auth.user.id)
    }
    const { data: parentData, error: pErr } = await parentQuery.maybeSingle()
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
      scope,
      owner_id: scope === 'personal' ? auth.user.id : null,
      created_by: auth.user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
