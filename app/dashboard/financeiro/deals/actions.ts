// @ts-nocheck
"use server"

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { Deal, DealPayment } from '@/types/deal'

const PAGE_SIZE = 25

// ─── 1. getDeals ────────────────────────────────────────────────────────────

export async function getDeals(filters?: {
  consultant_id?: string
  deal_type?: string
  status?: string
  date_from?: string
  date_to?: string
  page?: number
}): Promise<{ deals: Deal[]; total: number; error: string | null }> {
  try {
    const admin = createAdminClient()
    const page = filters?.page ?? 1
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = (admin as any)
      .from('deals')
      .select(
        '*, property:dev_properties!deals_property_id_fkey(id, title, external_ref), consultant:dev_users!deals_consultant_id_fkey(id, commercial_name)',
        { count: 'exact' }
      )
      .order('deal_date', { ascending: false })
      .range(from, to)

    if (filters?.consultant_id) {
      query = query.eq('consultant_id', filters.consultant_id)
    }
    if (filters?.deal_type) {
      query = query.eq('deal_type', filters.deal_type)
    }
    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.date_from) {
      query = query.gte('deal_date', filters.date_from)
    }
    if (filters?.date_to) {
      query = query.lte('deal_date', filters.date_to)
    }

    const { data: deals, count, error } = await query

    if (error) {
      return { deals: [], total: 0, error: error.message }
    }

    if (!deals || deals.length === 0) {
      return { deals: [], total: count ?? 0, error: null }
    }

    // Fetch payments with splits for all deal IDs in one query
    const dealIds = deals.map((d: any) => d.id)
    const { data: payments, error: paymentsError } = await (admin as any)
      .from('deal_payments')
      .select('*, deal_payment_splits(*, agent:dev_users!deal_payment_splits_agent_id_fkey(id, commercial_name))')
      .in('deal_id', dealIds)
      .order('payment_moment', { ascending: true })

    if (paymentsError) {
      return { deals: [], total: 0, error: paymentsError.message }
    }

    // Merge payments into deals (map splits from nested query)
    const paymentsByDeal: Record<string, DealPayment[]> = {}
    for (const p of (payments ?? [])) {
      if (!paymentsByDeal[p.deal_id]) {
        paymentsByDeal[p.deal_id] = []
      }
      paymentsByDeal[p.deal_id].push({
        ...p,
        splits: p.deal_payment_splits || [],
        deal_payment_splits: undefined,
      })
    }

    const dealsWithPayments = deals.map((d: any) => ({
      ...d,
      payments: paymentsByDeal[d.id] ?? [],
    }))

    return { deals: dealsWithPayments, total: count ?? 0, error: null }
  } catch (err: any) {
    return { deals: [], total: 0, error: err.message ?? 'Erro ao carregar negócios' }
  }
}

// ─── 2. getDeal ─────────────────────────────────────────────────────────────

export async function getDeal(id: string): Promise<{ deal: Deal | null; error: string | null }> {
  try {
    const admin = createAdminClient()

    const { data: deal, error } = await (admin as any)
      .from('deals')
      .select(
        '*, property:dev_properties!deals_property_id_fkey(id, title, external_ref), consultant:dev_users!deals_consultant_id_fkey(id, commercial_name)'
      )
      .eq('id', id)
      .single()

    if (error) {
      return { deal: null, error: error.message }
    }

    // Fetch payments with splits
    const { data: payments, error: paymentsError } = await (admin as any)
      .from('deal_payments')
      .select('*, deal_payment_splits(*, agent:dev_users!deal_payment_splits_agent_id_fkey(id, commercial_name))')
      .eq('deal_id', id)
      .order('payment_moment', { ascending: true })

    if (paymentsError) {
      return { deal: null, error: paymentsError.message }
    }

    const mappedPayments = (payments ?? []).map((p: any) => ({
      ...p,
      splits: p.deal_payment_splits || [],
      deal_payment_splits: undefined,
    }))

    return { deal: { ...deal, payments: mappedPayments }, error: null }
  } catch (err: any) {
    return { deal: null, error: err.message ?? 'Erro ao carregar negócio' }
  }
}

