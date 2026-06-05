import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { createProposalSchema } from '@/lib/validations/credit'

const uuidRegex = /^[0-9a-f-]{36}$/

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('credit')
    if (!auth.authorized) return auth.response

    const { id } = await params

    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const supabase = await createClient()
    const db = supabase as any // TEMP tables not in generated types

    const { data, error } = await db
      .from('temp_propostas_banco')
      .select('*')
      .eq('pedido_credito_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar propostas:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('credit')
    if (!auth.authorized) return auth.response

    const { id } = await params

    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const supabase = await createClient()
    const db = supabase as any // TEMP tables not in generated types

    const body = await request.json()
    const validation = createProposalSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { data: proposal, error } = await db
      .from('temp_propostas_banco')
      .insert({
        ...validation.data,
        pedido_credito_id: id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao criar proposta', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(proposal, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar proposta:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
