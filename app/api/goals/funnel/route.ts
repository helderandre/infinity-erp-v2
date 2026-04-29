// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { resolvePeriodBounds, formatYmd, periodEuroTarget } from '@/lib/goals/funnel/period'
import { getStagesFor } from '@/lib/goals/funnel/stages'
import {
  computeStageTargets,
  statusFromPercent,
  buildStageMessage,
  aggregateFunnelStatus,
  computeTotalConversion,
  computeInputRatios,
  inputsNeededForNextOne,
} from '@/lib/goals/funnel/calculate'
import {
  REALIZED_DEAL_COLUMNS,
  aggregateRealizedByConsultant,
  type DealForRealized,
} from '@/lib/goals/funnel/realized'
import type {
  FunnelType,
  FunnelPeriod,
  FunnelScope,
  FunnelStageKey,
  FunnelStageResult,
  FunnelData,
  FunnelResponse,
} from '@/types/funnel'

/**
 * GET /api/goals/funnel
 *   ?consultant_id=<uuid>     (default: caller)
 *   &period=<daily|weekly|monthly|annual>   (default: weekly)
 *   &date=<YYYY-MM-DD>        (default: today)
 *   &scope=<consultant|team>  (default: consultant)
 *
 * scope=team aggregates all consultants with active goals in the year.
 *   - Targets are summed per consultor (each has their own ratios).
 *   - Realized counts are summed across consultants from funnel_events.
 *   - Manager-only (broker, team_leader, admin).
 *   - consultant_id is ignored when scope=team.
 */
