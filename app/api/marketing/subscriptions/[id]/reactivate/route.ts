import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

    // Verify subscription belongs to user and is eligible for reactivation
    const { data: subscription, error: fetchError } = await supabase
      .from('marketing_subscriptions')
      .select('*')
      .eq('id', id)
      .eq('agent_id', user.id)
      .single()

    if (fetchError || !subscription) {
      return NextResponse.json({ error: 'Subscrição não encontrada' }, { status: 404 })
    }

    if (subscription.status !== 'active') {
      return NextResponse.json({ error: 'Apenas subscrições activas podem ser reactivadas' }, { status: 400 })
    }

    if (!subscription.cancel_at_period_end) {
      return NextResponse.json({ error: 'Subscrição não está marcada para cancelamento' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabase
      .from('marketing_subscriptions')
      .update({
        cancel_at_period_end: false,
        cancelled_at: null,
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erro ao reactivar subscrição:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
