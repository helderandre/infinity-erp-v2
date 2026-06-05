import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { bankSchema } from '@/lib/validations/credit'

const uuidRegex = /^[0-9a-f-]{36}$/

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ bankId: string }> }
) {
  try {
    const auth = await requirePermission('credit')
    if (!auth.authorized) return auth.response

    const { bankId } = await params

    if (!uuidRegex.test(bankId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const supabase = await createClient()
    const db = supabase as any // TEMP tables not in generated types

    const body = await request.json()
    const validation = bankSchema.partial().safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { data: bank, error } = await db
      .from('temp_credito_bancos')
      .update(validation.data)
      .eq('id', bankId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Banco não encontrado' }, { status: 404 })
      }
      return NextResponse.json(
        { error: 'Erro ao actualizar banco', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(bank)
  } catch (error) {
    console.error('Erro ao actualizar banco:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ bankId: string }> }
) {
  try {
    const auth = await requirePermission('credit')
    if (!auth.authorized) return auth.response

    const { bankId } = await params

    if (!uuidRegex.test(bankId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const supabase = await createClient()
    const db = supabase as any // TEMP tables not in generated types

    // Soft delete — desactivar banco
    const { data: bank, error } = await db
      .from('temp_credito_bancos')
      .update({ is_active: false })
      .eq('id', bankId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Banco não encontrado' }, { status: 404 })
      }
      return NextResponse.json(
        { error: 'Erro ao eliminar banco', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao eliminar banco:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
