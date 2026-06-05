/**
 * SLA Engine
 *
 * Determines the SLA deadline for a new lead entry based on configured SLA rules.
 * Also provides the check function used by the cron job to update SLA statuses
 * and create escalation notifications.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = import('@supabase/supabase-js').SupabaseClient<any, any, any>
import type { LeadsSlaConfig } from '@/types/leads-crm'

// ============================================================================
// SLA Deadline Calculation
// ============================================================================

/**
 * Calculate the SLA deadline for a new entry based on matching SLA config.
 */
export async function calculateSlaDeadline(
  supabase: SupabaseClient,
  entry: { source: string; sector?: string | null; priority?: string }
): Promise<{ deadline: Date; config_id: string } | null> {
  const { data: configs } = await supabase
    .from('leads_sla_configs')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: false })

  if (!configs?.length) return null

  for (const config of configs as LeadsSlaConfig[]) {
    if (!matchesSlaConfig(config, entry)) continue

    const deadline = new Date()
    deadline.setMinutes(deadline.getMinutes() + config.sla_minutes)

    return { deadline, config_id: config.id }
  }

  return null
}

function matchesSlaConfig(
  config: LeadsSlaConfig,
  entry: { source: string; sector?: string | null; priority?: string }
): boolean {
  if (config.source_match?.length && !config.source_match.includes(entry.source)) {
    return false
  }
  if (config.sector_match?.length && entry.sector && !config.sector_match.includes(entry.sector)) {
    return false
  }
  if (config.priority_match?.length && entry.priority && !config.priority_match.includes(entry.priority)) {
    return false
  }
  return true
}

// ============================================================================
// SLA Status Check (for cron job)
// ============================================================================

interface SlaCheckResult {
  entries_checked: number
  warnings_created: number
  breaches_created: number
  escalations_created: number
}

/**
 * Check all active entries for SLA violations.
 * Called by the cron job every 5 minutes.
 */
export async function checkSlaStatuses(supabase: SupabaseClient): Promise<SlaCheckResult> {
  const result: SlaCheckResult = {
    entries_checked: 0,
    warnings_created: 0,
    breaches_created: 0,
    escalations_created: 0,
  }

  // Fetch entries with active SLA tracking
  const { data: entries } = await supabase
    .from('leads_entries')
    .select('id, assigned_agent_id, contact_id, sla_deadline, sla_status, first_contact_at, source, sector, priority, created_at')
    .in('sla_status', ['pending', 'on_time', 'warning'])
    .not('sla_deadline', 'is', null)

  if (!entries?.length) return result

  // Fetch SLA configs for threshold calculations
  const { data: configs } = await supabase
    .from('leads_sla_configs')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: false })

  const now = new Date()

  for (const entry of entries) {
    result.entries_checked++

    // If already contacted, mark SLA as completed
    if (entry.first_contact_at) {
      await supabase
        .from('leads_entries')
        .update({ sla_status: 'completed' })
        .eq('id', entry.id)
      continue
    }

    const deadline = new Date(entry.sla_deadline)
    const created = new Date(entry.created_at)
    const totalMs = deadline.getTime() - created.getTime()
    const elapsedMs = now.getTime() - created.getTime()
    const pctElapsed = totalMs > 0 ? (elapsedMs / totalMs) * 100 : 100

    // Find matching SLA config for thresholds
    const config = findMatchingConfig(configs as LeadsSlaConfig[], entry)
    const warningPct = config?.warning_pct ?? 50
    const criticalPct = config?.critical_pct ?? 100
    const escalatePct = config?.escalate_pct ?? 150

    let newStatus = entry.sla_status

    if (pctElapsed >= escalatePct) {
      newStatus = 'breached'
      if (entry.sla_status !== 'breached') {
        result.escalations_created++
        await createEscalationNotification(supabase, entry, 'sla_escalation')
      }
    } else if (pctElapsed >= criticalPct) {
      newStatus = 'breached'
      if (entry.sla_status !== 'breached') {
        result.breaches_created++
        await createEscalationNotification(supabase, entry, 'sla_breach')
      }
    } else if (pctElapsed >= warningPct) {
      newStatus = 'warning'
      if (entry.sla_status === 'pending' || entry.sla_status === 'on_time') {
        result.warnings_created++
        await createEscalationNotification(supabase, entry, 'sla_warning')
      }
    } else {
      newStatus = 'on_time'
    }

    if (newStatus !== entry.sla_status) {
      await supabase
        .from('leads_entries')
        .update({ sla_status: newStatus })
        .eq('id', entry.id)
    }
  }

  return result
}

function findMatchingConfig(
  configs: LeadsSlaConfig[],
  entry: { source: string; sector?: string | null; priority?: string }
): LeadsSlaConfig | null {
  for (const config of configs) {
    if (matchesSlaConfig(config, entry)) return config
  }
  return null
}

// ============================================================================
// Notification Helpers
// ============================================================================

