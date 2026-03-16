// @ts-nocheck
"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  ManagementDashboard,
  RevenuePipelineItem,
  PerformanceAlert,
  AgentDashboard,
  AgentRanking,
  FinancialTransaction,
  TransactionStatus,
  CommissionTier,
  AgencySetting,
  AgentAnalysisReport,
  MonthlyComparison,
  MonthlyComparisonTotals,
  AgentSummary,
  TrendIndicator,
  UpcomingAction,
  VsAverageItem,
  ReportFilters,
  CustomReportConfig,
  ReportDimension,
  ReportMetric,
} from "@/types/financial"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfMonth(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`
}

function startOfYear(date: Date = new Date()): string {
  return `${date.getFullYear()}-01-01`
}

function endOfMonth(date: Date = new Date()): string {
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`
}

function reportingMonth(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function monthsElapsed(): number {
  const now = new Date()
  return now.getMonth() + 1
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

const STAGE_PROBABILITIES: Record<string, { label: string; probability: number }> = {
  approved: { label: "Aprovado", probability: 0.20 },
  visitas: { label: "Visitas", probability: 0.35 },
  proposta: { label: "Proposta", probability: 0.50 },
  cpcv: { label: "CPCV", probability: 0.80 },
  escritura: { label: "Escritura", probability: 0.95 },
}

const DEFAULT_MARGIN_RATE = 0.30
const ITEMS_PER_PAGE = 25

// ─── 1. Management Dashboard ─────────────────────────────────────────────────

export async function getManagementDashboard(): Promise<ManagementDashboard & { error: string | null }> {
  const empty: ManagementDashboard = {
    forecasts: { expected_acquisitions: 0, pending_acquisitions: 0, expected_deals: 0, active_deals: 0, expected_revenue: 0, expected_margin: 0 },
    acquisitions: { new_this_month: 0, active: 0, days_without_acquisition: 0, last_acquisition_title: null, last_acquisition_date: null, last_acquisition_id: null, acquired: 0, reserved: 0, sold: 0, cancelled: 0 },
    reporting: { reported_this_month: 0, signed_pending: 0, reported_this_year: 0 },
    margin: { margin_this_month: 0, pending_collection: 0, margin_this_year: 0 },
    portfolio: { active_volume: 0, potential_revenue: 0 },
  }

  try {
    const admin = createAdminClient()
    const now = new Date()
    const monthStart = startOfMonth(now)
    const yearStart = startOfYear(now)
    const currentReportingMonth = reportingMonth(now)

    // ── Forecasts ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: goals } = await (admin as any).from("temp_consultant_goals")
      .select("annual_target")
      .eq("year", now.getFullYear())

    const expectedRevenue = (goals ?? []).reduce((sum: number, g: { annual_target: number }) => sum + (g.annual_target || 0), 0)

    const { count: pendingCount } = await admin
      .from("dev_properties")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_approval")

    const { count: activePropsCount } = await admin
      .from("dev_properties")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")

    const { count: activeDeals } = await admin
      .from("proc_instances")
      .select("id", { count: "exact", head: true })
      .in("current_status", ["in_progress", "approved"])

    // ── Acquisitions ──
    const { count: newThisMonth } = await admin
      .from("dev_properties")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthStart)

    const { count: acquired } = await admin
      .from("dev_properties")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")

    const { count: reserved } = await admin
      .from("dev_properties")
      .select("id", { count: "exact", head: true })
      .eq("status", "reserved")

    const { count: sold } = await admin
      .from("dev_properties")
      .select("id", { count: "exact", head: true })
      .eq("status", "sold")

    const { count: cancelled } = await admin
      .from("dev_properties")
      .select("id", { count: "exact", head: true })
      .eq("status", "cancelled")

    // Days without acquisition + last acquisition info
    const { data: lastProp } = await admin
      .from("dev_properties")
      .select("id, title, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    const daysWithout = lastProp
      ? Math.floor((now.getTime() - new Date(lastProp.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0
    const lastAcqTitle = lastProp?.title ?? null
    const lastAcqDate = lastProp?.created_at ?? null
    const lastAcqId = lastProp?.id ?? null

    // ── Reporting ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: monthRevenue } = await (admin as any).from("temp_goal_activity_log")
      .select("revenue_amount")
      .eq("reporting_month", currentReportingMonth)

    const reportedThisMonth = (monthRevenue ?? []).reduce((sum: number, r: { revenue_amount: number }) => sum + (r.revenue_amount || 0), 0)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: yearRevenue } = await (admin as any).from("temp_goal_activity_log")
      .select("revenue_amount")
      .gte("reporting_month", `${now.getFullYear()}-01`)
      .lte("reporting_month", currentReportingMonth)

    const reportedThisYear = (yearRevenue ?? []).reduce((sum: number, r: { revenue_amount: number }) => sum + (r.revenue_amount || 0), 0)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pendingTx } = await (admin as any).from("temp_financial_transactions")
      .select("agency_commission_amount")
      .eq("status", "approved")

    const signedPending = (pendingTx ?? []).reduce((sum: number, t: { agency_commission_amount: number }) => sum + (t.agency_commission_amount || 0), 0)

    // ── Margin ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: settings } = await (admin as any).from("temp_agency_settings")
      .select("value")
      .eq("key", "margin_rate")
      .single()

    const marginRate = settings?.value ? parseFloat(settings.value) : DEFAULT_MARGIN_RATE

    // ── Portfolio ──
    const { data: activeProps } = await admin
      .from("dev_properties")
      .select("listing_price")
      .eq("status", "active")

    const activeVolume = (activeProps ?? []).reduce((sum, p) => sum + (p.listing_price || 0), 0)

    const { data: internalData } = await admin
      .from("dev_property_internal")
      .select("commission_agreed, property_id")

    // Filter only active properties for potential revenue
    const { data: activeIds } = await admin
      .from("dev_properties")
      .select("id")
      .eq("status", "active")

    const activeIdSet = new Set((activeIds ?? []).map((p) => p.id))
    const potentialRevenue = (internalData ?? [])
      .filter((d) => activeIdSet.has(d.property_id))
      .reduce((sum, d) => sum + (d.commission_agreed || 0), 0)

    const dashboard: ManagementDashboard = {
      forecasts: {
        expected_acquisitions: (goals ?? []).length * 2, // estimated 2 per consultant
        pending_acquisitions: pendingCount ?? 0,
        expected_deals: activeDeals ?? 0,
        active_deals: activeDeals ?? 0,
        expected_revenue: expectedRevenue,
        expected_margin: expectedRevenue * marginRate,
      },
      acquisitions: {
        new_this_month: newThisMonth ?? 0,
        active: acquired ?? 0,
        days_without_acquisition: daysWithout,
        last_acquisition_title: lastAcqTitle,
        last_acquisition_date: lastAcqDate,
        last_acquisition_id: lastAcqId,
        acquired: acquired ?? 0,
        reserved: reserved ?? 0,
        sold: sold ?? 0,
        cancelled: cancelled ?? 0,
      },
      reporting: {
        reported_this_month: reportedThisMonth,
        signed_pending: signedPending,
        reported_this_year: reportedThisYear,
      },
      margin: {
        margin_this_month: reportedThisMonth * marginRate,
        pending_collection: signedPending * marginRate,
        margin_this_year: reportedThisYear * marginRate,
      },
      portfolio: {
        active_volume: activeVolume,
        potential_revenue: potentialRevenue,
      },
    }

    return { ...dashboard, error: null }
  } catch (err) {
    console.error("[getManagementDashboard]", err)
    return { ...empty, error: (err as Error).message }
  }
}

// ─── 2. Revenue Chart ────────────────────────────────────────────────────────

export async function getRevenueChart(
  months: number = 12
): Promise<{ data: { month: string; revenue: number; margin: number }[]; error: string | null }> {
  try {
    const admin = createAdminClient()
    const now = new Date()

    // Get margin rate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: settings } = await (admin as any).from("temp_agency_settings")
      .select("value")
      .eq("key", "margin_rate")
      .single()

    const marginRate = settings?.value ? parseFloat(settings.value) : DEFAULT_MARGIN_RATE

    // Build list of months
    const monthList: string[] = []
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      monthList.push(reportingMonth(d))
    }

    const fromMonth = monthList[0]
    const toMonth = monthList[monthList.length - 1]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: logs } = await (admin as any).from("temp_goal_activity_log")
      .select("reporting_month, revenue_amount")
      .gte("reporting_month", fromMonth)
      .lte("reporting_month", toMonth)

    // Aggregate by month
    const revenueMap: Record<string, number> = {}
    for (const m of monthList) revenueMap[m] = 0
    for (const log of (logs ?? [])) {
      if (log.reporting_month && revenueMap[log.reporting_month] !== undefined) {
        revenueMap[log.reporting_month] += log.revenue_amount || 0
      }
    }

    const data = monthList.map((m) => {
      const [y, mo] = m.split("-")
      const monthIdx = parseInt(mo, 10) - 1
      const label = `${MONTH_NAMES[monthIdx]} ${y}`
      const revenue = revenueMap[m] || 0
      return { month: label, revenue, margin: revenue * marginRate }
    })

    return { data, error: null }
  } catch (err) {
    console.error("[getRevenueChart]", err)
    return { data: [], error: (err as Error).message }
  }
}

// ─── 3. Performance Alerts ───────────────────────────────────────────────────

export async function getPerformanceAlerts(): Promise<{ alerts: PerformanceAlert[]; error: string | null }> {
  try {
    const admin = createAdminClient()
    const now = new Date()
    const monthStart = startOfMonth(now)
    const yearStart = startOfYear(now)
    const elapsed = monthsElapsed()
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()

    // Get active consultants
    const { data: consultants } = await admin
      .from("dev_users")
      .select("id, commercial_name")
      .eq("is_active", true)

    if (!consultants || consultants.length === 0) {
      return { alerts: [], error: null }
    }

    // Get goals for current year
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: goals } = await (admin as any).from("temp_consultant_goals")
      .select("consultant_id, annual_target")
      .eq("year", now.getFullYear())

    const goalMap: Record<string, number> = {}
    for (const g of (goals ?? [])) {
      goalMap[g.consultant_id] = g.annual_target || 0
    }

    // Get YTD revenue per consultant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: activityLogs } = await (admin as any).from("temp_goal_activity_log")
      .select("consultant_id, revenue_amount")
      .gte("reporting_month", `${now.getFullYear()}-01`)

    const revenueMap: Record<string, number> = {}
    for (const log of (activityLogs ?? [])) {
      revenueMap[log.consultant_id] = (revenueMap[log.consultant_id] || 0) + (log.revenue_amount || 0)
    }

    // Get properties created this month per consultant
    const { data: monthProps } = await admin
      .from("dev_properties")
      .select("consultant_id")
      .gte("created_at", monthStart)

    const acqMap: Record<string, number> = {}
    for (const p of (monthProps ?? [])) {
      if (p.consultant_id) {
        acqMap[p.consultant_id] = (acqMap[p.consultant_id] || 0) + 1
      }
    }

    // Get last activity per consultant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lastActivities } = await (admin as any).from("temp_goal_activity_log")
      .select("consultant_id, created_at")
      .order("created_at", { ascending: false })

    const lastActivityMap: Record<string, string> = {}
    for (const a of (lastActivities ?? [])) {
      if (!lastActivityMap[a.consultant_id]) {
        lastActivityMap[a.consultant_id] = a.created_at
      }
    }

    const alerts: PerformanceAlert[] = []

    for (const c of consultants) {
      const target = goalMap[c.id] || 0
      const ytdRevenue = revenueMap[c.id] || 0
      const monthAcq = acqMap[c.id] || 0
      const lastActivity = lastActivityMap[c.id]

      // No acquisitions this month
      if (monthAcq === 0) {
        alerts.push({
          consultant_id: c.id,
          consultant_name: c.commercial_name || "Consultor",
          type: "no_acquisitions",
          severity: "warning",
          message: `Sem angariações este mês`,
        })
      }

      // Below target (YTD revenue < 50% of expected proportional target)
      if (target > 0) {
        const expectedByNow = (target * elapsed) / 12
        if (ytdRevenue < expectedByNow * 0.5) {
          alerts.push({
            consultant_id: c.id,
            consultant_name: c.commercial_name || "Consultor",
            type: "below_target",
            severity: "urgent",
            message: `Facturação YTD abaixo de 50% do esperado`,
            value: ytdRevenue,
            target: expectedByNow,
          })
        }

        // Annual risk: simple extrapolation
        const projectedAnnual = elapsed > 0 ? (ytdRevenue / elapsed) * 12 : 0
        if (projectedAnnual < target * 0.7) {
          alerts.push({
            consultant_id: c.id,
            consultant_name: c.commercial_name || "Consultor",
            type: "annual_risk",
            severity: "urgent",
            message: `Meta anual em risco (projecção: ${Math.round(projectedAnnual).toLocaleString("pt-PT")} / ${target.toLocaleString("pt-PT")})`,
            value: projectedAnnual,
            target,
          })
        }
      }

      // No activity in last 5 days
      if (!lastActivity || new Date(lastActivity) < new Date(fiveDaysAgo)) {
        alerts.push({
          consultant_id: c.id,
          consultant_name: c.commercial_name || "Consultor",
          type: "no_activity",
          severity: "warning",
          message: `Sem actividade registada nos últimos 5 dias`,
        })
      }
    }

    return { alerts, error: null }
  } catch (err) {
    console.error("[getPerformanceAlerts]", err)
    return { alerts: [], error: (err as Error).message }
  }
}

