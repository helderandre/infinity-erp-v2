import type {
  ConsultantGoal,
  FinancialTargets,
  SellerFunnelTargets,
  BuyerFunnelTargets,
  GoalPeriod,
  GoalStatus,
} from '@/types/goal'

// ─── Financial Targets ──────────────────────────────────

export function calcFinancial(goal: ConsultantGoal): Record<GoalPeriod, FinancialTargets> {
  const { annual_revenue_target, pct_sellers, pct_buyers, working_weeks_year, working_days_week } = goal

  const annual: FinancialTargets = {
    total: annual_revenue_target,
    sellers: annual_revenue_target * (pct_sellers / 100),
    buyers: annual_revenue_target * (pct_buyers / 100),
  }

  const monthly: FinancialTargets = {
    total: annual.total / 12,
    sellers: annual.sellers / 12,
    buyers: annual.buyers / 12,
  }

  const weekly: FinancialTargets = {
    total: annual.total / working_weeks_year,
    sellers: annual.sellers / working_weeks_year,
    buyers: annual.buyers / working_weeks_year,
  }

  const daily: FinancialTargets = {
    total: weekly.total / working_days_week,
    sellers: weekly.sellers / working_days_week,
    buyers: weekly.buyers / working_days_week,
  }

  return { annual, monthly, weekly, daily }
}

// ─── Seller Funnel ──────────────────────────────────────

export function calcSellerFunnel(goal: ConsultantGoal): Record<GoalPeriod, SellerFunnelTargets> {
  const {
    annual_revenue_target, pct_sellers, working_weeks_year, working_days_week,
    sellers_avg_sale_value, sellers_avg_commission_pct,
    sellers_pct_listings_sold, sellers_pct_visit_to_listing,
    sellers_pct_lead_to_visit, sellers_avg_calls_per_lead,
  } = goal

  const revenue = annual_revenue_target * (pct_sellers / 100)

  // If funnel params are missing, return zeros
  if (!sellers_avg_sale_value || !sellers_avg_commission_pct) {
    const empty: SellerFunnelTargets = { revenue: 0, sales: 0, listings: 0, visits: 0, leads: 0, calls: 0 }
    return { annual: { ...empty, revenue }, monthly: { ...empty, revenue: revenue / 12 }, weekly: { ...empty, revenue: revenue / working_weeks_year }, daily: { ...empty, revenue: revenue / working_weeks_year / working_days_week } }
  }

  const commissionPerSale = sellers_avg_sale_value * (sellers_avg_commission_pct / 100)
  const sales = commissionPerSale > 0 ? revenue / commissionPerSale : 0
  const listings = sellers_pct_listings_sold && sellers_pct_listings_sold > 0
    ? sales / (sellers_pct_listings_sold / 100) : 0
  const visits = sellers_pct_visit_to_listing && sellers_pct_visit_to_listing > 0
    ? listings / (sellers_pct_visit_to_listing / 100) : 0
  const leads = sellers_pct_lead_to_visit && sellers_pct_lead_to_visit > 0
    ? visits / (sellers_pct_lead_to_visit / 100) : 0
  const calls = (sellers_avg_calls_per_lead || 0) * leads

  const annual: SellerFunnelTargets = { revenue, sales, listings, visits, leads, calls }

  return {
    annual,
    monthly: divide(annual, 12),
    weekly: divide(annual, working_weeks_year),
    daily: divide(annual, working_weeks_year * working_days_week),
  }
}

// ─── Buyer Funnel ───────────────────────────────────────

