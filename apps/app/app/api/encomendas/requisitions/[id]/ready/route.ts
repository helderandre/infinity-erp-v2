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

    const { data: requisition, error: reqError } = await supabase
      .from('temp_requisitions')
      .select('status')
      .eq('id', id)
      .single()

    if (reqError || !requisition) {
      return NextResponse.json({ error: 'Requisição não encontrada' }, { status: 404 })
    }

    if (requisition.status !== 'approved') {
      return NextResponse.json({ error: 'Apenas requisições aprovadas podem ser marcadas como prontas' }, { status: 400 })
    }

    // Update requisition status
    const { data, error } = await supabase
      .from('temp_requisitions')
      .update({ status: 'ready' })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Update all pending/reserved items to ready
    await supabase
      .from('temp_requisition_items')
      .update({ status: 'ready' })
      .eq('requisition_id', id)
      .in('status', ['pending', 'reserved', 'in_production'])

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao marcar requisição como pronta:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
