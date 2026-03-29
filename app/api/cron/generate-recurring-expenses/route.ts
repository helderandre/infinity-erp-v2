import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Cron endpoint — runs daily (e.g. 02:00 UTC).
 * Generates recurring expense transactions for the current month.
 *
 * Call: GET /api/cron/generate-recurring-expenses?key=<CRON_SECRET>
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && key !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient() as any
    const now = new Date()
    const targetMonth = now.getMonth() + 1
    const targetYear = now.getFullYear()

    // Get active templates
    const { data: templates, error: tplError } = await admin
      .from('company_recurring_templates')
      .select('*')
      .eq('is_active', true)

    if (tplError) {
      console.error('Erro ao obter templates:', tplError)
      return NextResponse.json({ error: tplError.message }, { status: 500 })
    }

    const tplList = (templates || []) as any[]
    if (tplList.length === 0) {
      return NextResponse.json({ generated: 0, message: 'Sem templates activos' })
    }

    let generated = 0

    for (const tpl of tplList) {
      // Check frequency
      const shouldGenerate =
        tpl.frequency === 'monthly' ||
        (tpl.frequency === 'quarterly' && [1, 4, 7, 10].includes(targetMonth)) ||
        (tpl.frequency === 'annual' && targetMonth === 1)

      if (!shouldGenerate) continue

      // Check if already generated for this period
      const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
      const endMonth = targetMonth === 12 ? 1 : targetMonth + 1
      const endYear = targetMonth === 12 ? targetYear + 1 : targetYear
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

      const { count } = await admin
        .from('company_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('recurring_template_id', tpl.id)
        .gte('date', startDate)
        .lt('date', endDate)

      if ((count ?? 0) > 0) continue

      // Calculate amounts
      const vatPct = tpl.vat_pct ?? 23
      const vatAmount = Math.round(tpl.amount_net * (vatPct / 100) * 100) / 100
      const amountGross = Math.round((tpl.amount_net + vatAmount) * 100) / 100

      const dayOfMonth = Math.min(tpl.day_of_month || 1, 28)
      const txDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`

      const { error: insertError } = await admin
        .from('company_transactions')
        .insert({
          date: txDate,
          type: 'expense',
          category: tpl.category,
          subcategory: tpl.subcategory,
          entity_name: tpl.entity_name,
          entity_nif: tpl.entity_nif,
          description: tpl.description || tpl.name,
          amount_net: tpl.amount_net,
          amount_gross: amountGross,
          vat_amount: vatAmount,
          vat_pct: vatPct,
          is_recurring: true,
          recurring_template_id: tpl.id,
          status: 'confirmed',
        })

      if (!insertError) {
        generated++
        await admin
          .from('company_recurring_templates')
          .update({ last_generated_at: new Date().toISOString() })
          .eq('id', tpl.id)
      }
    }

    return NextResponse.json({
      generated,
      month: targetMonth,
      year: targetYear,
      message: `${generated} transaccoes recorrentes geradas para ${String(targetMonth).padStart(2, '0')}/${targetYear}`,
    })
  } catch (error) {
    console.error('Erro no cron de despesas recorrentes:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
