import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'
import { z } from 'zod'

const updateSchema = z.object({
  notes: z.string().max(500).optional().nullable(),
  sent_via: z.enum(['email', 'whatsapp', 'manual']).optional().nullable(),
  sent_to: z.string().max(200).optional().nullable(),
  /** Quando true marca como enviado agora; quando false desfaz. */
  mark_sent: z.boolean().optional(),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; studyId: string }> },
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { studyId } = await params
    const body = await request.json().catch(() => null)
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const admin = createAdminClient() as any
    const updateData: any = {}
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes
    if (parsed.data.sent_via !== undefined) updateData.sent_via = parsed.data.sent_via
    if (parsed.data.sent_to !== undefined) updateData.sent_to = parsed.data.sent_to
    if (parsed.data.mark_sent === true) {
      updateData.sent_at = new Date().toISOString()
      if (!parsed.data.sent_via) updateData.sent_via = 'manual'
    } else if (parsed.data.mark_sent === false) {
      updateData.sent_at = null
      updateData.sent_via = null
      updateData.sent_to = null
    }

    const { data, error } = await admin
      .from('negocio_market_studies')
      .update(updateData)
      .eq('id', studyId)
      .select(`*, creator:dev_users!created_by(id, commercial_name)`)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    console.error('[market-studies PUT]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; studyId: string }> },
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { studyId } = await params
    const admin = createAdminClient() as any

    const { error } = await admin
      .from('negocio_market_studies')
      .delete()
      .eq('id', studyId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[market-studies DELETE]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
