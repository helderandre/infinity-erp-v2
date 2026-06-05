/**
 * DELETE /api/crm/contacts/[id]/relationships/[relId]
 * Remove a contact-to-contact relationship. Allowed if the caller can access
 * either side of the pair (or is management).
 */
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { requireAuth } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { NextResponse } from 'next/server'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; relId: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = createCrmAdminClient()
    const { id, relId } = await params

    const { data: rel, error: fetchErr } = await supabase
      .from('lead_relationships')
      .select('id, contact_id, related_contact_id')
      .eq('id', relId)
      .maybeSingle()
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    if (!rel) return NextResponse.json({ error: 'Relação não encontrada' }, { status: 404 })

    // The relId must actually belong to this contacto (either side).
    if (rel.contact_id !== id && rel.related_contact_id !== id) {
      return NextResponse.json({ error: 'Relação não pertence a este contacto' }, { status: 400 })
    }

    if (!isManagementRole(auth.roles)) {
      const { data: sides } = await supabase
        .from('leads')
        .select('agent_id')
        .in('id', [rel.contact_id, rel.related_contact_id])
      const canAccess = (sides ?? []).some((s: { agent_id: string | null }) => s.agent_id === auth.user.id)
      if (!canAccess) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { error } = await supabase.from('lead_relationships').delete().eq('id', relId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
