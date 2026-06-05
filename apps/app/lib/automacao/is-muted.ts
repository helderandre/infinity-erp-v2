import type { SupabaseClient } from "@supabase/supabase-js"
import type { ContactAutomationChannel, ContactAutomationEventType } from "@/types/contact-automation"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>

export interface IsMutedArgs {
  leadId: string
  agentId: string | null
  eventType: ContactAutomationEventType
  channel: ContactAutomationChannel
}

/**
 * Null-as-wildcard predicate against contact_automation_mutes.
 * A (lead, agent, event, channel) triple is muted when any row has every
 * non-null discriminator matching (and null columns always match).
 */
export async function isMuted(supabase: AnySupabase, args: IsMutedArgs): Promise<boolean> {
  const { leadId, agentId, eventType, channel } = args

  const filters = [
    `consultant_id.is.null${agentId ? `,consultant_id.eq.${agentId}` : ""}`,
    `lead_id.is.null,lead_id.eq.${leadId}`,
    `event_type.is.null,event_type.eq.${eventType}`,
    `channel.is.null,channel.eq.${channel}`,
  ]

  let query = supabase.from("contact_automation_mutes").select("id", { head: true, count: "exact" })
  for (const f of filters) query = query.or(f)

  const { count, error } = await query
  if (error) {
    console.error("[isMuted] query error:", error)
    return false
  }
  return (count ?? 0) > 0
}
