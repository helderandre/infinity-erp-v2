import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { NextResponse } from 'next/server'
import { updateContactSchema } from '@/lib/validations/leads-crm'
import { requireAuth } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { redactLead, shouldRedactLead } from '@/lib/auth/redact-lead'

// Devolve 404 para inexistente, 403 quando o caller não é gestão e não
// é o `agent_id` do contacto. Mantém o sheet/edit silenciosamente
// inacessíveis a quem não deveria sequer saber que existem outros.
async function checkContactAccess(
  supabase: any,
  id: string,
  authUserId: string,
  isManagement: boolean,
  // Read-only callers (GET) also grant access to the referrer of the contacto —
  // they keep visibility after handing day-to-day management to the recipient.
  // Mutating callers (PUT/DELETE) leave this false: only the owner/management
  // may edit or delete.
  allowReferrer = false,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data, error } = await supabase
    .from('leads')
    .select('agent_id')
    .eq('id', id)
    .maybeSingle()
  if (error) return { ok: false, status: 500, error: error.message }
  if (!data) return { ok: false, status: 404, error: 'Contacto não encontrado' }
  if (isManagement || data.agent_id === authUserId) return { ok: true }
  if (allowReferrer) {
    const { data: ref } = await supabase
      .from('leads_referrals')
      .select('id')
      .eq('contact_id', id)
      .eq('from_consultant_id', authUserId)
      .eq('referral_type', 'internal')
      .neq('status', 'cancelled')
      .limit(1)
      .maybeSingle()
    if (ref) return { ok: true }
  }
  return { ok: false, status: 403, error: 'Sem permissão para este contacto' }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = createCrmAdminClient()
    const { id } = await params
    const access = await checkContactAccess(
      supabase,
      id,
      auth.user.id,
      isManagementRole(auth.roles),
      true, // GET is read-only → referrer may view the contacto they referred out
    )
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const { data, error } = await supabase
      .from('leads')
      .select(
        '*, leads_contact_stages(*), dev_users!agent_id(id, commercial_name)'
      )
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Contacto não encontrado' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const row = data as Record<string, unknown>
    const payload = shouldRedactLead(
      auth.roles,
      row.agent_id as string | null | undefined,
      auth.user.id,
    )
      ? redactLead(row)
      : row

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Erro ao obter contacto:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = createCrmAdminClient()
    const { id } = await params
    const access = await checkContactAccess(
      supabase,
      id,
      auth.user.id,
      isManagementRole(auth.roles),
    )
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const body = await request.json()
    const validation = updateContactSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('leads')
      .update(validation.data)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao actualizar contacto', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar contacto:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = createCrmAdminClient()
    const { id } = await params
    const access = await checkContactAccess(
      supabase,
      id,
      auth.user.id,
      isManagementRole(auth.roles),
    )
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao eliminar contacto', details: error.message },
        { status: 500 }
      )
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Erro ao eliminar contacto:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
