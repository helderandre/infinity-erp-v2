import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Lead-entry voice intake. Two-stage pipeline:
//   1. Whisper → raw transcription (Portuguese).
//   2. GPT-4o-mini → structured extraction with the actual list of consultores
//      and the catálogo de imóveis as constrained vocabulary, so it can return
//      a real consultant_id / property_id instead of free-text guesses.
//
// Returned `extracted` may include consultant_id and property_id when the
// recording references a specific consultor or angariação ("é a Joana que vai
// tratar disto", "interessado no PROP-2024-0123" / "no apartamento de Cascais").
//
// Request body: multipart/form-data with `audio: File`.
// Response: { transcription, extracted }.

interface ExtractedFields {
  name: string | null
  email: string | null
  phone: string | null
  source: string | null
  sector: string | null
  notes: string | null
  consultant_id: string | null
  consultant_name: string | null
  property_id: string | null
  property_external_ref: string | null
  property_title: string | null
}

const SOURCES = [
  'meta_ads', 'google_ads', 'website', 'landing_page', 'partner', 'organic',
  'walk_in', 'phone_call', 'social_media', 'manual', 'other',
]

const SECTORS = [
  'real_estate_buy', 'real_estate_sell', 'real_estate_rent',
  'real_estate_landlord', 'recruitment', 'credit',
]

function buildSystemPrompt(
  consultants: { id: string; name: string }[],
  properties: { id: string; external_ref: string | null; title: string; city: string | null }[],
): string {
  const consultantsList = consultants.length
    ? consultants.map((c) => `- ${c.name} → ${c.id}`).join('\n')
    : '(nenhum consultor activo)'

  const propsList = properties.length
    ? properties
        .slice(0, 60)
        .map((p) => `- ${p.external_ref ?? '(sem ref)'} | ${p.title}${p.city ? ` (${p.city})` : ''} → ${p.id}`)
        .join('\n')
    : '(nenhum imóvel activo)'

  return `Recebes uma transcrição em PT-PT sobre uma nova lead imobiliária. Devolve APENAS JSON válido, sem markdown.

Devolve este formato exacto:
{
  "name": string|null,
  "email": string|null,
  "phone": string|null,                  // formato +351 9XX XXX XXX se possível
  "source": ${SOURCES.map((s) => `"${s}"`).join('|')}|null,
  "sector": ${SECTORS.map((s) => `"${s}"`).join('|')}|null,
  "notes": string|null,                  // contexto, interesses, etc.
  "consultant_id": uuid|null,            // só se identificares com confiança um consultor da lista
  "consultant_name": string|null,        // o nome exacto da lista
  "property_id": uuid|null,              // só se identificares com confiança um imóvel da lista
  "property_external_ref": string|null,  // ex: "PROP-2024-0123" se mencionado
  "property_title": string|null
}

REGRAS:
- Se o utilizador disser "atribui à Joana" ou "é para a Mariana tratar" → faz match contra a lista de consultores abaixo (case-insensitive, primeiro nome ou nome comercial). Devolve consultant_id+consultant_name.
- Se disser "interessado no apartamento de Cascais" ou "PROP-2024-0123" ou "no T3 da Avenida da Liberdade" → procura nos imóveis abaixo. Match por external_ref tem prioridade. Se não houver certeza, devolve só property_external_ref (texto bruto) e deixa property_id null.
- "sector" deve ser inferido do contexto (compra/venda/arrendamento/recrutamento/crédito).
- "source" só se mencionado explicitamente (Meta Ads, Google, walk-in, etc.). Caso contrário, null.

CONSULTORES DISPONÍVEIS (nome → uuid):
${consultantsList}

IMÓVEIS RECENTES (ref | título → uuid):
${propsList}`
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient() as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null
    if (!audioFile) {
      return NextResponse.json({ error: 'Ficheiro de áudio obrigatório' }, { status: 400 })
    }

    // ── Step 1: Whisper transcription ──
    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
      language: 'pt',
    })
    const text = transcription.text

    // ── Step 2: Load constrained vocabulary (consultors + recent properties) ──
    // We use the admin client to bypass RLS — the gestora needs the full list
    // of consultores and the active angariações to resolve voice references.
    const admin = createAdminClient() as any

    const [{ data: consultantsRaw }, { data: propsRaw }] = await Promise.all([
      admin
        .from('dev_users')
        .select('id, commercial_name')
        .eq('is_active', true)
        .order('commercial_name'),
      admin
        .from('dev_properties')
        .select('id, external_ref, title, city, status, created_at')
        .in('status', ['active', 'pending_approval', 'available'])
        .order('created_at', { ascending: false })
        .limit(60),
    ])

    const consultants = (consultantsRaw || []).map((c: any) => ({
      id: c.id as string,
      name: (c.commercial_name as string) || '',
    }))
    const properties = (propsRaw || []).map((p: any) => ({
      id: p.id as string,
      external_ref: p.external_ref ?? null,
      title: (p.title as string) || '',
      city: p.city ?? null,
    }))

    // ── Step 3: Structured extraction ──
    const extraction = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemPrompt(consultants, properties) },
        { role: 'user', content: text },
      ],
    })

    let extracted: ExtractedFields = {
      name: null, email: null, phone: null, source: null, sector: null,
      notes: text, consultant_id: null, consultant_name: null,
      property_id: null, property_external_ref: null, property_title: null,
    }
    try {
      const content = extraction.choices[0]?.message?.content || '{}'
      const parsed = JSON.parse(content)
      extracted = { ...extracted, ...parsed }
    } catch {
      extracted.notes = text
    }

    // ── Step 4: Defensive sanity checks against hallucinated IDs ──
    if (extracted.consultant_id && !consultants.some((c: { id: string }) => c.id === extracted.consultant_id)) {
      extracted.consultant_id = null
    }
    if (extracted.property_id && !properties.some((p: { id: string }) => p.id === extracted.property_id)) {
      // Keep the textual ref (still useful for the gestora to investigate),
      // drop the unverified UUID.
      extracted.property_id = null
    }

    return NextResponse.json({ transcription: text, extracted })
  } catch (error) {
    console.error('Erro na transcrição:', error)
    return NextResponse.json({ error: 'Erro ao transcrever áudio' }, { status: 500 })
  }
}
