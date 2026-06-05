import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('owner_role_types')
      .select('id, name, label, color, order_index')
      .eq('is_active', true)
      .order('order_index', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar owner role types:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
