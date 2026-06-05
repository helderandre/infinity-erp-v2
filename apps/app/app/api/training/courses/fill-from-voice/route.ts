// @ts-nocheck
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'

// Whisper domain hint — nudges transcription toward course/real-estate vocabulary.
const WHISPER_PROMPT =
  'Transcrição em português de Portugal. Vocabulário comum: curso, formação, módulo, lição, consultor, imóvel, cliente, proprietário, venda, arrendamento, avaliação, comissão, CPCV, certificado, obrigatório, iniciante, intermédio, avançado, quiz, minutos, horas.'

const EXTRACTION_SYSTEM = `Tu extrais dados estruturados para criar um curso de formação interna a partir de uma descrição falada em português de Portugal.

REGRAS:
1. Devolves APENAS valores que foram explicitamente mencionados na transcrição. Campos não referidos ficam a null.
2. Nunca inventes dados. Se o utilizador não disse o título, deixa null.
3. Os valores numéricos devem ser números (não strings).
4. "difficulty_level" deve ser um de: beginner (iniciante/básico), intermediate (intermédio), advanced (avançado).
5. "category_name" é uma string livre — NÃO é um UUID. Copia o nome da categoria tal como foi dito.
6. "tags" é um array de strings curtas (máximo 5) com palavras-chave do conteúdo.
7. "estimated_duration_minutes" é em minutos (converter horas se preciso).
8. "passing_score" é 0-100 (%).
9. Se o utilizador falou em português do Brasil, normaliza para PT-PT (ex.: "usuário" → "utilizador", "celular" → "telemóvel").`

const EXTRACTION_SCHEMA = {
  type: 'object' as const,
  additionalProperties: false,
  properties: {
    title: { type: ['string', 'null'] },
    summary: { type: ['string', 'null'] },
    description: { type: ['string', 'null'] },
    difficulty_level: { type: ['string', 'null'], enum: ['beginner', 'intermediate', 'advanced', null] },
    instructor_name: { type: ['string', 'null'] },
    estimated_duration_minutes: { type: ['number', 'null'] },
    is_mandatory: { type: ['boolean', 'null'] },
    has_certificate: { type: ['boolean', 'null'] },
    passing_score: { type: ['number', 'null'] },
    tags: {
      anyOf: [
        { type: 'null' },
        { type: 'array', items: { type: 'string' }, maxItems: 10 },
      ],
    },
    category_name: { type: ['string', 'null'] },
  },
  required: [
    'title', 'summary', 'description', 'difficulty_level',
    'instructor_name', 'estimated_duration_minutes',
    'is_mandatory', 'has_certificate', 'passing_score',
    'tags', 'category_name',
  ],
}

type Extracted = {
  title: string | null
  summary: string | null
  description: string | null
  difficulty_level: 'beginner' | 'intermediate' | 'advanced' | null
  instructor_name: string | null
  estimated_duration_minutes: number | null
  is_mandatory: boolean | null
  has_certificate: boolean | null
  passing_score: number | null
  tags: string[] | null
  category_name: string | null
}

function stripNulls<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)) {
      out[k] = v
    }
  }
  return out as Partial<T>
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Serviço de IA não configurado' },
      { status: 503 }
    )
  }

  // Auth — requires training permission (brokers/admins get it via role mapping)
  const auth = await requirePermission('training')
  if (!auth.authorized) return auth.response

  // Parse multipart
  let audioFile: Blob | null = null
  try {
    const formData = await request.formData()
    const field = formData.get('audio')
    if (field instanceof Blob) audioFile = field
  } catch {
    return NextResponse.json({ error: 'Formato multipart inválido' }, { status: 400 })
  }

  if (!audioFile) {
    return NextResponse.json(
      { error: 'Ficheiro de áudio em falta' },
      { status: 400 }
    )
  }

  const openai = new OpenAI({ apiKey })

  // ─── 1. Transcribe ──────────────────────────────────────
  let transcription = ''
  try {
    const file = new File([audioFile], 'audio.webm', { type: audioFile.type || 'audio/webm' })
    const result = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      language: 'pt',
      prompt: WHISPER_PROMPT,
    })
    transcription = (result.text ?? '').trim()
  } catch (err) {
    console.error('Erro Whisper:', err)
    return NextResponse.json(
      { error: 'Erro na transcrição' },
      { status: 500 }
    )
  }

  if (!transcription) {
    return NextResponse.json({ transcription: '', fields: {}, category_match: null })
  }

  // ─── 2. Extract structured fields ──────────────────────
  let extracted: Extracted | null = null
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM },
        {
          role: 'user',
          content: `Transcrição:\n"""\n${transcription}\n"""\n\nExtrai os dados do curso.`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'course_extraction',
          strict: true,
          schema: EXTRACTION_SCHEMA,
        },
      },
    })
    const raw = completion.choices[0]?.message?.content
    extracted = raw ? JSON.parse(raw) : null
  } catch (err) {
    console.error('Erro extracção GPT:', err)
    // Still return transcription so the user isn't blocked
    return NextResponse.json({ transcription, fields: {}, category_match: null })
  }

  if (!extracted) {
    return NextResponse.json({ transcription, fields: {}, category_match: null })
  }

  // ─── 3. Lookup category_name → category_id ─────────────
  let categoryMatch: { id: string; name: string } | null = null
  if (extracted.category_name) {
    try {
      const supabase = await createClient()
      const { data: cat } = await supabase
        .from('forma_training_categories')
        .select('id, name')
        .ilike('name', extracted.category_name.trim())
        .eq('is_active', true)
        .maybeSingle()
      if (cat) categoryMatch = { id: cat.id, name: cat.name }
    } catch (err) {
      console.error('Erro lookup categoria:', err)
    }
  }

  // ─── 4. Build response — strip nulls/empties ───────────
  const cleanFields = stripNulls(extracted) as Record<string, unknown>
  // category_name is not a form field; keep only if unmatched so UI can show hint
  if (categoryMatch) delete cleanFields.category_name

  return NextResponse.json({
    transcription,
    fields: cleanFields,
    category_match: categoryMatch,
  })
}
