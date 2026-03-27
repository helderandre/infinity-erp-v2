import { createClient } from '@supabase/supabase-js'

// ─── Types ──────────────────────────────────────────────

type ActivityType =
  | 'call'
  | 'visit'
  | 'listing'
  | 'sale_close'
  | 'buyer_close'
  | 'lead_contact'
  | 'buyer_qualify'
  | 'follow_up'

type Origin = 'sellers' | 'buyers'
type Direction = 'inbound' | 'outbound'

interface LogGoalActivityParams {
  consultantId: string
  activityType: ActivityType
  origin: Origin
  createdBy: string
  direction?: Direction
  revenueAmount?: number
  referenceId?: string
  referenceType?: 'lead' | 'property' | 'negocio'
  notes?: string
  activityDate?: string // YYYY-MM-DD, defaults to today
}

// ─── Pipeline type → origin mapping ─────────────────────

const PIPELINE_TYPE_TO_ORIGIN: Record<string, Origin> = {
  vendedor: 'sellers',
  arrendador: 'sellers',
  comprador: 'buyers',
  arrendatario: 'buyers',
}

export function pipelineTypeToOrigin(pipelineType: string): Origin {
  return PIPELINE_TYPE_TO_ORIGIN[pipelineType] || 'sellers'
}

// ─── Main function ──────────────────────────────────────

/**
 * Log an activity to the goals tracking system.
 * Uses service-role client to bypass RLS.
 * Wrapped in try-catch internally — never throws.
 * Safe to call from any route without affecting the main operation.
 */
export async function logGoalActivity(params: LogGoalActivityParams): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) return

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const today = params.activityDate || new Date().toISOString().split('T')[0]

    await admin
      .from('temp_goal_activity_log')
      .insert({
        consultant_id: params.consultantId,
        activity_date: today,
        activity_type: params.activityType,
        origin: params.origin,
        origin_type: 'system',
        direction: params.direction || null,
        quantity: 1,
        revenue_amount: params.revenueAmount || null,
        reference_id: params.referenceId || null,
        reference_type: params.referenceType || null,
        notes: params.notes || null,
        created_by: params.createdBy,
      })
  } catch (err) {
    console.warn('[logGoalActivity] Failed:', err)
  }
}
