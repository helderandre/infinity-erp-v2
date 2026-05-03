import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { personalExpenseCreateSchema } from '@/lib/validations/personal-expense'

// GET — listagem paginada das despesas do próprio.
//
// Query params:
//   from        ISO date (inclusive)
//   to          ISO date (inclusive)
//   category    filtro exacto
//   page        default 1
//   limit       default 30, max 50
//
// Scope forçado a auth.user.id. Não há override por gestão (RLS bloquearia mesmo).
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const category = searchParams.get('category')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 30))
    const offset = (page - 1) * limit

    let query = (supabase as any)
      .from('agent_personal_expenses')
      .select('*', { count: 'exact' })
      .eq('agent_id', auth.user.id)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (from) query = query.gte('expense_date', from)
    if (to) query = query.lte('expense_date', to)
    if (category) query = query.eq('category', category)

    const { data, error, count } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: data || [],
      page,
      limit,
      total: count || 0,
      hasMore: (count || 0) > offset + (data?.length || 0),
    })
  } catch (error) {
    console.error('Erro ao listar despesas pessoais:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — criar uma despesa pessoal. agent_id é forçado a auth.user.id.
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const body = await request.json()
    const parsed = personalExpenseCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data, error } = await (supabase as any)
      .from('agent_personal_expenses')
      .insert({
        ...parsed.data,
        agent_id: auth.user.id,
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar despesa pessoal:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
