import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/permissions'

const patchSchema = z.object({
  photo_urls: z.array(z.string().url()).max(20).optional(),
  manual_caption: z.string().max(2000).nullable().optional(),
  ai_description: z.string().max(4000).nullable().optional(),
  published_to_instagram: z.boolean().optional(),
  published_to_linkedin: z.boolean().optional(),
  published_at: z.string().datetime().nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Sem campos para actualizar' })

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; mmId: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id: dealId, mmId } = await params
    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const adminDb = admin as unknown as { from: (t: string) => ReturnType<typeof admin.from> }

    // If publishing flags flip to true, auto-set published_at
    const update: Record<string, unknown> = { ...parsed.data }
    if ((parsed.data.published_to_instagram === true || parsed.data.published_to_linkedin === true)
        && parsed.data.published_at === undefined) {
      update.published_at = new Date().toISOString()
    }

    const { data, error } = await adminDb
      .from('deal_marketing_moments')
      .update(update)
      .eq('id', mmId)
      .eq('deal_id', dealId)
      .select('*')
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: 'Momento não encontrado' }, { status: 404 })
    }
    return NextResponse.json({ data })
  } catch (err) {
    console.error('[PATCH marketing-moments]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; mmId: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id: dealId, mmId } = await params
    const admin = createAdminClient()
    const adminDb = admin as unknown as { from: (t: string) => ReturnType<typeof admin.from> }

    const { error } = await adminDb
      .from('deal_marketing_moments')
      .delete()
      .eq('id', mmId)
      .eq('deal_id', dealId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE marketing-moments]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
