import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { creditDocumentSchema } from '@/lib/validations/credit'

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
      .from('temp_credito_documentos')
      .select('*')
      .eq('pedido_credito_id', id)
      .order('order_index', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar documentos:', error)
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
    const validation = creditDocumentSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { data: document, error } = await db
      .from('temp_credito_documentos')
      .insert({
        ...validation.data,
        pedido_credito_id: id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao criar documento', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar documento:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
