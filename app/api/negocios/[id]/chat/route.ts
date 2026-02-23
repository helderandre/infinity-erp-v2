import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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
    const { messages } = body as { messages: { role: string; content: string }[] }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Mensagens em falta' }, { status: 400 })
    }

    // Buscar dados actuais do negocio
    const { data: negocio, error: negError } = await supabase
      .from('negocios')
      .select('*, lead:leads(nome)')
      .eq('id', id)
      .single()

    if (negError || !negocio) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
    }

    // Construir system prompt com campos preenchidos vs em falta
    const filledFields: string[] = []
    const missingFields: string[] = []

    const fieldLabels: Record<string, string> = {
      tipo_imovel: 'Tipo de imóvel',
      localizacao: 'Localização',
      orcamento: 'Orçamento mínimo',
      orcamento_max: 'Orçamento máximo',
      quartos_min: 'Quartos mínimos',
      area_min_m2: 'Área mínima',
      motivacao_compra: 'Motivação',
      prazo_compra: 'Prazo',
      preco_venda: 'Preço de venda',
      renda_max_mensal: 'Renda máxima',
      renda_pretendida: 'Renda pretendida',
      estado_imovel: 'Estado do imóvel',
    }

    const negocioRecord = negocio as Record<string, unknown>
    for (const [key, label] of Object.entries(fieldLabels)) {
      if (negocioRecord[key] !== null && negocioRecord[key] !== undefined) {
        filledFields.push(`${label}: ${negocioRecord[key]}`)
      } else {
        missingFields.push(label)
      }
    }

    const leadName = (negocio.lead as { nome: string } | null)?.nome || 'o cliente'

    const systemPrompt = `És um assistente imobiliário que ajuda a preencher os dados de um negócio de ${negocio.tipo} para ${leadName}.

Campos já preenchidos:
${filledFields.length > 0 ? filledFields.join('\n') : '(nenhum)'}

Campos em falta:
${missingFields.length > 0 ? missingFields.join('\n') : '(todos preenchidos)'}

Faz perguntas naturais ao utilizador para preencher os campos em falta. Quando o utilizador responde, extrai os dados e retorna em JSON:
{"reply": "a tua resposta conversacional", "fields": {"campo": valor}}

Os fields devem usar as chaves exactas da base de dados (ex: orcamento, orcamento_max, tipo_imovel, etc).
Valores numéricos devem ser números (sem €, sem m²).
Retorna APENAS JSON válido, sem markdown.`

    const openai = new OpenAI({ apiKey })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
      max_tokens: 300,
      temperature: 0.3,
    })

    const text = completion.choices[0]?.message?.content || ''

    let result
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      result = JSON.parse(cleaned)
    } catch {
      result = { reply: text, fields: {} }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro no chat:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
