import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rejectRequisitionSchema } from '@/lib/validations/encomenda'

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

    const body = await request.json()
    const parsed = rejectRequisitionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { data: requisition, error: reqError } = await supabase
      .from('temp_requisitions')
      .select('status')
      .eq('id', id)
      .single()

    if (reqError || !requisition) {
      return NextResponse.json({ error: 'Requisição não encontrada' }, { status: 404 })
    }

    if (requisition.status !== 'pending') {
      return NextResponse.json({ error: 'Apenas requisições pendentes podem ser rejeitadas' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('temp_requisitions')
      .update({
        status: 'rejected',
        rejection_reason: parsed.data.rejection_reason,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao rejeitar requisição:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
