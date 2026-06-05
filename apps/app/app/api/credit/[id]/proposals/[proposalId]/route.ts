import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { updateProposalSchema } from '@/lib/validations/credit'

const uuidRegex = /^[0-9a-f-]{36}$/

export async function PUT(
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

    const body = await request.json()
    const validation = updateProposalSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { data: proposal, error } = await db
      .from('temp_propostas_banco')
      .update(validation.data)
      .eq('id', proposalId)
      .eq('pedido_credito_id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
      }
      return NextResponse.json(
        { error: 'Erro ao actualizar proposta', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(proposal)
  } catch (error) {
    console.error('Erro ao actualizar proposta:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    const { error } = await db
      .from('temp_propostas_banco')
      .delete()
      .eq('id', proposalId)
      .eq('pedido_credito_id', id)

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao eliminar proposta', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao eliminar proposta:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