// ─── 4. Rankings ─────────────────────────────────────────────────────────────

export async function getAgentRankings(
  metric: "revenue" | "acquisitions",
  period?: string
): Promise<{ rankings: AgentRanking[]; error: string | null }> {
  try {
    const admin = createAdminClient()
    const now = new Date()
    const yearStart = startOfYear(now)
    const monthStart = startOfMonth(now)
    const currentReportingMonth = reportingMonth(now)

    // Determine date range
    const dateFrom = period === "month" ? monthStart : yearStart
    const monthFrom = period === "month" ? currentReportingMonth : `${now.getFullYear()}-01`

    // Get consultants
    const { data: consultants } = await admin
      .from("dev_users")
      .select("id, commercial_name")
      .eq("is_active", true)

    if (!consultants || consultants.length === 0) {
      return { rankings: [], error: null }
    }

    // Get goals
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: goals } = await (admin as any).from("temp_consultant_goals")
      .select("consultant_id, annual_target")
      .eq("year", now.getFullYear())

    const goalMap: Record<string, number> = {}
    for (const g of (goals ?? [])) goalMap[g.consultant_id] = g.annual_target || 0

    if (metric === "revenue") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: logs } = await (admin as any).from("temp_goal_activity_log")
        .select("consultant_id, revenue_amount")
        .gte("reporting_month", monthFrom)

      const revenueMap: Record<string, number> = {}
      for (const log of (logs ?? [])) {
        revenueMap[log.consultant_id] = (revenueMap[log.consultant_id] || 0) + (log.revenue_amount || 0)
      }

      const rankings: AgentRanking[] = consultants
        .map((c) => {
          const value = revenueMap[c.id] || 0
          const target = goalMap[c.id] || null
          return {
            position: 0,
            consultant_id: c.id,
            consultant_name: c.commercial_name || "Consultor",
            value,
            target,
            pct_achieved: target ? Math.round((value / target) * 100) : null,
            variation_vs_previous: null,
          }
        })
        .sort((a, b) => b.value - a.value)
        .map((r, i) => ({ ...r, position: i + 1 }))

      return { rankings, error: null }
    } else {
      // Acquisitions
      const { data: props } = await admin
        .from("dev_properties")
        .select("consultant_id, status")
        .gte("created_at", dateFrom)

      const acqMap: Record<string, { total: number; active: number; sold: number }> = {}
      for (const p of (props ?? [])) {
        if (!p.consultant_id) continue
        if (!acqMap[p.consultant_id]) acqMap[p.consultant_id] = { total: 0, active: 0, sold: 0 }
        acqMap[p.consultant_id].total++
        if (p.status === "active") acqMap[p.consultant_id].active++
        if (p.status === "sold") acqMap[p.consultant_id].sold++
      }

      // New this month
      const { data: monthProps } = await admin
        .from("dev_properties")
        .select("consultant_id")
        .gte("created_at", monthStart)

      const newMap: Record<string, number> = {}
      for (const p of (monthProps ?? [])) {
        if (p.consultant_id) newMap[p.consultant_id] = (newMap[p.consultant_id] || 0) + 1
      }

      const rankings: AgentRanking[] = consultants
        .map((c) => {
          const stats = acqMap[c.id] || { total: 0, active: 0, sold: 0 }
          return {
            position: 0,
            consultant_id: c.id,
            consultant_name: c.commercial_name || "Consultor",
            value: stats.total,
            target: null,
            pct_achieved: null,
            variation_vs_previous: null,
            new_this_month: newMap[c.id] || 0,
            active: stats.active,
            sold: stats.sold,
          }
        })
        .sort((a, b) => b.value - a.value)
        .map((r, i) => ({ ...r, position: i + 1 }))

      return { rankings, error: null }
    }
  } catch (err) {
    console.error("[getAgentRankings]", err)
    return { rankings: [], error: (err as Error).message }
  }
}

