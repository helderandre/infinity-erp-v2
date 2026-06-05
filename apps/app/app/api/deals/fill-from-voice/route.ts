import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { requireAuth } from '@/lib/auth/permissions'

// POST /api/deals/fill-from-voice — Extract deal data from text (transcribed or typed)
export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Serviço de IA não configurado' }, { status: 503 })
    }

    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const contentType = request.headers.get('content-type') || ''
    let text: string

    if (contentType.includes('multipart/form-data')) {
      // Audio file — transcribe first
      const formData = await request.formData()
      const audio = formData.get('audio') as File | null
      if (!audio) {
        return NextResponse.json({ error: 'Áudio em falta' }, { status: 400 })
      }

      const openai = new OpenAI({ apiKey })
      const transcription = await openai.audio.transcriptions.create({
        file: audio,
        model: 'whisper-1',
        language: 'pt',
      })
      text = transcription.text
    } else {
      const body = await request.json()
      text = body.text
    }

    if (!text?.trim()) {
      return NextResponse.json({ error: 'Texto em falta' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey })

    const systemPrompt = `Extrai dados estruturados do seguinte texto livre sobre um fecho de negócio imobiliário em Portugal.

Campos possíveis (usa apenas os que conseguires detectar):
- business_type: "venda" | "arrendamento" | "trespasse"
- deal_value: number (preço/valor em euros)
- commission_pct: number (comissão em percentagem)
- cpcv_pct: number (percentagem paga no CPCV)
- deposit_value: string (valor do sinal/caução)
- contract_signing_date: string (data formato YYYY-MM-DD)
- max_deadline: string (prazo em dias ou anos)
- has_guarantor: boolean
- has_furniture: boolean
- is_bilingual: boolean
- has_financing: boolean
- has_financing_condition: boolean
- has_signature_recognition: boolean
- housing_regime: "hpp" | "secundaria" | "na"
- has_referral: boolean
- referral_pct: number
- referral_type: "interna" | "externa"
- conditions_notes: string (observações)
- client_name: string (nome do comprador/arrendatário)
- client_email: string
- client_phone: string
- partner_agency_name: string (nome da agência parceira)
- external_consultant_name: string (nome do consultor externo)

Retorna APENAS um JSON plano com os campos detectados.
Valores numéricos devem ser números puros.
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
      return NextResponse.json({ error: 'Não foi possível extrair dados do texto' }, { status: 422 })
    }

    // Map client fields into clients array
    if (result.client_name) {
      result.clients = [{
        person_type: 'singular',
        name: result.client_name,
        email: result.client_email || '',
        phone: result.client_phone || '',
        order_index: 0,
      }]
      delete result.client_name
      delete result.client_email
      delete result.client_phone
    }

    return NextResponse.json({ ...result, _transcription: text })
  } catch (error) {
    console.error('Erro no fill-from-voice:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
