import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { bankSchema } from '@/lib/validations/credit'

export async function GET() {
  try {
    const auth = await requirePermission('credit')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const db = supabase as any // TEMP tables not in generated types

    const { data, error } = await db
      .from('temp_credito_bancos')
      .select('*')
      .eq('is_active', true)
      .order('nome', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar bancos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('credit')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const db = supabase as any // TEMP tables not in generated types

    const body = await request.json()
    const validation = bankSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { data: bank, error } = await db
      .from('temp_credito_bancos')
      .insert(validation.data)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao criar banco', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(bank, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar banco:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