// ─── 5. Revenue Pipeline ─────────────────────────────────────────────────────

export async function getRevenuePipeline(): Promise<{ pipeline: RevenuePipelineItem[]; error: string | null }> {
  try {
    const admin = createAdminClient()

    // Get active proc_instances with stage info
    const { data: instances } = await admin
      .from("proc_instances")
      .select(`
        id,
        property_id,
        current_stage_id,
        current_status,
        tpl_stages:current_stage_id (name)
      `)
      .in("current_status", ["in_progress", "approved"])

    if (!instances || instances.length === 0) {
      return { pipeline: [], error: null }
    }

    // Get property values
    const propertyIds = Array.from(new Set((instances ?? []).map((i) => i.property_id).filter(Boolean)))

    const { data: internals } = await admin
      .from("dev_property_internal")
      .select("property_id, commission_agreed")
      .in("property_id", propertyIds)

    const { data: properties } = await admin
      .from("dev_properties")
      .select("id, listing_price")
      .in("id", propertyIds)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: settingsData } = await (admin as any).from("temp_agency_settings")
      .select("value")
      .eq("key", "default_commission_rate")
      .single()

    const defaultRate = settingsData?.value ? parseFloat(settingsData.value) : 0.05

    const internalMap: Record<string, number> = {}
    for (const i of (internals ?? [])) {
      internalMap[i.property_id] = i.commission_agreed || 0
    }

    const priceMap: Record<string, number> = {}
    for (const p of (properties ?? [])) {
      priceMap[p.id] = p.listing_price || 0
    }

    // Group by stage
    const stageGroups: Record<string, { count: number; totalValue: number }> = {}

    for (const inst of instances) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stageName = ((inst as any).tpl_stages?.name || "approved").toLowerCase()
      const matchedStage = Object.keys(STAGE_PROBABILITIES).find((s) => stageName.includes(s)) || "approved"

      if (!stageGroups[matchedStage]) stageGroups[matchedStage] = { count: 0, totalValue: 0 }
      stageGroups[matchedStage].count++

      const commission = inst.property_id
        ? internalMap[inst.property_id] || priceMap[inst.property_id] * defaultRate
        : 0
      stageGroups[matchedStage].totalValue += commission
    }

    const pipeline: RevenuePipelineItem[] = Object.entries(STAGE_PROBABILITIES).map(([stage, config]) => {
      const group = stageGroups[stage] || { count: 0, totalValue: 0 }
      return {
        stage,
        label: config.label,
        probability: config.probability,
        total_value: group.totalValue,
        weighted_value: group.totalValue * config.probability,
        count: group.count,
      }
    })

    return { pipeline, error: null }
  } catch (err) {
    console.error("[getRevenuePipeline]", err)
    return { pipeline: [], error: (err as Error).message }
  }
}

// ─── 6. Agent Dashboard ──────────────────────────────────────────────────────

