import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { companyTransactionSchema } from '@/lib/validations/financial'

export async function GET(request: Request) {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const category = searchParams.get('category')
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 25
    const offset = (page - 1) * limit

    const supabase = await createClient()
    let query = supabase
      .from('company_transactions' as any)
      .select('*', { count: 'exact' })

    // Filter by month/year
    if (month && year) {
      const startDate = `${year}-${month.padStart(2, '0')}-01`
      const endMonth = parseInt(month)
      const endYear = endMonth === 12 ? parseInt(year) + 1 : parseInt(year)
      const endM = endMonth === 12 ? 1 : endMonth + 1
      const endDate = `${endYear}-${String(endM).padStart(2, '0')}-01`
      query = query.gte('date', startDate).lt('date', endDate)
    }

    if (category) query = query.eq('category', category)
    if (type) query = query.eq('type', type)
    if (status) query = query.eq('status', status)

    const { data, error, count } = await query
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      page,
      total_pages: Math.ceil((count || 0) / limit),
    })
  } catch (error) {
    console.error('Erro ao listar transacções:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const body = await request.json()
    const parsed = companyTransactionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    // Auto-calculate gross if not provided
    const input = { ...parsed.data }
    if (input.amount_net && input.vat_pct && !input.amount_gross) {
      input.vat_amount = Math.round(input.amount_net * (input.vat_pct / 100) * 100) / 100
      input.amount_gross = Math.round((input.amount_net + input.vat_amount) * 100) / 100
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('company_transactions' as any)
      .insert({ ...input, created_by: auth.user.id })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar transacção:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
