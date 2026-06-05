import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Serviço de IA não configurado' }, { status: 503 })
    }

    const body = await request.json()
    const { text } = body as { text?: string }

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Texto em falta' }, { status: 400 })
    }

    // Load consultants so the AI can match a spoken name to a UUID.
    const supabase = await createClient()
    const { data: consultants } = await supabase
      .from('dev_users')
      .select('id, commercial_name')
      .eq('is_active', true)
      .order('commercial_name')

    const roster = (consultants ?? [])
      .map((c) => `- ${c.id} :: ${c.commercial_name}`)
      .join('\n') || '(sem consultores)'

    const currentYear = new Date().getFullYear()

    const systemPrompt = `Extrai dados estruturados do seguinte texto livre sobre o objetivo anual de um consultor imobiliário. Responde apenas com um objecto JSON plano contendo os campos detectados.

Campos possíveis (usa apenas os que conseguires detectar — não inventes valores):
- consultant_id: UUID do consultor. Faz matching fuzzy do nome mencionado contra a lista abaixo e devolve o UUID correspondente. Se não conseguires fazer match com confiança, NÃO incluas o campo.
- year: number (ano do objetivo; se não for mencionado, assume ${currentYear})
- annual_revenue_target: number (facturação anual em euros; "150 mil" → 150000, "1.5M" → 1500000)
- pct_sellers: number (percentagem da facturação proveniente de vendedores/angariações, 0-100)
- pct_buyers: number (percentagem proveniente de compradores, 0-100)
- working_weeks_year: number (semanas de trabalho por ano, tipicamente 46-48)
- working_days_week: number (dias por semana, tipicamente 5)
- sellers_avg_sale_value: number (valor médio de venda de uma angariação em euros)
- sellers_avg_commission_pct: number (percentagem média de comissão em angariações, 0-100)
- sellers_pct_listings_sold: number (percentagem de angariações que vendem, 0-100)
- sellers_pct_visit_to_listing: number (percentagem de visitas que convertem em angariação, 0-100)
- sellers_pct_lead_to_visit: number (percentagem de leads que convertem em visita, 0-100)
- sellers_avg_calls_per_lead: number (média de chamadas por lead)
- buyers_avg_purchase_value: number (valor médio de compra em euros)
- buyers_avg_commission_pct: number (percentagem média de comissão em compras, 0-100)
- buyers_close_rate: number (taxa de fecho, 0-100)
- buyers_pct_lead_to_qualified: number (percentagem de leads qualificados, 0-100)
- buyers_avg_calls_per_lead: number (média de chamadas por lead)

Lista de consultores disponíveis (UUID :: nome comercial):
${roster}

Regras:
- Valores numéricos devem ser números puros (sem €, %, "mil"). Converte unidades para a base (mil → *1000, milhão → *1000000).
- Percentagens devem ser 0-100 (não 0-1).
- Se pct_sellers for dito e pct_buyers não, calcula pct_buyers = 100 - pct_sellers.
- Responde APENAS com o objecto JSON, sem texto à volta nem \`\`\`.`

    const openai = new OpenAI({ apiKey })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      max_tokens: 400,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    })

    const raw = completion.choices[0]?.message?.content || '{}'

    let result: Record<string, unknown>
    try {
      result = JSON.parse(raw)
    } catch {
      return NextResponse.json(
        { error: 'Não foi possível extrair dados do texto' },
        { status: 422 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao extrair objetivo do texto:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
