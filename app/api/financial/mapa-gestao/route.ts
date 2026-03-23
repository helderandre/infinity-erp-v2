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
    const consultantId = searchParams.get('consultant_id')
    const dealType = searchParams.get('deal_type')
    const businessType = searchParams.get('business_type')

    // Date range for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endMonth = month === 12 ? 1 : month + 1
    const endYear = month === 12 ? year + 1 : year
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

    const supabase = await createClient()

    // Build deal query — fetch deals with payments where deal_date is in the month
    // OR where any deal_payment signed_date is in the month
    let query = supabase
      .from('deals')
      .select(`
        id, reference, pv_number, remax_draft_number,
        deal_type, deal_value, deal_date, business_type,
        commission_pct, commission_type, commission_total,
        has_share, share_type, share_pct, share_amount,
        consultant_amount, network_amount, agency_margin, agency_net,
        partner_amount, partner_agency_name,
        internal_colleague_id,
        consultant_pct,
        status, proc_instance_id,
        consultant:dev_users!deals_consultant_id_fkey(id, commercial_name),
        colleague:dev_users!deals_internal_colleague_id_fkey(id, commercial_name),
        property:dev_properties!deals_property_id_fkey(id, title, external_ref),
        deal_payments(
          id, payment_moment, payment_pct, amount,
          network_amount, agency_amount, consultant_amount, partner_amount,
          is_signed, signed_date,
          is_received, received_date,
          is_reported, reported_date,
          agency_invoice_number, agency_invoice_date,
          agency_invoice_recipient, agency_invoice_recipient_nif,
          agency_invoice_amount_net, agency_invoice_amount_gross,
          agency_invoice_id,
          network_invoice_number, network_invoice_date,
          consultant_invoice_number, consultant_invoice_date, consultant_invoice_type,
          consultant_paid, consultant_paid_date,
          notes
        )
      `)
      .in('status', ['submitted', 'active', 'completed'])
      .gte('deal_date', startDate)
      .lt('deal_date', endDate)

    // When filtering by consultant, also include deals where they are the internal colleague
    // or where they appear as a referral consultant
    if (consultantId) query = query.or(`consultant_id.eq.${consultantId},internal_colleague_id.eq.${consultantId}`)
    if (dealType) query = query.eq('deal_type', dealType)
    if (businessType) query = query.eq('business_type', businessType)

    const { data: deals, error } = await query.order('deal_date', { ascending: true })

    if (error) {
      console.error('Erro mapa gestão:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch all referrals for the deals in one query
    const dealIds = (deals || []).map((d: any) => d.id)
    let referralsMap: Record<string, any[]> = {}
    if (dealIds.length > 0) {
      const { data: allReferrals } = await (supabase as any)
        .from('deal_referrals')
        .select('*, consultant:dev_users!deal_referrals_consultant_id_fkey(id, commercial_name)')
        .in('deal_id', dealIds)

      for (const ref of (allReferrals || [])) {
        if (!referralsMap[ref.deal_id]) referralsMap[ref.deal_id] = []
        referralsMap[ref.deal_id].push(ref)
      }
    }

    // Also check if consultant appears as a referral (for filtering)
    let referralDealIds: string[] = []
    if (consultantId) {
      const { data: refDeals } = await (supabase as any)
        .from('deal_referrals')
        .select('deal_id')
        .eq('consultant_id', consultantId)
        .eq('referral_type', 'interna')
      referralDealIds = (refDeals || []).map((r: any) => r.deal_id)

      // Fetch those extra deals if not already loaded
      const missingIds = referralDealIds.filter((id) => !dealIds.includes(id))
      if (missingIds.length > 0) {
        const { data: extraDeals } = await supabase
          .from('deals')
          .select(`
            id, reference, pv_number, remax_draft_number,
            deal_type, deal_value, deal_date, business_type,
            commission_pct, commission_type, commission_total,
            has_share, share_type, share_pct, share_amount,
            consultant_amount, network_amount, agency_margin, agency_net,
            partner_amount, partner_agency_name,
            internal_colleague_id, consultant_pct,
            status, proc_instance_id,
            consultant:dev_users!deals_consultant_id_fkey(id, commercial_name),
            colleague:dev_users!deals_internal_colleague_id_fkey(id, commercial_name),
            property:dev_properties!deals_property_id_fkey(id, title, external_ref),
            deal_payments(
              id, payment_moment, payment_pct, amount,
              network_amount, agency_amount, consultant_amount, partner_amount,
              is_signed, signed_date, is_received, received_date,
              is_reported, reported_date,
              agency_invoice_number, agency_invoice_date,
              agency_invoice_recipient, agency_invoice_recipient_nif,
              agency_invoice_amount_net, agency_invoice_amount_gross,
              agency_invoice_id,
              network_invoice_number, network_invoice_date,
              consultant_invoice_number, consultant_invoice_date, consultant_invoice_type,
              consultant_paid, consultant_paid_date, notes
            )
          `)
          .in('id', missingIds)

        if (extraDeals) {
          deals!.push(...(extraDeals as any[]))
          for (const d of extraDeals as any[]) {
            // Fetch referrals for extra deals
            const { data: extraRefs } = await (supabase as any)
              .from('deal_referrals')
              .select('*, consultant:dev_users!deal_referrals_consultant_id_fkey(id, commercial_name)')
              .eq('deal_id', d.id)
            if (extraRefs) referralsMap[d.id] = extraRefs
          }
        }
      }
    }

    // ── Build rows ──
    const momentOrder: Record<string, number> = { cpcv: 0, escritura: 1, single: 2 }
    const rows: any[] = []

    // Helper: build a base row object
    function baseRow(deal: any, payments: any[]) {
      return {
        deal_id: deal.id,
        reference: deal.reference,
        pv_number: deal.pv_number,
        remax_draft_number: deal.remax_draft_number,
        deal_type: deal.deal_type,
        deal_value: Number(deal.deal_value),
        deal_date: deal.deal_date,
        business_type: deal.business_type,
        commission_pct: Number(deal.commission_pct),
        has_share: deal.has_share,
        property: deal.property,
        proc_instance_id: deal.proc_instance_id,
        status: deal.status,
        payments,
      }
    }

    // Helper: create rows for one "side" of a deal
    function createSideRows(
      deal: any,
      payments: any[],
      sideAgent: any,
      sideShare: number, // absolute amount for this side
      sideRole: 'comprador' | 'angariacao' | null,
      sidePct: number | null,
      sideName: 'negocio' | 'angariacao',
      partnerName: string | null,
      referrals: any[],
    ) {
      // Get referrals for this side
      const sideReferrals = referrals.filter((r: any) => r.side === sideName)
      const internalRefs = sideReferrals.filter((r: any) => r.referral_type === 'interna' && r.consultant)
      const externalRefs = sideReferrals.filter((r: any) => r.referral_type === 'externa')

      // Total referral deductions (both internal and external)
      const totalRefPct = sideReferrals.reduce((s: number, r: any) => s + Number(r.referral_pct), 0) / 100
      const agentAmount = sideShare * (1 - totalRefPct)

      // Build deductions list for display
      const deductions = sideReferrals.map((r: any) => ({
        name: r.referral_type === 'interna'
          ? r.consultant?.commercial_name || 'Consultor'
          : r.external_name || 'Externo',
        pct: Number(r.referral_pct),
        type: r.referral_type,
      }))

      // Main agent row
      rows.push({
        ...baseRow(deal, payments),
        commission_total: agentAmount,
        share_pct: sidePct,
        share_role: sideRole,
        referral_pct_display: null,
        referral_deductions: deductions,
        consultant_amount: null,
        network_amount: null,
        agency_margin: null,
        agency_net: null,
        partner_amount: null,
        partner_agency_name: partnerName,
        consultant: sideAgent,
      })

      // Internal referral rows
      for (const ref of internalRefs) {
        const refAmount = sideShare * (Number(ref.referral_pct) / 100)
        rows.push({
          ...baseRow(deal, payments),
          commission_total: refAmount,
          share_pct: null,
          share_role: 'referencia' as const,
          referral_pct_display: Number(ref.referral_pct),
          referral_deductions: [],
          consultant_amount: null,
          network_amount: null,
          agency_margin: null,
          agency_net: null,
          partner_amount: null,
          partner_agency_name: sideAgent?.commercial_name || null,
          consultant: ref.consultant,
        })
      }
    }

    for (const deal of (deals || [])) {
      const payments = (deal.deal_payments || []).sort(
        (a: any, b: any) => (momentOrder[a.payment_moment] ?? 9) - (momentOrder[b.payment_moment] ?? 9)
      )

      const commissionTotal = Number(deal.commission_total)
      const dealReferrals = referralsMap[deal.id] || []
      const isInternalShare = deal.share_type === 'internal_agency' && deal.internal_colleague_id && deal.colleague

      if (isInternalShare) {
        const sharePct = Number(deal.share_pct || 50) / 100
        const consultantShare = commissionTotal * sharePct
        const colleagueShare = commissionTotal * (1 - sharePct)

        // Comprador side (main consultant) — referrals with side='negocio'
        createSideRows(
          deal, payments,
          deal.consultant, consultantShare,
          'comprador', Number(deal.share_pct || 50),
          'negocio',
          deal.colleague?.commercial_name || null,
          dealReferrals,
        )

        // Angariação side (colleague) — referrals with side='angariacao'
        createSideRows(
          deal, payments,
          deal.colleague, colleagueShare,
          'angariacao', 100 - Number(deal.share_pct || 50),
          'angariacao',
          deal.consultant?.commercial_name || null,
          dealReferrals,
        )
      } else {
        // Non-internal-share: single side, all referrals apply to the main consultant
        // Determine side name based on deal_type
        const sideName = deal.deal_type === 'angariacao_externa' ? 'negocio' : 'negocio'

        const allRefs = dealReferrals
        const totalRefPct = allRefs.reduce((s: number, r: any) => s + Number(r.referral_pct), 0) / 100
        const internalRefs = allRefs.filter((r: any) => r.referral_type === 'interna' && r.consultant)
        const agentAmount = commissionTotal * (1 - totalRefPct)

        const deductions = allRefs.map((r: any) => ({
          name: r.referral_type === 'interna'
            ? r.consultant?.commercial_name || 'Consultor'
            : r.external_name || 'Externo',
          pct: Number(r.referral_pct),
          type: r.referral_type,
        }))

        // Main row
        rows.push({
          ...baseRow(deal, payments),
          commission_total: allRefs.length > 0 ? agentAmount : commissionTotal,
          share_pct: deal.share_pct ? Number(deal.share_pct) : null,
          share_role: null,
          referral_pct_display: null,
          referral_deductions: deductions,
          consultant_amount: deal.consultant_amount ? Number(deal.consultant_amount) : null,
          network_amount: deal.network_amount ? Number(deal.network_amount) : null,
          agency_margin: deal.agency_margin ? Number(deal.agency_margin) : null,
          agency_net: deal.agency_net ? Number(deal.agency_net) : null,
          partner_amount: deal.partner_amount ? Number(deal.partner_amount) : null,
          partner_agency_name: deal.partner_agency_name,
          consultant: deal.consultant,
        })

        // Internal referral rows
        for (const ref of internalRefs) {
          const refAmount = commissionTotal * (Number(ref.referral_pct) / 100)
          rows.push({
            ...baseRow(deal, payments),
            commission_total: refAmount,
            share_pct: null,
            share_role: 'referencia' as const,
            referral_pct_display: Number(ref.referral_pct),
            referral_deductions: [],
            consultant_amount: null,
            network_amount: null,
            agency_margin: null,
            agency_net: null,
            partner_amount: null,
            partner_agency_name: deal.consultant?.commercial_name || null,
            consultant: ref.consultant,
          })
        }
      }
    }

    // If filtering by consultant, keep only rows where the consultant matches
    const filteredRows = consultantId
      ? rows.filter((r: any) => r.consultant?.id === consultantId)
      : rows

    // Compute totals
    const totals = {
      report: filteredRows.reduce((s: number, r: any) => s + r.commission_total, 0),
      consultant_total: filteredRows.reduce((s: number, r: any) => s + (r.consultant_amount || 0), 0),
      network_total: filteredRows.reduce((s: number, r: any) => s + (r.network_amount || 0), 0),
      margin_total: filteredRows.reduce((s: number, r: any) => s + (r.agency_net || r.agency_margin || 0), 0),
      partner_total: filteredRows.reduce((s: number, r: any) => s + (r.partner_amount || 0), 0),
      deal_count: filteredRows.length,
    }

    return NextResponse.json({ rows: filteredRows, totals })
  } catch (error) {
    console.error('Erro mapa gestão:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
