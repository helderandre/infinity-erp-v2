import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'

// GET — parceiros de marketing activos (is_marketing_partner) para o picker de
// campanhas da Loja. Auth-only: qualquer consultor que peça campanha precisa de
// escolher um parceiro executor.
export async function GET() {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = (await createClient()) as any

    const { data, error } = await supabase
      .from('dev_users')
      .select('id, commercial_name')
      .eq('is_marketing_partner', true)
      .eq('is_active', true)
      .order('commercial_name', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar parceiros de marketing:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
