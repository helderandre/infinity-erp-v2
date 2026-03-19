import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const SYSTEM_PROMPT = `Analisa este documento — um contrato de trabalho ou contrato de prestação de serviços de um consultor imobiliário.
Extrai os seguintes campos em JSON:
- contract_type: tipo de contrato (ex: "Contrato de Trabalho", "Prestação de Serviços", "Contrato de Agente", etc.)
- contract_start_date: data de início do contrato, formato YYYY-MM-DD
- contract_end_date: data de fim do contrato. Se sem termo ou indeterminado, usa "sem-termo". formato YYYY-MM-DD se tiver data
- hiring_date: data de admissão/contratação, formato YYYY-MM-DD
- monthly_salary: salário base mensal em euros (apenas número). null se não aplicável
- commission_rate: taxa/percentagem de comissão (apenas número). null se não visível
- full_name: nome completo do consultor no contrato
- nif: NIF do consultor (se visível)
- iban: IBAN do consultor (se visível)
- company_name: nome da empresa contratante (se visível)
- notes: condições especiais ou cláusulas relevantes (texto curto)

Retorna APENAS JSON válido, sem markdown. Se um campo não for visível ou aplicável, usa null.`

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Serviço de IA não configurado' }, { status: 503 })
    }

    const body = await request.json().catch(() => ({}))
    const docUrl = body.document_url
    if (!docUrl) {
      return NextResponse.json({ error: 'URL do documento não fornecida' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey })
    const isPdf = docUrl.toLowerCase().includes('.pdf')

    let userContent: any[]

    if (isPdf) {
      // Fetch PDF, convert to base64, send as data URI
      try {
        const fileRes = await fetch(docUrl)
        if (!fileRes.ok) throw new Error('Fetch failed')
        const buffer = await fileRes.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        userContent = [
          { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64}` } },
        ]
      } catch {
        return NextResponse.json({ error: 'Não foi possível aceder ao ficheiro' }, { status: 400 })
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
      max_tokens: 800,
      temperature: 0.1,
    })

    const text = completion.choices[0]?.message?.content || '{}'
    let result
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      result = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'Não foi possível extrair dados do contrato' }, { status: 422 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Erro ao analisar contrato:', error?.message || error)
    // If the model doesn't support PDF via data URI, suggest using an image
    const msg = String(error?.message || '')
    if (msg.includes('Could not process') || msg.includes('invalid_image') || msg.includes('Unsupported')) {
      return NextResponse.json({ error: 'O modelo não conseguiu processar este ficheiro. Tente carregar uma foto/scan (JPG, PNG) do contrato.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao analisar o documento.' }, { status: 500 })
  }
}
