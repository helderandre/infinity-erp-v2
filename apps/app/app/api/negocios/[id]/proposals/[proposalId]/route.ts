import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'
import { z } from 'zod'

const UUID_REGEX = /^[0-9a-f-]{36}$/

const updateSchema = z.object({
  amount: z.number().positive().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(['pending', 'accepted', 'rejected', 'withdrawn']).optional(),
  rejected_reason: z.string().max(500).nullable().optional(),
  deal_id: z.string().regex(UUID_REGEX).nullable().optional(),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; proposalId: string }> },
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { proposalId } = await params
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

    if (parsed.data.amount !== undefined) updateData.amount = parsed.data.amount
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes
    if (parsed.data.deal_id !== undefined) updateData.deal_id = parsed.data.deal_id

    if (parsed.data.status) {
      updateData.status = parsed.data.status
      const now = new Date().toISOString()
      switch (parsed.data.status) {
        case 'accepted':
          updateData.accepted_at = now
          updateData.rejected_at = null
          updateData.withdrawn_at = null
          updateData.rejected_reason = null
          break
        case 'rejected':
          updateData.rejected_at = now
          updateData.accepted_at = null
          updateData.withdrawn_at = null
          if (parsed.data.rejected_reason !== undefined) {
            updateData.rejected_reason = parsed.data.rejected_reason
          }
          break
        case 'withdrawn':
          updateData.withdrawn_at = now
          updateData.accepted_at = null
          updateData.rejected_at = null
          updateData.rejected_reason = null
          break
        case 'pending':
          updateData.accepted_at = null
          updateData.rejected_at = null
          updateData.withdrawn_at = null
          updateData.rejected_reason = null
          break
      }
    } else if (parsed.data.rejected_reason !== undefined) {
      updateData.rejected_reason = parsed.data.rejected_reason
    }

    const { data, error } = await admin
      .from('negocio_proposals')
      .update(updateData)
      .eq('id', proposalId)
      .select(`
        *,
        property:dev_properties!property_id(id, title, slug, listing_price, external_ref, city, zone),
        deal:deals!deal_id(id),
        creator:dev_users!created_by(id, commercial_name)
      `)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    console.error('[negocios/[id]/proposals/[proposalId] PUT]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; proposalId: string }> },
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { proposalId } = await params
    const admin = createAdminClient() as any

    const { error } = await admin
      .from('negocio_proposals')
      .delete()
      .eq('id', proposalId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[negocios/[id]/proposals/[proposalId] DELETE]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