export async function getAgentDashboard(
  consultantId: string
): Promise<AgentDashboard & { error: string | null }> {
  const empty: AgentDashboard = {
    revenue_ytd: 0,
    revenue_this_month: 0,
    annual_target: 0,
    pct_achieved: 0,
    ranking_position: 0,
    total_agents: 0,
    my_properties: { active: 0, reserved: 0, sold_year: 0, volume: 0 },
    upcoming_actions: [],
    vs_average: [],
    monthly_evolution: [],
  }

  try {
    const admin = createAdminClient()
    const now = new Date()
    const currentMonth = reportingMonth(now)
    const yearStart = startOfYear(now)
    const monthStart = startOfMonth(now)

    // ── Revenue YTD & This Month ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allLogs } = await (admin as any).from("temp_goal_activity_log")
      .select("consultant_id, revenue_amount, reporting_month")
      .gte("reporting_month", `${now.getFullYear()}-01`)

    let revenueYtd = 0
    let revenueThisMonth = 0
    const allConsultantRevenue: Record<string, number> = {}

    for (const log of (allLogs ?? [])) {
      const amt = log.revenue_amount || 0
      allConsultantRevenue[log.consultant_id] = (allConsultantRevenue[log.consultant_id] || 0) + amt
      if (log.consultant_id === consultantId) {
        revenueYtd += amt
        if (log.reporting_month === currentMonth) revenueThisMonth += amt
      }
    }

    // ── Target ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: goal } = await (admin as any).from("temp_consultant_goals")
      .select("annual_target")
      .eq("consultant_id", consultantId)
      .eq("year", now.getFullYear())
      .single()

    const annualTarget = goal?.annual_target || 0

    // ── Ranking ──
    const sorted = Object.entries(allConsultantRevenue).sort(([, a], [, b]) => b - a)
    const rankIdx = sorted.findIndex(([id]) => id === consultantId)
    const rankingPosition = rankIdx >= 0 ? rankIdx + 1 : sorted.length + 1

    // ── My Properties ──
    const { data: myProps } = await admin
      .from("dev_properties")
      .select("id, status, listing_price, created_at")
      .eq("consultant_id", consultantId)

    let active = 0
    let reserved = 0
    let soldYear = 0
    let volume = 0

    for (const p of (myProps ?? [])) {
      if (p.status === "active") { active++; volume += p.listing_price || 0 }
      if (p.status === "reserved") { reserved++; volume += p.listing_price || 0 }
      if (p.status === "sold" && p.created_at >= yearStart) soldYear++
    }

    // ── Upcoming Actions ──
    const upcomingActions: UpcomingAction[] = []

    // Tasks with due dates
    const { data: tasks } = await admin
      .from("proc_tasks")
      .select(`
        title,
        due_date,
        proc_instances!inner(property_id)
      `)
      .eq("assigned_to", consultantId)
      .eq("status", "pending")
      .not("due_date", "is", null)
      .order("due_date", { ascending: true })
      .limit(10)

    for (const t of (tasks ?? [])) {
      const title = t.title || "Tarefa"
      const taskType = title.toLowerCase().includes("cpcv") ? "cpcv" as const
        : title.toLowerCase().includes("escritura") ? "escritura" as const
        : title.toLowerCase().includes("visita") ? "visit" as const
        : "visit" as const

      upcomingActions.push({
        type: taskType,
        title,
        date: t.due_date!,
      })
    }

    // Contract expiries
    const { data: expiring } = await admin
      .from("dev_property_internal")
      .select("property_id, contract_expiry")
      .not("contract_expiry", "is", null)
      .gte("contract_expiry", now.toISOString().split("T")[0])
      .order("contract_expiry", { ascending: true })
      .limit(5)

    const myPropIds = new Set((myProps ?? []).map((p) => p.id))

    for (const e of (expiring ?? [])) {
      if (myPropIds.has(e.property_id)) {
        upcomingActions.push({
          type: "contract_expiry",
          title: `Contrato a expirar`,
          date: e.contract_expiry!,
          property_ref: e.property_id,
        })
      }
    }

    upcomingActions.sort((a, b) => a.date.localeCompare(b.date))

    // ── Vs Average ──
    const { data: allConsultants } = await admin
      .from("dev_users")
      .select("id")
      .eq("is_active", true)

    const totalAgents = allConsultants?.length || 1
    const totalRevenue = Object.values(allConsultantRevenue).reduce((s, v) => s + v, 0)
    const avgRevenue = totalRevenue / totalAgents

    // Acquisitions this year
    const { data: yearProps } = await admin
      .from("dev_properties")
      .select("consultant_id")
      .gte("created_at", yearStart)

    const acqCountMap: Record<string, number> = {}
    for (const p of (yearProps ?? [])) {
      if (p.consultant_id) acqCountMap[p.consultant_id] = (acqCountMap[p.consultant_id] || 0) + 1
    }
    const myAcq = acqCountMap[consultantId] || 0
    const avgAcq = Object.values(acqCountMap).reduce((s, v) => s + v, 0) / totalAgents

    const vsAverage: VsAverageItem[] = [
      {
        metric: "Facturação YTD",
        my_value: revenueYtd,
        agency_avg: avgRevenue,
        direction: revenueYtd > avgRevenue ? "above" : revenueYtd < avgRevenue ? "below" : "equal",
      },
      {
        metric: "Angariações (ano)",
        my_value: myAcq,
        agency_avg: avgAcq,
        direction: myAcq > avgAcq ? "above" : myAcq < avgAcq ? "below" : "equal",
      },
      {
        metric: "Imóveis Activos",
        my_value: active,
        agency_avg: (activeProps_count(myProps ?? [], "active") * totalAgents) > 0 ? active : 0,
        direction: "equal",
      },
    ]

    // ── Monthly Evolution ──
    const monthlyEvolution: { month: string; revenue: number; target: number }[] = []
    const monthlyTarget = annualTarget / 12

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const m = reportingMonth(d)
      const monthIdx = d.getMonth()

      let monthRev = 0
      for (const log of (allLogs ?? [])) {
        if (log.consultant_id === consultantId && log.reporting_month === m) {
          monthRev += log.revenue_amount || 0
        }
      }

      monthlyEvolution.push({
        month: MONTH_NAMES[monthIdx],
        revenue: monthRev,
        target: monthlyTarget,
      })
    }

    return {
      revenue_ytd: revenueYtd,
      revenue_this_month: revenueThisMonth,
      annual_target: annualTarget,
      pct_achieved: annualTarget > 0 ? Math.round((revenueYtd / annualTarget) * 100) : 0,
      ranking_position: rankingPosition,
      total_agents: totalAgents,
      my_properties: { active, reserved, sold_year: soldYear, volume },
      upcoming_actions: upcomingActions.slice(0, 10),
      vs_average: vsAverage,
      monthly_evolution: monthlyEvolution,
      error: null,
    }
  } catch (err) {
    console.error("[getAgentDashboard]", err)
    return { ...empty, error: (err as Error).message }
  }
}

// Helper for vs_average calculation — count properties by status
function activeProps_count(props: { status: string }[], status: string): number {
  return props.filter((p) => p.status === status).length
}

// ─── 7. Transactions CRUD ────────────────────────────────────────────────────

export async function getTransactions(filters?: {
  consultant_id?: string
  status?: string
  type?: string
  date_from?: string
  date_to?: string
  page?: number
}): Promise<{ transactions: FinancialTransaction[]; total: number; error: string | null }> {
  try {
    const admin = createAdminClient()
    const page = filters?.page || 1
    const from = (page - 1) * ITEMS_PER_PAGE
    const to = from + ITEMS_PER_PAGE - 1

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (admin as any).from("temp_financial_transactions")
      .select(`
        *,
        consultant:dev_users!temp_financial_transactions_consultant_id_fkey(id, commercial_name),
        property:dev_properties!temp_financial_transactions_property_id_fkey(id, title, external_ref, listing_price)
      `, { count: "exact" })
      .order("transaction_date", { ascending: false })
      .range(from, to)

    if (filters?.consultant_id) query = query.eq("consultant_id", filters.consultant_id)
    if (filters?.status) query = query.eq("status", filters.status)
    if (filters?.type) query = query.eq("transaction_type", filters.type)
    if (filters?.date_from) query = query.gte("transaction_date", filters.date_from)
    if (filters?.date_to) query = query.lte("transaction_date", filters.date_to)

    const { data, count, error } = await query

    if (error) return { transactions: [], total: 0, error: error.message }
    return { transactions: (data ?? []) as FinancialTransaction[], total: count ?? 0, error: null }
  } catch (err) {
    console.error("[getTransactions]", err)
    return { transactions: [], total: 0, error: (err as Error).message }
  }
}

