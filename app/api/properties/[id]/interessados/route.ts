import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Asymmetric type-compatibility map.
// Key = buyer's `tipo_imovel`. Value = additional property types this buyer
// would reasonably accept (beyond an exact-string match, which is always allowed).
//
// Direction matters: an apartment seeker is often open to moradias, but a
// moradia seeker rarely wants an apartment.
const TYPE_ACCEPTS: Record<string, string[]> = {
  apartamento: ['moradia', 'duplex', 'loft'],
  duplex: ['apartamento', 'moradia'],
  loft: ['apartamento'],
  moradia: ['moradia geminada', 'moradia banda', 'quinta'],
  loja: ['armazem'],
  armazem: ['loja'],
}

// GET — list all interested buyers for this property (reverse lookup on negocio_properties)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient() as any

    // 1) Get buyers who have this property in their negocio_properties
    const { data: links, error: linksErr } = await supabase
      .from('negocio_properties')
      .select(`
        id, status, sent_at, visited_at, notes, created_at, updated_at,
        negocio:negocios!inner(
          id, tipo, estado, orcamento, orcamento_max, localizacao, observacoes, assigned_consultant_id, tipo_imovel, quartos_min,
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

    // 2) Also find matching buyer negócios that could be interested (not yet linked)
    // Get property details for matching
    const { data: property } = await supabase
      .from('dev_properties')
      .select('listing_price, property_type, city, zone')
      .eq('id', id)
      .single()

    // 2) Find matching buyer negócios — same filters as leads property-matches but reversed
    let suggestions: any[] = []
    if (property) {
      const linkedNegocioIds = (links || []).map((l: any) => l.negocio?.id).filter(Boolean)
      const price = Number(property.listing_price) || 0

      let query = supabase
        .from('negocios')
        .select(`
          id, tipo, estado, orcamento, orcamento_max, localizacao, quartos_min, tipo_imovel, observacoes, assigned_consultant_id,
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
        .in('tipo', ['Compra', 'Compra e Venda'])
        // Exclude only terminal states; everything else is a candidate
        .not('estado', 'in', '("Fechado","Cancelado","Perdido")')
        .limit(100)

      // Exclude already linked
      if (linkedNegocioIds.length > 0) {
        query = query.not('id', 'in', `(${linkedNegocioIds.join(',')})`)
      }

      const { data: candidates, error: candErr } = await query
      if (candErr) console.error('Erro a buscar candidatos:', candErr)

      if (candidates) {
        const propType = (property.property_type || '').toLowerCase()
        const propCity = (property.city || '').toLowerCase()
        const propZone = (property.zone || '').toLowerCase()

        const scored = (candidates as any[]).map((n) => {
          let score = 0
          let typeOk: 'exact' | 'compatible' | 'mismatch' | 'unknown' = 'unknown'
          let locOk: 'match' | 'mismatch' | 'unknown' = 'unknown'
          let budgetOk: 'match' | 'mismatch' | 'unknown' = 'unknown'

          const buyerType = (n.tipo_imovel || '').toLowerCase()
          const buyerLoc = (n.localizacao || '').toLowerCase()
          const budget = Number(n.orcamento_max || n.orcamento) || 0

          // Type matching
          // 1. exact: strings overlap (e.g. "apartamento" includes "apartamento") → +30
          // 2. compatible: asymmetric map says this buyer would accept this property type → +15
          // 3. mismatch: explicit excluder
          if (propType && buyerType) {
            if (buyerType.includes(propType) || propType.includes(buyerType)) {
              typeOk = 'exact'; score += 30
            } else {
              const accepted = TYPE_ACCEPTS[buyerType] || []
              if (accepted.some((t) => propType.includes(t))) {
                typeOk = 'compatible'; score += 15
              } else {
                typeOk = 'mismatch'
              }
            }
          }

          // Location — only "match" if buyer location contains city or zone
          if (buyerLoc && (propCity || propZone)) {
            const cityHit = propCity && buyerLoc.includes(propCity)
            const zoneHit = propZone && buyerLoc.includes(propZone)
            if (cityHit || zoneHit) {
              locOk = 'match'
              if (cityHit) score += 30
              if (zoneHit) score += 20
            } else {
              locOk = 'mismatch'
            }
          }

          // Budget vs price
          let price_flag: string | null = null
          if (budget && price) {
            const ratio = price / budget
            if (ratio <= 1.05) { price_flag = 'green'; budgetOk = 'match'; score += 30 }
            else if (ratio <= 1.15) { price_flag = 'yellow'; budgetOk = 'match'; score += 20 }
            else if (ratio <= 1.25) { price_flag = 'orange'; budgetOk = 'match'; score += 10 }
            else { price_flag = 'red'; budgetOk = 'mismatch' }
          }

          return { ...n, price_flag, type_match: typeOk, _score: score, _typeOk: typeOk, _locOk: locOk, _budgetOk: budgetOk }
        })

        suggestions = scored
          .filter((n) => {
            // Hard exclusions: any explicit mismatch on type, location or budget kills the match.
            if (n._typeOk === 'mismatch') return false
            if (n._locOk === 'mismatch') return false
            if (n._budgetOk === 'mismatch') return false
            // Require at least one positive signal — "all unknown" is not a match
            const typePositive = n._typeOk === 'exact' || n._typeOk === 'compatible'
            return typePositive || n._locOk === 'match' || n._budgetOk === 'match'
          })
          .sort((a, b) => b._score - a._score)
          .slice(0, 25)
          .map(({ _score, _typeOk, _locOk, _budgetOk, ...rest }) => rest)
      }
    }

    return NextResponse.json({
      linked: links || [],
      suggestions: suggestions || [],
    })
  } catch (error) {
    console.error('Erro ao listar interessados:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — add an interested buyer (link a negocio to this property)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient() as any
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
