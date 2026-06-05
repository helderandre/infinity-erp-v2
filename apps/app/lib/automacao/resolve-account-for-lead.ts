import type { SupabaseClient } from "@supabase/supabase-js"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>

export interface ResolveAccountArgs {
  leadId: string
  agentId: string | null
  eventType: string
  /**
   * Quando presente limita a pesquisa a uma row scoped a um evento custom.
   * Null/undefined = busca scope fixo (custom_event_id IS NULL).
   */
  customEventId?: string | null
}

export interface ResolvedAccount {
  id: string
  source: "override" | "default" | "first_created"
}

async function getOverrideId(
  supabase: AnySupabase,
  leadId: string,
  eventType: string,
  column: "smtp_account_id" | "wpp_instance_id",
  customEventId?: string | null,
): Promise<string | null> {
  let query = supabase
    .from("contact_automation_lead_settings")
    .select(column)
    .eq("lead_id", leadId)
    .eq("event_type", eventType)
  query = customEventId
    ? query.eq("custom_event_id", customEventId)
    : query.is("custom_event_id", null)
  const { data } = await query.maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data as any)?.[column] as string | null) ?? null
}

export async function resolveSmtpAccountForLead(
  supabase: AnySupabase,
  args: ResolveAccountArgs,
): Promise<ResolvedAccount | null> {
  const { leadId, agentId, eventType, customEventId } = args
  if (!agentId) return null

  const overrideId = await getOverrideId(supabase, leadId, eventType, "smtp_account_id", customEventId)
  if (overrideId) {
    const { data } = await supabase
      .from("consultant_email_accounts")
      .select("id,is_active,consultant_id")
      .eq("id", overrideId)
      .maybeSingle()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const acc = data as any
    if (acc && acc.is_active === true && acc.consultant_id === agentId) {
      return { id: acc.id, source: "override" }
    }
    // fall back to first-created
  }

  // Prefer is_default=true, fallback to first-created
  const { data: defaultAcc } = await supabase
    .from("consultant_email_accounts")
    .select("id")
    .eq("consultant_id", agentId)
    .eq("is_active", true)
    .eq("is_default", true)
    .maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = defaultAcc as any
  if (d?.id) return { id: d.id, source: "default" }

  const { data: first } = await supabase
    .from("consultant_email_accounts")
    .select("id")
    .eq("consultant_id", agentId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const f = first as any
  if (f?.id) return { id: f.id, source: "first_created" }
  return null
}

export async function resolveWppInstanceForLead(
  supabase: AnySupabase,
  args: ResolveAccountArgs,
): Promise<ResolvedAccount | null> {
  const { leadId, agentId, eventType, customEventId } = args
  if (!agentId) return null

  const overrideId = await getOverrideId(supabase, leadId, eventType, "wpp_instance_id", customEventId)
  if (overrideId) {
    const { data } = await supabase
      .from("auto_wpp_instances")
      .select("id,user_id,connection_status")
      .eq("id", overrideId)
      .maybeSingle()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inst = data as any
    if (inst && inst.user_id === agentId && inst.connection_status === "connected") {
      return { id: inst.id, source: "override" }
    }
  }

  // Prefer is_default=true, fallback to first-created
  const { data: defaultInst } = await supabase
    .from("auto_wpp_instances")
    .select("id")
    .eq("user_id", agentId)
    .eq("connection_status", "connected")
    .eq("is_default", true)
    .maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = defaultInst as any
  if (d?.id) return { id: d.id, source: "default" }

  const { data: first } = await supabase
    .from("auto_wpp_instances")
    .select("id")
    .eq("user_id", agentId)
    .eq("connection_status", "connected")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const f = first as any
  if (f?.id) return { id: f.id, source: "first_created" }
  return null
}