export async function createTransaction(
  data: Partial<FinancialTransaction>
): Promise<{ transaction: FinancialTransaction | null; error: string | null }> {
  try {
    const admin = createAdminClient()
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { transaction: null, error: "Não autenticado" }

    const now = new Date()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (admin as any).from("temp_financial_transactions")
      .insert({
        consultant_id: data.consultant_id,
        property_id: data.property_id || null,
        proc_instance_id: data.proc_instance_id || null,
        transaction_type: data.transaction_type || "commission_sale",
        category: data.category || null,
        deal_value: data.deal_value || null,
        agency_commission_pct: data.agency_commission_pct || null,
        agency_commission_amount: data.agency_commission_amount || null,
        consultant_split_pct: data.consultant_split_pct || null,
        consultant_commission_amount: data.consultant_commission_amount || null,
        is_shared_deal: data.is_shared_deal || false,
        share_type: data.share_type || null,
        share_agency_name: data.share_agency_name || null,
        share_pct: data.share_pct || null,
        share_amount: data.share_amount || null,
        status: "pending",
        transaction_date: data.transaction_date || now.toISOString().split("T")[0],
        reporting_month: data.reporting_month || reportingMonth(now),
        description: data.description || null,
        notes: data.notes || null,
      })
      .select()
      .single()

    if (error) return { transaction: null, error: error.message }
    return { transaction: result as FinancialTransaction, error: null }
  } catch (err) {
    console.error("[createTransaction]", err)
    return { transaction: null, error: (err as Error).message }
  }
}

export async function updateTransactionStatus(
  id: string,
  status: TransactionStatus,
  paymentRef?: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const admin = createAdminClient()
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "Não autenticado" }

    const now = new Date().toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      status,
      updated_at: now,
    }

    if (status === "approved") {
      updateData.approved_by = user.id
      updateData.approved_at = now
    }

    if (status === "paid") {
      updateData.paid_at = now
      if (paymentRef) updateData.payment_reference = paymentRef
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).from("temp_financial_transactions")
      .update(updateData)
      .eq("id", id)

    if (error) return { success: false, error: error.message }
    return { success: true, error: null }
  } catch (err) {
    console.error("[updateTransactionStatus]", err)
    return { success: false, error: (err as Error).message }
  }
}

export async function bulkApproveTransactions(
  ids: string[]
): Promise<{ success: boolean; error: string | null }> {
  try {
    const admin = createAdminClient()
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "Não autenticado" }

    if (!ids || ids.length === 0) return { success: false, error: "Nenhuma transacção seleccionada" }

    const now = new Date().toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).from("temp_financial_transactions")
      .update({
        status: "approved",
        approved_by: user.id,
        approved_at: now,
        updated_at: now,
      })
      .in("id", ids)
      .eq("status", "pending")

    if (error) return { success: false, error: error.message }
    return { success: true, error: null }
  } catch (err) {
    console.error("[bulkApproveTransactions]", err)
    return { success: false, error: (err as Error).message }
  }
}

// ─── 8. Commission Tiers ─────────────────────────────────────────────────────

export async function getCommissionTiers(): Promise<{ tiers: CommissionTier[]; error: string | null }> {
  try {
    const admin = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any).from("temp_commission_tiers")
      .select("*")
      .order("business_type", { ascending: true })
      .order("order_index", { ascending: true })

    if (error) return { tiers: [], error: error.message }
    return { tiers: (data ?? []) as CommissionTier[], error: null }
  } catch (err) {
    console.error("[getCommissionTiers]", err)
    return { tiers: [], error: (err as Error).message }
  }
}

export async function upsertCommissionTier(
  data: Partial<CommissionTier>
): Promise<{ success: boolean; error: string | null }> {
  try {
    const admin = createAdminClient()

    if (data.id) {
      // Update
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (admin as any).from("temp_commission_tiers")
        .update({
          name: data.name,
          business_type: data.business_type,
          min_value: data.min_value,
          max_value: data.max_value ?? null,
          agency_rate: data.agency_rate,
          consultant_rate: data.consultant_rate,
          is_active: data.is_active ?? true,
          order_index: data.order_index ?? 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id)

      if (error) return { success: false, error: error.message }
    } else {
      // Insert
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (admin as any).from("temp_commission_tiers")
        .insert({
          name: data.name,
          business_type: data.business_type,
          min_value: data.min_value ?? 0,
          max_value: data.max_value ?? null,
          agency_rate: data.agency_rate ?? 0.05,
          consultant_rate: data.consultant_rate ?? 0.50,
          is_active: data.is_active ?? true,
          order_index: data.order_index ?? 0,
        })

      if (error) return { success: false, error: error.message }
    }

    return { success: true, error: null }
  } catch (err) {
    console.error("[upsertCommissionTier]", err)
    return { success: false, error: (err as Error).message }
  }
}

export async function deleteCommissionTier(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const admin = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).from("temp_commission_tiers")
      .delete()
      .eq("id", id)

    if (error) return { success: false, error: error.message }
    return { success: true, error: null }
  } catch (err) {
    console.error("[deleteCommissionTier]", err)
    return { success: false, error: (err as Error).message }
  }
}

// ─── 9. Agency Settings ──────────────────────────────────────────────────────

export async function getAgencySettings(): Promise<{ settings: AgencySetting[]; error: string | null }> {
  try {
    const admin = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any).from("temp_agency_settings")
      .select("*")
      .order("key", { ascending: true })

    if (error) return { settings: [], error: error.message }
    return { settings: (data ?? []) as AgencySetting[], error: null }
  } catch (err) {
    console.error("[getAgencySettings]", err)
    return { settings: [], error: (err as Error).message }
  }
}

export async function updateAgencySetting(
  key: string,
  value: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const admin = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).from("temp_agency_settings")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("key", key)

    if (error) return { success: false, error: error.message }
    return { success: true, error: null }
  } catch (err) {
    console.error("[updateAgencySetting]", err)
    return { success: false, error: (err as Error).message }
  }
}

// ─── 10. Reports ─────────────────────────────────────────────────────────────

