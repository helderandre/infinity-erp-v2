import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

/**
 * GET /api/admin-areas/[id]/hierarchy
 *
 * Devolve a cadeia administrativa completa para uma área (até 3 níveis):
 *   { distrito: string|null, concelho: string|null, freguesia: string|null,
 *     full_label: string }
 *
 * Útil para auto-preencher os 3 campos texto (`negocios.distrito/concelho/
 * freguesia`) quando o consultor escolhe uma freguesia ou concelho na
 * pesquisa de zonas — em vez de o consultor ter de copiar à mão.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission('leads')
  if (!auth.authorized) return auth.response

  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: 'id em falta' }, { status: 400 })
  }

  const supabase = await createClient()

  type AreaRow = {
    id: string
    type: 'distrito' | 'concelho' | 'freguesia'
    name: string
    parent_id: string | null
  }
  const sb = supabase as unknown as {
    from: (t: 'admin_areas') => {
      select: (c: string) => {
        eq: (c: string, v: string) => {
          maybeSingle: () => Promise<{ data: AreaRow | null; error: { message: string } | null }>
        }
      }
    }
  }

  // Walk up até 3 níveis (freguesia → concelho → distrito).
  let cursor: string | null = id
  const chain: AreaRow[] = []
  for (let i = 0; i < 3 && cursor; i += 1) {
    const { data, error } = await sb
      .from('admin_areas')
      .select('id, type, name, parent_id')
      .eq('id', cursor)
      .maybeSingle()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) break
    chain.push(data)
    cursor = data.parent_id
  }

  const byType: Record<string, string | null> = {
    distrito: null,
    concelho: null,
    freguesia: null,
  }
  for (const row of chain) {
    byType[row.type] = row.name
  }

  const fullLabel = [byType.freguesia, byType.concelho, byType.distrito]
    .filter(Boolean)
    .join(', ')

  return NextResponse.json({
    distrito: byType.distrito,
    concelho: byType.concelho,
    freguesia: byType.freguesia,
    full_label: fullLabel || null,
  })
}
