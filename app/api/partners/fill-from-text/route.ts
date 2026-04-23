import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const CATEGORIES = [
  'notary',
  'lawyer',
  'architect',
  'engineer',
  'contractor',
  'painter',
  'electrician',
  'plumber',
  'cleaner',
  'mortgage_broker',
  'inspector',
  'appraiser',
  'photographer',
  'stager',
  'mover',
  'insurance',
  'other',
] as const

const PAYMENT_METHODS = [
  'bank_transfer',
  'mbway',
  'cash',
  'check',
  'credit_card',
  'other',
] as const

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Serviço de IA não configurado' }, { status: 503 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { text } = body as { text?: string }
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Texto é obrigatório' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `És um assistente que extrai dados estruturados para criar um parceiro/fornecedor a partir de texto livre em Português de Portugal.

Categorias permitidas: ${CATEGORIES.join(', ')}
Métodos de pagamento: ${PAYMENT_METHODS.join(', ')}

Extrai (retorna JSON, null para campos não mencionados):
{
  "name": "string — nome da empresa ou pessoa",
  "person_type": "singular|coletiva — pessoa ou empresa",
  "nif": "string — NIF português (9 dígitos)",
  "category": "uma das categorias permitidas",
  "email": "string — email",
  "phone": "string — telemóvel/telefone principal",
  "phone_secondary": "string — segundo contacto",
  "website": "string — URL do site",
  "address": "string — morada (rua, número)",
  "city": "string — cidade",
  "postal_code": "string — código postal",
  "contact_person": "string — pessoa de contacto dentro da empresa",
  "specialties": "array de strings — especializações/áreas",
  "service_areas": "array de strings — zonas de actuação (cidades/regiões)",
  "commercial_conditions": "string — condições comerciais",
  "payment_method": "um dos métodos de pagamento",
  "is_recommended": "boolean — true se texto sugerir recomendação forte",
  "internal_notes": "string — notas internas adicionais"
}

Regras:
- "notário", "cartório" → category="notary"
- "advogado" → "lawyer"
- "arquitecto" → "architect"
- "engenheiro civil" → "engineer"
- "construtor", "empreiteiro" → "contractor"
- "pintor" → "painter"; "electricista" → "electrician"
- "canalizador" → "plumber"; "empresa de limpeza" → "cleaner"
- "intermediário de crédito"/"banco"/"crédito habitação" → "mortgage_broker"
- "perito"/"avaliador" → "inspector" ou "appraiser"
- "fotógrafo" → "photographer"; "home staging"/"decorador" → "stager"
- "mudanças" → "mover"; "seguros" → "insurance"
- Se não bater em nada, "other"
- NIF = apenas 9 dígitos, sem espaços
- "transferência" → "bank_transfer"; "mb way"/"mbway" → "mbway"
- "recomendado"/"de confiança" → is_recommended=true
- Responde APENAS com o JSON`,
        },
        { role: 'user', content: text },
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    let extracted: Record<string, unknown>
    try {
      extracted = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Falha ao interpretar resposta da IA' }, { status: 500 })
    }

    // Validate enums.
    if (
      typeof extracted.category === 'string' &&
      !CATEGORIES.includes(extracted.category as any)
    ) {
      extracted.category = null
    }
    if (
      typeof extracted.payment_method === 'string' &&
      !PAYMENT_METHODS.includes(extracted.payment_method as any)
    ) {
      extracted.payment_method = null
    }
    if (
      typeof extracted.person_type === 'string' &&
      extracted.person_type !== 'singular' &&
      extracted.person_type !== 'coletiva'
    ) {
      extracted.person_type = null
    }

    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(extracted)) {
      if (value === null || value === undefined || value === '') continue
      if (Array.isArray(value) && value.length === 0) continue
      result[key] = value
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Erro ao extrair dados do parceiro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
