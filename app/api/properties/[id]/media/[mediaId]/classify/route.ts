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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id, mediaId } = await params
    const supabase = await createClient()

    // Fetch the media record
    const { data: media, error: mediaError } = await supabase
      .from('dev_property_media')
      .select('id, url, property_id')
      .eq('id', mediaId)
      .eq('property_id', id)
      .single()

    if (mediaError || !media) {
      return NextResponse.json({ error: 'Imagem não encontrada' }, { status: 404 })
    }

    // Call GPT-4o Vision for classification
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
              image_url: {
                url: media.url,
                detail: 'low',
              },
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
    if (!content) {
      return NextResponse.json({ error: 'Sem resposta da IA' }, { status: 502 })
    }

    const parsed = JSON.parse(content) as { room_type: string; confidence: number }
    const roomLabel = parsed.room_type || 'outro'
    const confidence = Math.min(1, Math.max(0, parsed.confidence ?? 0))

    // Update the media record
    const { data: updated, error: updateError } = await supabase
      .from('dev_property_media')
      .update({
        ai_room_label: roomLabel,
        ai_room_confidence: confidence,
        ai_classified_at: new Date().toISOString(),
      })
      .eq('id', mediaId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao guardar classificação', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erro na classificação IA:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
