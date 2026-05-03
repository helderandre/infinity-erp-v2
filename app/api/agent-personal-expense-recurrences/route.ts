import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { personalExpenseRecurrenceCreateSchema } from '@/lib/validations/personal-expense'

// GET — lista recorrências do consultor (default: só activas).
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') !== 'false'

    const supabase = await createClient()
    let query = (supabase as any)
      .from('agent_personal_expense_recurrences')
      .select('*')
      .eq('agent_id', auth.user.id)
      .order('day_of_month', { ascending: true })
      .order('created_at', { ascending: false })

    if (activeOnly) query = query.eq('is_active', true)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Erro ao listar recorrências:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — cria nova recorrência (template). Não dispara geração imediata.
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const body = await request.json()
    const parsed = personalExpenseRecurrenceCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data, error } = await (supabase as any)
      .from('agent_personal_expense_recurrences')
      .insert({
        ...parsed.data,
        agent_id: auth.user.id,
      })
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar recorrência:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
