import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const SYSTEM_PROMPT = `Analisa a imagem de um documento de identificação português (CC, Passaporte, BI ou Autorização de Residência).
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

Retorna APENAS JSON válido, sem markdown. Se um campo não for visível, usa null.`

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient() as any

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Serviço de IA não configurado' }, { status: 503 })
    }

    const body = await request.json().catch(() => ({}))
    let docUrl = body.document_url

    if (!docUrl) {
      const { data: priv } = await supabase
        .from('dev_consultant_private_data')
        .select('id_doc_file_url')
        .eq('user_id', id)
        .single()
      docUrl = priv?.id_doc_file_url
    }

    if (!docUrl) {
      return NextResponse.json({ error: 'Nenhum documento de identificação encontrado' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey })
    const isPdf = docUrl.toLowerCase().includes('.pdf')

    let userContent: OpenAI.Chat.ChatCompletionContentPart[]

    if (isPdf) {
      try {
        const fileRes = await fetch(docUrl)
        if (!fileRes.ok) throw new Error('Fetch failed')
        const buffer = await fileRes.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        userContent = [
          { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64}` } } as any,
        ]
      } catch {
        return NextResponse.json({ error: 'Não foi possível aceder ao ficheiro PDF' }, { status: 400 })
      }
    } else {
      userContent = [
        { type: 'image_url', image_url: { url: docUrl, detail: 'high' } },
      ]
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      max_tokens: 500,
      temperature: 0.1,
    })

    const text = completion.choices[0]?.message?.content || '{}'
    let result
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      result = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'Não foi possível extrair dados do documento' }, { status: 422 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Erro ao analisar documento:', error?.message || error)
    return NextResponse.json(
      { error: error?.message || 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
