import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

/**
 * Extract structured contact + negócio data from free-text (WhatsApp transcript,
 * notes, voice transcription). Uses OpenAI structured outputs so the model is
 * forced to return valid JSON matching the schema below.
 *
 * Principles:
 *  1. Structured outputs (no free-form parsing).
 *  2. Prompt discipline: extract only what was explicitly said; no inference.
 *  3. Per-field confidence ('high' | 'medium' | 'low'). Low fields are dropped
 *     before returning so the form doesn't autofill unreliable data.
 *  4. Post-processing normalizes common variants ("T dois", "300 mil", etc).
 *  5. Never auto-submits — UI always shows the preview.
 */

type Confidence = 'high' | 'medium' | 'low'

interface FieldWithConfidence<T> {
  value: T | null
  confidence: Confidence
}

interface ExtractedPayload {
  contacto: {
    nome: FieldWithConfidence<string>
    email: FieldWithConfidence<string>
    telemovel: FieldWithConfidence<string>
    nacionalidade: FieldWithConfidence<string>
    observacoes: FieldWithConfidence<string>
  }
  negocio: {
    tipo: FieldWithConfidence<'Compra' | 'Venda' | 'Arrendatário' | 'Arrendador'>
    tipo_imovel: FieldWithConfidence<string>
    tipologia: FieldWithConfidence<string>
    quartos_min: FieldWithConfidence<number>
    orcamento: FieldWithConfidence<number>
    orcamento_max: FieldWithConfidence<number>
    localizacao: FieldWithConfidence<string>
    caracteristicas: FieldWithConfidence<string[]>
  }
}

const JSON_SCHEMA = {
  name: 'extracted_lead',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      contacto: {
        type: 'object',
        additionalProperties: false,
        properties: {
          nome: fieldSchema({ type: 'string' }),
          email: fieldSchema({ type: 'string' }),
          telemovel: fieldSchema({ type: 'string' }),
          nacionalidade: fieldSchema({ type: 'string' }),
          observacoes: fieldSchema({ type: 'string' }),
        },
        required: ['nome', 'email', 'telemovel', 'nacionalidade', 'observacoes'],
      },
      negocio: {
        type: 'object',
        additionalProperties: false,
        properties: {
          tipo: fieldSchema({ type: 'string', enum: ['Compra', 'Venda', 'Arrendatário', 'Arrendador'] }),
          tipo_imovel: fieldSchema({ type: 'string' }),
          tipologia: fieldSchema({ type: 'string' }),
          quartos_min: fieldSchema({ type: 'integer' }),
          orcamento: fieldSchema({ type: 'number' }),
          orcamento_max: fieldSchema({ type: 'number' }),
          localizacao: fieldSchema({ type: 'string' }),
          caracteristicas: fieldSchema({ type: 'array', items: { type: 'string' } }),
        },
        required: ['tipo', 'tipo_imovel', 'tipologia', 'quartos_min', 'orcamento', 'orcamento_max', 'localizacao', 'caracteristicas'],
      },
    },
    required: ['contacto', 'negocio'],
  },
} as const

function fieldSchema(valueSchema: Record<string, unknown>) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      value: { anyOf: [valueSchema, { type: 'null' }] },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    },
    required: ['value', 'confidence'],
  }
}

