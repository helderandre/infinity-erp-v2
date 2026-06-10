import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/permissions'
import { isPartner } from '@/lib/auth/roles'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

export const dynamic = 'force-dynamic'

const PARTNER_STATUSES = ['pedido', 'aceite', 'criada', 'activa', 'terminada', 'rejeitada'] as const

const patchSchema = z.object({
  partner_status: z.enum(PARTNER_STATUSES),
  reason: z.string().trim().max(500).optional().nullable(),
})

// PATCH — transição do ciclo do parceiro numa campanha (pedido → aceite →
// criada → activa → terminada, + rejeitada). Acesso: o parceiro a quem a
// campanha foi atribuída (partner_id = self) OU gestão (permissions.users /
// permissions.marketing). Guarda motivo + timestamp na transição.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const body = await request.json().catch(() => null)
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }
    const { partner_status, reason } = parsed.data

    const db = createCrmAdminClient()
    const { data: campaign, error: loadErr } = await db
      .from('marketing_campaigns')
      .select('id, partner_id')
      .eq('id', id)
      .maybeSingle()

    if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 })
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

    const isManagement = auth.permissions.users === true || auth.permissions.marketing === true
    const isOwningPartner = isPartner(auth.roles) && campaign.partner_id === auth.user.id
    if (!isManagement && !isOwningPartner) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    if (partner_status === 'rejeitada' && (!reason || reason.trim().length < 3)) {
      return NextResponse.json({ error: 'Indique o motivo da rejeição.' }, { status: 400 })
    }

    const { data: updated, error: updErr } = await db
      .from('marketing_campaigns')
      .update({
        partner_status,
        partner_status_updated_at: new Date().toISOString(),
        partner_rejection_reason: partner_status === 'rejeitada' ? (reason ?? null) : null,
      })
      .eq('id', id)
      .select('id, partner_status, partner_status_updated_at, partner_rejection_reason')
      .single()

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erro ao actualizar estado da campanha (parceiro):', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
