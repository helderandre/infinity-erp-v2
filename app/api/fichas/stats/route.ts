import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { RATING_FIELDS } from '@/types/visit-ficha'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const property_id = searchParams.get('property_id')
    if (!property_id) return NextResponse.json({ error: 'property_id é obrigatório.' }, { status: 400 })

    const admin = createAdminClient() as any
    const { data: fichas, error } = await admin
      .from('visit_fichas')
      .select('*')
      .eq('property_id', property_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!fichas || fichas.length === 0) {
      return NextResponse.json({ data: { totalFichas: 0, avgRatings: {}, wouldBuyPct: 0, avgPerceivedValue: null, hasPropertyToSellPct: 0, discoveryBreakdown: {}, sourceBreakdown: {} } })
    }

    // Calculate average ratings
    const avgRatings: Record<string, number> = {}
    for (const field of RATING_FIELDS) {
      const values = fichas.map((f: any) => f[field.key]).filter((v: any) => v !== null && v !== undefined) as number[]
      if (values.length > 0) {
        avgRatings[field.key] = Math.round((values.reduce((a: number, b: number) => a + b, 0) / values.length) * 10) / 10
      }
    }

    // Would buy percentage
    const wouldBuyResponses = fichas.filter((f: any) => f.would_buy !== null)
    const wouldBuyPct = wouldBuyResponses.length > 0
      ? Math.round((wouldBuyResponses.filter((f: any) => f.would_buy).length / wouldBuyResponses.length) * 100)
      : 0

    // Average perceived value
    const perceivedValues = fichas.map((f: any) => f.perceived_value).filter((v: any) => v !== null) as number[]
    const avgPerceivedValue = perceivedValues.length > 0
      ? Math.round(perceivedValues.reduce((a: number, b: number) => a + b, 0) / perceivedValues.length)
      : null

    // Has property to sell
    const sellResponses = fichas.filter((f: any) => f.has_property_to_sell !== null)
    const hasPropertyToSellPct = sellResponses.length > 0
      ? Math.round((sellResponses.filter((f: any) => f.has_property_to_sell).length / sellResponses.length) * 100)
      : 0

    // Discovery source breakdown
    const discoveryBreakdown: Record<string, number> = {}
    for (const f of fichas) {
      if (f.discovery_source) {
        discoveryBreakdown[f.discovery_source] = (discoveryBreakdown[f.discovery_source] || 0) + 1
      }
    }

    // Source breakdown
    const sourceBreakdown: Record<string, number> = {}
    for (const f of fichas) {
      sourceBreakdown[f.source] = (sourceBreakdown[f.source] || 0) + 1
    }

    return NextResponse.json({
      data: {
        totalFichas: fichas.length,
        avgRatings,
        wouldBuyPct,
        avgPerceivedValue,
        hasPropertyToSellPct,
        discoveryBreakdown,
        sourceBreakdown,
      }
    })
  } catch (err) {
    console.error('[fichas/stats GET]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