async function createEscalationNotification(
  supabase: SupabaseClient,
  entry: { id: string; assigned_agent_id: string | null; contact_id: string },
  type: 'sla_warning' | 'sla_breach' | 'sla_escalation'
) {
  const titles: Record<string, string> = {
    sla_warning: 'Lead por contactar — SLA a 50%',
    sla_breach: 'SLA ultrapassado — lead não contactada',
    sla_escalation: 'Escalonamento — lead reatribuída',
  }

  const notifications: Array<{
    recipient_id: string
    type: string
    title: string
    body: string
    link: string
    entry_id: string
    contact_id: string
  }> = []

  // Notify the assigned agent (for warning and breach)
  if (entry.assigned_agent_id && type !== 'sla_escalation') {
    notifications.push({
      recipient_id: entry.assigned_agent_id,
      type,
      title: titles[type],
      body: type === 'sla_warning'
        ? 'Tem uma lead que ainda não foi contactada. O tempo de SLA está a expirar.'
        : 'O SLA desta lead foi ultrapassado. Contacte o mais rapidamente possível.',
      link: `/dashboard/crm/contactos/${entry.contact_id}`,
      entry_id: entry.id,
      contact_id: entry.contact_id,
    })
  }

  // For breach and escalation, also notify gestoras (users with role that has pipeline permission)
  if (type === 'sla_breach' || type === 'sla_escalation') {
    const { data: gestoras } = await supabase
      .from('dev_users')
      .select('id, role_id, roles!inner(permissions)')
      .eq('is_active', true)

    if (gestoras) {
      for (const g of gestoras) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const roles = (g as any).roles
        const permissions = roles?.permissions as Record<string, boolean> | undefined
        if (permissions?.pipeline) {
          notifications.push({
            recipient_id: g.id,
            type,
            title: type === 'sla_escalation'
              ? 'Lead escalonada — necessita reatribuição'
              : 'SLA ultrapassado por um consultor',
            body: 'Uma lead ultrapassou o SLA e requer atenção.',
            link: `/dashboard/crm/contactos/${entry.contact_id}`,
            entry_id: entry.id,
            contact_id: entry.contact_id,
          })
        }
      }
    }
  }

  if (notifications.length) {
    await supabase.from('leads_notifications').insert(notifications)

    // Send email + push notifications (fire-and-forget, don't block SLA check)
    sendSlaEmails(supabase, notifications, entry).catch(err =>
      console.warn('[SLA Email] Failed:', err)
    )
    sendSlaPush(supabase, notifications, entry).catch(err =>
      console.warn('[SLA Push] Failed:', err)
    )
  }
}

/**
 * Send email notifications for SLA events.
 * Fetches agent email + contact info, then sends via the email service.
 */
async function sendSlaEmails(
  supabase: SupabaseClient,
  notifications: Array<{ recipient_id: string; type: string; body: string; link: string }>,
  entry: { contact_id: string }
) {
  // Lazy import to avoid circular deps
  const { sendNotificationEmail } = await import('./send-notification-email')

  // Fetch contact info for the email body
  const { data: contact } = await supabase
    .from('leads')
    .select('nome, telemovel, email')
    .eq('id', entry.contact_id)
    .single()

  for (const notif of notifications) {
    // Fetch agent email
    const { data: agent } = await supabase
      .from('dev_users')
      .select('professional_email, commercial_name')
      .eq('id', notif.recipient_id)
      .single()

    if (!agent?.professional_email) continue

    await sendNotificationEmail({
      recipientEmail: agent.professional_email,
      recipientName: agent.commercial_name ?? 'Consultor',
      type: notif.type as 'sla_warning' | 'sla_breach' | 'sla_escalation',
      title: notif.type,
      body: notif.body,
      link: notif.link,
      contactName: contact?.nome,
      contactPhone: contact?.telemovel,
    })

    // Mark email as sent
    await supabase
      .from('leads_notifications')
      .update({ is_email_sent: true })
      .eq('recipient_id', notif.recipient_id)
      .eq('entry_id', entry.contact_id)
      .eq('type', notif.type)
      .eq('is_email_sent', false)
  }
}

async function sendSlaPush(
  supabase: SupabaseClient,
  notifications: Array<{ recipient_id: string; type: string; title: string; body: string; link: string }>,
  entry: { id: string; contact_id: string }
) {
  const { sendPushToUser } = await import('./send-push')

  for (const notif of notifications) {
    await sendPushToUser(supabase, notif.recipient_id, {
      title: notif.title,
      body: notif.body,
      url: notif.link,
      tag: `sla-${entry.id}`,
    })

    await supabase
      .from('leads_notifications')
      .update({ is_push_sent: true })
      .eq('recipient_id', notif.recipient_id)
      .eq('entry_id', entry.contact_id)
      .eq('type', notif.type)
      .eq('is_push_sent', false)
  }
}