export async function generateAgentReport(
  consultantId: string,
  year: number
): Promise<{ report: AgentAnalysisReport | null; error: string | null }> {
  try {
    const admin = createAdminClient()
    const prevYear = year - 1

    // ── Agent Info ──
    const { data: user } = await admin
      .from("dev_users")
      .select("id, commercial_name, created_at")
      .eq("id", consultantId)
      .single()

    if (!user) return { report: null, error: "Consultor não encontrado" }

    const { data: privateData } = await admin
      .from("dev_consultant_private_data")
      .select("hiring_date, commission_rate")
      .eq("user_id", consultantId)
      .single()

    // ── Goal ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: goal } = await (admin as any).from("temp_consultant_goals")
      .select("annual_target")
      .eq("consultant_id", consultantId)
      .eq("year", year)
      .single()

    const annualTarget = goal?.annual_target || 0

    // ── Ranking ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allLogs } = await (admin as any).from("temp_goal_activity_log")
      .select("consultant_id, revenue_amount")
      .gte("reporting_month", `${year}-01`)
      .lte("reporting_month", `${year}-12`)

    const revenueMap: Record<string, number> = {}
    for (const log of (allLogs ?? [])) {
      revenueMap[log.consultant_id] = (revenueMap[log.consultant_id] || 0) + (log.revenue_amount || 0)
    }

    const sorted = Object.entries(revenueMap).sort(([, a], [, b]) => b - a)
    const rankIdx = sorted.findIndex(([id]) => id === consultantId)

    // ── Monthly Billing ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: txCurr } = await (admin as any).from("temp_financial_transactions")
      .select("reporting_month, agency_commission_amount, transaction_type")
      .eq("consultant_id", consultantId)
      .gte("reporting_month", `${year}-01`)
      .lte("reporting_month", `${year}-12`)
      .in("status", ["approved", "paid"])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: txPrev } = await (admin as any).from("temp_financial_transactions")
      .select("reporting_month, agency_commission_amount, transaction_type")
      .eq("consultant_id", consultantId)
      .gte("reporting_month", `${prevYear}-01`)
      .lte("reporting_month", `${prevYear}-12`)
      .in("status", ["approved", "paid"])

    // ── Acquisitions ──
    const { data: acqCurr } = await admin
      .from("dev_properties")
      .select("id, created_at")
      .eq("consultant_id", consultantId)
      .gte("created_at", `${year}-01-01`)
      .lte("created_at", `${year}-12-31`)

    const { data: acqPrev } = await admin
      .from("dev_properties")
      .select("id, created_at")
      .eq("consultant_id", consultantId)
      .gte("created_at", `${prevYear}-01-01`)
      .lte("created_at", `${prevYear}-12-31`)

    // Total acquisitions (cumulative)
    const { count: totalAcqCurr } = await admin
      .from("dev_properties")
      .select("id", { count: "exact", head: true })
      .eq("consultant_id", consultantId)
      .lte("created_at", `${year}-12-31`)

    const { count: totalAcqPrev } = await admin
      .from("dev_properties")
      .select("id", { count: "exact", head: true })
      .eq("consultant_id", consultantId)
      .lte("created_at", `${prevYear}-12-31`)

    // ── Build Monthly Comparison ──
    const billingByMonth = (txs: typeof txCurr, yr: number): Record<string, { amount: number; count: number }> => {
      const map: Record<string, { amount: number; count: number }> = {}
      for (let m = 1; m <= 12; m++) {
        const key = `${yr}-${String(m).padStart(2, "0")}`
        map[key] = { amount: 0, count: 0 }
      }
      for (const tx of (txs ?? [])) {
        if (map[tx.reporting_month]) {
          map[tx.reporting_month].amount += tx.agency_commission_amount || 0
          map[tx.reporting_month].count++
        }
      }
      return map
    }

    const acqByMonth = (acqs: typeof acqCurr, yr: number): Record<number, number> => {
      const map: Record<number, number> = {}
      for (let m = 1; m <= 12; m++) map[m] = 0
      for (const a of (acqs ?? [])) {
        const month = new Date(a.created_at).getMonth() + 1
        map[month]++
      }
      return map
    }

    const currBilling = billingByMonth(txCurr, year)
    const prevBilling = billingByMonth(txPrev, prevYear)
    const currAcq = acqByMonth(acqCurr, year)
    const prevAcq = acqByMonth(acqPrev, prevYear)

    const monthlyComparison: MonthlyComparison[] = []
    let cumulAcqCurr = 0
    let cumulAcqPrev = 0

    for (let m = 1; m <= 12; m++) {
      const currKey = `${year}-${String(m).padStart(2, "0")}`
      const prevKey = `${prevYear}-${String(m).padStart(2, "0")}`

      cumulAcqCurr += currAcq[m] || 0
      cumulAcqPrev += prevAcq[m] || 0

      const billingCurr = currBilling[currKey]?.amount || 0
      const billingPrev = prevBilling[prevKey]?.amount || 0

      // Quarter average (last 3 months)
      let quarterSum = 0
      for (let q = Math.max(1, m - 2); q <= m; q++) {
        const qKey = `${year}-${String(q).padStart(2, "0")}`
        quarterSum += currBilling[qKey]?.amount || 0
      }
      const quarterAvg = quarterSum / Math.min(m, 3)

      monthlyComparison.push({
        month: MONTH_NAMES[m - 1],
        billing_prev: billingPrev,
        billing_curr: billingCurr,
        new_acq_prev: prevAcq[m] || 0,
        new_acq_curr: currAcq[m] || 0,
        total_acq_prev: cumulAcqPrev,
        total_acq_curr: cumulAcqCurr,
        productivity_prev: (prevAcq[m] || 0) > 0 ? billingPrev / prevAcq[m] : 0,
        productivity_curr: (currAcq[m] || 0) > 0 ? billingCurr / currAcq[m] : 0,
        quarter_avg: quarterAvg,
        transactions_prev: prevBilling[prevKey]?.count || 0,
        transactions_curr: currBilling[currKey]?.count || 0,
      })
    }

    // ── Totals ──
    const totals: MonthlyComparisonTotals = {
      billing_prev: monthlyComparison.reduce((s, m) => s + m.billing_prev, 0),
      billing_curr: monthlyComparison.reduce((s, m) => s + m.billing_curr, 0),
      new_acq_prev: monthlyComparison.reduce((s, m) => s + m.new_acq_prev, 0),
      new_acq_curr: monthlyComparison.reduce((s, m) => s + m.new_acq_curr, 0),
      total_acq_prev: totalAcqPrev ?? 0,
      total_acq_curr: totalAcqCurr ?? 0,
      productivity_prev: monthlyComparison.reduce((s, m) => s + m.productivity_prev, 0) / 12,
      productivity_curr: monthlyComparison.reduce((s, m) => s + m.productivity_curr, 0) / 12,
      transactions_prev: monthlyComparison.reduce((s, m) => s + m.transactions_prev, 0),
      transactions_curr: monthlyComparison.reduce((s, m) => s + m.transactions_curr, 0),
    }

    // ── Summary ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allTxCurr } = await (admin as any).from("temp_financial_transactions")
      .select("transaction_type, agency_commission_amount, is_shared_deal, share_type")
      .eq("consultant_id", consultantId)
      .gte("reporting_month", `${year}-01`)
      .lte("reporting_month", `${year}-12`)
      .in("status", ["approved", "paid"])

    let saleCount = 0
    let rentCount = 0
    let internalShares = 0
    let externalShares = 0
    let networkShares = 0
    let saleAcqAmount = 0
    let saleSoldAmount = 0

    for (const tx of (allTxCurr ?? [])) {
      if (tx.transaction_type === "commission_sale") saleCount++
      if (tx.transaction_type === "commission_rent") rentCount++
      if (tx.is_shared_deal) {
        if (tx.share_type === "internal") internalShares++
        else if (tx.share_type === "external") externalShares++
        else if (tx.share_type === "network") networkShares++
      }
    }

    const totalTx = (allTxCurr ?? []).length || 1
    const ytdCurrent = totals.billing_curr
    const ytdPrevious = totals.billing_prev

    // Sale acquisitions vs sold
    const { data: saleAcqs } = await admin
      .from("dev_properties")
      .select("listing_price, status")
      .eq("consultant_id", consultantId)
      .eq("business_type", "venda")
      .gte("created_at", `${year}-01-01`)
      .lte("created_at", `${year}-12-31`)

    for (const p of (saleAcqs ?? [])) {
      saleAcqAmount += p.listing_price || 0
      if (p.status === "sold") saleSoldAmount += p.listing_price || 0
    }

    const totalAcqAmount = saleAcqAmount || 1

    const summary: AgentSummary = {
      total_acquisitions: totalAcqCurr ?? 0,
      sale_count: saleCount,
      rent_count: rentCount,
      internal_shares_pct: Math.round((internalShares / totalTx) * 100),
      external_shares_pct: Math.round((externalShares / totalTx) * 100),
      network_shares_pct: Math.round((networkShares / totalTx) * 100),
      ytd_current: ytdCurrent,
      ytd_previous: ytdPrevious,
      ytd_diff: ytdCurrent - ytdPrevious,
      sale_acq_amount: saleAcqAmount,
      sale_acq_pct: totalAcqAmount > 0 ? Math.round((saleAcqAmount / totalAcqAmount) * 100) : 0,
      sale_sold_amount: saleSoldAmount,
      sale_sold_pct: totalAcqAmount > 0 ? Math.round((saleSoldAmount / totalAcqAmount) * 100) : 0,
    }

    // ── Trends ──
    const trendDir = (curr: number, prev: number): TrendIndicator => ({
      direction: curr > prev ? "up" : curr < prev ? "down" : "equal",
      value: prev > 0 ? Math.round(((curr - prev) / prev) * 100) : curr > 0 ? 100 : 0,
    })

    const trends = {
      billing: trendDir(totals.billing_curr, totals.billing_prev),
      productivity: trendDir(totals.productivity_curr, totals.productivity_prev),
      new_acquisitions: trendDir(totals.new_acq_curr, totals.new_acq_prev),
      total_acquisitions: trendDir(totalAcqCurr ?? 0, totalAcqPrev ?? 0),
    }

    // ── Commission tier name ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tiers } = await (admin as any).from("temp_commission_tiers")
      .select("name, min_value, max_value")
      .eq("is_active", true)
      .eq("business_type", "venda")
      .order("min_value", { ascending: true })

    let tierName = "Standard"
    for (const t of (tiers ?? [])) {
      if (ytdCurrent >= (t.min_value || 0) && (!t.max_value || ytdCurrent <= t.max_value)) {
        tierName = t.name
      }
    }

    const report: AgentAnalysisReport = {
      agent: {
        name: user.commercial_name || "Consultor",
        agency: "Infinity Group",
        id_number: consultantId.slice(0, 8).toUpperCase(),
        entry_date: privateData?.hiring_date || user.created_at?.split("T")[0] || "",
        tier: tierName,
        ranking_position: rankIdx >= 0 ? rankIdx + 1 : sorted.length + 1,
      },
      objective: {
        forecast: annualTarget,
        in_value: ytdCurrent,
        growth_pct: ytdPrevious > 0 ? Math.round(((ytdCurrent - ytdPrevious) / ytdPrevious) * 100) : 0,
      },
      monthly_comparison: monthlyComparison,
      totals,
      summary,
      trends,
    }

    return { report, error: null }
  } catch (err) {
    console.error("[generateAgentReport]", err)
    return { report: null, error: (err as Error).message }
  }
}

