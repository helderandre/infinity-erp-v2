import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// PUT — toggle feedback visibility (admin)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const body = await request.json()
    const { feedback_id, is_public } = body

    if (!feedback_id) {
      return NextResponse.json({ error: 'ID do feedback é obrigatório.' }, { status: 400 })
    }

    const admin = createAdminClient() as any
    const { error } = await admin
      .from('supplier_order_feedback')
      .update({ is_public })
      .eq('id', feedback_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[supplier feedback PUT]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
