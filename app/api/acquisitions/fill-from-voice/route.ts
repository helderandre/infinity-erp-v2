import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Serviço de IA não configurado' },
        { status: 503 }
      )
    }

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { text } = body as { text: string }

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Texto em falta' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey })

    const systemPrompt = `Extrai dados estruturados do seguinte texto livre sobre uma angariação imobiliária.
O texto descreve um imóvel que está a ser angariado para venda.

Campos possíveis (usa apenas os que conseguires detectar):
- title: string (título descritivo do imóvel, ex: "Apartamento T2 em Lisboa")
- property_type: string (Apartamento, Moradia, Terreno, Loja, Escritório, Armazém, Prédio, Quinta, etc.)
- listing_price: number (preço de venda em euros)
- description: string (descrição do imóvel)
- property_condition: string (new, used, under_construction, to_renovate, renovated, ruin)
- energy_certificate: string (A+, A, B, B-, C, D, E, F, Isento)
- city: string (cidade)
- zone: string (zona/região)
- address_street: string (morada/rua)
- address_parish: string (freguesia)
- postal_code: string (código postal)
- bedrooms: number (quartos)
- bathrooms: number (casas de banho)
- area_util: number (área útil m²)
- area_gross: number (área bruta m²)
- construction_year: number (ano de construção)
- parking_spaces: number (estacionamentos)
- garage_spaces: number (garagens)
- typology: string (T0, T1, T2, T3, etc.)
- has_elevator: boolean (tem elevador)
- features: string[] (características: Piscina, Varanda, Jardim, Terraço, etc.)
- contract_regime: string (exclusivo, aberto, partilhado)
- commission_agreed: number (comissão acordada em percentagem)

Retorna APENAS um JSON plano (flat) com os campos detectados.
Valores numéricos devem ser números puros (sem € ou m²).
Não incluas campos que não foram mencionados no texto.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      max_tokens: 500,
      temperature: 0.2,
    })

    const responseText = completion.choices[0]?.message?.content || '{}'

    let result: Record<string, unknown>
    try {
      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      result = JSON.parse(cleaned)
    } catch {
      return NextResponse.json(
        { error: 'Não foi possível extrair dados do texto' },
        { status: 422 }
      )
    }

    // Reorganize specs fields into specifications object for the form
    const specFields = ['bedrooms', 'bathrooms', 'area_util', 'area_gross', 'construction_year', 'parking_spaces', 'garage_spaces', 'typology', 'has_elevator', 'features']
    const specs: Record<string, unknown> = {}
    const formFields: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(result)) {
      if (specFields.includes(key)) {
        specs[key] = value
      } else {
        formFields[key] = value
      }
    }

    if (Object.keys(specs).length > 0) {
      formFields.specifications = specs
    }

    return NextResponse.json(formFields)
  } catch (error) {
    console.error('Erro ao extrair dados:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
