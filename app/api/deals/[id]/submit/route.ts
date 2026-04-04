import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'

// POST /api/deals/[id]/submit — Submit deal, create proc_instance + payments + splits
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient() as any

    // Fetch the deal with property info
    const { data: deal, error: fetchError } = await supabase
      .from('deals')
      .select(`
        *,
        property:dev_properties!deals_property_id_fkey(
          id, consultant_id,
          dev_property_internal(commission_agreed, commission_type)
        )
      `)
      .eq('id', id)
      .single()

    if (fetchError || !deal) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
    }

    if (deal.status !== 'draft') {
      return NextResponse.json({ error: 'Apenas rascunhos podem ser submetidos' }, { status: 400 })
    }

    // Validate required fields
    if (!deal.deal_value || deal.deal_value <= 0) {
      return NextResponse.json({ error: 'Valor da transacção é obrigatório' }, { status: 400 })
    }
    if (!deal.commission_pct || deal.commission_pct <= 0) {
      return NextResponse.json({ error: 'Percentagem de comissão é obrigatória' }, { status: 400 })
    }

    // ── 1. Create proc_instance ──
    const { data: procInstance, error: procError } = await supabase
      .from('proc_instances')
      .insert({
        property_id: deal.property_id || null,
        tpl_process_id: null,
        current_status: 'pending_approval',
        process_type: 'negocio',
        requested_by: auth.user.id,
        percent_complete: 0,
        last_completed_step: 0,
      })
      .select('id')
      .single()

    if (procError || !procInstance) {
      return NextResponse.json(
        { error: 'Erro ao criar processo', details: procError?.message },
        { status: 500 }
      )
    }

    // ── 2. Fetch agency settings for network % ──
    const { data: networkSetting } = await supabase
      .from('agency_settings')
      .select('value')
      .eq('key', 'network_pct')
      .single()
    const networkPct = parseFloat(networkSetting?.value ?? '8') / 100

    // ── 3. Fetch commission tiers for consultant rates ──
    const { data: tiers } = await supabase
      .from('commission_tiers')
      .select('*')
      .eq('is_active', true)
      .order('order_index')

    function getTierRate(dealValue: number, businessType: string): number {
      const applicable = (tiers || [])
        .filter((t: any) => t.business_type === businessType)
        .find((t: any) =>
          dealValue >= t.min_value &&
          (t.max_value === null || t.max_value === undefined || dealValue < t.max_value)
        )
      return applicable ? Number(applicable.consultant_rate) : 50
    }

    // ── 4. Calculate commission breakdown ──
    const dealValue = Number(deal.deal_value)
    const commissionPct = Number(deal.commission_pct) / 100
    const commissionTotal = dealValue * commissionPct

    const isInternalShare = deal.share_type === 'internal_agency'
    const sharePctVal = Number(deal.share_pct || 50)
    const shareAmount = deal.has_share ? commissionTotal * (sharePctVal / 100) : commissionTotal
    const partnerAmount = commissionTotal - shareAmount

    const networkAmount = shareAmount * networkPct
    const agencyMargin = shareAmount - networkAmount

    const businessType = deal.business_type || 'venda'
    const mainTierRate = getTierRate(dealValue, businessType) / 100
    const consultantAmount = agencyMargin * mainTierRate
    const agencyNet = agencyMargin - consultantAmount

    // ── 5. Determine payment moments ──
    const cpcvPct = Number(deal.cpcv_pct || 0)
    const escrituraPct = Number(deal.escritura_pct || 100)
    const paymentStructure = deal.payment_structure || 'split'

    type MomentDef = { moment: string; pct: number; date: string | null }
    const moments: MomentDef[] = []

    if (businessType === 'arrendamento' || businessType === 'trespasse') {
      moments.push({
        moment: 'single',
        pct: 100,
        date: deal.contract_signing_date || null,
      })
    } else if (paymentStructure === 'cpcv_only') {
      moments.push({ moment: 'cpcv', pct: 100, date: deal.contract_signing_date || null })
      // Still create escritura row with 0% for date tracking
      moments.push({ moment: 'escritura', pct: 0, date: deal.max_deadline || null })
    } else if (paymentStructure === 'escritura_only') {
      // Still create CPCV row with 0% for date tracking
      moments.push({ moment: 'cpcv', pct: 0, date: deal.contract_signing_date || null })
      moments.push({ moment: 'escritura', pct: 100, date: deal.max_deadline || null })
    } else {
      // split
      moments.push({ moment: 'cpcv', pct: cpcvPct, date: deal.contract_signing_date || null })
      moments.push({ moment: 'escritura', pct: escrituraPct, date: deal.max_deadline || null })
    }

    // ── 6. Create deal_payments ──
    const paymentRows = moments.map((m) => {
      const ratio = m.pct / 100
      return {
        deal_id: id,
        payment_moment: m.moment,
        payment_pct: m.pct,
        amount: commissionTotal * ratio,
        network_amount: networkAmount * ratio,
        agency_amount: agencyMargin * ratio,
        consultant_amount: consultantAmount * ratio,
        partner_amount: partnerAmount * ratio,
        signed_date: m.date,
        date_type: 'predicted',
      }
    })

    const { data: createdPayments, error: paymentsError } = await supabase
      .from('deal_payments')
      .insert(paymentRows)
      .select('id, payment_moment, agency_amount')

    if (paymentsError || !createdPayments) {
      // Rollback proc_instance
      await supabase.from('proc_instances').delete().eq('id', procInstance.id)
      return NextResponse.json({ error: 'Erro ao criar pagamentos', details: paymentsError?.message }, { status: 500 })
    }

    // ── 7. Create deal_payment_splits ──
    const splitRows: any[] = []

    // Fetch referrals for this deal
    const { data: referrals } = await supabase
      .from('deal_referrals')
      .select('consultant_id, referral_pct, side, referral_type')
      .eq('deal_id', id)

    const sellerRefs = (referrals || []).filter((r: any) => r.side === 'angariacao')
    const buyerRefs = (referrals || []).filter((r: any) => r.side === 'negocio')
    const sellerRefPct = sellerRefs.reduce((s: number, r: any) => s + Number(r.referral_pct), 0)
    const buyerRefPct = buyerRefs.reduce((s: number, r: any) => s + Number(r.referral_pct), 0)

    // Partner tier rate
    const partnerTierRate = isInternalShare ? getTierRate(dealValue, businessType) / 100 : 0

    for (const cp of createdPayments) {
      const momentAgencyMargin = Number(cp.agency_amount || 0)

      if (isInternalShare) {
        // Seller side (main consultant = angariador)
        const sellerMargin = momentAgencyMargin * (sharePctVal / 100)
        const sellerAfterRef = sellerMargin * (1 - sellerRefPct / 100)
        splitRows.push({
          deal_payment_id: cp.id,
          agent_id: deal.consultant_id,
          role: 'main',
          split_pct: mainTierRate * 100,
          amount: sellerAfterRef * mainTierRate,
        })

        // Seller referrals
        for (const ref of sellerRefs) {
          const refBase = sellerMargin * (Number(ref.referral_pct) / 100)
          const refTier = ref.referral_type === 'interna'
            ? getTierRate(dealValue, businessType) / 100
            : 1 // external gets full amount
          splitRows.push({
            deal_payment_id: cp.id,
            agent_id: ref.consultant_id,
            role: 'referral',
            split_pct: refTier * 100,
            amount: refBase * refTier,
          })
        }

        // Buyer side (partner = comprador)
        if (deal.internal_colleague_id) {
          const buyerMargin = momentAgencyMargin * ((100 - sharePctVal) / 100)
          const buyerAfterRef = buyerMargin * (1 - buyerRefPct / 100)
          splitRows.push({
            deal_payment_id: cp.id,
            agent_id: deal.internal_colleague_id,
            role: 'partner',
            split_pct: partnerTierRate * 100,
            amount: buyerAfterRef * partnerTierRate,
          })

          // Buyer referrals
          for (const ref of buyerRefs) {
            const refBase = buyerMargin * (Number(ref.referral_pct) / 100)
            const refTier = ref.referral_type === 'interna'
              ? getTierRate(dealValue, businessType) / 100
              : 1
            splitRows.push({
              deal_payment_id: cp.id,
              agent_id: ref.consultant_id,
              role: 'referral',
              split_pct: refTier * 100,
              amount: refBase * refTier,
            })
          }
        }
      } else {
        // No internal share
        const mainMargin = momentAgencyMargin * (1 - sellerRefPct / 100)
        splitRows.push({
          deal_payment_id: cp.id,
          agent_id: deal.consultant_id,
          role: 'main',
          split_pct: mainTierRate * 100,
          amount: mainMargin * mainTierRate,
        })

        for (const ref of sellerRefs) {
          const refBase = momentAgencyMargin * (Number(ref.referral_pct) / 100)
          const refTier = ref.referral_type === 'interna'
            ? getTierRate(dealValue, businessType) / 100
            : 1
          splitRows.push({
            deal_payment_id: cp.id,
            agent_id: ref.consultant_id,
            role: 'referral',
            split_pct: refTier * 100,
            amount: refBase * refTier,
          })
        }
      }
    }

    if (splitRows.length > 0) {
      const { error: splitsError } = await supabase
        .from('deal_payment_splits')
        .insert(splitRows)

      if (splitsError) {
        console.error('Erro ao criar splits:', splitsError.message)
      }
    }

    // ── 8. Update deal with calculated amounts and link to proc ──
    const { error: updateError } = await supabase
      .from('deals')
      .update({
        status: 'submitted',
        proc_instance_id: procInstance.id,
        commission_total: commissionTotal,
        network_pct: networkPct * 100,
        network_amount: networkAmount,
        agency_margin: agencyMargin,
        consultant_pct: mainTierRate * 100,
        consultant_amount: consultantAmount,
        agency_net: agencyNet,
        partner_amount: partnerAmount,
        share_amount: shareAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      deal_id: id,
      proc_instance_id: procInstance.id,
      payments_created: createdPayments.length,
      splits_created: splitRows.length,
    })
  } catch (err: any) {
    console.error('Erro ao submeter negócio:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
