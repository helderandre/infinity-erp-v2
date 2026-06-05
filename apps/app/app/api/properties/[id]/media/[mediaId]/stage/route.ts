import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { NextResponse } from 'next/server'
import OpenAI, { toFile } from 'openai'
import { uploadImageToR2 } from '@/lib/r2/images'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const PRESERVE_ROOM = `CRITICAL: You must preserve the EXACT room structure. Do NOT alter walls, floor, ceiling, windows, doors, room dimensions, camera angle, perspective, vanishing points, or lighting direction. The room geometry, colors, and materials must remain pixel-perfect identical. Only ADD furniture ON TOP of the existing scene. The final image must look like someone placed real furniture into the original photo.`

const PLACEMENT_RULES = `FURNITURE PLACEMENT RULES — follow these strictly:
- Sofas must FACE the TV or focal wall, never sideways to it. A person sitting on the sofa should look directly at where a TV would be.
- Coffee tables go centered in front of the sofa, within arm's reach.
- Rugs must be under the front legs of the sofa at minimum, never floating away from furniture.
- Beds must be centered on the main wall (usually opposite the door), with the headboard against the wall.
- Nightstands must be symmetrical on both sides of the bed.
- Dining tables centered in the room or dining zone, with chairs evenly spaced around them.
- Never block doors, windows, closet doors, or appliance doors with furniture.
- Leave walking paths of at least 80cm between furniture pieces.
- Wall art must be at eye height and centered above the furniture below it.
- Side tables go at the ends of sofa arms, not floating in space.
- All furniture must be proportional to the room — do not place oversized furniture in a small room.
- Furniture must be anchored to walls or zones, never floating randomly in the middle of the room.
- All shadows must be consistent with the existing light source direction in the photo.
- Respect correct perspective and depth — furniture farther from the camera must be smaller.
- NEVER place beds in corridors, hallways, or entrance halls. Only place beds in bedrooms and suites.
- Match furniture to the room type — kitchens get tables and chairs, not sofas; hallways get consoles and mirrors, not beds.`

// Room-specific furniture per style
const ROOM_FURNITURE: Record<string, Record<string, string>> = {
  'sala de estar': {
    moderno: 'a sleek fabric sofa, glass coffee table, minimalist TV stand, decorative cushions, a large area rug, two potted plants, contemporary wall art, and a warm LED floor lamp',
    classico: 'a tufted Chesterfield sofa, dark wood coffee table, a Persian rug, an ornate mirror, a chandelier, velvet curtains, table lamps with fabric shades, and decorative books',
    minimalista: 'one low-profile sofa in neutral tone, a single round coffee table, one abstract artwork, one floor lamp, and one small potted plant. Keep most floor space empty',
    escandinavo: 'a light birch wood sofa with white linen cushions, a birch coffee table, a woven wool rug, indoor plants in white ceramic pots, a pendant lamp, and a small bookshelf',
    industrial: 'a dark brown leather sofa, a reclaimed wood coffee table with iron legs, a metal bookshelf, an Edison bulb floor lamp, a metal side table, and a dark woven rug',
  },
  quarto: {
    moderno: 'a platform bed with upholstered headboard, matching nightstands with lamps, a soft area rug beside the bed, a sleek dresser, decorative cushions, and a potted plant',
    classico: 'a four-poster or sleigh bed with luxury bedding, ornate nightstands with crystal lamps, a Persian rug, an upholstered bench at the foot, a vanity mirror, and silk curtains',
    minimalista: 'a simple low platform bed with white linen bedding, one nightstand with a single lamp, and one small artwork above the bed. Keep most floor space empty',
    escandinavo: 'a light wood bed frame with cozy white bedding, birch nightstands, a woven rug, a pendant lamp, indoor plant, and a light throw blanket',
    industrial: 'a metal frame bed with dark bedding, reclaimed wood nightstands, Edison bulb hanging lamps, a metal clothing rack, and a dark woven rug',
  },
  suite: {
    moderno: 'a king-size platform bed with upholstered headboard, elegant nightstands with designer lamps, a chaise lounge, a soft area rug, large artwork, and ambient lighting',
    classico: 'a grand upholstered king bed with luxury bedding, matching nightstands with crystal lamps, a velvet chaise, Persian rug, chandelier, and silk drapes',
    minimalista: 'a king platform bed with premium white bedding, floating nightstands, one statement artwork, and a single designer floor lamp',
    escandinavo: 'a king bed with light wood frame and cozy layered bedding, birch nightstands, sheepskin rug, pendant lights, and a reading nook with armchair',
    industrial: 'a king metal frame bed, reclaimed wood nightstands, Edison pendant lights, a leather armchair, exposed metal shelving, and a textured rug',
  },
  cozinha: {
    moderno: 'a modern dining table with 4 chairs, a fruit bowl on the counter, pendant lights over the table, small herb pots by the window, and a decorative kitchen runner rug',
    classico: 'a wooden dining table with upholstered chairs, a chandelier above, ceramic vases, linen table runner, and a fruit bowl',
    minimalista: 'a simple round dining table with 2 chairs, one pendant light, and a single vase with a branch',
    escandinavo: 'a light wood dining table with white chairs, a woven table runner, candles, ceramic dishes, and hanging plants',
    industrial: 'a reclaimed wood dining table with metal chairs, Edison bulb pendant, metal fruit basket, and a chalkboard on the wall',
  },
  'sala de jantar': {
    moderno: 'a large modern dining table with 6 upholstered chairs, a statement chandelier, a sideboard with decorative objects, and a large area rug under the table',
    classico: 'an elegant dark wood dining table with 6 carved chairs, a crystal chandelier, a china cabinet, candlesticks, and a Persian rug',
    minimalista: 'a slim dining table with 4 simple chairs, one pendant light, and a single centerpiece vase',
    escandinavo: 'a light oak dining table with 6 white wishbone chairs, a woven rug, a pendant lamp cluster, and a potted plant centerpiece',
    industrial: 'a long reclaimed wood table with metal legs and 6 mixed metal/wood chairs, industrial pendant lights, and a metal sideboard',
  },
  escritório: {
    moderno: 'a sleek desk with a modern office chair, a desk lamp, a monitor stand, floating shelves with books, a potted plant, and a small rug',
    classico: 'a large wooden executive desk with a leather chair, a brass desk lamp, a bookcase filled with books, a globe, and heavy curtains',
    minimalista: 'a simple white desk with a minimal chair, one desk lamp, and a single shelf with a few books',
    escandinavo: 'a birch wood desk with a white ergonomic chair, a pendant lamp, wooden shelving, plants, and a cozy rug',
    industrial: 'a metal and wood desk, a leather swivel chair, metal pipe shelving, an Edison desk lamp, and exposed storage',
  },
  'casa de banho': {
    moderno: 'folded white towels on a shelf, a soap dispenser, a small plant, a round mirror with LED backlight, and decorative candles',
    classico: 'embroidered hand towels, an ornate mirror, crystal soap dispenser, a small vase with flowers, and decorative jars',
    minimalista: 'one folded white towel, a single soap dispenser, and one small succulent',
    escandinavo: 'wooden bathroom accessories, white folded towels, a small potted plant, and a woven basket for storage',
    industrial: 'metal towel rack with dark towels, a concrete soap dispenser, an industrial mirror, and a metal shelf',
  },
  varanda: {
    moderno: 'outdoor lounge chairs with cushions, a small side table, potted plants, string lights, and a modern outdoor rug',
    classico: 'wrought iron bistro table and chairs with cushions, a potted topiary, lanterns, and flowing outdoor curtains',
    minimalista: 'one simple lounge chair, a small plant, and a side table',
    escandinavo: 'wooden outdoor furniture with white cushions, blankets, lanterns, and several potted plants',
    industrial: 'metal frame chairs with cushions, a reclaimed wood table, Edison string lights, and concrete planters',
  },
}

