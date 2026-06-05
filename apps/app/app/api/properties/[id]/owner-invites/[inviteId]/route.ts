import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'

// Revoke a pending invite.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; inviteId: string }> }
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id: propertyId, inviteId } = await params
    const admin = createAdminClient()

    const { data, error } = await (admin as any)
      .from('property_owner_invites')
      .update({ status: 'revoked' })
      .eq('id', inviteId)
      .eq('property_id', propertyId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json(
        { error: 'Convite não encontrado ou já processado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Erro ao revogar convite:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
