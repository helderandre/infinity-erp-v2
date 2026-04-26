import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { computeFlexibleBadges, isStrictPass } from '@/lib/matching'
import type { GeoSource } from '@/lib/matching'

// GET — list interested buyers for this property
//
// Devolve { linked, suggestions }:
//   - linked      → negócios já ligados via negocio_properties (mantido legacy shape)
//   - suggestions → negócios candidatos via match_negocios_for_property (novo motor)
//
// Query params:
//   ?strict=true → exclui sugestões com badges warning
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const strict = url.searchParams.get('strict') === 'true'
    const supabaseRaw = await createClient()
    const supabase = supabaseRaw as unknown as {
      from: (table: string) => any
      rpc: (fn: string, args: Record<string, unknown>) => Promise<any>
    }

    // 1) Buyers já ligados a este imóvel (negocio_properties)
    const { data: links, error: linksErr } = await supabase
      .from('negocio_properties')
      .select(`
        id, status, sent_at, visited_at, notes, created_at, updated_at,
        negocio:negocios!inner(
          id, tipo, estado, orcamento, orcamento_max, localizacao, observacoes,
          assigned_consultant_id, tipo_imovel, quartos_min,
          lead:leads!inner(
            id, nome, email, telemovel, agent_id,
            agent:dev_users!leads_agent_id_fkey(id, commercial_name, professional_email,
              profile:dev_consultant_profiles(phone_commercial)
            )
          ),
          consultant:dev_users!negocios_assigned_consultant_id_fkey(id, commercial_name, professional_email,
            profile:dev_consultant_profiles(phone_commercial)
          )
        )
      `)
      .eq('property_id', id)
      .order('created_at', { ascending: false })

    if (linksErr) {
      console.error('Erro a buscar links interessados:', linksErr)
      return NextResponse.json({ error: linksErr.message }, { status: 500 })
    }

    const linkedNegocioIds: string[] = (links ?? [])
      .map((l: { negocio?: { id?: string } | null }) => l.negocio?.id)
      .filter((x: unknown): x is string => typeof x === 'string')

    // 2) Aplica bloqueantes via SQL function
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'match_negocios_for_property',
      { p_property_id: id }
    )

    if (rpcError) {
      console.error('Erro RPC match_negocios_for_property:', rpcError)
      return NextResponse.json({
        linked: links ?? [],
        suggestions: [],
      })
    }

    const matched: Array<{ negocio_id: string; geo_source: GeoSource }> = rpcResult ?? []
    const candidateIds = matched
      .map((m) => m.negocio_id)
      .filter((nid) => !linkedNegocioIds.includes(nid))

    if (candidateIds.length === 0) {
      return NextResponse.json({ linked: links ?? [], suggestions: [] })
    }

    const geoSourceMap = new Map(matched.map((m) => [m.negocio_id, m.geo_source]))

    // 3) Hidratar negócios + property para badges
    const [negociosRes, propertyRes] = await Promise.all([
      supabase
        .from('negocios')
        .select(`
          id, tipo, estado, orcamento, orcamento_max, localizacao, observacoes,
          assigned_consultant_id, tipo_imovel, quartos_min, area_min_m2, estado_imovel,
          tem_garagem, tem_estacionamento, tem_elevador, tem_piscina,
          tem_varanda, tem_arrumos, tem_exterior, tem_porteiro,
          lead:leads!inner(
            id, nome, email, telemovel, agent_id,
            agent:dev_users!leads_agent_id_fkey(id, commercial_name, professional_email,
              profile:dev_consultant_profiles(phone_commercial)
            )
          ),
          consultant:dev_users!negocios_assigned_consultant_id_fkey(id, commercial_name, professional_email,
            profile:dev_consultant_profiles(phone_commercial)
          )
        `)
        .in('id', candidateIds),
      supabase
        .from('dev_properties')
        .select('id, listing_price, property_type, property_condition, dev_property_specifications(area_util, area_gross, bedrooms, bathrooms, has_elevator, garage_spaces, parking_spaces, balcony_area, pool_area, attic_area, pantry_area, features, equipment)')
        .eq('id', id)
        .single(),
    ])

    if (negociosRes.error) {
      console.error('Erro a hidratar negócios:', negociosRes.error)
      return NextResponse.json({ linked: links ?? [], suggestions: [] })
    }

    const property = propertyRes.data
    const propertyForBadges = property
      ? {
          property_condition: property.property_condition,
          specifications: Array.isArray(property.dev_property_specifications)
            ? property.dev_property_specifications[0] ?? null
            : property.dev_property_specifications ?? null,
        }
      : { property_condition: null, specifications: null }

    type NegocioCandidate = {
      id: string
      orcamento: number | null
      orcamento_max: number | null
      area_min_m2: number | null
      estado_imovel: string | null
      tem_garagem: boolean | null
      tem_estacionamento: boolean | null
      tem_elevador: boolean | null
      tem_piscina: boolean | null
      tem_varanda: boolean | null
      tem_arrumos: boolean | null
      tem_exterior: boolean | null
      tem_porteiro: boolean | null
      [key: string]: unknown
    }

    const candidates = (negociosRes.data ?? []) as NegocioCandidate[]
    const propPrice = Number(property?.listing_price) || 0

    // Carregar negocio_properties já existentes para este imóvel + estes negocios,
    // para podermos surfacear `last_sent_at` em cada cartão (evita reenvios por engano).
    const { data: existingLinks } = await supabase
      .from('negocio_properties')
      .select('negocio_id, sent_at, status')
      .eq('property_id', id)
      .in('negocio_id', candidateIds)
    const sentMap = new Map<string, string | null>()
    for (const l of (existingLinks ?? []) as Array<{
      negocio_id: string
      sent_at: string | null
      status: string | null
    }>) {
      sentMap.set(l.negocio_id, l.sent_at)
    }

    const enriched = candidates.map((n) => {
      const geoSource = geoSourceMap.get(n.id) ?? 'no_filter'

      const badges = computeFlexibleBadges(
        {
          area_min_m2: n.area_min_m2,
          estado_imovel: n.estado_imovel,
          tem_garagem: n.tem_garagem,
          tem_estacionamento: n.tem_estacionamento,
          tem_elevador: n.tem_elevador,
          tem_piscina: n.tem_piscina,
          tem_varanda: n.tem_varanda,
          tem_arrumos: n.tem_arrumos,
          tem_exterior: n.tem_exterior,
          tem_porteiro: n.tem_porteiro,
        },
        propertyForBadges,
        geoSource
      )

      // price flag (mantém compatibilidade com UI existente)
      let price_flag: 'green' | 'yellow' | 'orange' | 'red' | null = null
      const budget = Number(n.orcamento_max ?? n.orcamento) || 0
      if (budget && propPrice) {
        const ratio = propPrice / budget
        if (ratio <= 1.0) price_flag = 'green'
        else if (ratio <= 1.05) price_flag = 'green'
        else if (ratio <= 1.15) price_flag = 'yellow'
        else if (ratio <= 1.25) price_flag = 'orange'
        else price_flag = 'red'
      }

      // Emitir warnings de orçamento — assim strict mode (que filtra warnings)
      // exclui automaticamente leads sem orçamento definido OU com orçamento
      // que não encaixa (yellow/orange/red).
      // Princípio: "missing info" não é assumido como "qualquer preço" — fica
      // explicitamente fora do match estrito.
      if (!budget) {
        badges.push({
          type: 'warning',
          key: 'orcamento_missing',
          label: 'Sem orçamento definido',
        })
      } else if (propPrice && (price_flag === 'yellow' || price_flag === 'orange' || price_flag === 'red')) {
        badges.push({
          type: 'warning',
          key: 'orcamento_off',
          label:
            price_flag === 'yellow' ? 'Orçamento ligeiramente abaixo' :
            price_flag === 'orange' ? 'Orçamento abaixo' :
            'Muito acima do orçamento',
        })
      }

      return {
        ...n,
        price_flag,
        geo_source: geoSource,
        badges,
        last_sent_at: sentMap.get(n.id) ?? null,
        // mantém compat com UI antigo:
        type_match: 'exact' as const,
      }
    })

    const suggestions = enriched
      .filter((n) => (strict ? isStrictPass(n.badges) : true))
      .sort((a, b) => {
        const aWarnings = a.badges.filter((b) => b.type === 'warning').length
        const bWarnings = b.badges.filter((b) => b.type === 'warning').length
        if (aWarnings !== bWarnings) return aWarnings - bWarnings
        // budget proximity (lower price/budget ratio = better fit) as tie-breaker
        const aRatio =
          propPrice && (a.orcamento_max ?? a.orcamento)
            ? propPrice / Number(a.orcamento_max ?? a.orcamento)
            : 999
        const bRatio =
          propPrice && (b.orcamento_max ?? b.orcamento)
            ? propPrice / Number(b.orcamento_max ?? b.orcamento)
            : 999
        return aRatio - bRatio
      })
      .slice(0, 50)

    return NextResponse.json({ linked: links ?? [], suggestions })
  } catch (error) {
    console.error('Erro ao listar interessados:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — link a buyer (negocio) to this property
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabaseRaw = await createClient()
    const supabase = supabaseRaw as unknown as {
      from: (table: string) => {
        insert: (row: Record<string, unknown>) => {
          select: () => { single: () => Promise<{ data: unknown; error: { message: string } | null }> }
        }
      }
    }
    const body = await request.json()

    const { data, error } = await supabase
      .from('negocio_properties')
      .insert({
        property_id: id,
        negocio_id: body.negocio_id,
        status: body.status || 'suggested',
        notes: body.notes || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao adicionar interessado:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
