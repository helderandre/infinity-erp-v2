import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'

const IS_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function resolvePropertyId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  param: string,
): Promise<string | null> {
  if (IS_UUID.test(param)) return param
  const { data } = await supabase
    .from('dev_properties')
    .select('id')
    .eq('slug', param)
    .single()
  return data?.id ?? null
}

const optStr = z.string().trim().max(2000).optional().nullable()
const uuid = z.string().uuid()

const overridesSchema = z
  .object({
    cover: z
      .object({
        title: optStr,
        eyebrow: optStr,
        cover_media_id: uuid.optional().nullable(),
      })
      .partial()
      .optional(),
    resumo: z
      .object({
        title: optStr,
      })
      .partial()
      .optional(),
    descricao: z
      .object({
        heading: optStr,
        body: z.string().trim().max(20000).optional().nullable(),
      })
      .partial()
      .optional(),
    galeria: z
      .object({
        heading: optStr,
        media_ids: z.array(uuid).max(20).optional().nullable(),
      })
      .partial()
      .optional(),
    localizacao: z
      .object({
        heading: optStr,
      })
      .partial()
      .optional(),
    consultor: z
      .object({
        tagline: optStr,
      })
      .partial()
      .optional(),
    closing: z
      .object({
        headline: optStr,
        eyebrow: optStr,
      })
      .partial()
      .optional(),
  })
  .strict()

const bodySchema = z.object({ overrides: overridesSchema.nullable() })

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id: param } = await params
    const supabase = await createClient()
    const id = await resolvePropertyId(supabase, param)
    if (!id) return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 })

    const { data, error } = await supabase
      .from('dev_properties')
      .select('presentation_overrides')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ overrides: data?.presentation_overrides ?? null })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id: param } = await params
    const supabase = await createClient()
    const id = await resolvePropertyId(supabase, param)
    if (!id) return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 })

    const json = await request.json()
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const next = parsed.data.overrides

    // If image overrides reference media ids, ensure they belong to this property.
    const allRefIds = new Set<string>()
    if (next?.cover?.cover_media_id) allRefIds.add(next.cover.cover_media_id)
    for (const mid of next?.galeria?.media_ids ?? []) allRefIds.add(mid)

    if (allRefIds.size > 0) {
      const { data: media, error: mediaErr } = await supabase
        .from('dev_property_media')
        .select('id')
        .eq('property_id', id)
        .in('id', Array.from(allRefIds))

      if (mediaErr) {
        return NextResponse.json(
          { error: 'Erro a validar imagens', details: mediaErr.message },
          { status: 500 },
        )
      }
      const found = new Set((media ?? []).map((m) => m.id))
      const missing = Array.from(allRefIds).filter((mid) => !found.has(mid))
      if (missing.length > 0) {
        return NextResponse.json(
          { error: 'Algumas imagens já não pertencem a este imóvel.', missing },
          { status: 400 },
        )
      }
    }

    const { error } = await supabase
      .from('dev_properties')
      .update({ presentation_overrides: next })
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: 'Erro a guardar', details: error.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, overrides: next })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
