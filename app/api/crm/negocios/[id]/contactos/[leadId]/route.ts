/**
 * A single participant on an oportunidade.
 *
 *   PATCH  /api/crm/negocios/[id]/contactos/[leadId]
 *     body: { role?, order_index?, make_primary? }
 *     → update role/order. `make_primary: true` promotes this contacto to the
 *       deal's main contact by updating `negocios.lead_id` (the forward trigger
 *       demotes the old primary and flags this one). The old primary stays on
 *       the deal as a non-primary participant.
 *
 *   DELETE /api/crm/negocios/[id]/contactos/[leadId]
 *     → remove a participant. The primary cannot be removed (reassign first).
 */
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { requireAuth } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const PARTICIPANT_ROLES = ['titular', 'conjuge', 'co_comprador', 'co_vendedor', 'fiador', 'representante', 'outro'] as const

const patchSchema = z
  .object({
    role: z.enum(PARTICIPANT_ROLES).optional(),
    order_index: z.number().int().min(0).optional(),
    make_primary: z.literal(true).optional(),
  })
  .refine((b) => b.role !== undefined || b.order_index !== undefined || b.make_primary === true, {
    message: 'Indique pelo menos uma alteração',
  })

async function checkNegocioAccess(
  supabase: any,
  negocioId: string,
  userId: string,
  isManagement: boolean,
): Promise<{ ok: true; leadId: string | null } | { ok: false; status: number; error: string }> {
  const { data, error } = await supabase
    .from('negocios')
    .select('lead_id, assigned_consultant_id, referrer_consultant_id')
    .eq('id', negocioId)
    .maybeSingle()
  if (error) return { ok: false, status: 500, error: error.message }
  if (!data) return { ok: false, status: 404, error: 'Negócio não encontrado' }
  if (!isManagement && data.assigned_consultant_id !== userId && data.referrer_consultant_id !== userId) {
    return { ok: false, status: 403, error: 'Sem permissão para este negócio' }
  }
  return { ok: true, leadId: data.lead_id ?? null }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; leadId: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = createCrmAdminClient()
    const { id, leadId } = await params

    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const access = await checkNegocioAccess(supabase, id, auth.user.id, isManagementRole(auth.roles))
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    // Promote to primary → drive it through negocios.lead_id (forward trigger
    // mirrors the junction). Done first so a combined patch lands consistently.
    if (parsed.data.make_primary) {
      if (access.leadId !== leadId) {
        // Ensure the contacto is actually on the deal before promoting.
        const { data: exists } = await supabase
          .from('negocio_contacts')
          .select('lead_id')
          .eq('negocio_id', id)
          .eq('lead_id', leadId)
          .maybeSingle()
        if (!exists) return NextResponse.json({ error: 'Contacto não está no negócio' }, { status: 404 })

        const { error: negErr } = await supabase
          .from('negocios')
          .update({ lead_id: leadId })
          .eq('id', id)
        if (negErr) return NextResponse.json({ error: negErr.message }, { status: 500 })
      }
    }

    const fields: Record<string, unknown> = {}
    if (parsed.data.role !== undefined) fields.role = parsed.data.role
    if (parsed.data.order_index !== undefined) fields.order_index = parsed.data.order_index
    if (Object.keys(fields).length > 0) {
      const { error: updErr } = await supabase
        .from('negocio_contacts')
        .update(fields)
        .eq('negocio_id', id)
        .eq('lead_id', leadId)
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; leadId: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = createCrmAdminClient()
    const { id, leadId } = await params

    const access = await checkNegocioAccess(supabase, id, auth.user.id, isManagementRole(auth.roles))
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    if (access.leadId === leadId) {
      return NextResponse.json(
        { error: 'Não é possível remover o titular. Defina outro contacto como titular primeiro.' },
        { status: 400 },
      )
    }

    const { error } = await supabase
      .from('negocio_contacts')
      .delete()
      .eq('negocio_id', id)
      .eq('lead_id', leadId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