// Fallback for rooms not in the map
const DEFAULT_FURNITURE: Record<string, string> = {
  moderno: 'appropriate modern furniture and decor items that fit this room type, with clean lines, neutral colors, and warm lighting',
  classico: 'appropriate classic furniture and decor items that fit this room type, with warm wood tones, ornate details, and elegant fabrics',
  minimalista: 'a few carefully chosen furniture pieces appropriate for this room type, keeping most space empty and clean',
  escandinavo: 'appropriate Scandinavian furniture with light wood, white tones, cozy textiles, and indoor plants',
  industrial: 'appropriate industrial furniture with metal, reclaimed wood, Edison bulbs, and raw textures',
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id, mediaId } = await params
    const supabase = await createClient()

    const body = await request.json().catch(() => ({}))
    const style = (body.style as string) || 'moderno'
    const customPrompt = (body.customPrompt as string)?.trim() || ''

    if (!DEFAULT_FURNITURE[style]) {
      return NextResponse.json(
        { error: 'Estilo inválido', styles: Object.keys(DEFAULT_FURNITURE) },
        { status: 400 }
      )
    }

    const { data: media, error: mediaError } = await supabase
      .from('dev_property_media')
      .select('id, url, property_id, ai_room_label')
      .eq('id', mediaId)
      .eq('property_id', id)
      .single()

    if (mediaError || !media) {
      return NextResponse.json({ error: 'Imagem não encontrada' }, { status: 404 })
    }

    // Download the original image
    const imgResponse = await fetch(media.url)
    if (!imgResponse.ok) {
      return NextResponse.json({ error: 'Erro ao descarregar imagem original' }, { status: 502 })
    }
    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer())
    const imageFile = await toFile(imgBuffer, 'room.png', { type: 'image/png' })

    // Build prompt: preservation instructions + room-aware furniture
    const roomType = media.ai_room_label || ''
    const furniture = ROOM_FURNITURE[roomType]?.[style] || DEFAULT_FURNITURE[style]
    const roomContext = roomType ? `This is a ${roomType}. ` : ''

    const userExtra = customPrompt ? `\n\nAdditional user instructions: ${customPrompt}` : ''
    const prompt = `${PRESERVE_ROOM}\n\n${PLACEMENT_RULES}\n\n${roomContext}Add ${furniture}. Photorealistic result, natural shadows under furniture, consistent lighting with the existing room.${userExtra}`

    // Use OpenAI GPT Image to add furniture to the room
    const result = await openai.images.edit({
      model: 'gpt-image-1',
      image: imageFile,
      prompt,
      quality: 'medium',
      size: '1024x1024',
    })

    const b64 = result.data?.[0]?.b64_json
    if (!b64) {
      return NextResponse.json({ error: 'Sem resposta da IA' }, { status: 502 })
    }

    // Upload staged image to R2
    const stagedBuffer = Buffer.from(b64, 'base64')
    const { url: stagedUrl } = await uploadImageToR2(
      stagedBuffer,
      `staged-${style}-${mediaId}.webp`,
      'image/webp',
      id
    )

    // Save to DB
    const { error: updateError } = await supabase
      .from('dev_property_media')
      .update({
        ai_staged_url: stagedUrl,
        ai_staged_style: style,
      })
      .eq('id', mediaId)

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao guardar imagem decorada', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ai_staged_url: stagedUrl, ai_staged_style: style })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Erro na decoração virtual:', message, error)
    return NextResponse.json(
      { error: message || 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
