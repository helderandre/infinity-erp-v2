import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; propId: string }> }
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { propId } = await params
    const body = await request.json()
    const admin = createAdminClient() as any

    const updateData: any = {}
    if (body.status) {
      updateData.status = body.status
      if (body.status === 'sent' && !body.sent_at) updateData.sent_at = new Date().toISOString()
      if (body.status === 'visited' && !body.visited_at) updateData.visited_at = new Date().toISOString()
    }
    if (body.notes !== undefined) updateData.notes = body.notes

    if (body.client_reaction !== undefined) {
      const valid = body.client_reaction === null
        || body.client_reaction === 'liked'
        || body.client_reaction === 'disliked'
      if (!valid) {
        return NextResponse.json({ error: 'client_reaction inválido' }, { status: 400 })
      }
      updateData.client_reaction = body.client_reaction
      updateData.client_reaction_at = body.client_reaction === null ? null : new Date().toISOString()
    }
    if (body.client_reaction_note !== undefined) {
      updateData.client_reaction_note = body.client_reaction_note || null
    }

    const { data, error } = await admin
      .from('negocio_properties')
      .update(updateData)
      .eq('id', propId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    console.error('[negocio-properties PUT]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; propId: string }> }
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { propId } = await params
    const admin = createAdminClient() as any

    const { error } = await admin
      .from('negocio_properties')
      .delete()
      .eq('id', propId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[negocio-properties DELETE]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