export async function generateCommissionReport(
  filters: ReportFilters
): Promise<{ rows: any[]; error: string | null }> {
  try {
    const admin = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (admin as any).from("temp_financial_transactions")
      .select(`
        *,
        consultant:dev_users!temp_financial_transactions_consultant_id_fkey(id, commercial_name),
        property:dev_properties!temp_financial_transactions_property_id_fkey(id, title, external_ref, listing_price, property_type, city, business_type)
      `)
      .order("transaction_date", { ascending: false })

    if (filters.consultant_id) query = query.eq("consultant_id", filters.consultant_id)
    if (filters.date_from) query = query.gte("transaction_date", filters.date_from)
    if (filters.date_to) query = query.lte("transaction_date", filters.date_to)
    if (filters.status) query = query.eq("status", filters.status)
    if (filters.business_type) query = query.eq("transaction_type", filters.business_type === "venda" ? "commission_sale" : "commission_rent")

    const { data, error } = await query

    if (error) return { rows: [], error: error.message }
    return { rows: data ?? [], error: null }
  } catch (err) {
    console.error("[generateCommissionReport]", err)
    return { rows: [], error: (err as Error).message }
  }
}

export async function generateTimeToSaleReport(
  filters: ReportFilters
): Promise<{ rows: any[]; error: string | null }> {
  try {
    const admin = createAdminClient()

    let query = admin
      .from("dev_properties")
      .select(`
        id,
        title,
        external_ref,
        property_type,
        business_type,
        city,
        listing_price,
        status,
        created_at,
        updated_at,
        consultant_id,
        dev_users!dev_properties_consultant_id_fkey(commercial_name)
      `)
      .eq("status", "sold")

    if (filters.consultant_id) query = query.eq("consultant_id", filters.consultant_id)
    if (filters.date_from) query = query.gte("updated_at", filters.date_from)
    if (filters.date_to) query = query.lte("updated_at", filters.date_to)
    if (filters.property_type) query = query.eq("property_type", filters.property_type)
    if (filters.city) query = query.eq("city", filters.city)

    const { data, error } = await query

    if (error) return { rows: [], error: error.message }

    // Calculate time to sale
    const rows = (data ?? []).map((p) => {
      const created = new Date(p.created_at)
      const sold = new Date(p.updated_at)
      const daysToSale = Math.floor((sold.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))

      // Price tier
      const price = p.listing_price || 0
      let priceTier = "< 100k"
      if (price >= 500000) priceTier = "> 500k"
      else if (price >= 300000) priceTier = "300k - 500k"
      else if (price >= 200000) priceTier = "200k - 300k"
      else if (price >= 100000) priceTier = "100k - 200k"

      return {
        ...p,
        days_to_sale: daysToSale,
        price_tier: priceTier,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        consultant_name: (p as any).dev_users?.commercial_name || null,
      }
    })

    return { rows, error: null }
  } catch (err) {
    console.error("[generateTimeToSaleReport]", err)
    return { rows: [], error: (err as Error).message }
  }
}

export async function generateSharesReport(
  filters: ReportFilters
): Promise<{ rows: any[]; error: string | null }> {
  try {
    const admin = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (admin as any).from("temp_financial_transactions")
      .select(`
        *,
        consultant:dev_users!temp_financial_transactions_consultant_id_fkey(id, commercial_name),
        property:dev_properties!temp_financial_transactions_property_id_fkey(id, title, external_ref)
      `)
      .eq("is_shared_deal", true)
      .order("transaction_date", { ascending: false })

    if (filters.consultant_id) query = query.eq("consultant_id", filters.consultant_id)
    if (filters.date_from) query = query.gte("transaction_date", filters.date_from)
    if (filters.date_to) query = query.lte("transaction_date", filters.date_to)

    const { data, error } = await query

    if (error) return { rows: [], error: error.message }

    // Group summary by share_type
    const grouped: Record<string, { count: number; total_amount: number; rows: any[] }> = {}
    for (const tx of (data ?? [])) {
      const st = tx.share_type || "unknown"
      if (!grouped[st]) grouped[st] = { count: 0, total_amount: 0, rows: [] }
      grouped[st].count++
      grouped[st].total_amount += tx.agency_commission_amount || 0
      grouped[st].rows.push(tx)
    }

    const rows = Object.entries(grouped).map(([shareType, info]) => ({
      share_type: shareType,
      count: info.count,
      total_amount: info.total_amount,
      transactions: info.rows,
    }))

    return { rows, error: null }
  } catch (err) {
    console.error("[generateSharesReport]", err)
    return { rows: [], error: (err as Error).message }
  }
}

