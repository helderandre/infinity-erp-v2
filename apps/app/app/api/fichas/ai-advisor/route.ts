import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const property_id = searchParams.get('property_id')
    if (!property_id) return NextResponse.json({ error: 'property_id é obrigatório.' }, { status: 400 })

    const admin = createAdminClient() as any

    // Get property info
    const { data: property } = await admin
      .from('dev_properties')
      .select('title, listing_price, city, zone, property_type, status')
      .eq('id', property_id)
      .single()

    // Get all fichas
    const { data: fichas } = await admin
      .from('visit_fichas')
      .select('*')
      .eq('property_id', property_id)

    if (!fichas || fichas.length < 2) {
      return NextResponse.json({ data: { advice: 'São necessárias pelo menos 2 fichas de visita para gerar recomendações.', hasEnoughData: false } })
    }

    // Build data summary for GPT
    const ratingFields = [
      'rating_floorplan', 'rating_construction', 'rating_finishes',
      'rating_sun_exposition', 'rating_location', 'rating_value',
      'rating_overall', 'rating_agent_service',
    ]
    const ratingLabels: Record<string, string> = {
      rating_floorplan: 'Planta', rating_construction: 'Construção', rating_finishes: 'Acabamentos',
      rating_sun_exposition: 'Exposição Solar', rating_location: 'Localização', rating_value: 'Valor',
      rating_overall: 'Apreciação Global', rating_agent_service: 'Serviço do Agente',
    }

    const avgRatings: Record<string, number> = {}
    for (const field of ratingFields) {
      const vals = fichas.map((f: any) => f[field]).filter((v: any) => v != null) as number[]
      if (vals.length) avgRatings[ratingLabels[field]] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
    }

    const perceivedValues = fichas.map((f: any) => f.perceived_value).filter(Boolean) as number[]
    const avgPerceived = perceivedValues.length ? Math.round(perceivedValues.reduce((a, b) => a + b, 0) / perceivedValues.length) : null

    const wouldBuyYes = fichas.filter((f: any) => f.would_buy === true).length
    const wouldBuyNo = fichas.filter((f: any) => f.would_buy === false).length

    const likedMost = fichas.map((f: any) => f.liked_most).filter(Boolean)
    const likedLeast = fichas.map((f: any) => f.liked_least).filter(Boolean)
    const buyReasons = fichas.map((f: any) => f.would_buy_reason).filter(Boolean)

    const summary = `
Imóvel: ${property?.title || 'N/A'} — ${property?.city || ''} ${property?.zone || ''}
Preço pedido: ${property?.listing_price ? `${property.listing_price}€` : 'N/A'}
Total de fichas: ${fichas.length}

Médias de avaliação (1-5):
${Object.entries(avgRatings).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

Compraria: ${wouldBuyYes} sim, ${wouldBuyNo} não (de ${wouldBuyYes + wouldBuyNo} respostas)
Valor médio percebido: ${avgPerceived ? `${avgPerceived}€` : 'N/A'}

O que mais gostaram:
${likedMost.map((t: string) => `- "${t}"`).join('\n') || '(sem respostas)'}

O que menos gostaram:
${likedLeast.map((t: string) => `- "${t}"`).join('\n') || '(sem respostas)'}

Razões para comprar/não comprar:
${buyReasons.map((t: string) => `- "${t}"`).join('\n') || '(sem respostas)'}
`.trim()

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `És um consultor imobiliário experiente em Portugal. Analisa as fichas de visita de um imóvel e dá conselhos PRÁTICOS e ACCIONÁVEIS ao agente.

Estrutura a resposta em 3 secções:
1. **Pontos Fortes** — O que destacar nos anúncios e visitas
2. **Pontos a Melhorar** — O que sugerir ao proprietário ou como ajustar a estratégia
3. **Recomendação de Preço** — Se o valor percebido diverge do preço pedido, sugere ajustes

Sê directo, conciso e em Português de Portugal. Usa bullet points. Não repitas os dados — analisa e aconselha.`,
        },
        { role: 'user', content: summary },
      ],
      max_tokens: 1500,
      temperature: 0.7,
    })

    const advice = response.choices[0]?.message?.content || 'Não foi possível gerar recomendações.'

    return NextResponse.json({ data: { advice, hasEnoughData: true, fichaCount: fichas.length } })
  } catch (err) {
    console.error('[fichas/ai-advisor GET]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
