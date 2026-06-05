import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('dev_users')
      .select('id, commercial_name, dev_consultant_profiles(profile_photo_url), user_roles!user_roles_user_id_fkey(role:roles(name))')
      .eq('is_active', true)
      .order('commercial_name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
