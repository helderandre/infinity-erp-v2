// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { resolvePeriodBounds, formatYmd, periodEuroTarget } from '@/lib/goals/funnel/period'
import { getStagesFor } from '@/lib/goals/funnel/stages'
import { computeStageTargets, statusFromPercent } from '@/lib/goals/funnel/calculate'
import type {
  FunnelType,
  FunnelPeriod,
  FunnelStageKey,
  FunnelStageStatus,
  TeamOverviewResponse,
  TeamOverviewConsultantCard,
  TeamOverviewStageDot,
  TeamOverviewKpis,
} from '@/types/funnel'

/**
 * GET /api/goals/funnel/team-overview?period=&date=
 *
 * Manager-only summary view: one card per consultor with active goal in the
 * target year, plus team-wide KPIs.
 *
 * Status logic — composite score:
 *   composite_pct = max(revenue_pct, funnel_avg_pct), capped at 100
 *
 * This way a consultor smashing revenue but with a weak funnel still shows
 * green (they're delivering), while a consultor with mediocre revenue but
 * strong funnel also shows green (they're building up). Only those failing
 * BOTH dimensions trigger amber/red.
 */
export async function GET(request: Request) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const isManager = auth.roles.some((r) =>
      ['admin', 'Broker/CEO', 'team_leader'].includes(r),
    )
    if (!isManager) {
      return NextResponse.json(
        { error: 'Apenas gestores podem ver o resumo da equipa' },
        { status: 403 },
      )
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const period = (searchParams.get('period') || 'weekly') as FunnelPeriod
    if (!['daily', 'weekly', 'monthly', 'annual'].includes(period)) {
      return NextResponse.json({ error: 'period inválido' }, { status: 400 })
    }
    const dateParam = searchParams.get('date')
    const refDate = dateParam ? new Date(dateParam) : new Date()
    const bounds = resolvePeriodBounds(period, refDate)

    const { data: goals, error: goalsErr } = await supabase
      .from('temp_consultant_goals')
      .select('*')
      .eq('year', bounds.year)
      .eq('is_active', true)
    if (goalsErr) {
      return NextResponse.json({ error: goalsErr.message }, { status: 500 })
    }
    if (!goals || goals.length === 0) {
      const empty: TeamOverviewResponse = {
        period,
        period_start: formatYmd(bounds.start),
        period_end: formatYmd(bounds.end),
        team_period_target_eur: 0,
        kpis: {
          total_realized_eur: 0,
          total_target_eur: 0,
          achievement_pct: 0,
          count_late: 0,
          count_attention: 0,
          count_on_track: 0,
        },
        consultants: [],
      }
      return NextResponse.json(empty)
    }
    const consultantIds = goals.map((g) => g.consultant_id)

    const { data: users } = await supabase
      .from('dev_users')
      .select(
        `
        id, commercial_name,
        profile:dev_consultant_profiles!dev_consultant_profiles_user_id_fkey(profile_photo_url)
      `,
      )
      .in('id', consultantIds)
    const userMap: Record<string, { name: string; photo: string | null }> = {}
    ;(users || []).forEach((u) => {
      // Supabase returns 1:1 relationship as object — handle both shapes defensively
      const photo =
        (u.profile as any)?.profile_photo_url ??
        (Array.isArray(u.profile) ? u.profile[0]?.profile_photo_url : null) ??
        null
      userMap[u.id] = {
        name: u.commercial_name ?? '',
        photo,
      }
    })

    const { data: events } = await supabase
      .from('funnel_events')
      .select('consultant_id, funnel_type, stage_key')
      .in('consultant_id', consultantIds)
      .gte('occurred_at', bounds.start.toISOString())
      .lte('occurred_at', bounds.end.toISOString())
    const eventsByConsultor: Record<string, any[]> = {}
    ;(events || []).forEach((e) => {
      if (!eventsByConsultor[e.consultant_id]) eventsByConsultor[e.consultant_id] = []
      eventsByConsultor[e.consultant_id].push(e)
    })

    const { data: dealsRows } = await supabase
      .from('deals')
      .select('consultant_id, commission_total')
      .in('consultant_id', consultantIds)
      .gte('deal_date', formatYmd(bounds.start))
      .lte('deal_date', formatYmd(bounds.end))
    const realizedByConsultor: Record<string, number> = {}
    ;(dealsRows || []).forEach((d) => {
      realizedByConsultor[d.consultant_id] =
        (realizedByConsultor[d.consultant_id] || 0) + (Number(d.commission_total) || 0)
    })

    const { data: overrides } = await supabase
      .from('funnel_target_overrides')
      .select('consultant_id, funnel_type, stage_key, target_value')
      .in('consultant_id', consultantIds)
      .eq('year', bounds.year)
      .eq('period', period)
    const overrideMap: Record<string, number> = {}
    ;(overrides || []).forEach((r) => {
      overrideMap[`${r.consultant_id}:${r.funnel_type}:${r.stage_key}`] = Number(r.target_value)
    })

    const cards: TeamOverviewConsultantCard[] = []
    let teamTargetEur = 0
    let teamRealizedEur = 0

    for (const goal of goals) {
      const userInfo = userMap[goal.consultant_id] || { name: '—', photo: null }
      const annual = Number(goal.annual_revenue_target || 0)
      const periodEur = periodEuroTarget(
        period,
        annual,
        Number(goal.working_weeks_year || 48),
        Number(goal.working_days_week || 5),
      )
      teamTargetEur += periodEur
      const realizedEur = Math.round(realizedByConsultor[goal.consultant_id] || 0)
      teamRealizedEur += realizedEur

      const consultorEvents = eventsByConsultor[goal.consultant_id] || []

      function processFunnel(funnel: FunnelType): {
        avgPct: number
        dots: TeamOverviewStageDot[]
        worst: { label: string; message: string; gap: number; rank: number } | null
      } {
        const stagesDefs = getStagesFor(funnel)
        const isBuyer = funnel === 'buyer'
        const pct = isBuyer ? Number(goal.pct_buyers || 50) : Number(goal.pct_sellers || 50)
        const periodEurFunnel = periodEur * (pct / 100)
        const avgDealValue = Number(
          isBuyer ? goal.buyers_avg_purchase_value : goal.sellers_avg_sale_value,
        ) || 0
        const commissionPct = Number(
          isBuyer ? goal.buyers_avg_commission_pct : goal.sellers_avg_commission_pct,
        ) || 0

        const absoluteOverrides: Partial<Record<FunnelStageKey, number>> = {}
        stagesDefs.forEach((s) => {
          const v = overrideMap[`${goal.consultant_id}:${funnel}:${s.key}`]
          if (v !== undefined) absoluteOverrides[s.key] = v
        })

        const conversionOverrides: Partial<Record<FunnelStageKey, number>> = {}
        const crByFunnel = (goal.funnel_conversion_rates || {})[funnel] as
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

        const targets = computeStageTargets({
          funnel,
          periodEuroTarget: periodEurFunnel,
          avgDealValue,
          commissionPct,
          absoluteOverrides,
          conversionOverrides,
        })

        let totalCappedPctSum = 0
        let stageCount = 0
        let worst: { label: string; message: string; gap: number; rank: number } | null = null
        const dots: TeamOverviewStageDot[] = []

        stagesDefs.forEach((def) => {
          const realized = consultorEvents.filter(
            (e) => e.funnel_type === funnel && e.stage_key === def.key,
          ).length
          const target = Math.max(0, Math.round(targets[def.key] * 100) / 100)
          const stagePctRaw =
            target > 0 ? Math.round((realized / target) * 1000) / 10 : realized > 0 ? 100 : 0
          const stagePctCapped = Math.min(100, stagePctRaw)
          const status = statusFromPercent(stagePctRaw)

          dots.push({
            key: def.key,
            short_label: def.shortLabel,
            status,
            realized,
            target: Math.round(target),
          })
          totalCappedPctSum += stagePctCapped
          stageCount += 1

          // Bottleneck ranking: late=2 > attention=1 > others=0 (winners excluded)
          const rank = status === 'late' ? 2 : status === 'attention' ? 1 : 0
          if (rank > 0 && target > realized) {
            const gap = target - realized
            if (
              !worst ||
              rank > worst.rank ||
              (rank === worst.rank && gap > worst.gap)
            ) {
              worst = {
                label: def.label,
                message: `Faltam ${Math.ceil(gap)} ${def.label.toLowerCase()}`,
                gap,
                rank,
              }
            }
          }
        })

        const avgPct = stageCount > 0 ? totalCappedPctSum / stageCount : 0
        return { avgPct, dots, worst }
      }

      const buyer = processFunnel('buyer')
      const seller = processFunnel('seller')

      // Composite score: max of revenue achievement and funnel achievement,
      // both capped at 100. Anyone winning EITHER dimension shows green.
      const revenuePctRaw =
        periodEur > 0 ? Math.round((realizedEur / periodEur) * 1000) / 10 : realizedEur > 0 ? 100 : 0
      const revenuePctCapped = Math.min(100, revenuePctRaw)
      const funnelAvgPct = (buyer.avgPct + seller.avgPct) / 2
      const compositePct = Math.max(revenuePctCapped, funnelAvgPct)
      const compositeStatus = statusFromPercent(compositePct)

      // Buyer/seller status pill = same composite logic, scoped to that funnel
      const buyerStatus = statusFromPercent(buyer.avgPct)
      const sellerStatus = statusFromPercent(seller.avgPct)

      const bottleneck =
        buyer.worst && seller.worst
          ? buyer.worst.gap >= seller.worst.gap
            ? buyer.worst
            : seller.worst
          : buyer.worst || seller.worst

      cards.push({
        consultant_id: goal.consultant_id,
        commercial_name: userInfo.name,
        profile_photo_url: userInfo.photo,
        status: compositeStatus,
        composite_pct: Math.round(compositePct * 10) / 10,
        revenue_pct: Math.round(revenuePctRaw * 10) / 10,
        funnel_avg_pct: Math.round(funnelAvgPct * 10) / 10,
        buyer_pct: Math.round(buyer.avgPct),
        seller_pct: Math.round(seller.avgPct),
        buyer_status: buyerStatus,
        seller_status: sellerStatus,
        period_target_eur: Math.round(periodEur * 100) / 100,
        realized_eur: realizedEur,
        bottleneck_label: bottleneck?.label ?? null,
        bottleneck_message: bottleneck?.message ?? null,
        buyer_stage_dots: buyer.dots,
        seller_stage_dots: seller.dots,
      })
    }

    // Sort: late → attention → on_track → alphabetical within each
    const statusRank: Record<FunnelStageStatus, number> = {
      late: 0,
      attention: 1,
      on_track: 2,
      completed: 3,
      pending: 4,
    }
    cards.sort((a, b) => {
      const rankDiff = statusRank[a.status] - statusRank[b.status]
      if (rankDiff !== 0) return rankDiff
      return a.commercial_name.localeCompare(b.commercial_name, 'pt')
    })

    const kpis: TeamOverviewKpis = {
      total_realized_eur: Math.round(teamRealizedEur),
      total_target_eur: Math.round(teamTargetEur * 100) / 100,
      achievement_pct:
        teamTargetEur > 0
          ? Math.round((teamRealizedEur / teamTargetEur) * 1000) / 10
          : teamRealizedEur > 0
            ? 100
            : 0,
      count_late: cards.filter((c) => c.status === 'late').length,
      count_attention: cards.filter((c) => c.status === 'attention').length,
      count_on_track: cards.filter(
        (c) => c.status === 'on_track' || c.status === 'completed',
      ).length,
    }

    const response: TeamOverviewResponse = {
      period,
      period_start: formatYmd(bounds.start),
      period_end: formatYmd(bounds.end),
      team_period_target_eur: kpis.total_target_eur,
      kpis,
      consultants: cards,
    }
    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'private, max-age=30' },
    })
  } catch (error) {
    console.error('Erro a calcular team overview:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
