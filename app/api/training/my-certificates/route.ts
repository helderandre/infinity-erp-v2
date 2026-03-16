// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'

export async function GET() {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const userId = auth.user.id
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('temp_training_certificates')
      .select(`
        *,
        course:temp_training_courses(title)
      `)
      .eq('user_id', userId)
      .order('issued_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Erro ao listar certificados:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
