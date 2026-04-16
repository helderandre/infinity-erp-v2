import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const ROOM_TYPES = [
  'sala de estar',
  'quarto',
  'suite',
  'casa de banho',
  'cozinha',
  'escritório',
  'hall de entrada',
  'corredor',
  'varanda',
  'terraço',
  'jardim',
  'garagem',
  'arrecadação',
  'lavandaria',
  'sala de jantar',
  'piscina',
  'sótão',
  'cave',
  'fachada exterior',
  'vista aérea',
  'planta',
  'outro',
] as const

async function classifySingleImage(url: string): Promise<{ room_type: string; confidence: number }> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a real estate image classifier. Analyze the image and identify which room or area of a property it shows.

Return ONLY a JSON object with:
- "room_type": one of: ${ROOM_TYPES.join(', ')}
- "confidence": a number between 0 and 1 (e.g. 0.95 for very confident, 0.6 for uncertain)

Be precise. If the image shows multiple areas, pick the dominant one. If it's not a property photo, use "outro" with low confidence.`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url, detail: 'low' },
          },
          {
            type: 'text',
            text: 'Classify this property image.',
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 100,
    temperature: 0.1,
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('No response')

  const parsed = JSON.parse(content)
  return {
    room_type: parsed.room_type || 'outro',
    confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0)),
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    // Check for optional "force" flag to re-classify already classified images
    const body = await request.json().catch(() => ({}))
    const force = body.force === true

    // Fetch all media for this property
    let query = supabase
      .from('dev_property_media')
      .select('id, url')
      .eq('property_id', id)
      .order('order_index', { ascending: true })

    if (!force) {
      query = query.is('ai_room_label', null)
    }

    const { data: mediaList, error: fetchError } = await query

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!mediaList || mediaList.length === 0) {
      return NextResponse.json({ classified: 0, results: [] })
    }

    // Classify in parallel (batches of 20 — gpt-4o-mini has generous rate limits)
    const results: { id: string; room_type: string; confidence: number; error?: string }[] = []
    const BATCH_SIZE = 20

    for (let i = 0; i < mediaList.length; i += BATCH_SIZE) {
      const batch = mediaList.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.allSettled(
        batch.map(async (m) => {
          const classification = await classifySingleImage(m.url)
          // Update DB
          await supabase
            .from('dev_property_media')
            .update({
              ai_room_label: classification.room_type,
              ai_room_confidence: classification.confidence,
              ai_classified_at: new Date().toISOString(),
            })
            .eq('id', m.id)

          return { id: m.id, ...classification }
        })
      )

      for (const [idx, result] of batchResults.entries()) {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          results.push({
            id: batch[idx].id,
            room_type: 'erro',
            confidence: 0,
            error: result.reason?.message || 'Erro desconhecido',
          })
        }
      }
    }

    return NextResponse.json({
      classified: results.filter((r) => !r.error).length,
      total: mediaList.length,
      results,
    })
  } catch (error) {
    console.error('Erro na classificação em massa:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