// ─── 3. createDeal ──────────────────────────────────────────────────────────

export async function createDeal(data: {
  property_id?: string
  consultant_id: string
  deal_type: string
  deal_value: number
  deal_date: string
  commission_pct: number
  commission_total: number
  has_share: boolean
  share_type?: string
  internal_colleague_id?: string
  share_pct?: number
  share_amount?: number
  partner_agency_name?: string
  partner_contact?: string
  partner_amount?: number
  network_pct?: number
  network_amount?: number
  agency_margin?: number
  consultant_pct?: number
  consultant_amount?: number
  agency_net?: number
  payment_structure: string
  cpcv_pct?: number
  escritura_pct?: number
  reference?: string
  pv_number?: string
  notes?: string
  payments: Array<{
    payment_moment: string
    payment_pct: number
    amount: number
    network_amount: number
    agency_amount: number
    consultant_amount: number
    partner_amount: number
    date?: string
  }>
  partner_tier_pct?: number
  referrals?: Array<{
    side: 'angariacao' | 'negocio'
    agent_id: string
    pct: number
    tier_pct?: number
  }>
}): Promise<{ deal: Deal | null; error: string | null }> {
  try {
    const admin = createAdminClient()
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { deal: null, error: 'Não autenticado' }
    }

    const { payments, referrals: _referrals, partner_tier_pct: _partnerTierPct, ...dealData } = data

    // Insert deal
    const { data: deal, error: dealError } = await (admin as any)
      .from('deals')
      .insert({
        ...dealData,
        property_id: dealData.property_id || null,
        share_type: dealData.share_type || null,
        share_pct: dealData.share_pct ?? null,
        share_amount: dealData.share_amount ?? null,
        partner_agency_name: dealData.partner_agency_name || null,
        partner_contact: dealData.partner_contact || null,
        internal_colleague_id: dealData.internal_colleague_id || null,
        partner_amount: dealData.partner_amount ?? null,
        network_pct: dealData.network_pct ?? null,
        network_amount: dealData.network_amount ?? null,
        agency_margin: dealData.agency_margin ?? null,
        consultant_pct: dealData.consultant_pct ?? null,
        consultant_amount: dealData.consultant_amount ?? null,
        agency_net: dealData.agency_net ?? null,
        cpcv_pct: dealData.cpcv_pct ?? 0,
        escritura_pct: dealData.escritura_pct ?? 0,
        reference: dealData.reference || null,
        pv_number: dealData.pv_number || null,
        notes: dealData.notes || null,
        status: 'active',
        created_by: user.id,
      })
      .select()
      .single()

    if (dealError) {
      return { deal: null, error: dealError.message }
    }

    // Insert payments + splits
    if (payments.length > 0) {
      const paymentRows = payments.map((p) => ({
        deal_id: deal.id,
        payment_moment: p.payment_moment,
        payment_pct: p.payment_pct,
        amount: p.amount,
        network_amount: p.network_amount,
        agency_amount: p.agency_amount,
        consultant_amount: p.consultant_amount,
        partner_amount: p.partner_amount,
        ...(p.date ? { signed_date: p.date } : {}),
      }))

      const { data: createdPayments, error: paymentsError } = await (admin as any)
        .from('deal_payments')
        .insert(paymentRows)
        .select('id, payment_moment, consultant_amount, agency_amount')

      if (paymentsError || !createdPayments) {
        await (admin as any).from('deals').delete().eq('id', deal.id)
        return { deal: null, error: paymentsError?.message || 'Erro ao criar pagamentos' }
      }

      // Create splits for each payment moment
      // Each agent gets their share of agency_margin × their own tier %
      const splitRows: any[] = []
      const isInternalShare = dealData.has_share && dealData.share_type === 'internal_agency'
      const sharePctVal = Number(dealData.share_pct || 50)
      const mainTierPct = Number(dealData.consultant_pct || 0)
      const partnerTierPct = Number(data.partner_tier_pct ?? mainTierPct)
      const referrals = data.referrals || []

      // Referral deductions per side (% taken from that side before tier)
      const sellerRefs = referrals.filter((r) => r.side === 'angariacao')
      const buyerRefs = referrals.filter((r) => r.side === 'negocio')
      const sellerRefPct = sellerRefs.reduce((s, r) => s + r.pct, 0)
      const buyerRefPct = buyerRefs.reduce((s, r) => s + r.pct, 0)

      for (const cp of createdPayments) {
        // agency_amount on the payment is the agency margin for this moment
        const agencyMargin = Number(cp.agency_amount || 0)

        if (isInternalShare) {
          // Each side gets their share of agency_margin
          const sellerMargin = agencyMargin * (sharePctVal / 100)
          const buyerMargin = agencyMargin * ((100 - sharePctVal) / 100)

          // Seller side — main consultant
          const sellerAfterRef = sellerMargin * (1 - sellerRefPct / 100)
          splitRows.push({
            deal_payment_id: cp.id,
            agent_id: dealData.consultant_id,
            role: 'main',
            split_pct: mainTierPct,
            amount: sellerAfterRef * (mainTierPct / 100),
          })

          // Seller referral splits
          for (const ref of sellerRefs) {
            const refBase = sellerMargin * (ref.pct / 100)
            const refTier = ref.tier_pct ?? mainTierPct
            splitRows.push({
              deal_payment_id: cp.id,
              agent_id: ref.agent_id,
              role: 'referral',
              split_pct: refTier,
              amount: refBase * (refTier / 100),
            })
          }

          // Buyer side — partner consultant
          if (dealData.internal_colleague_id) {
            const buyerAfterRef = buyerMargin * (1 - buyerRefPct / 100)
            splitRows.push({
              deal_payment_id: cp.id,
              agent_id: dealData.internal_colleague_id,
              role: 'partner',
              split_pct: partnerTierPct,
              amount: buyerAfterRef * (partnerTierPct / 100),
            })

            // Buyer referral splits
            for (const ref of buyerRefs) {
              const refBase = buyerMargin * (ref.pct / 100)
              const refTier = ref.tier_pct ?? partnerTierPct
              splitRows.push({
                deal_payment_id: cp.id,
                agent_id: ref.agent_id,
                role: 'referral',
                split_pct: refTier,
                amount: refBase * (refTier / 100),
              })
            }
          }
        } else {
          // No internal share — all referrals deduct from main side
          const mainMargin = agencyMargin * (1 - sellerRefPct / 100)
          splitRows.push({
            deal_payment_id: cp.id,
            agent_id: dealData.consultant_id,
            role: 'main',
            split_pct: mainTierPct,
            amount: mainMargin * (mainTierPct / 100),
          })

          for (const ref of sellerRefs) {
            const refBase = agencyMargin * (ref.pct / 100)
            const refTier = ref.tier_pct ?? mainTierPct
            splitRows.push({
              deal_payment_id: cp.id,
              agent_id: ref.agent_id,
              role: 'referral',
              split_pct: refTier,
              amount: refBase * (refTier / 100),
            })
          }
        }
      }

      if (splitRows.length > 0) {
        const { error: splitsError } = await (admin as any)
          .from('deal_payment_splits')
          .insert(splitRows)

        if (splitsError) {
          console.error('Erro ao criar splits:', splitsError.message)
        }
      }

      // Store referrals in deal_referrals table
      if (referrals.length > 0) {
        const referralRows = referrals.map((r) => ({
          deal_id: deal.id,
          side: r.side,
          referral_type: 'interna',
          consultant_id: r.agent_id,
          referral_pct: r.pct,
        }))

        const { error: refError } = await (admin as any)
          .from('deal_referrals')
          .insert(referralRows)

        if (refError) {
          console.error('Erro ao criar referenciações:', refError.message)
        }
      }
    }

    // Return full deal with payments
    return getDeal(deal.id)
  } catch (err: any) {
    return { deal: null, error: err.message ?? 'Erro ao criar negócio' }
  }
}

