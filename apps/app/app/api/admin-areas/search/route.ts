import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

/**
 * GET /api/admin-areas/search?q=<query>&limit=10&types=distrito,concelho,freguesia
 *
 * Devolve áreas administrativas que casam com a pesquisa, ordenadas por
 * relevância (similaridade trigram) e tipo (distrito > concelho > freguesia).
 *
 * Inclui hierarquia (parent_label) para mostrar contexto na UI:
 *   "Estoril" (Freguesia, Cascais)
 *
 * Resposta:
 *   { data: Array<{ id, type, name, parent_id, parent_label }> }
 */
export async function GET(request: Request) {
  const auth = await requirePermission('leads')
  if (!auth.authorized) return auth.response

  const url = new URL(request.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '10', 10) || 10, 1), 30)
  const typesParam = url.searchParams.get('types') ?? ''
  const allowedTypes = typesParam
    ? typesParam.split(',').filter((t) => ['distrito', 'concelho', 'freguesia'].includes(t))
    : ['distrito', 'concelho', 'freguesia']

  if (q.length < 2) {
    return NextResponse.json({ data: [] })
  }

  const supabase = await createClient()

  // admin_areas foi criada após a última regeneração de types/database.ts.
  // Cast para bypass dos tipos até gerarmos novamente.
  type AdminAreaRow = {
    id: string
    type: 'distrito' | 'concelho' | 'freguesia'
    name: string
    parent_id: string | null
  }
  const sb = supabase as unknown as {
    from: (table: 'admin_areas') => {
      select: (cols: string) => {
        ilike: (col: string, val: string) => {
          in: (col: string, vals: string[]) => {
            order: (col: string, opts: { ascending: boolean }) => {
              order: (col: string, opts: { ascending: boolean }) => {
                limit: (n: number) => Promise<{
                  data: AdminAreaRow[] | null
                  error: { message: string } | null
                }>
              }
            }
          }
        }
      }
    }
  }

  const { data, error } = await sb
    .from('admin_areas')
    .select('id, type, name, parent_id')
    .ilike('name', `%${q}%`)
    .in('type', allowedTypes)
    .order('type', { ascending: true })
    .order('name', { ascending: true })
    .limit(limit * 3)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = data ?? []
  if (rows.length === 0) return NextResponse.json({ data: [] })

  // Ordenar por relevância: começa-com-q > contém-q, distrito antes de concelho antes de freguesia
  const lcQ = q.toLowerCase()
  const typeOrder = { distrito: 0, concelho: 1, freguesia: 2 } as const
  rows.sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(lcQ) ? 0 : 1
    const bStarts = b.name.toLowerCase().startsWith(lcQ) ? 0 : 1
    if (aStarts !== bStarts) return aStarts - bStarts
    const aType = typeOrder[a.type as keyof typeof typeOrder] ?? 9
    const bType = typeOrder[b.type as keyof typeof typeOrder] ?? 9
    if (aType !== bType) return aType - bType
    return a.name.localeCompare(b.name, 'pt-PT')
  })

  const top = rows.slice(0, limit)
  const parentIds = [...new Set(top.map((r) => r.parent_id).filter((x): x is string => !!x))]

  type ParentRow = { id: string; name: string }
  const sbParents = supabase as unknown as {
    from: (table: 'admin_areas') => {
      select: (cols: string) => {
        in: (col: string, vals: string[]) => Promise<{
          data: ParentRow[] | null
          error: { message: string } | null
        }>
      }
    }
  }

  let parentLabels = new Map<string, string>()
  if (parentIds.length > 0) {
    const { data: parents } = await sbParents
      .from('admin_areas')
      .select('id, name')
      .in('id', parentIds)
    parentLabels = new Map((parents ?? []).map((p) => [p.id, p.name]))
  }

  const enriched = top.map((r) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    parent_id: r.parent_id,
    parent_label: r.parent_id ? parentLabels.get(r.parent_id) ?? null : null,
  }))

  return NextResponse.json({ data: enriched })
}
