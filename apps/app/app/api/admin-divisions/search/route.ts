import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'

const VALID_TYPES = ['freguesia', 'concelho', 'distrito'] as const
type DivisionType = (typeof VALID_TYPES)[number]

interface SearchResult {
  id: string
  name: string
  type: DivisionType
  freguesia: string | null
  concelho: string | null
  distrito: string | null
}

/**
 * GET /api/admin-divisions/search?q=Sant&type=freguesia|concelho|distrito&limit=10
 *
 * Pesquisa prefix-match em `admin_areas` (Continental, seedada via
 * scripts/seed-admin-areas.ts).
 *
 * Para cada match devolve a hierarquia já resolvida (parent walk) — o
 * autocompleter usa isto para auto-preencher concelho/distrito quando
 * o utilizador escolhe uma freguesia, ou distrito quando escolhe um
 * concelho.
 *
 * Auth: qualquer utilizador autenticado (não é dado sensível).
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()
    const type = (searchParams.get('type') || 'freguesia') as DivisionType
    const limitRaw = parseInt(searchParams.get('limit') || '10', 10)
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 25) : 10

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    }
    if (q.length < 2) {
      return NextResponse.json([], { status: 200 })
    }

    // admin_areas é uma tabela de referência pública (divisão administrativa
    // continental). Usamos service-role client para evitar surpresas com RLS
    // (o resultado é o mesmo seja qual for o utilizador autenticado).
    const supabase = createAdminClient()

    // 1) Matches do tipo pedido. Prefix match dá melhores resultados que
    //    contains arbitrário porque o utilizador está a digitar do início.
    //    Usamos ilike `q%` mas também `% q%` para cobrir casos como
    //    "Santa Maria" quando alguém digita "Maria".
    const pattern = `%${q.replace(/[%_]/g, (c) => '\\' + c)}%`
    const { data: matches, error: matchErr } = await supabase
      .from('admin_areas')
      .select('id, name, type, parent_id')
      .eq('type', type)
      .ilike('name', pattern)
      .order('name', { ascending: true })
      .limit(limit)

    if (matchErr) {
      return NextResponse.json({ error: matchErr.message }, { status: 500 })
    }
    if (!matches || matches.length === 0) {
      return NextResponse.json([], { status: 200 })
    }

    // 2) Resolver pais (concelhos quando matches são freguesias; distritos
    //    quando matches são concelhos).
    const parentIds = Array.from(
      new Set(
        matches.map((m) => m.parent_id).filter((id): id is string => !!id)
      )
    )

    let parents: Array<{ id: string; name: string; type: string; parent_id: string | null }> = []
    if (parentIds.length > 0) {
      const { data: parentRows, error: parentErr } = await supabase
        .from('admin_areas')
        .select('id, name, type, parent_id')
        .in('id', parentIds)
      if (parentErr) {
        return NextResponse.json({ error: parentErr.message }, { status: 500 })
      }
      parents = parentRows || []
    }

    // 3) Resolver avós (distritos para freguesias).
    const grandparentIds = Array.from(
      new Set(
        parents.map((p) => p.parent_id).filter((id): id is string => !!id)
      )
    )

    let grandparents: Array<{ id: string; name: string }> = []
    if (grandparentIds.length > 0) {
      const { data: gpRows } = await supabase
        .from('admin_areas')
        .select('id, name')
        .in('id', grandparentIds)
      grandparents = gpRows || []
    }

    // 4) Hidratar respostas
    const results: SearchResult[] = matches.map((m) => {
      const parent = m.parent_id ? parents.find((p) => p.id === m.parent_id) : null
      const grandparent = parent?.parent_id
        ? grandparents.find((g) => g.id === parent.parent_id)
        : null

      let freguesia: string | null = null
      let concelho: string | null = null
      let distrito: string | null = null

      if (m.type === 'freguesia') {
        freguesia = m.name
        concelho = parent?.name ?? null
        distrito = grandparent?.name ?? null
      } else if (m.type === 'concelho') {
        concelho = m.name
        distrito = parent?.name ?? null
      } else if (m.type === 'distrito') {
        distrito = m.name
      }

      return {
        id: m.id,
        name: m.name,
        type: m.type as DivisionType,
        freguesia,
        concelho,
        distrito,
      }
    })

    return NextResponse.json(results, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    })
  } catch (error) {
    console.error('Erro ao pesquisar admin divisions:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