// ─── 4. updateDeal ──────────────────────────────────────────────────────────

export async function updateDeal(
  id: string,
  data: Partial<{
    property_id: string | null
    consultant_id: string
    deal_type: string
    deal_value: number
    deal_date: string
    commission_pct: number
    commission_total: number
    has_share: boolean
    share_type: string | null
    share_pct: number | null
    share_amount: number | null
    partner_agency_name: string | null
    partner_contact: string | null
    partner_amount: number | null
    network_pct: number | null
    network_amount: number | null
    agency_margin: number | null
    consultant_pct: number | null
    consultant_amount: number | null
    agency_net: number | null
    payment_structure: string
    cpcv_pct: number
    escritura_pct: number
    reference: string | null
    pv_number: string | null
    notes: string | null
    status: string
  }>
): Promise<{ deal: Deal | null; error: string | null }> {
  try {
    const admin = createAdminClient()

    const { data: deal, error } = await (admin as any)
      .from('deals')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return { deal: null, error: error.message }
    }

    return getDeal(deal.id)
  } catch (err: any) {
    return { deal: null, error: err.message ?? 'Erro ao actualizar negócio' }
  }
}

// ─── 5. cancelDeal ──────────────────────────────────────────────────────────

export async function cancelDeal(id: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const admin = createAdminClient()

    const { error } = await (admin as any)
      .from('deals')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Erro ao cancelar negócio' }
  }
}

