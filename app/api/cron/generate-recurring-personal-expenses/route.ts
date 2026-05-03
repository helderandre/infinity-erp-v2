import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Cron diário — gera despesas pessoais a partir de recorrências activas.
 *
 * Auth: GET /api/cron/generate-recurring-personal-expenses?key=<CRON_SECRET>
 *
 * Lógica por linha de `agent_personal_expense_recurrences` activa:
 *   - se `today >= start_date`
 *   - e `(end_date IS NULL OR today <= end_date)`
 *   - e `effective_day_today = day_of_month` (clamped ao último dia do mês)
 *   - e `last_generated_at` é null OU está num mês anterior a hoje
 *   → INSERT em `agent_personal_expenses` com snapshot dos campos
 *   → UPDATE da recorrência com `last_generated_at = today`
 *
 * Idempotente: se correr duas vezes no mesmo dia, a segunda passa a check
 * de `last_generated_at`.
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

    const today = new Date()
    const todayIso = today.toISOString().slice(0, 10)
    const todayDay = today.getUTCDate()
    const lastDayThisMonth = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)
    ).getUTCDate()

    const monthStart = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-01`

    // Busca todas as recorrências activas e filtra em JS (volume é baixo).
    const { data: rules, error: rulesErr } = await admin
      .from('agent_personal_expense_recurrences')
      .select('*')
      .eq('is_active', true)
      .lte('start_date', todayIso)

    if (rulesErr) {
      return NextResponse.json({ error: rulesErr.message }, { status: 500 })
    }

    let created = 0
    const errors: string[] = []

    for (const rule of rules || []) {
      // Não correr para regras com end_date no passado
      if (rule.end_date && rule.end_date < todayIso) continue

      // Dia efectivo hoje: se day_of_month > último dia do mês, usa o último.
      const effectiveDay = Math.min(rule.day_of_month, lastDayThisMonth)
      if (effectiveDay !== todayDay) continue

      // Já gerada este mês?
      if (rule.last_generated_at && rule.last_generated_at >= monthStart) continue

      // Insert despesa
      const { error: insErr } = await admin
        .from('agent_personal_expenses')
        .insert({
          agent_id: rule.agent_id,
          expense_date: todayIso,
          category: rule.category,
          description: rule.description,
          vendor_name: rule.vendor_name,
          vendor_nif: rule.vendor_nif,
          amount_gross: rule.amount_gross,
          amount_net: rule.amount_net,
          vat_amount: rule.vat_amount,
          vat_pct: rule.vat_pct,
          invoice_number: rule.invoice_number,
          notes: rule.notes,
          recurrence_id: rule.id,
        })

      if (insErr) {
        errors.push(`rule ${rule.id}: ${insErr.message}`)
        continue
      }

      const { error: updErr } = await admin
        .from('agent_personal_expense_recurrences')
        .update({ last_generated_at: todayIso })
        .eq('id', rule.id)

      if (updErr) {
        // Não-bloqueante, mas log
        console.warn(`Falha ao actualizar last_generated_at para ${rule.id}:`, updErr)
      }

      created++
    }

    return NextResponse.json({
      ok: true,
      today: todayIso,
      rules_evaluated: rules?.length ?? 0,
      created,
      errors,
    })
  } catch (error: any) {
    console.error('Erro no cron de recorrências:', error)
    return NextResponse.json({ error: error?.message ?? 'Erro interno' }, { status: 500 })
  }
}
