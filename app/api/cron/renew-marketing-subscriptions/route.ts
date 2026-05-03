import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Cron diário — renova subscrições mensais/trimestrais/anuais da loja
 * institucional.
 *
 * Auth: GET /api/cron/renew-marketing-subscriptions?key=<CRON_SECRET>
 *
 * Lógica:
 * 1. Lê `marketing_subscriptions` activas onde `next_billing_date <= today`.
 * 2. Para cada uma:
 *    a. Se `cancel_at_period_end=true` → marca cancelled e termina.
 *    b. Senão, lê o `order_item` original e o respectivo `order` para
 *       herdar payment_method e propriedade (se for o caso).
 *    c. Cria nova `marketing_orders` com `status='accepted'` (auto-aprovado).
 *    d. Cria nova `marketing_order_items` (snapshot).
 *    e. Se payment_method='conta_corrente' → INSERT debit confirmed em CC
 *       com novo balance_after.
 *    f. Se payment_method='invoice' → o trigger SQL
 *       `trg_marketing_order_invoice_to_expense_insert` cria automaticamente
 *       a entry em `agent_personal_expenses`.
 *    g. Avança current_period_*, next_billing_date, last_billing_attempt.
 *
 * Idempotente — se correr duas vezes no mesmo dia, a 2ª execução vê o
 * `next_billing_date` já avançado e skipa.
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

    // Subscrições devidas hoje
    const { data: dueSubs, error: subsErr } = await admin
      .from('marketing_subscriptions')
      .select(`
        id, agent_id, order_item_id, catalog_item_id, billing_cycle,
        price_per_cycle, current_period_start, current_period_end,
        next_billing_date, cancel_at_period_end, failed_billing_count
      `)
      .eq('status', 'active')
      .lte('next_billing_date', todayIso)

    if (subsErr) {
      return NextResponse.json({ error: subsErr.message }, { status: 500 })
    }

    let renewed = 0
    let cancelled = 0
    const errors: string[] = []

    for (const sub of dueSubs || []) {
      try {
        // (a) Cancelar no fim do período se foi marcado para tal
        if (sub.cancel_at_period_end) {
          await admin
            .from('marketing_subscriptions')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', sub.id)
          cancelled++
          continue
        }

        // (b) Lê o original order_item + order para snapshot
        const { data: origItem } = await admin
          .from('marketing_order_items')
          .select(`
            id, order_id, catalog_item_id, pack_id, name, price,
            order:marketing_orders(
              id, agent_id, payment_method, property_id, address,
              postal_code, city, parish, property_type, typology,
              area_m2, contact_is_agent, contact_name, contact_phone,
              contact_relationship, property_bundle_data
            )
          `)
          .eq('id', sub.order_item_id)
          .maybeSingle()

        if (!origItem || !origItem.order) {
          errors.push(`sub ${sub.id}: original order_item não encontrado`)
          continue
        }

        const origOrder = Array.isArray(origItem.order) ? origItem.order[0] : origItem.order
        const paymentMethod = origOrder?.payment_method ?? 'conta_corrente'

        // (c) Cria nova marketing_orders auto-aceite
        const { data: newOrder, error: newOrderErr } = await admin
          .from('marketing_orders')
          .insert({
            agent_id: sub.agent_id,
            status: 'accepted', // auto-aprovado: a inicial já passou aprovação
            total_amount: sub.price_per_cycle,
            payment_method: paymentMethod,
            property_id: origOrder?.property_id ?? null,
            address: origOrder?.address ?? null,
            postal_code: origOrder?.postal_code ?? null,
            city: origOrder?.city ?? null,
            parish: origOrder?.parish ?? null,
            property_type: origOrder?.property_type ?? null,
            typology: origOrder?.typology ?? null,
            area_m2: origOrder?.area_m2 ?? null,
            contact_is_agent: origOrder?.contact_is_agent ?? true,
            contact_name: origOrder?.contact_name ?? null,
            contact_phone: origOrder?.contact_phone ?? null,
            contact_relationship: origOrder?.contact_relationship ?? null,
            property_bundle_data: origOrder?.property_bundle_data ?? null,
            internal_notes: `Renovação automática da subscrição ${sub.id} — ciclo ${sub.billing_cycle}`,
          })
          .select('id')
          .single()

        if (newOrderErr || !newOrder) {
          errors.push(`sub ${sub.id}: erro a criar nova order — ${newOrderErr?.message ?? 'sem dados'}`)
          continue
        }

        // (d) Cria order_item snapshot (1 item, o original)
        await admin.from('marketing_order_items').insert({
          order_id: newOrder.id,
          catalog_item_id: origItem.catalog_item_id,
          pack_id: origItem.pack_id,
          name: origItem.name,
          price: sub.price_per_cycle,
          status: 'available',
        })

        // (e) Para CC: insert debit confirmed (auto-aprovado)
        if (paymentMethod === 'conta_corrente') {
          const { data: lastTx } = await admin
            .from('conta_corrente_transactions')
            .select('balance_after')
            .eq('agent_id', sub.agent_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          const currentBalance = Number(lastTx?.balance_after ?? 0)
          const newBalance = currentBalance - Number(sub.price_per_cycle)

          await admin.from('conta_corrente_transactions').insert({
            agent_id: sub.agent_id,
            type: 'DEBIT',
            category: 'marketing_purchase',
            amount: sub.price_per_cycle,
            description: `Renovação subscrição — ${origItem.name}`,
            settlement_status: 'confirmed',
            reference_id: newOrder.id,
            reference_type: 'marketing_order',
            balance_after: newBalance,
          })
        }
        // (f) Para invoice: o trigger SQL trata da personal_expense.

        // (g) Avança o ciclo da subscrição
        const periodStart = new Date(sub.next_billing_date)
        const periodEnd = new Date(periodStart)
        if (sub.billing_cycle === 'quarterly') {
          periodEnd.setMonth(periodEnd.getMonth() + 3)
        } else if (sub.billing_cycle === 'yearly') {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1)
        } else {
          periodEnd.setMonth(periodEnd.getMonth() + 1)
        }

        await admin
          .from('marketing_subscriptions')
          .update({
            current_period_start: periodStart.toISOString().slice(0, 10),
            current_period_end: periodEnd.toISOString().slice(0, 10),
            next_billing_date: periodEnd.toISOString().slice(0, 10),
            last_billing_attempt: new Date().toISOString(),
            failed_billing_count: 0,
            last_billing_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sub.id)

        renewed++
      } catch (innerErr: any) {
        errors.push(`sub ${sub.id}: ${innerErr?.message ?? 'erro'}`)
        // Incrementa failed_billing_count para flagging
        await admin
          .from('marketing_subscriptions')
          .update({
            failed_billing_count: (sub.failed_billing_count ?? 0) + 1,
            last_billing_error: String(innerErr?.message ?? 'erro'),
            last_billing_attempt: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', sub.id)
      }
    }

    return NextResponse.json({
      ok: true,
      today: todayIso,
      due: (dueSubs ?? []).length,
      renewed,
      cancelled,
      errors,
    })
  } catch (error: any) {
    console.error('Erro no cron de renovação de subscrições:', error)
    return NextResponse.json({ error: error?.message ?? 'Erro interno' }, { status: 500 })
  }
}
