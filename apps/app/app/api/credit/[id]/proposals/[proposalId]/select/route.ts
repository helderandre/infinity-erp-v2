import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

const uuidRegex = /^[0-9a-f-]{36}$/

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; proposalId: string }> }
) {
  try {
    const auth = await requirePermission('credit')
    if (!auth.authorized) return auth.response

    const { id, proposalId } = await params

    if (!uuidRegex.test(id) || !uuidRegex.test(proposalId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const supabase = await createClient()
    const db = supabase as any // TEMP tables not in generated types

    // Desseleccionar todas as propostas deste pedido
    const { error: unselectError } = await db
      .from('temp_propostas_banco')
      .update({ is_selected: false })
      .eq('pedido_credito_id', id)

    if (unselectError) {
      return NextResponse.json(
        { error: 'Erro ao desseleccionar propostas', details: unselectError.message },
        { status: 500 }
      )
    }

    // Seleccionar a proposta escolhida
    const { data: proposal, error: selectError } = await db
      .from('temp_propostas_banco')
      .update({ is_selected: true })
      .eq('id', proposalId)
      .eq('pedido_credito_id', id)
      .select()
      .single()

    if (selectError) {
      if (selectError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
      }
      return NextResponse.json(
        { error: 'Erro ao seleccionar proposta', details: selectError.message },
        { status: 500 }
      )
    }

    return NextResponse.json(proposal)
  } catch (error) {
    console.error('Erro ao seleccionar proposta:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