export function calcBuyerFunnel(goal: ConsultantGoal): Record<GoalPeriod, BuyerFunnelTargets> {
  const {
    annual_revenue_target, pct_buyers, working_weeks_year, working_days_week,
    buyers_avg_purchase_value, buyers_avg_commission_pct,
    buyers_close_rate, buyers_pct_lead_to_qualified, buyers_avg_calls_per_lead,
  } = goal

  const revenue = annual_revenue_target * (pct_buyers / 100)

  if (!buyers_avg_purchase_value || !buyers_avg_commission_pct) {
    const empty: BuyerFunnelTargets = { revenue: 0, closes: 0, qualified: 0, leads: 0, calls: 0 }
    return { annual: { ...empty, revenue }, monthly: { ...empty, revenue: revenue / 12 }, weekly: { ...empty, revenue: revenue / working_weeks_year }, daily: { ...empty, revenue: revenue / working_weeks_year / working_days_week } }
  }

  const commissionPerClose = buyers_avg_purchase_value * (buyers_avg_commission_pct / 100)
  const closes = commissionPerClose > 0 ? revenue / commissionPerClose : 0
  const qualified = buyers_close_rate && buyers_close_rate > 0
    ? closes / (buyers_close_rate / 100) : 0
  const leads = buyers_pct_lead_to_qualified && buyers_pct_lead_to_qualified > 0
    ? qualified / (buyers_pct_lead_to_qualified / 100) : 0
  const calls = (buyers_avg_calls_per_lead || 0) * leads

  const annual: BuyerFunnelTargets = { revenue, closes, qualified, leads, calls }

  return {
    annual,
    monthly: divideBuyer(annual, 12),
    weekly: divideBuyer(annual, working_weeks_year),
    daily: divideBuyer(annual, working_weeks_year * working_days_week),
  }
}

// ─── Reality Check ──────────────────────────────────────

export function calcRealityCheck(
  goal: ConsultantGoal,
  totalRealized: number,
): { total_realized: number; target_to_date: number; pct_achieved: number; projected_annual: number; gap: number; status: GoalStatus; message: string } {
  const now = new Date()
  const yearStart = new Date(goal.year, 0, 1)
  const yearEnd = new Date(goal.year, 11, 31)

  // Working days elapsed (approximate: weekdays only)
  let workingDaysPassed = 0
  const cursor = new Date(yearStart)
  while (cursor <= now && cursor <= yearEnd) {
    const dow = cursor.getDay()
    if (dow !== 0 && dow !== 6) workingDaysPassed++
    cursor.setDate(cursor.getDate() + 1)
  }

  const totalWorkingDays = goal.working_weeks_year * goal.working_days_week
  const targetToDate = totalWorkingDays > 0
    ? (goal.annual_revenue_target / totalWorkingDays) * workingDaysPassed
    : 0

  const pctAchieved = targetToDate > 0 ? (totalRealized / targetToDate) * 100 : 0
  const dailyRate = workingDaysPassed > 0 ? totalRealized / workingDaysPassed : 0
  const projectedAnnual = dailyRate * totalWorkingDays
  const gap = goal.annual_revenue_target - totalRealized

  let status: GoalStatus = 'green'
  if (pctAchieved < 75) status = 'red'
  else if (pctAchieved < 100) status = 'orange'

  const projectedFormatted = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(projectedAnnual)

  let message: string
  if (status === 'green') {
    message = `Parabéns! Se continuares neste ritmo, vais fechar ${projectedFormatted} este ano.`
  } else {
    const gapFormatted = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(gap)
    message = `Se continuares neste ritmo, vais fechar ${projectedFormatted} este ano. Estás ${gapFormatted} abaixo do objetivo.`
  }

  return { total_realized: totalRealized, target_to_date: targetToDate, pct_achieved: pctAchieved, projected_annual: projectedAnnual, gap, status, message }
}

// ─── Status helper ──────────────────────────────────────

export function getGoalStatus(realized: number, target: number): GoalStatus {
  if (target <= 0) return 'green'
  const pct = (realized / target) * 100
  if (pct >= 100) return 'green'
  if (pct >= 75) return 'orange'
  return 'red'
}

// ─── Helpers ────────────────────────────────────────────

function divide(annual: SellerFunnelTargets, divisor: number): SellerFunnelTargets {
  return {
    revenue: annual.revenue / divisor,
    sales: annual.sales / divisor,
    listings: annual.listings / divisor,
    visits: annual.visits / divisor,
    leads: annual.leads / divisor,
    calls: annual.calls / divisor,
  }
}

function divideBuyer(annual: BuyerFunnelTargets, divisor: number): BuyerFunnelTargets {
  return {
    revenue: annual.revenue / divisor,
    closes: annual.closes / divisor,
    qualified: annual.qualified / divisor,
    leads: annual.leads / divisor,
    calls: annual.calls / divisor,
  }
}
