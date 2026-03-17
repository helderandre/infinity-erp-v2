import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cancelSubscriptionSchema } from '@/lib/validations/marketing'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient() as any
    const { id } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = cancelSubscriptionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { immediate } = parsed.data

    // Verify subscription belongs to user
    const { data: subscription, error: fetchError } = await supabase
      .from('marketing_subscriptions')
      .select('*')
      .eq('id', id)
      .eq('agent_id', user.id)
      .single()

    if (fetchError || !subscription) {
      return NextResponse.json({ error: 'Subscrição não encontrada' }, { status: 404 })
    }

    if (subscription.status === 'cancelled') {
      return NextResponse.json({ error: 'Subscrição já está cancelada' }, { status: 400 })
    }

    const now = new Date().toISOString()

    const updateData = immediate
      ? { status: 'cancelled', cancelled_at: now }
      : { cancel_at_period_end: true, cancelled_at: now }

    const { data: updated, error: updateError } = await supabase
      .from('marketing_subscriptions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erro ao cancelar subscrição:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
