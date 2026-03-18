import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
          id, tipo, estado, orcamento, localizacao, observacoes,
          lead:leads!inner(id, nome, name, email, telemovel, phone_primary),
          agent:dev_users!negocios_agent_id_fkey(id, commercial_name, professional_email),
          agent_profile:dev_consultant_profiles!negocios_agent_id_fkey(phone_commercial)
        )
      `)
      .eq('property_id', id)
      .order('created_at', { ascending: false })

    if (linksErr) return NextResponse.json({ error: linksErr.message }, { status: 500 })

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
          id, tipo, estado, orcamento, orcamento_max, localizacao, quartos_min, tipo_imovel, observacoes,
          lead:leads!inner(id, nome, name, email, telemovel, phone_primary),
          agent:dev_users!negocios_agent_id_fkey(id, commercial_name, professional_email),
          agent_profile:dev_consultant_profiles!negocios_agent_id_fkey(phone_commercial)
        `)
        .in('tipo', ['Compra', 'Compra e Venda'])
        .in('estado', ['activo', 'em_negociacao', 'Aberto', 'Em Acompanhamento', 'Em progresso'])
        .limit(50)

      // Filter by property type (same as leads matching: ilike)
      if (property.property_type) {
        query = query.ilike('tipo_imovel', `%${property.property_type}%`)
      }

      // Filter by price range — same logic as leads: budget * 0.7 to budget * 1.25
      // Reversed: property price must be between buyer's budget*0.7 and budget*1.25
      // So: buyer's budget must be >= price * 0.8 (price/1.25) and <= price * 1.43 (price/0.7)
      if (price > 0) {
        query = query.gte('orcamento', Math.round(price * 0.8))
      }

      // Filter by location (same as leads: city/zone ilike OR)
      if (property.city || property.zone) {
        const locationParts: string[] = []
        if (property.city) locationParts.push(`localizacao.ilike.%${property.city}%`)
        if (property.zone) locationParts.push(`localizacao.ilike.%${property.zone}%`)
        if (locationParts.length > 0) {
          query = query.or(locationParts.join(','))
        }
      }

      // Exclude already linked
      if (linkedNegocioIds.length > 0) {
        query = query.not('id', 'in', `(${linkedNegocioIds.join(',')})`)
      }

      const { data: candidates } = await query

      if (candidates) {
        // Add price flags — same scale as leads matching
        suggestions = (candidates as any[]).map(n => {
          const budget = Number(n.orcamento_max || n.orcamento) || 0
          let price_flag: string | null = null
          if (budget && price) {
            const ratio = price / budget
            if (ratio <= 1.0) price_flag = 'green'
            else if (ratio <= 1.05) price_flag = 'green'
            else if (ratio <= 1.15) price_flag = 'yellow'
            else if (ratio <= 1.25) price_flag = 'orange'
            else price_flag = 'red'
          }
          return { ...n, price_flag }
        })
        .sort((a, b) => {
          // Sort: green first, then yellow, orange, red
          const flagOrder: Record<string, number> = { green: 0, yellow: 1, orange: 2, red: 3 }
          return (flagOrder[a.price_flag || 'red'] || 3) - (flagOrder[b.price_flag || 'red'] || 3)
        })
        .slice(0, 15)
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
