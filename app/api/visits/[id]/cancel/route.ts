import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { cancelVisitSchema } from '@/lib/validations/visit'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = cancelVisitSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const admin = createAdminClient() as any

    const { data, error } = await admin
      .from('visits')
      .update({
        status: 'cancelled',
        cancelled_reason: parsed.data.cancelled_reason,
        cancelled_by: user.id,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[visits/[id]/cancel POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update calendar event title to indicate cancellation
    if (data?.calendar_event_id) {
      await admin
        .from('calendar_events')
        .update({
          title: `[CANCELADA] ${data.notes || 'Visita cancelada'}`,
          color: '#ef4444',
        })
        .eq('id', data.calendar_event_id)
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[visits/[id]/cancel POST]', err)
    return NextResponse.json({ error: 'Erro interno ao cancelar visita.' }, { status: 500 })
  }
}