// ─── 6. updatePaymentStatus ─────────────────────────────────────────────────

export async function updatePaymentStatus(
  paymentId: string,
  field: 'is_signed' | 'is_received' | 'is_reported',
  value: boolean,
  date?: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const admin = createAdminClient()

    // Deal-level fields only (consultant_paid is now on splits via payout system)
    const dateFieldMap: Record<string, string> = {
      is_signed: 'signed_date',
      is_received: 'received_date',
      is_reported: 'reported_date',
    }

    const dateField = dateFieldMap[field]
    const updateData: Record<string, any> = {
      [field]: value,
      [dateField]: value ? (date ?? new Date().toISOString().split('T')[0]) : null,
      updated_at: new Date().toISOString(),
    }

    const { data: payment, error } = await (admin as any)
      .from('deal_payments')
      .update(updateData)
      .eq('id', paymentId)
      .select('*')
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Credits are created automatically by DB trigger when is_received = true.
    // Consultant payment is managed by the payout system via deal_payment_splits.

    // Check if all payments of this deal are fully complete
    const { data: allPayments, error: fetchError } = await (admin as any)
      .from('deal_payments')
      .select('is_received, consultant_paid')
      .eq('deal_id', payment.deal_id)

    if (!fetchError && allPayments) {
      const allComplete = allPayments.every(
        (p: any) => p.is_received === true && p.consultant_paid === true
      )

      if (allComplete) {
        await (admin as any)
          .from('deals')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', payment.deal_id)
      }
    }

    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Erro ao actualizar pagamento' }
  }
}

// ─── 7. updatePaymentInvoice (deal-level: agency + network invoices) ────────

export async function updatePaymentInvoice(
  paymentId: string,
  data: {
    signed_date?: string | null
    received_date?: string | null
    reported_date?: string | null
    consultant_paid_date?: string | null
    agency_invoice_number?: string
    agency_invoice_date?: string
    agency_invoice_recipient?: string
    agency_invoice_recipient_nif?: string
    agency_invoice_amount_net?: number
    agency_invoice_amount_gross?: number
    network_invoice_number?: string
    network_invoice_date?: string
  }
): Promise<{ success: boolean; error: string | null }> {
  try {
    const admin = createAdminClient()

    const { error } = await (admin as any)
      .from('deal_payments')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', paymentId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Erro ao actualizar factura' }
  }
}

// ─── 7b. updateSplitInvoice (per-agent: consultant invoice) ────────────────

export async function updateSplitInvoice(
  splitId: string,
  data: {
    consultant_invoice_number?: string
    consultant_invoice_date?: string
    consultant_invoice_type?: string
  }
): Promise<{ success: boolean; error: string | null }> {
  try {
    const admin = createAdminClient()

    const { error } = await (admin as any)
      .from('deal_payment_splits')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', splitId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Erro ao actualizar factura do consultor' }
  }
}

