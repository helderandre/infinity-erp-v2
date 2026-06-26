/**
 * recomputeDealPayments — propaga uma alteração aos dados-base do negócio
 * (valor, % de comissão, partilha, escalão) para as linhas calculadas em
 * `deal_payments` / `deal_payment_splits`, que o mapa de gestão lê.
 *
 * Política (override pattern — ver /overridable-computed-values-portable-spec.md §6):
 *   - PRESERVA pagamentos com `amounts_locked` (edição manual) e partes
 *     `is_manual` / com `amount_override` / `consultant_paid`.
 *   - NUNCA toca em pagamentos já faturados (moloni_status ∈ {1,2}) ou recebidos.
 *   - Reescala as partes não-protegidas pelo factor de variação da margem da
 *     agência (preserva referências e escalões).
 *   - Devolve a lista de momentos saltados para a UI poder avisar.
 *
 * Sem gate de permissão — é uma propagação de sistema. O caller decide quem
 * pode disparar (a server action `recalcDealPayments` faz o gate `financial`;
 * a edição do negócio dispara automaticamente). Usa admin client (bypass RLS).
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { computeDealFinancials, momentAmounts } from '@/lib/processes/neg/compute-deal-financials'

/* eslint-disable @typescript-eslint/no-explicit-any */

function getTierRatePct(tiers: any[], dealValue: number, businessType: string): number {
  const applicable = (tiers || [])
    .filter((t) => t.business_type === businessType)
    .find((t) => dealValue >= t.min_value && (t.max_value == null || dealValue < t.max_value))
  return applicable ? Number(applicable.consultant_rate) : 50
}

export interface RecomputeResult {
  ok: boolean
  error?: string
  updated: number
  skipped: { moment: string; reason: string }[]
}

export async function recomputeDealPayments(
  dealId: string,
  actorId?: string | null,
): Promise<RecomputeResult> {
  try {
    const admin = createAdminClient() as any

    const { data: deal, error: dErr } = await admin
      .from('deals')
      .select('id, deal_value, commission_pct, has_share, share_pct, business_type')
      .eq('id', dealId)
      .single()
    if (dErr || !deal) return { ok: false, error: 'Negócio não encontrado', updated: 0, skipped: [] }

    const { data: networkSetting } = await admin
      .from('agency_settings').select('value').eq('key', 'network_pct').single()
    const networkPct = parseFloat(networkSetting?.value ?? '8') / 100

    const { data: tiers } = await admin
      .from('commission_tiers').select('*').eq('is_active', true).order('order_index')

    const dealValue = Number(deal.deal_value)
    const businessType = deal.business_type || 'venda'
    const mainTierRate = getTierRatePct(tiers ?? [], dealValue, businessType) / 100

    const fin = computeDealFinancials({
      dealValue,
      commissionPctFraction: Number(deal.commission_pct) / 100,
      hasShare: !!deal.has_share,
      sharePctValue: Number(deal.share_pct || 50),
      networkPctFraction: networkPct,
      mainTierRateFraction: mainTierRate,
    })

    // Agregados ao nível do negócio (resumo lateral).
    await admin.from('deals').update({
      commission_total: fin.commission_total,
      network_pct: networkPct * 100,
      network_amount: fin.network_amount,
      agency_margin: fin.agency_margin,
      consultant_pct: mainTierRate * 100,
      consultant_amount: fin.consultant_amount,
      agency_net: fin.agency_net,
      partner_amount: fin.partner_amount,
      share_amount: fin.share_amount,
      updated_at: new Date().toISOString(),
    }).eq('id', dealId)

    const { data: payments } = await admin
      .from('deal_payments')
      .select('id, payment_moment, payment_pct, agency_amount, is_received, moloni_status, amounts_locked, deal_payment_splits(id, is_manual, is_deleted, consultant_paid, amount, amount_override)')
      .eq('deal_id', dealId)

    let updated = 0
    const skipped: { moment: string; reason: string }[] = []

    for (const p of (payments ?? [])) {
      if (p.moloni_status === 1 || p.moloni_status === 2) {
        skipped.push({ moment: p.payment_moment, reason: 'fatura emitida/creditada' }); continue
      }
      if (p.is_received) {
        skipped.push({ moment: p.payment_moment, reason: 'já recebido' }); continue
      }
      if (p.amounts_locked) {
        skipped.push({ moment: p.payment_moment, reason: 'edição manual' }); continue
      }

      const desired = momentAmounts(fin, Number(p.payment_pct))
      const oldAgencyAuto = Number(p.agency_amount ?? 0)
      const factor = oldAgencyAuto > 0 ? desired.agency_amount / oldAgencyAuto : null

      const { error: upErr } = await admin.from('deal_payments').update({
        amount: desired.amount,
        network_amount: desired.network_amount,
        agency_amount: desired.agency_amount,
        consultant_amount: desired.consultant_amount,
        partner_amount: desired.partner_amount,
        updated_at: new Date().toISOString(),
      }).eq('id', p.id)
      if (upErr) continue
      updated++

      // Reescala as partes não-protegidas (não manuais, não pagas, não eliminadas,
      // sem override próprio) pelo factor de variação da margem da agência.
      if (factor != null) {
        for (const s of (p.deal_payment_splits ?? [])) {
          if (s.is_deleted || s.is_manual || s.consultant_paid || s.amount_override != null) continue
          await admin.from('deal_payment_splits')
            .update({ amount: Number(s.amount ?? 0) * factor, updated_at: new Date().toISOString() })
            .eq('id', s.id)
        }
      }
    }

    try {
      await admin.from('deal_payment_overrides').insert({
        deal_id: dealId, payment_id: null, split_id: null,
        entity: 'payment', action: 'recompute', field: null,
        old_value: null, new_value: { updated, skipped: skipped.length },
        reason: 'Recálculo automático', actor_id: actorId ?? null,
      })
    } catch { /* auditoria best-effort */ }

    return { ok: true, updated, skipped }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Erro ao recalcular', updated: 0, skipped: [] }
  }
}