export async function GET(request: Request) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const period = (searchParams.get('period') || 'weekly') as FunnelPeriod
    if (!['daily', 'weekly', 'monthly', 'annual'].includes(period)) {
      return NextResponse.json({ error: 'period inválido' }, { status: 400 })
    }

    const dateParam = searchParams.get('date')
    const refDate = dateParam ? new Date(dateParam) : new Date()
    if (isNaN(refDate.getTime())) {
      return NextResponse.json({ error: 'date inválida' }, { status: 400 })
    }

    const scope = (searchParams.get('scope') || 'consultant') as FunnelScope
    if (!['consultant', 'team'].includes(scope)) {
      return NextResponse.json({ error: 'scope inválido' }, { status: 400 })
    }

    const isManager = auth.roles.some((r) =>
      ['admin', 'Broker/CEO', 'team_leader'].includes(r),
    )
    if (scope === 'team' && !isManager) {
      return NextResponse.json(
        { error: 'Apenas gestores podem ver o agregado da equipa' },
        { status: 403 },
      )
    }

    const requestedConsultantId =
      scope === 'team' ? null : searchParams.get('consultant_id') || auth.user.id

    if (
      scope === 'consultant' &&
      requestedConsultantId !== auth.user.id &&
      !isManager
    ) {
      return NextResponse.json(
        { error: 'Não pode consultar objectivos de outro consultor' },
        { status: 403 },
      )
    }

    const bounds = resolvePeriodBounds(period, refDate)

    // ── Goals (one or many) ──────────────────────────────────────────────
    let goalsQuery = supabase
      .from('temp_consultant_goals')
      .select('*')
      .eq('year', bounds.year)
      .eq('is_active', true)

    if (scope === 'consultant') {
      goalsQuery = goalsQuery.eq('consultant_id', requestedConsultantId)
    }
    const { data: goals, error: goalsErr } = await goalsQuery
    if (goalsErr) {
      return NextResponse.json({ error: goalsErr.message }, { status: 500 })
    }

    const consultantIds: string[] =
      scope === 'team'
        ? (goals || []).map((g) => g.consultant_id)
        : [requestedConsultantId as string]

    // ── Consultor info (single or aggregate placeholder) ─────────────────
    let consultantInfo = {
      id: requestedConsultantId ?? 'team',
      commercial_name: scope === 'team' ? 'Equipa' : '',
      profile_photo_url: null as string | null,
    }
    if (scope === 'consultant' && requestedConsultantId) {
      const { data: consultant, error: consErr } = await supabase
        .from('dev_users')
        .select(
          `
          id, commercial_name,
          profile:dev_consultant_profiles!dev_consultant_profiles_user_id_fkey(profile_photo_url)
        `,
        )
        .eq('id', requestedConsultantId)
        .single()
      if (consErr || !consultant) {
        return NextResponse.json({ error: 'Consultor não encontrado' }, { status: 404 })
      }
      // Supabase returns 1:1 relationship as object (not array)
      const photo =
        (consultant.profile as any)?.profile_photo_url ??
        (Array.isArray(consultant.profile)
          ? consultant.profile[0]?.profile_photo_url
          : null) ??
        null
      consultantInfo = {
        id: consultant.id,
        commercial_name: consultant.commercial_name ?? '',
        profile_photo_url: photo,
      }
    }

    // ── Period € target (single or summed) ───────────────────────────────
    let totalAnnual = 0
    let pctBuyersWeighted = 0
    let pctSellersWeighted = 0
    let workingWeeksAvg = 48
    let workingDaysAvg = 5

    ;(goals || []).forEach((g) => {
      const ann = Number(g.annual_revenue_target || 0)
      totalAnnual += ann
      pctBuyersWeighted += ann * Number(g.pct_buyers || 50)
      pctSellersWeighted += ann * Number(g.pct_sellers || 50)
    })
    if ((goals || []).length > 0) {
      workingWeeksAvg =
        (goals || []).reduce((acc, g) => acc + Number(g.working_weeks_year || 48), 0) /
        goals!.length
      workingDaysAvg =
        (goals || []).reduce((acc, g) => acc + Number(g.working_days_week || 5), 0) /
        goals!.length
    }
    const pctBuyersAvg = totalAnnual > 0 ? pctBuyersWeighted / totalAnnual : 50
    const pctSellersAvg = totalAnnual > 0 ? pctSellersWeighted / totalAnnual : 50

    const periodTargetTotal = periodEuroTarget(
      period,
      totalAnnual,
      workingWeeksAvg,
      workingDaysAvg,
    )

    // ── Events from the unified view ─────────────────────────────────────
    let eventsRows: any[] = []
    if (consultantIds.length > 0) {
      const { data: events, error: evErr } = await supabase
        .from('funnel_events')
        .select('source, funnel_type, stage_key, occurred_at, consultant_id')
        .in('consultant_id', consultantIds)
        .gte('occurred_at', bounds.start.toISOString())
        .lte('occurred_at', bounds.end.toISOString())
      if (evErr) {
        return NextResponse.json({ error: evErr.message }, { status: 500 })
      }
      eventsRows = events || []
    }

    // ── Realized € — split por tranche (CPCV + Escritura) ────────────────
    // Cada deal contribui em duas datas distintas: na data CPCV (o consultor
    // recebe `cpcv_pct`% do `consultant_amount`) e na data Escritura (recebe o
    // restante). Fetch alargado para apanhar deals cuja CPCV ou Escritura caia
    // na janela, mesmo que a outra tranche esteja noutro período.
    let realizedEurAll = 0
    if (consultantIds.length > 0) {
      const startYmd = formatYmd(bounds.start)
      const endYmd = formatYmd(bounds.end)
      const todayYmd = formatYmd(new Date())
      const dateOr =
        `and(deal_date.gte.${startYmd},deal_date.lte.${endYmd}),` +
        `and(escritura_actual_date.gte.${startYmd},escritura_actual_date.lte.${endYmd}),` +
        `and(contract_signing_date.gte.${startYmd},contract_signing_date.lte.${endYmd}),` +
        `and(cpcv_actual_date.gte.${startYmd},cpcv_actual_date.lte.${endYmd})`

      const { data: dealsRows } = await supabase
        .from('deals')
        .select(REALIZED_DEAL_COLUMNS)
        .in('consultant_id', consultantIds)
        .or(dateOr)

      const byConsultor = aggregateRealizedByConsultant(
        (dealsRows || []) as DealForRealized[],
        startYmd,
        endYmd,
        todayYmd,
      )
      realizedEurAll = Object.values(byConsultor).reduce((acc, v) => acc + v, 0)
    }

    // ── Per-stage absolute overrides ─────────────────────────────────────
    const overrideMap: Record<string, number> = {}
    if (consultantIds.length > 0) {
      const { data: overridesRows } = await supabase
        .from('funnel_target_overrides')
        .select('funnel_type, stage_key, period, target_value, consultant_id')
        .in('consultant_id', consultantIds)
        .eq('year', bounds.year)
        .eq('period', period)

      ;(overridesRows || []).forEach((r) => {
        const key = `${r.consultant_id}:${r.funnel_type}:${r.stage_key}`
        overrideMap[key] = Number(r.target_value)
      })
    }

    // ── Build a funnel by summing per-consultor targets, aggregating realized ──
    function buildFunnel(funnel: FunnelType): FunnelData {
      const stagesDefs = getStagesFor(funnel)
      const isBuyer = funnel === 'buyer'

      // Input-ratio overrides:
      //  - consultant scope with exactly 1 goal: use that consultor's per-stage rates
      //  - team scope or no goals: use defaults (mixing per-consultor cr into a team
      //    "1 proposta = 5 visitas" framing would mislead).
      let ratioOverrides: Partial<Record<FunnelStageKey, number>> | undefined
      if (scope === 'consultant' && (goals || []).length === 1) {
        const crByFunnel = ((goals || [])[0].funnel_conversion_rates || {})[funnel] as
          | Record<string, number>
          | undefined
        if (crByFunnel) {
          ratioOverrides = {}
          for (const s of stagesDefs) {
            const v = crByFunnel[s.key]
            if (typeof v === 'number' && v > 0 && v <= 1) {
              ratioOverrides[s.key] = v
            }
          }
        }
      }
      const inputRatios = computeInputRatios(funnel, ratioOverrides)

      // Sum targets across all goals
      const summedTargets: Record<string, number> = {}
      stagesDefs.forEach((s) => (summedTargets[s.key] = 0))

      ;(goals || []).forEach((g) => {
        const annual = Number(g.annual_revenue_target || 0)
        const pct = isBuyer
          ? Number(g.pct_buyers || 50)
          : Number(g.pct_sellers || 50)
        const periodEur = periodEuroTarget(
          period,
          annual,
          Number(g.working_weeks_year || 48),
          Number(g.working_days_week || 5),
        )
        const periodEurFunnel = periodEur * (pct / 100)
        const avgDealValue = Number(
          isBuyer ? g.buyers_avg_purchase_value : g.sellers_avg_sale_value,
        ) || 0
        const commissionPct = Number(
          isBuyer ? g.buyers_avg_commission_pct : g.sellers_avg_commission_pct,
        ) || 0

        // Per-consultor absolute overrides (if any)
        const absoluteOverrides: Partial<Record<FunnelStageKey, number>> = {}
        stagesDefs.forEach((s) => {
          const v = overrideMap[`${g.consultant_id}:${funnel}:${s.key}`]
          if (v !== undefined) absoluteOverrides[s.key] = v
        })

        // Per-consultor conversion rate overrides (configured by gestor)
        const conversionOverrides: Partial<Record<FunnelStageKey, number>> = {}
        const crByFunnel = (g.funnel_conversion_rates || {})[funnel] as
          | Record<string, number>
          | undefined
        if (crByFunnel) {
          stagesDefs.forEach((s) => {
            const v = crByFunnel[s.key]
            if (typeof v === 'number' && v >= 0 && v <= 1) {
              conversionOverrides[s.key] = v
            }
          })
        }

        const consultorTargets = computeStageTargets({
          funnel,
          periodEuroTarget: periodEurFunnel,
          avgDealValue,
          commissionPct,
          absoluteOverrides,
          conversionOverrides,
        })
        stagesDefs.forEach((s) => {
          summedTargets[s.key] += consultorTargets[s.key] || 0
        })
      })

      // Aggregate realized counts — pass 1: realized + breakdown only, indexed
      // by stage key so we can resolve `realized[prev.key]` in pass 2.
      const realizedByKey: Record<string, { realized: number; system: number; manual: number }> = {}
      stagesDefs.forEach((def) => {
        const matched = eventsRows.filter(
          (e) => e.funnel_type === funnel && e.stage_key === def.key,
        )
        const system = matched.filter((e) => e.source === 'system').length
        const manual = matched.filter((e) => e.source === 'manual').length
        realizedByKey[def.key] = { realized: system + manual, system, manual }
      })

      // Pass 2: assemble FunnelStageResult with ratios + still-needed maths.
      const stages: FunnelStageResult[] = stagesDefs.map((def) => {
        const { realized, system, manual } = realizedByKey[def.key]
        const target = Math.max(0, Math.round(summedTargets[def.key] * 100) / 100)
        const percent =
          target > 0 ? Math.min(999, Math.round((realized / target) * 1000) / 10) : realized > 0 ? 100 : 0
        const status = statusFromPercent(percent)
        const message = buildStageMessage({
          realized,
          target,
          status,
          stageLabel: def.label,
          period,
          emptyHint: def.emptyHint,
        })

        const ratioInfo = inputRatios[def.key]
        const realizedPrev = ratioInfo.prev_key ? realizedByKey[ratioInfo.prev_key].realized : 0
        const prevInputsNeeded = inputsNeededForNextOne({
          ratio: ratioInfo.ratio_from_prev,
          realizedThis: realized,
          realizedPrev,
        })

        return {
          key: def.key,
          label: def.label,
          order: def.order,
          realized,
          target,
          percent,
          status,
          message,
          source_breakdown: { system, manual },
          is_terminal_completed: status === 'completed' && realized >= target && target > 0,
          ratio_from_prev: ratioInfo.ratio_from_prev,
          prev_label: ratioInfo.prev_label,
          prev_key: ratioInfo.prev_key,
          prev_inputs_needed_for_next_one: prevInputsNeeded,
          still_needed_for_period_target: Math.max(0, Math.ceil(target - realized)),
        }
      })

      const realizedEur =
        funnel === 'seller'
          ? realizedEurAll * (pctSellersAvg / 100 || 1)
          : realizedEurAll * (pctBuyersAvg / 100 || 1)

      return {
        funnel,
        status: aggregateFunnelStatus(stages),
        stages,
        summary: {
          conv_total_pct: computeTotalConversion(stages),
          realized_eur: Math.round(realizedEur),
          avg_cycle_days: null,
        },
      }
    }

    const response: FunnelResponse = {
      scope,
      consultant: consultantInfo,
      team_member_count: scope === 'team' ? (goals || []).length : undefined,
      period,
      period_start: formatYmd(bounds.start),
      period_end: formatYmd(bounds.end),
      period_target_eur: Math.round(periodTargetTotal * 100) / 100,
      buyer: buildFunnel('buyer'),
      seller: buildFunnel('seller'),
    }

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'private, max-age=30' },
    })
  } catch (error) {
    console.error('Erro a calcular funil de objectivos:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
