import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { requireAuth } from '@/lib/auth/permissions'

// POST /api/deals/fill-from-proposal — Extract deal data from uploaded proposal PDF/image
export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Serviço de IA não configurado' }, { status: 503 })
    }

    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const body = await request.json()
    const { file_url } = body as { file_url: string }

    if (!file_url) {
      return NextResponse.json({ error: 'URL do ficheiro em falta' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey })
    const isPdf = file_url.toLowerCase().includes('.pdf')

    let userContent: OpenAI.Chat.ChatCompletionContentPart[]
    if (isPdf) {
      try {
        const fileRes = await fetch(file_url)
        if (!fileRes.ok) throw new Error('Fetch failed')
        const buffer = await fileRes.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        userContent = [
          { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64}` } } as any,
        ]
      } catch {
        return NextResponse.json({ error: 'Não foi possível aceder ao ficheiro' }, { status: 400 })
      }
    } else {
      userContent = [
        { type: 'image_url', image_url: { url: file_url, detail: 'high' } },
      ]
    }

    // Prompt is form-field-driven: we tell GPT what the form needs,
    // not what the document structure is. GPT finds matching data.
    const systemPrompt = `Estás a ajudar a preencher um formulário de fecho de negócio imobiliário.
O utilizador fez upload de um documento (proposta, contrato, email, ou outro) que pode conter informação relevante.

Analisa o documento e tenta encontrar dados que correspondam aos seguintes campos do formulário.
Retorna APENAS os campos para os quais encontraste informação clara e concreta no documento.
NÃO inventes, NÃO assumas, NÃO extrapoles. Se não encontras um valor claro, omite o campo.

Campos do formulário (usa exactamente estas chaves no JSON):

TIPO DE NEGÓCIO:
- business_type: "venda" | "arrendamento" | "trespasse" (detectar a partir do tipo de documento/transacção)

VALORES:
- deal_value: number (preço de venda, valor da renda, ou valor do trespasse — em euros, sem símbolos)
- deposit_value: string (valor do sinal, caução, rendas adiantadas, ou pagamento inicial)
- commission_pct: number (comissão em percentagem, se mencionada)
- cpcv_pct: number (percentagem paga no CPCV, se mencionada)

DATAS E PRAZOS:
- contract_signing_date: string (data no formato YYYY-MM-DD)
- max_deadline: string (prazo para escritura/contrato, em dias ou anos)

FINANCIAMENTO:
- has_financing: boolean (true se o documento menciona financiamento bancário ou crédito)

OBSERVAÇÕES:
- conditions_notes: string (condições complementares, cláusulas especiais, notas relevantes)

DADOS DO COMPRADOR/ARRENDATÁRIO/TRESPASSÁRIO (o proponente):
- client_name: string (nome completo)
- client_email: string (email)
- client_phone: string (contacto/telemóvel)
- client_person_type: "singular" | "coletiva" (se for empresa, coletiva)

Retorna APENAS um objecto JSON com os campos encontrados. Nada mais.
Valores numéricos devem ser números puros (sem €, sem pontos de milhares — ex: 450000, não 450.000).`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: 800,
      temperature: 0.1,
    })

    const responseText = completion.choices[0]?.message?.content || '{}'

    let extracted: Record<string, unknown>
    try {
      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      extracted = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'Não foi possível extrair dados da proposta' }, { status: 422 })
    }

    // Build form-ready output — only include fields that map directly
    const formFields: Record<string, unknown> = {}

    // Direct field mappings (keys already match the form)
    const directFields = [
      'business_type', 'deal_value', 'deposit_value', 'commission_pct',
      'cpcv_pct', 'contract_signing_date', 'max_deadline',
      'has_financing', 'conditions_notes',
    ]

    for (const key of directFields) {
      if (extracted[key] != null && extracted[key] !== '') {
        formFields[key] = extracted[key]
      }
    }

    // Client data → clients array
    if (extracted.client_name) {
      formFields.clients = [{
        person_type: extracted.client_person_type || 'singular',
        name: extracted.client_name,
        email: extracted.client_email || '',
        phone: extracted.client_phone || '',
        order_index: 0,
      }]
    }

    return NextResponse.json(formFields)
  } catch (error) {
    console.error('Erro ao analisar proposta:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
