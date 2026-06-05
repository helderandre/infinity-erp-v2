import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
      auth: typeof supabase.auth
    }
    const { data: { user }, error: authError } = await db.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { count, error } = await (db.from('notifications') as ReturnType<typeof supabase.from>)
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('is_read', false)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ count: count ?? 0 })
  } catch (error) {
    console.error('Erro ao contar notificações:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