export async function generateCustomReport(
  config: CustomReportConfig
): Promise<{ rows: any[]; columns: string[]; error: string | null }> {
  try {
    const admin = createAdminClient()
    const { dimensions, metrics, filters, sort_by, sort_dir } = config

    // Determine the base table based on primary metric/dimension
    const needsTransactions = metrics.some((m) =>
      ["revenue", "transactions", "commission_agency", "commission_consultant"].includes(m)
    )
    const needsProperties = metrics.some((m) =>
      ["acquisitions", "volume", "time_to_sale", "productivity"].includes(m)
    ) || dimensions.some((d) => ["property_type", "city", "price_tier"].includes(d))

    const columns: string[] = [...dimensions, ...metrics]

    if (needsTransactions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (admin as any).from("temp_financial_transactions")
        .select(`
          *,
          consultant:dev_users!temp_financial_transactions_consultant_id_fkey(id, commercial_name),
          property:dev_properties!temp_financial_transactions_property_id_fkey(id, title, property_type, city, business_type, listing_price)
        `)
        .in("status", ["approved", "paid"])

      if (filters.consultant_id) query = query.eq("consultant_id", filters.consultant_id)
      if (filters.date_from) query = query.gte("transaction_date", filters.date_from)
      if (filters.date_to) query = query.lte("transaction_date", filters.date_to)
      if (filters.status) query = query.eq("status", filters.status)

      const { data, error } = await query
      if (error) return { rows: [], columns, error: error.message }

      // Group and aggregate
      const groups: Record<string, any> = {}

      for (const tx of (data ?? [])) {
        const keyParts: string[] = []

        for (const dim of dimensions) {
          let val = ""
          switch (dim) {
            case "consultant":
              val = tx.consultant?.commercial_name || "N/A"
              break
            case "month":
              val = tx.reporting_month || "N/A"
              break
            case "quarter": {
              const m = parseInt(tx.reporting_month?.split("-")[1] || "1", 10)
              val = `Q${Math.ceil(m / 3)}`
              break
            }
            case "year":
              val = tx.reporting_month?.split("-")[0] || "N/A"
              break
            case "property_type":
              val = tx.property?.property_type || "N/A"
              break
            case "business_type":
              val = tx.property?.business_type || tx.transaction_type || "N/A"
              break
            case "city":
              val = tx.property?.city || "N/A"
              break
            case "price_tier": {
              const price = tx.deal_value || tx.property?.listing_price || 0
              if (price >= 500000) val = "> 500k"
              else if (price >= 300000) val = "300k - 500k"
              else if (price >= 200000) val = "200k - 300k"
              else if (price >= 100000) val = "100k - 200k"
              else val = "< 100k"
              break
            }
          }
          keyParts.push(val)
        }

        const groupKey = keyParts.join("||")
        if (!groups[groupKey]) {
          const row: any = {}
          dimensions.forEach((dim, i) => { row[dim] = keyParts[i] })
          metrics.forEach((m) => { row[m] = 0 })
          groups[groupKey] = row
        }

        const row = groups[groupKey]
        for (const m of metrics) {
          switch (m) {
            case "revenue":
              row[m] += tx.agency_commission_amount || 0
              break
            case "transactions":
              row[m] += 1
              break
            case "commission_agency":
              row[m] += tx.agency_commission_amount || 0
              break
            case "commission_consultant":
              row[m] += tx.consultant_commission_amount || 0
              break
            case "volume":
              row[m] += tx.deal_value || 0
              break
          }
        }
      }

      let rows = Object.values(groups)

      // Sort
      if (sort_by && rows.length > 0) {
        const dir = sort_dir === "asc" ? 1 : -1
        rows.sort((a, b) => {
          const aVal = a[sort_by] ?? 0
          const bVal = b[sort_by] ?? 0
          return typeof aVal === "number" ? (aVal - bVal) * dir : String(aVal).localeCompare(String(bVal)) * dir
        })
      }

      return { rows, columns, error: null }
    }

    if (needsProperties) {
      let query = admin
        .from("dev_properties")
        .select(`
          id,
          title,
          property_type,
          business_type,
          city,
          listing_price,
          status,
          consultant_id,
          created_at,
          updated_at,
          dev_users!dev_properties_consultant_id_fkey(commercial_name)
        `)

      if (filters.consultant_id) query = query.eq("consultant_id", filters.consultant_id)
      if (filters.date_from) query = query.gte("created_at", filters.date_from)
      if (filters.date_to) query = query.lte("created_at", filters.date_to)
      if (filters.property_type) query = query.eq("property_type", filters.property_type)
      if (filters.city) query = query.eq("city", filters.city)

      const { data, error } = await query
      if (error) return { rows: [], columns, error: error.message }

      const groups: Record<string, any> = {}

      for (const prop of (data ?? [])) {
        const keyParts: string[] = []

        for (const dim of dimensions) {
          let val = ""
          switch (dim) {
            case "consultant":
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              val = (prop as any).dev_users?.commercial_name || "N/A"
              break
            case "month": {
              const d = new Date(prop.created_at)
              val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
              break
            }
            case "quarter": {
              const d = new Date(prop.created_at)
              val = `Q${Math.ceil((d.getMonth() + 1) / 3)}`
              break
            }
            case "year":
              val = new Date(prop.created_at).getFullYear().toString()
              break
            case "property_type":
              val = prop.property_type || "N/A"
              break
            case "business_type":
              val = prop.business_type || "N/A"
              break
            case "city":
              val = prop.city || "N/A"
              break
            case "price_tier": {
              const price = prop.listing_price || 0
              if (price >= 500000) val = "> 500k"
              else if (price >= 300000) val = "300k - 500k"
              else if (price >= 200000) val = "200k - 300k"
              else if (price >= 100000) val = "100k - 200k"
              else val = "< 100k"
              break
            }
          }
          keyParts.push(val)
        }

        const groupKey = keyParts.join("||")
        if (!groups[groupKey]) {
          const row: any = {}
          dimensions.forEach((dim, i) => { row[dim] = keyParts[i] })
          metrics.forEach((m) => { row[m] = 0 })
          groups[groupKey] = row
        }

        const row = groups[groupKey]
        for (const m of metrics) {
          switch (m) {
            case "acquisitions":
              row[m] += 1
              break
            case "volume":
              row[m] += prop.listing_price || 0
              break
            case "time_to_sale":
              if (prop.status === "sold") {
                const days = Math.floor(
                  (new Date(prop.updated_at).getTime() - new Date(prop.created_at).getTime()) /
                  (1000 * 60 * 60 * 24)
                )
                // Running average: store sum and count
                row[`_${m}_sum`] = (row[`_${m}_sum`] || 0) + days
                row[`_${m}_count`] = (row[`_${m}_count`] || 0) + 1
                row[m] = Math.round(row[`_${m}_sum`] / row[`_${m}_count`])
              }
              break
            case "productivity":
              // Will recalculate after
              row[m] += 1
              break
          }
        }
      }

      let rows = Object.values(groups)

      // Clean up internal fields
      for (const row of rows) {
        for (const key of Object.keys(row)) {
          if (key.startsWith("_")) delete row[key]
        }
      }

      // Sort
      if (sort_by && rows.length > 0) {
        const dir = sort_dir === "asc" ? 1 : -1
        rows.sort((a, b) => {
          const aVal = a[sort_by] ?? 0
          const bVal = b[sort_by] ?? 0
          return typeof aVal === "number" ? (aVal - bVal) * dir : String(aVal).localeCompare(String(bVal)) * dir
        })
      }

      return { rows, columns, error: null }
    }

    return { rows: [], columns, error: "Configuração de relatório inválida" }
  } catch (err) {
    console.error("[generateCustomReport]", err)
    return { rows: [], columns: [], error: (err as Error).message }
  }
}
