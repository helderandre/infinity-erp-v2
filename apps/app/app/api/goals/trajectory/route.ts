// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { buildTrajectory, ymd, type GoalRow } from '@/lib/goals/trajectory/calculate'
import {
  REALIZED_DEAL_COLUMNS,
  aggregateRealizedByConsultant,
  type DealForRealized,
} from '@/lib/goals/funnel/realized'
import type { TrajectoryResponse, TrajectoryScope } from '@/types/trajectory'

/**
 * GET /api/goals/trajectory
 *   ?year=<YYYY>             (default: ano corrente)
 *   &consultant_id=<uuid>    (default: caller; ignorado se scope=team)
 *   &scope=<consultant|team> (default: consultant)
 *
 * Devolve a trajectória anual cumulativa de escrituras + projecção ao ritmo
 * actual + status. Usado pelo `<TrajectoryHero>` no topo de /dashboard/objetivos.
 */
export async function GET(request: Request) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const yearParam = searchParams.get('year')
    const today = new Date()
    const year = yearParam ? parseInt(yearParam, 10) : today.getUTCFullYear()
    if (!Number.isFinite(year) || year < 2020 || year > 2100) {
      return NextResponse.json({ error: 'year inválido' }, { status: 400 })
    }

    const scope = (searchParams.get('scope') || 'consultant') as TrajectoryScope
    if (!['consultant', 'team'].includes(scope)) {
      return NextResponse.json({ error: 'scope inválido' }, { status: 400 })
    }

    const isManager = auth.roles.some((r) =>
      ['admin', 'Broker/CEO', 'Office Manager', 'team_leader'].includes(r),
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

    // ── Goals ────────────────────────────────────────────────────────────
    let goalsQuery = supabase
      .from('temp_consultant_goals')
      .select(
        'consultant_id, annual_revenue_target, pct_buyers, pct_sellers, buyers_avg_purchase_value, buyers_avg_commission_pct, sellers_avg_sale_value, sellers_avg_commission_pct',
      )
      .eq('year', year)
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

    // ── Consultor info (single) ──────────────────────────────────────────
    let consultantInfo: TrajectoryResponse['consultant'] = null
    if (scope === 'consultant' && requestedConsultantId) {
      const { data: cons } = await supabase
        .from('dev_users')
        .select(
          `
          id, commercial_name,
          profile:dev_consultant_profiles!dev_consultant_profiles_user_id_fkey(profile_photo_url)
        `,
        )
        .eq('id', requestedConsultantId)
        .single()
      if (cons) {
        const photo =
          (cons.profile as any)?.profile_photo_url ??
          (Array.isArray(cons.profile) ? cons.profile[0]?.profile_photo_url : null) ??
          null
        consultantInfo = {
          id: cons.id,
          commercial_name: cons.commercial_name ?? '',
          profile_photo_url: photo,
        }
      }
    }

    // ── Deals fechados YTD (deduplicados — uma row por deal) ─────────────
    // `deal_date` = data prevista da escritura. Contamos só os já passados.
    let dealRows: DealForRealized[] = []
    let dealDatesYtd: string[] = []
    if (consultantIds.length > 0) {
      const yearStart = `${year}-01-01`
      const yearEnd = `${year}-12-31`
      const { data: rows } = await supabase
        .from('deals')
        .select(REALIZED_DEAL_COLUMNS)
        .in('consultant_id', consultantIds)
        .gte('deal_date', yearStart)
        .lte('deal_date', yearEnd)
      dealRows = (rows || []) as DealForRealized[]
      const todayYmd = ymd(today)
      dealDatesYtd = dealRows
        .map((d) => (d.escritura_actual_date || d.deal_date || '').slice(0, 10))
        .filter((s): s is string => !!s && s <= todayYmd)
    }

    // ── € realizado YTD (split CPCV + escritura, perspectiva consultor) ──
    let realizedEurYtd = 0
    if (dealRows.length > 0) {
      const yearStart = `${year}-01-01`
      const todayYmd = ymd(today)
      const byConsultor = aggregateRealizedByConsultant(
        dealRows,
        yearStart,
        todayYmd,
        todayYmd,
      )
      realizedEurYtd = Object.values(byConsultor).reduce((acc, v) => acc + v, 0)
    }

    const result = buildTrajectory({
      year,
      today,
      goals: (goals || []) as GoalRow[],
      dealDatesYtd,
      realizedEurYtd,
      scope,
    })

    const response: TrajectoryResponse = {
      scope,
      year,
      today: ymd(today),
      weeks_in_year: result.weeksInYear,
      weeks_elapsed: result.weeksElapsed,
      consultant: consultantInfo,
      team_member_count: scope === 'team' ? (goals || []).length : undefined,
      summary: result.summary,
      weekly: result.weekly,
    }

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    })
  } catch (error) {
    console.error('Erro a calcular trajectória:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