// ─── 7c. updateSplitPaid (per-agent: consultant_paid toggle) ─────────────────

export async function updateSplitPaid(
  splitId: string,
  value: boolean,
  date?: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const admin = createAdminClient()

    const { error } = await (admin as any)
      .from('deal_payment_splits')
      .update({
        consultant_paid: value,
        consultant_paid_date: value ? (date ?? new Date().toISOString().split('T')[0]) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', splitId)

    if (error) return { success: false, error: error.message }
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Erro ao actualizar estado de pagamento' }
  }
}

// ─── 8. getDealStats ────────────────────────────────────────────────────────

export async function getDealStats(): Promise<{
  total_deals: number
  active_deals: number
  total_commission: number
  pending_payments: number
  received_payments: number
  consultant_pending: number
  error: string | null
}> {
  try {
    const admin = createAdminClient()

    // Get deal counts and totals
    const { data: deals, error: dealsError } = await (admin as any)
      .from('deals')
      .select('id, status, commission_total')

    if (dealsError) {
      return {
        total_deals: 0, active_deals: 0, total_commission: 0,
        pending_payments: 0, received_payments: 0, consultant_pending: 0,
        error: dealsError.message,
      }
    }

    const total_deals = deals?.length ?? 0
    const active_deals = deals?.filter((d: any) => d.status === 'active').length ?? 0
    const total_commission = deals
      ?.filter((d: any) => d.status !== 'cancelled')
      .reduce((sum: number, d: any) => sum + (d.commission_total ?? 0), 0) ?? 0

    // Get payment stats
    const { data: payments, error: paymentsError } = await (admin as any)
      .from('deal_payments')
      .select('amount, is_received, consultant_paid, consultant_amount')

    if (paymentsError) {
      return {
        total_deals, active_deals, total_commission,
        pending_payments: 0, received_payments: 0, consultant_pending: 0,
        error: paymentsError.message,
      }
    }

    const pending_payments = payments
      ?.filter((p: any) => !p.is_received)
      .reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0) ?? 0

    const received_payments = payments
      ?.filter((p: any) => p.is_received)
      .reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0) ?? 0

    const consultant_pending = payments
      ?.filter((p: any) => !p.consultant_paid)
      .reduce((sum: number, p: any) => sum + (p.consultant_amount ?? 0), 0) ?? 0

    return {
      total_deals,
      active_deals,
      total_commission,
      pending_payments,
      received_payments,
      consultant_pending,
      error: null,
    }
  } catch (err: any) {
    return {
      total_deals: 0, active_deals: 0, total_commission: 0,
      pending_payments: 0, received_payments: 0, consultant_pending: 0,
      error: err.message ?? 'Erro ao carregar estatísticas',
    }
  }
}

// ─── 9. getConsultantsForSelect ─────────────────────────────────────────────

export async function getConsultantsForSelect(): Promise<{
  consultants: { id: string; commercial_name: string }[]
  error: string | null
}> {
  try {
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('dev_users')
      .select('id, commercial_name')
      .eq('is_active', true)
      .order('commercial_name', { ascending: true })

    if (error) {
      return { consultants: [], error: error.message }
    }

    return { consultants: data ?? [], error: null }
  } catch (err: any) {
    return { consultants: [], error: err.message ?? 'Erro ao carregar consultores' }
  }
}

// ─── 10. getPropertiesForSelect ─────────────────────────────────────────────

export async function getPropertiesForSelect(search?: string): Promise<{
  properties: { id: string; title: string; external_ref: string }[]
  error: string | null
}> {
  try {
    const admin = createAdminClient()

    let query = admin
      .from('dev_properties')
      .select('id, title, external_ref')
      .order('created_at', { ascending: false })
      .limit(20)

    if (search && search.trim().length > 0) {
      query = query.or(`title.ilike.%${search}%,external_ref.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      return { properties: [], error: error.message }
    }

    return { properties: data ?? [], error: null }
  } catch (err: any) {
    return { properties: [], error: err.message ?? 'Erro ao carregar imóveis' }
  }
}
