import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { bypassNonApplicableNegTasks } from '@/lib/processes/neg/bypass-non-applicable-tasks'
import { repeatTasksPerClient } from '@/lib/processes/neg/repeat-tasks-per-client'

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

    // ── 1. Lookup system NEG template + create proc_instance ──
    // The template is seeded by 20260517_neg_process_template.sql.
    // If the migration hasn't been applied yet, fall back to null
    // (proc_instance is created without tasks; template can be linked
    // manually via /api/processes/[id]/re-template later).
    const { data: negTemplate } = await supabase
      .from('tpl_processes')
      .select('id')
      .eq('process_type', 'negocio')
      .eq('name', 'Processo de Negócio')
      .is('deleted_at' as any, null)
      .maybeSingle()

    // PROC-NEG não tem flow de aprovação — auto-active ao submeter.
    // (Decisão do stakeholder: a aprovação foi removida do fluxo
    // genérico de processos para fechos de negócio.)
    const nowIso = new Date().toISOString()
    const { data: procInstance, error: procError } = await supabase
      .from('proc_instances')
      .insert({
        property_id: deal.property_id || null,
        tpl_process_id: negTemplate?.id || null,
        current_status: 'active',
        process_type: 'negocio',
        requested_by: auth.user.id,
        approved_at: nowIso,
        approved_by: auth.user.id,
        started_at: nowIso,
        percent_complete: 0,
        last_completed_step: 0,
      })
      .select('id, tpl_process_id')
      .single()

    if (procError || !procInstance) {
      return NextResponse.json(
        { error: 'Erro ao criar processo', details: procError?.message },
        { status: 500 }
      )
    }

    // Popular tasks do template — não há trigger registado em proc_instances,
    // a função `populate_process_tasks(uuid)` tem de ser chamada explicitamente
    // (mesmo padrão usado no fluxo de angariação após `approve`).
    if (negTemplate?.id) {
      const { error: populateError } = await supabase.rpc(
        'populate_process_tasks' as never,
        { p_instance_id: procInstance.id } as never,
      )
      if (populateError) {
        console.error('[deals/submit] populate_process_tasks falhou:', populateError.message)
        // Não revertemos o proc_instance — o template pode ser re-aplicado via
        // /api/processes/[id]/re-template depois.
      }

      // Definir current_stage_id para a primeira stage do template
      // (populate_process_tasks não o faz — é responsabilidade do caller).
      const { data: firstStage } = await supabase
        .from('tpl_stages')
        .select('id')
        .eq('tpl_process_id', negTemplate.id)
        .order('order_index', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (firstStage) {
        await supabase
          .from('proc_instances')
          .update({ current_stage_id: (firstStage as { id: string }).id })
          .eq('id', procInstance.id)
      }
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

    // ── 8. Create deal_events for each signing moment ──
    // Maps payment moments → event types. Single-moment deals (arrendamento /
    // trespasse) map to the appropriate legal event. All events start as
    // status='scheduled' with scheduled_at = predicted date; occurred_at stays
    // NULL until the corresponding deal_payment is marked is_signed=true
    // (hook lands in follow-up commit).
    const eventTypeFor = (moment: string, bizType: string): string => {
      if (moment === 'cpcv') return 'cpcv'
      if (moment === 'escritura') return 'escritura'
      if (moment === 'single') {
        return bizType === 'arrendamento' ? 'contrato_arrendamento' : 'escritura'
      }
      return 'outro'
    }

    const eventRows = moments
      .filter((m) => m.date)
      .map((m) => ({
        deal_id: id,
        event_type: eventTypeFor(m.moment, businessType),
        scheduled_at: m.date,
        status: 'scheduled',
        created_by: auth.user.id,
      }))

    if (eventRows.length > 0) {
      const { error: eventsError } = await supabase
        .from('deal_events')
        .insert(eventRows)

      // Failure to create events should not abort submission — events
      // can be added manually from the deal detail later.
      if (eventsError) {
        console.error('Erro ao criar deal_events:', eventsError.message)
      }
    }

    // ── 9. Update deal with calculated amounts and link to proc ──
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

    // ── 10. PROC-NEG applies_when post-processor ──
    // Avalia config.applies_when de cada proc_task contra o deal real e
    // marca como is_bypassed=true as que não aplicam (ex.: "Documentos
    // do Vendedor (Externo)" num pleno; "Distrate de Hipoteca" sem
    // hipoteca activa). Erros não revertem o submit.
    let bypassedCount = 0
    try {
      const result = await bypassNonApplicableNegTasks(
        supabase,
        procInstance.id,
        id,
        auth.user.id
      )
      bypassedCount = result.bypassed_count
    } catch (bypassErr) {
      console.error('[ProcNegBypass] Erro:', bypassErr)
    }

    // ── 11. PROC-NEG per-client task multiplication ──
    // Para tasks com config.repeat_per_client=true (ex.: "Documentos do
    // Comprador (Singular)"), filtra deal_clients por person_type_filter
    // e clona a task uma vez por cliente adicional (annotando título +
    // config.client_id/client_name). Erros não revertem o submit.
    let tasksRepeated = 0
    let totalClones = 0
    try {
      const repeatResult = await repeatTasksPerClient(
        supabase,
        procInstance.id,
        id
      )
      tasksRepeated = repeatResult.tasks_repeated
      totalClones = repeatResult.total_clones
    } catch (repeatErr) {
      console.error('[ProcNegRepeat] Erro:', repeatErr)
    }

    return NextResponse.json({
      success: true,
      deal_id: id,
      proc_instance_id: procInstance.id,
      payments_created: createdPayments.length,
      splits_created: splitRows.length,
      tasks_bypassed: bypassedCount,
      tasks_repeated: tasksRepeated,
      task_clones_created: totalClones,
    })
  } catch (err: any) {
    console.error('Erro ao submeter negócio:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
