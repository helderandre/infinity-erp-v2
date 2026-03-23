import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { companyCategorySchema } from '@/lib/validations/financial'

export async function GET() {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('company_categories' as any)
      .select('*')
      .order('order_index', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao listar categorias:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const body = await request.json()
    const parsed = companyCategorySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const supabase = await createClient()

    // Get max order_index
    const { data: maxRow } = await supabase
      .from('company_categories' as any)
      .select('order_index')
      .order('order_index', { ascending: false })
      .limit(1)
      .single()

    const nextOrder = ((maxRow as any)?.order_index ?? 0) + 1

    const { data, error } = await supabase
      .from('company_categories' as any)
      .insert({ ...parsed.data, order_index: nextOrder })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar categoria:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
