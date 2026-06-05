import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient() as any
    const { data, error } = await supabase
      .from('leads_settings')
      .select('*')
      .order('category')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar settings:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient() as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { key, value } = body

    if (!key || !value) {
      return NextResponse.json({ error: 'Key e value obrigatorios' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('leads_settings')
      .update({ value, updated_at: new Date().toISOString(), updated_by: user.id })
      .eq('key', key)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar setting:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
