/**
 * Participants (pessoas) on an oportunidade.
 *
 *   GET  /api/crm/negocios/[id]/contactos
 *     → all people on the deal, primary first. Each row hydrates the underlying
 *       `leads` record so the UI can show name/phone/email without extra fetches.
 *
 *   POST /api/crm/negocios/[id]/contactos
 *     body: { lead_id, role?, relationship_type? }
 *     → adds an existing contacto to the deal as a NON-primary participant.
 *       (The primary is `negocios.lead_id`; change it via PATCH …/[leadId].)
 *       When `relationship_type` is given, also records a lead_relationships
 *       link between the new participant and the current primary contacto so
 *       the marriage/partnership shows up on the contact pages too.
 */
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { requireAuth } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const UUID = z.string().uuid()
const PARTICIPANT_ROLES = ['titular', 'conjuge', 'co_comprador', 'co_vendedor', 'fiador', 'representante', 'outro'] as const
const RELATIONSHIP_TYPES = ['conjuge', 'parceiro', 'familiar', 'socio', 'representante_legal', 'outro'] as const

const addSchema = z.object({
  lead_id: UUID,
  role: z.enum(PARTICIPANT_ROLES).optional().default('conjuge'),
  relationship_type: z.enum(RELATIONSHIP_TYPES).nullable().optional(),
})

const LEAD_EMBED = 'lead:leads!negocio_contacts_lead_id_fkey(id, nome, email, telemovel, telefone_fixo, nif, agent_id)'

/** 404 if the deal is missing; 403 if the caller is neither management nor the
 *  assigned consultant / referrer. Mirrors the redaction gate on the deal. */
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
  if (
    !isManagement &&
    data.assigned_consultant_id !== userId &&
    data.referrer_consultant_id !== userId
  ) {
    return { ok: false, status: 403, error: 'Sem permissão para este negócio' }
  }
  return { ok: true, leadId: data.lead_id ?? null }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = createCrmAdminClient()
    const { id } = await params

    const access = await checkNegocioAccess(supabase, id, auth.user.id, isManagementRole(auth.roles))
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    const { data, error } = await supabase
      .from('negocio_contacts')
      .select(`negocio_id, lead_id, is_primary, role, order_index, created_at, ${LEAD_EMBED}`)
      .eq('negocio_id', id)
      .order('is_primary', { ascending: false })
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = createCrmAdminClient()
    const { id } = await params

    const parsed = addSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { lead_id, role, relationship_type } = parsed.data

    const access = await checkNegocioAccess(supabase, id, auth.user.id, isManagementRole(auth.roles))
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    if (lead_id === access.leadId) {
      return NextResponse.json({ error: 'Este contacto já é o titular do negócio' }, { status: 409 })
    }

    // Next order_index = current max + 1 (after the primary at 0).
    const { data: maxRow } = await supabase
      .from('negocio_contacts')
      .select('order_index')
      .eq('negocio_id', id)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextOrder = ((maxRow?.order_index as number | undefined) ?? 0) + 1

    const { error: insErr } = await supabase
      .from('negocio_contacts')
      .insert({
        negocio_id: id,
        lead_id,
        is_primary: false,
        role,
        order_index: nextOrder,
        created_by: auth.user.id,
      })
    if (insErr) {
      // 23505 = already a participant on this deal
      if ((insErr as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'Este contacto já está no negócio' }, { status: 409 })
      }
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    // Optionally record the contact-to-contact relationship (marriage/partnership)
    // against the primary, so it also surfaces on the contact pages. Best-effort:
    // a duplicate pair (23505) is fine, and a failure here must not fail the add.
    if (relationship_type && access.leadId && access.leadId !== lead_id) {
      const { error: relErr } = await supabase.from('lead_relationships').insert({
        contact_id: access.leadId,
        related_contact_id: lead_id,
        relationship_type,
        created_by: auth.user.id,
      })
      if (relErr && (relErr as { code?: string }).code !== '23505') {
        console.warn('[negocio contactos POST] relationship insert failed:', relErr.message)
      }
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
