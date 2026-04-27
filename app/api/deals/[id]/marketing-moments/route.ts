import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/permissions'
import { generateMarketingCaption } from '@/lib/processes/neg/generate-marketing-caption'

const MOMENT_TYPES = ['cpcv', 'escritura', 'contrato_arrendamento', 'entrega_chaves'] as const

const createSchema = z.object({
  moment_type: z.enum(MOMENT_TYPES),
  photo_urls: z.array(z.string().url()).min(0).max(20).default([]),
  event_id: z.string().uuid().nullable().optional(),
  manual_caption: z.string().max(2000).nullable().optional(),
  generate_ai_caption: z.boolean().default(false),
})

/**
 * GET /api/deals/[id]/marketing-moments — list moments for a deal.
 * POST — create a new moment row, optionally calling GPT to generate
 * `ai_description` from the deal context.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id: dealId } = await params
    const admin = createAdminClient()
    const adminDb = admin as unknown as { from: (t: string) => ReturnType<typeof admin.from> }

    const { data, error } = await adminDb
      .from('deal_marketing_moments')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    console.error('[GET marketing-moments]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id: dealId } = await params
    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { moment_type, photo_urls, event_id, manual_caption, generate_ai_caption } = parsed.data

    const admin = createAdminClient()
    const adminDb = admin as unknown as { from: (t: string) => ReturnType<typeof admin.from> }

    // Fetch deal context for caption generation
    let aiDescription: string | null = null
    let aiModel: string | null = null
    let aiGeneratedAt: string | null = null

    if (generate_ai_caption) {
      const { data: dealCtx } = await adminDb
        .from('deals')
        .select(`
          business_type,
          property:dev_properties!deals_property_id_fkey(
            address_street, city,
            specs:dev_property_specifications(typology)
          ),
          consultant:dev_users!deals_consultant_id_fkey(commercial_name)
        `)
        .eq('id', dealId)
        .maybeSingle()

      const dc = dealCtx as
        | {
            business_type: string | null
            property?: { address_street: string | null; city: string | null; specs?: { typology: string | null } | null } | null
            consultant?: { commercial_name: string | null } | null
          }
        | null

      const propertyAddress = dc?.property
        ? [dc.property.address_street, dc.property.city].filter(Boolean).join(', ')
        : null

      try {
        const result = await generateMarketingCaption({
          moment_type,
          property_address: propertyAddress,
          property_typology: dc?.property?.specs?.typology ?? null,
          consultant_name: dc?.consultant?.commercial_name ?? null,
          business_type: dc?.business_type ?? null,
        })
        if (result) {
          aiDescription = result.caption
          aiModel = result.model
          aiGeneratedAt = new Date().toISOString()
        }
      } catch (gptErr) {
        // Non-blocking — moment row is still created without AI caption
        console.error('[marketing-moments][generate-caption]', gptErr)
      }
    }

    const { data: inserted, error: insertErr } = await adminDb
      .from('deal_marketing_moments')
      .insert({
        deal_id: dealId,
        event_id: event_id ?? null,
        moment_type,
        photo_urls,
        manual_caption: manual_caption ?? null,
        ai_description: aiDescription,
        ai_description_model: aiModel,
        ai_description_generated_at: aiGeneratedAt,
        consultant_id: auth.user.id,
      })
      .select('*')
      .single()

    if (insertErr || !inserted) {
      return NextResponse.json(
        { error: 'Erro ao criar momento', details: insertErr?.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: inserted }, { status: 201 })
  } catch (err) {
    console.error('[POST marketing-moments]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
