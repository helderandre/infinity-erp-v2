import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { data, error } = await (supabase as any)
      .from('crm_settings')
      .select('*')
      .order('key')

    if (error) throw error

    return NextResponse.json({ settings: data || [] })
  } catch (err) {
    console.error('[crm-settings-get]', err)
    return NextResponse.json({ error: 'Erro ao carregar definições' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const { key, value } = body

    if (!key) return NextResponse.json({ error: 'Chave obrigatória' }, { status: 400 })

    const { error } = await (supabase as any)
      .from('crm_settings')
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      }, { onConflict: 'key' })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[crm-settings-put]', err)
    return NextResponse.json({ error: 'Erro ao guardar definição' }, { status: 500 })
  }
}
