import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

export async function GET(request: Request) {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(request.url)
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endMonth = month === 12 ? 1 : month + 1
    const endYear = month === 12 ? year + 1 : year
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

    const supabase = await createClient()

    // 1. Revenue: deal_payments received this month
    const { data: receivedPayments } = await (supabase as any)
      .from('deal_payments')
      .select('amount, agency_amount, consultant_amount, network_amount')
      .eq('is_received', true)
      .gte('received_date', startDate)
      .lt('received_date', endDate)

    const revenueThisMonth = (receivedPayments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
    const agencyRevenueThisMonth = (receivedPayments || []).reduce((s: number, p: any) => s + Number(p.agency_amount || 0), 0)

    // 2. Expenses: company_transactions this month
    const { data: expenses } = await (supabase as any)
      .from('company_transactions')
      .select('amount_gross, amount_net')
      .eq('type', 'expense')
      .neq('status', 'cancelled')
      .gte('date', startDate)
      .lt('date', endDate)

    const expensesThisMonth = (expenses || []).reduce((s: number, t: any) => s + Number(t.amount_gross || t.amount_net || 0), 0)

    // 3. Pipeline: pending financial events
    const { data: signedNotReceived } = await (supabase as any)
      .from('deal_payments')
      .select('amount')
      .eq('is_signed', true)
      .eq('is_received', false)

    const { data: receivedNotReported } = await (supabase as any)
      .from('deal_payments')
      .select('amount')
      .eq('is_received', true)
      .eq('is_reported', false)

    const { data: pendingConsultantPay } = await (supabase as any)
      .from('deal_payments')
      .select('consultant_amount')
      .eq('is_received', true)
      .eq('consultant_paid', false)

    const pipeline = {
      signed_pending_receipt: (signedNotReceived || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0),
      received_pending_report: (receivedNotReported || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0),
      pending_consultant_payment: (pendingConsultantPay || []).reduce((s: number, p: any) => s + Number(p.consultant_amount || 0), 0),
    }

    // 4. Portfolio
    const { data: activeProperties } = await supabase
      .from('dev_properties')
      .select('listing_price')
      .in('status', ['active', 'available'])

    const activeVolume = (activeProperties || []).reduce((s: number, p: any) => s + Number(p.listing_price || 0), 0)
    const potentialRevenue = activeVolume * 0.05 // Assume 5% avg commission

    // 5. Monthly evolution (last 12 months)
    const monthlyEvolution: { month: string; report: number; margin: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1)
      const mStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      const mEndStr = `${mEnd.getFullYear()}-${String(mEnd.getMonth() + 1).padStart(2, '0')}-01`

      const { data: mPayments } = await (supabase as any)
        .from('deal_payments')
        .select('amount, agency_amount')
        .eq('is_received', true)
        .gte('received_date', mStart)
        .lt('received_date', mEndStr)

      const mReport = (mPayments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
      const mMargin = (mPayments || []).reduce((s: number, p: any) => s + Number(p.agency_amount || 0), 0)

      monthlyEvolution.push({
        month: `${d.getMonth() + 1}/${d.getFullYear()}`,
        report: mReport,
        margin: mMargin,
      })
    }

    const resultThisMonth = agencyRevenueThisMonth - expensesThisMonth
    const marginPct = revenueThisMonth > 0 ? Math.round((resultThisMonth / revenueThisMonth) * 100) : 0

    return NextResponse.json({
      revenue_this_month: revenueThisMonth,
      expenses_this_month: expensesThisMonth,
      result_this_month: resultThisMonth,
      margin_pct: marginPct,
      pipeline,
      portfolio: {
        active_volume: activeVolume,
        potential_revenue: potentialRevenue,
      },
      monthly_evolution: monthlyEvolution,
    })
  } catch (error) {
    console.error('Erro dashboard financeiro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
