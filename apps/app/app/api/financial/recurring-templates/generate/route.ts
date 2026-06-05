import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const { month, year } = await request.json()
    if (!month || !year) {
      return NextResponse.json({ error: 'Mês e ano obrigatórios' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get active templates
    const { data: templates, error: tplError } = await supabase
      .from('company_recurring_templates' as any)
      .select('*')
      .eq('is_active', true)

    if (tplError) return NextResponse.json({ error: tplError.message }, { status: 500 })
    const tplList = (templates || []) as any[]
    if (tplList.length === 0) {
      return NextResponse.json({ generated: 0, message: 'Sem templates activos' })
    }

    const targetMonth = parseInt(month)
    const targetYear = parseInt(year)
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

      const { count } = await supabase
        .from('company_transactions' as any)
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

      const { error: insertError } = await supabase
        .from('company_transactions' as any)
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
          created_by: auth.user.id,
        })

      if (!insertError) {
        generated++
        // Update last_generated_at
        await supabase
          .from('company_recurring_templates' as any)
          .update({ last_generated_at: new Date().toISOString() })
          .eq('id', tpl.id)
      }
    }

    return NextResponse.json({ generated, message: `${generated} transacções geradas` })
  } catch (error) {
    console.error('Erro ao gerar recorrentes:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
