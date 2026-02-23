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

    // Buscar URLs do documento
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('documento_identificacao_url, documento_identificacao_frente_url, documento_identificacao_verso_url')
      .eq('id', id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
    }

    const docUrl = lead.documento_identificacao_frente_url || lead.documento_identificacao_url
    if (!docUrl) {
      return NextResponse.json(
        { error: 'Nenhum documento de identificação encontrado' },
        { status: 400 }
      )
    }

    const openai = new OpenAI({ apiKey })

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `Analisa a imagem de um documento de identificação português (CC, Passaporte, BI ou Autorização de Residência).
Extrai os seguintes campos em JSON:
- tipo_documento: "Cartão de Cidadão" | "Passaporte" | "Bilhete de Identidade" | "Autorização de Residência"
- numero_documento: número do documento
- full_name: nome completo
- nif: NIF (se visível)
- data_nascimento: formato YYYY-MM-DD
- data_validade_documento: formato YYYY-MM-DD
- nacionalidade: nacionalidade
- pais_emissor: país emissor
- genero: "Masculino" ou "Feminino"

Retorna APENAS JSON válido, sem markdown. Se um campo não for visível, usa null.`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: docUrl, detail: 'high' },
          },
        ],
      },
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 500,
      temperature: 0.1,
    })

    const text = completion.choices[0]?.message?.content || '{}'

    // Tentar fazer parse do JSON
    let result
    try {
      // Remover possivel markdown
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      result = JSON.parse(cleaned)
    } catch {
      return NextResponse.json(
        { error: 'Não foi possível extrair dados do documento' },
        { status: 422 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao analisar documento:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
