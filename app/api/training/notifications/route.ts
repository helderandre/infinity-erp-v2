// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'

export async function GET() {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = await createClient()

    // Get notifications for current user
    const { data: notifications, error } = await supabase
      .from('forma_training_notifications')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Count unread
    const { count: unread_count } = await supabase
      .from('forma_training_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', auth.user.id)
      .eq('is_read', false)

    return NextResponse.json({
      data: notifications || [],
      unread_count: unread_count ?? 0,
    })
  } catch (error) {
    console.error('Erro ao listar notificações de formação:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