const SYSTEM_PROMPT = `És um extractor de dados imobiliários para Portugal. A partir de uma transcrição de conversa ou texto livre, devolves um JSON estruturado com dados do contacto e do negócio.

REGRAS ABSOLUTAS (não negociáveis):
1. SÓ extrai o que foi EXPLICITAMENTE dito. Nunca infiras, nunca assumas.
2. Se um campo não foi mencionado, devolve value=null com confidence="low".
3. Marca confidence:
   - "high" = a informação foi dita de forma clara e não ambígua pelo contacto ou agente.
   - "medium" = a informação aparece mas com alguma ambiguidade (ex: "talvez uns 300 mil").
   - "low" = não foi mencionado ou só aparece indirectamente; também usa quando value=null.
4. Campo "tipo" (Compra/Venda/Arrendatário/Arrendador): só "high" se o contacto expressar intenção clara (ex: "quero comprar", "estou a vender").
5. "tipologia" usa o formato português: T0, T1, T2, T3, T4, T5, T5+. Nunca números soltos.
6. "quartos_min" é um inteiro (não string).
7. Orçamento em EUROS como número (não string, sem símbolo €). Converte "300 mil" → 300000, "1.5M" → 1500000.
   - Se o contacto disser um valor único para comprar/arrendar (ex: "quero comprar por 300.000", "tenho 300k"), coloca esse valor em "orcamento_max" (tecto máximo). Deixa "orcamento" como null.
   - Se o contacto disser um intervalo explícito (ex: "entre 200.000 e 300.000"), coloca o mínimo em "orcamento" e o máximo em "orcamento_max".
   - Se o contacto disser "a partir de X" ou "pelo menos X", coloca em "orcamento". Se disser "até X" ou "no máximo X", coloca em "orcamento_max".
8. "localizacao" é texto livre como foi mencionado (ex: "Lisboa centro", "Cascais"). Não normalizes.
9. "observacoes" captura notas adicionais relevantes (preferências, timing, motivação) em 1-2 frases.
10. "caracteristicas" é uma lista curta de atributos mencionados (ex: ["garagem", "varanda", "vista mar"]).

Mensagens marcadas com "Agente:" são do consultor. Mensagens "Contacto:" são do cliente. Prioriza sempre o que o CONTACTO disse sobre o que o agente disse.`

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
    const { text } = body as { text: string }

    if (!text?.trim()) {
      return NextResponse.json({ error: 'Texto em falta' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text.slice(0, 6000) }, // cap input; 20 WA messages fit comfortably
      ],
      response_format: { type: 'json_schema', json_schema: JSON_SCHEMA },
    })

    const raw = completion.choices[0]?.message?.content?.trim() || '{}'
    let payload: ExtractedPayload
    try {
      payload = JSON.parse(raw)
    } catch {
      return NextResponse.json({ fields: {}, raw_text: text })
    }

    // Flatten: drop low-confidence fields, normalize values, produce the flat
    // shape that LeadForm.applyExtracted expects.
    const fields: Record<string, unknown> = {}
    const kept = (f: FieldWithConfidence<unknown>) =>
      f?.value !== null && f?.value !== undefined && (f.confidence === 'high' || f.confidence === 'medium')

    // Contacto
    if (kept(payload.contacto.nome)) fields.nome = payload.contacto.nome.value
    if (kept(payload.contacto.email)) fields.email = payload.contacto.email.value
    if (kept(payload.contacto.telemovel)) fields.telemovel = payload.contacto.telemovel.value
    if (kept(payload.contacto.observacoes)) fields.observacoes = payload.contacto.observacoes.value

    // Negócio
    if (kept(payload.negocio.tipo)) fields.negocio_tipo = payload.negocio.tipo.value
    if (kept(payload.negocio.tipo_imovel)) fields.tipo_imovel = normalizeTipoImovel(payload.negocio.tipo_imovel.value as string)
    if (kept(payload.negocio.tipologia)) fields.tipologia = normalizeTipologia(payload.negocio.tipologia.value as string)
    if (kept(payload.negocio.quartos_min)) fields.quartos_min = payload.negocio.quartos_min.value
    if (kept(payload.negocio.orcamento)) fields.orcamento = payload.negocio.orcamento.value
    if (kept(payload.negocio.orcamento_max)) fields.orcamento_max = payload.negocio.orcamento_max.value
    if (kept(payload.negocio.localizacao)) fields.localizacao = payload.negocio.localizacao.value

    // If tipologia was set but quartos_min wasn't, derive it (T2 → 2)
    if (fields.tipologia && !fields.quartos_min) {
      const match = /^T(\d)/.exec(String(fields.tipologia))
      if (match) fields.quartos_min = parseInt(match[1], 10)
    }

    return NextResponse.json({ fields, raw_text: text, _debug: payload })
  } catch (error) {
    console.error('[leads/extract-from-text]', error)
    return NextResponse.json({ error: 'Erro ao extrair dados' }, { status: 500 })
  }
}

// ── Normalizers ─────────────────────────────────────────────────

const TIPO_IMOVEL_MAP: Record<string, string> = {
  apartamento: 'Apartamento',
  apartamentos: 'Apartamento',
  flat: 'Apartamento',
  moradia: 'Moradia',
  moradias: 'Moradia',
  vivenda: 'Moradia',
  casa: 'Moradia',
  quinta: 'Quinta',
  herdade: 'Quinta',
  'prédio': 'Prédio',
  predio: 'Prédio',
  'comércio': 'Comércio',
  comercio: 'Comércio',
  loja: 'Comércio',
  'escritório': 'Comércio',
  escritorio: 'Comércio',
  garagem: 'Garagem',
  'terreno urbano': 'Terreno Urbano',
  'terreno rústico': 'Terreno Rústico',
  'terreno rustico': 'Terreno Rústico',
  terreno: 'Terreno Urbano',
}

function normalizeTipoImovel(input: string): string {
  const key = input.toLowerCase().trim()
  return TIPO_IMOVEL_MAP[key] || input
}

function normalizeTipologia(input: string): string {
  const s = input.toUpperCase().trim().replace(/\s+/g, '')
  // Already in correct format
  if (/^T\d\+?$/.test(s)) return s
  // "T dois", "T DOIS"
  const words: Record<string, number> = {
    ZERO: 0, UM: 1, DOIS: 2, TRÊS: 3, TRES: 3, QUATRO: 4, CINCO: 5, SEIS: 6,
  }
  const wordMatch = /^T(ZERO|UM|DOIS|TR[ÊE]S|QUATRO|CINCO|SEIS)(\+?)$/.exec(s)
  if (wordMatch) {
    const n = words[wordMatch[1].replace('Ê', 'E')]
    return `T${n}${wordMatch[2]}`
  }
  // Plain digit ("2", "3")
  const digitMatch = /^(\d)(\+?)$/.exec(s)
  if (digitMatch) return `T${digitMatch[1]}${digitMatch[2]}`
  return input
}
