import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

// GET /api/agent-personal-expenses/summary?from=&to=
//
// Devolve agregados das despesas pessoais do consultor:
//   {
//     total_amount: number,
//     count: number,
//     by_category: [{ category, amount, count }],
//     month_amount: number,         -- mês corrente
//     ytd_amount: number,           -- ano corrente
//   }
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const supabase = await createClient()

    // Filtered window (default = ano corrente)
    const now = new Date()
    const yearStart = `${now.getFullYear()}-01-01`
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    let query = (supabase as any)
      .from('agent_personal_expenses')
      .select('expense_date, category, amount_gross')
      .eq('agent_id', auth.user.id)

    if (from) query = query.gte('expense_date', from)
    if (to) query = query.lte('expense_date', to)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let total_amount = 0
    let count = 0
    let month_amount = 0
    let ytd_amount = 0
    const byCat = new Map<string, { amount: number; count: number }>()

    for (const r of data || []) {
      const amt = Number(r.amount_gross || 0)
      total_amount += amt
      count++
      const cat = r.category || 'Outras'
      const cur = byCat.get(cat) || { amount: 0, count: 0 }
      cur.amount += amt
      cur.count++
      byCat.set(cat, cur)

      if (r.expense_date >= yearStart) ytd_amount += amt
      if (r.expense_date >= monthStart) month_amount += amt
    }

    const by_category = Array.from(byCat.entries())
      .map(([category, v]) => ({ category, amount: v.amount, count: v.count }))
      .sort((a, b) => b.amount - a.amount)

    return NextResponse.json({
      total_amount,
      count,
      by_category,
      month_amount,
      ytd_amount,
    })
  } catch (error) {
    console.error('Erro ao calcular resumo de despesas:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
