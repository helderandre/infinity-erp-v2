// Types para M16 — Quadro de Objetivos Multi-Temporal

export interface ConsultantGoal {
  id: string
  consultant_id: string
  year: number
  // Base config
  annual_revenue_target: number
  pct_sellers: number
  pct_buyers: number
  working_weeks_year: number
  working_days_week: number
  // Seller funnel
  sellers_avg_sale_value: number | null
  sellers_avg_commission_pct: number | null
  sellers_pct_listings_sold: number | null
  sellers_pct_visit_to_listing: number | null
  sellers_pct_lead_to_visit: number | null
  sellers_avg_calls_per_lead: number | null
  // Buyer funnel
  buyers_avg_purchase_value: number | null
  buyers_avg_commission_pct: number | null
  buyers_close_rate: number | null
  buyers_pct_lead_to_qualified: number | null
  buyers_avg_calls_per_lead: number | null
  // Meta
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ConsultantGoalWithConsultant extends ConsultantGoal {
  consultant: {
    id: string
    commercial_name: string
    profile_photo_url?: string | null
  } | null
}

export interface GoalActivity {
  id: string
  consultant_id: string
  activity_date: string
  activity_type: GoalActivityType
  origin: GoalOrigin
  origin_type: 'system' | 'declared'
  direction: 'inbound' | 'outbound' | null
  quantity: number
  revenue_amount: number | null
  reference_id: string | null
  reference_type: 'lead' | 'property' | 'negocio' | null
  notes: string | null
  created_at: string
  created_by: string | null
}

export type GoalActivityType =
  | 'call'
  | 'visit'
  | 'listing'
  | 'sale_close'
  | 'buyer_close'
  | 'lead_contact'
  | 'buyer_qualify'
  | 'follow_up'

export type GoalOrigin = 'sellers' | 'buyers'
export type GoalPeriod = 'annual' | 'monthly' | 'weekly' | 'daily'
export type GoalStatus = 'green' | 'orange' | 'red'

export interface FinancialTargets {
  total: number
  sellers: number
  buyers: number
}

export interface SellerFunnelTargets {
  revenue: number
  sales: number
  listings: number
  visits: number
  leads: number
  calls: number
}

export interface BuyerFunnelTargets {
  revenue: number
  closes: number
  qualified: number
  leads: number
  calls: number
}

export interface RealityCheck {
  total_realized: number
  target_to_date: number
  pct_achieved: number
  projected_annual: number
  gap: number
  status: GoalStatus
  message: string
}

export interface DailyActions {
  leads_to_contact: number
  calls_minimum: number
  visits_to_schedule: number
  follow_ups: number
  status: Record<string, GoalStatus>
}

export interface GoalDashboard {
  goal: ConsultantGoalWithConsultant
  financial: Record<GoalPeriod, FinancialTargets>
  funnel_sellers: Record<GoalPeriod, SellerFunnelTargets>
  funnel_buyers: Record<GoalPeriod, BuyerFunnelTargets>
  reality_check: RealityCheck
  today: DailyActions
}

export interface GoalCompareRow {
  consultant_id: string
  commercial_name: string
  profile_photo_url: string | null
  target: number
  realized: number
  pct: number
  leads: { done: number; target: number }
  calls: { done: number; target: number }
  visits: { done: number; target: number }
  status: GoalStatus
}

// ─── Weekly Reports ──────────────────────────────────────

export type WeeklyReportStatus = 'draft' | 'submitted' | 'reviewed'

export interface WeeklyReport {
  id: string
  consultant_id: string
  goal_id: string | null
  week_start: string // YYYY-MM-DD (Monday)
  status: WeeklyReportStatus
  notes_wins: string | null
  notes_challenges: string | null
  notes_next_week: string | null
  submitted_at: string | null
  manager_feedback: string | null
  manager_reviewed_at: string | null
  manager_reviewed_by: string | null
  ai_summary: string | null
  ai_advice: string | null
  created_at: string
  updated_at: string
}

export interface WeeklyReportWithConsultant extends WeeklyReport {
  consultant: {
    id: string
    commercial_name: string
    profile_photo_url?: string | null
  } | null
}

export interface WeeklyReportWithActivities extends WeeklyReportWithConsultant {
  activities: {
    total: number
    system: number
    declared: number
    by_type: Record<GoalActivityType, { done: number; target: number }>
  }
  trust_ratio: number
}

export interface TeamWeekOverview {
  week_start: string
  week_end: string
  reports: WeeklyReportWithActivities[]
  team_summary?: string | null // AI-generated team briefing
}

export interface AIAdvice {
  weekly_tips: string[]     // 2-3 specific actionable tips
  strengths: string[]       // What they're doing well
  focus_areas: string[]     // Where to improve
  manager_talking_points?: string[] // For 1:1 prep
}
