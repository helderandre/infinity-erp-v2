import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/auth/permissions"
import { computeNextFixedOccurrence, type FixedEventType } from "@/lib/automacao/next-fixed-occurrence"

const FIXED_EVENTS: FixedEventType[] = ["aniversario_contacto", "natal", "ano_novo"]

type Channel = "email" | "whatsapp"
type State = "active" | "muted" | "skipped_no_channel"

interface ScheduledRow {
  source: "virtual" | "manual"
  lead_id: string
  lead_name: string | null
  agent_id: string | null
  agent_name: string | null
  event_type: string
  next_at: string | null
  channels_active: Channel[]
  channels_muted: Channel[]
  state: State
  manual_automation_id?: string
}

interface MuteRow {
  id: string
  consultant_id: string | null
  lead_id: string | null
  event_type: string | null
  channel: string | null
}

function canSeeAll(roles: string[]) {
  return roles.some((r) => ["admin", "Broker/CEO"].includes(r)) || roles.length > 1
}

/**
 * Null-as-wildcard predicate: does any mute row match this (lead, agent, event, channel)?
 */
function matchesMute(
  mutes: MuteRow[],
  leadId: string,
  agentId: string | null,
  eventType: string,
  channel: Channel,
): boolean {
  return mutes.some((m) => {
    if (m.consultant_id !== null && m.consultant_id !== agentId) return false
    if (m.lead_id !== null && m.lead_id !== leadId) return false
    if (m.event_type !== null && m.event_type !== eventType) return false
    if (m.channel !== null && m.channel !== channel) return false
    return true
  })
}

export async function GET(request: Request) {
  const auth = await requirePermission("leads")
  if (!auth.authorized) return auth.response

  const serverClient = await createClient()
  void serverClient
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const consultantFilter = searchParams.get("consultant_id")
  const eventFilter = searchParams.get("event_type")
  const stateFilter = searchParams.get("state")
  const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 500)
  const cursor = searchParams.get("cursor")

  const scopedAgentId = canSeeAll(auth.roles) ? (consultantFilter ?? null) : auth.user.id

  // 1) Fetch leads (paginated by id cursor)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let leadQuery: any = (supabase as any)
    .from("leads")
    .select(
      "id, nome, full_name, email, telemovel, data_nascimento, agent_id, consultor:dev_users!leads_agent_id_fkey(commercial_name)",
    )
    .not("agent_id", "is", null)
    .order("id", { ascending: true })
    .limit(limit)

  if (scopedAgentId) leadQuery = leadQuery.eq("agent_id", scopedAgentId)
  if (cursor) leadQuery = leadQuery.gt("id", cursor)

  const { data: leadsRaw, error: leadsErr } = await leadQuery
  if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leads = (leadsRaw as any[]) ?? []
  if (leads.length === 0) {
    return NextResponse.json({ rows: [], nextCursor: null, total: 0 })
  }

  const leadIds = leads.map((l) => l.id as string)
  const agentIds = Array.from(new Set(leads.map((l) => l.agent_id).filter(Boolean) as string[]))

  // 2) Batch — all manual automations for these leads in the 3 fixed events
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: manualRows } = await (supabase as any)
    .from("contact_automations")
    .select("id, contact_id, event_type, trigger_at, channels")
    .in("contact_id", leadIds)
    .in("event_type", FIXED_EVENTS)
    .eq("status", "scheduled")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const manualByKey = new Map<string, any>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const m of (manualRows as any[]) ?? []) {
    manualByKey.set(`${m.contact_id}|${m.event_type}`, m)
  }

  // 3) Batch — all lead settings (send_hour overrides)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: settingsRows } = await (supabase as any)
    .from("contact_automation_lead_settings")
    .select("lead_id, event_type, send_hour")
    .in("lead_id", leadIds)

  const settingsByKey = new Map<string, number | null>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of (settingsRows as any[]) ?? []) {
    settingsByKey.set(`${s.lead_id}|${s.event_type}`, s.send_hour ?? null)
  }

  // 4) Batch — all mutes that could affect any of these leads/agents
  const muteFilter: string[] = ["lead_id.is.null"]
  muteFilter.push(`lead_id.in.(${leadIds.join(",")})`)
  if (agentIds.length > 0) muteFilter.push(`consultant_id.in.(${agentIds.join(",")})`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: muteRows } = await (supabase as any)
    .from("contact_automation_mutes")
    .select("id, consultant_id, lead_id, event_type, channel")
    .or(muteFilter.join(","))

  const mutes: MuteRow[] = (muteRows as MuteRow[] | null) ?? []

  // 5) Batch — active SMTP accounts per agent + WhatsApp instances
  const smtpByAgent = new Map<string, boolean>()
  const wppByAgent = new Map<string, boolean>()
  if (agentIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: smtp } = await (supabase as any)
      .from("consultant_email_accounts")
      .select("consultant_id, is_active")
      .in("consultant_id", agentIds)
      .eq("is_active", true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of (smtp as any[]) ?? []) smtpByAgent.set(s.consultant_id, true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: wpp } = await (supabase as any)
      .from("auto_wpp_instances")
      .select("user_id, connection_status")
      .in("user_id", agentIds)
      .eq("connection_status", "connected")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const w of (wpp as any[]) ?? []) wppByAgent.set(w.user_id, true)
  }

  const now = new Date()
  const rows: ScheduledRow[] = []

  for (const lead of leads) {
    const agentId = (lead.agent_id as string | null) ?? null
    const hasSmtp = agentId ? smtpByAgent.has(agentId) : false
    const hasWpp = agentId ? wppByAgent.has(agentId) : false

    for (const eventType of FIXED_EVENTS) {
      if (eventFilter && eventType !== eventFilter) continue
      if (eventType === "aniversario_contacto" && !lead.data_nascimento) continue

      const manualRow = manualByKey.get(`${lead.id}|${eventType}`)
      if (manualRow) {
        const row: ScheduledRow = {
          source: "manual",
          lead_id: lead.id,
          lead_name: lead.nome || lead.full_name,
          agent_id: agentId,
          agent_name: lead.consultor?.commercial_name ?? null,
          event_type: eventType,
          next_at: manualRow.trigger_at,
          channels_active: (manualRow.channels ?? []) as Channel[],
          channels_muted: [],
          state: "active",
          manual_automation_id: manualRow.id,
        }
        if (stateFilter && stateFilter !== row.state) continue
        rows.push(row)
        continue
      }

      // Virtual — compute next_at
      const sendHour = settingsByKey.get(`${lead.id}|${eventType}`) ?? undefined
      const nextAt = computeNextFixedOccurrence({
        eventType,
        birthday: lead.data_nascimento,
        sendHour,
        now,
      })
      if (!nextAt) continue

      const activeChannels: Channel[] = []
      const mutedChannels: Channel[] = []

      if (lead.email) {
        if (matchesMute(mutes, lead.id, agentId, eventType, "email")) mutedChannels.push("email")
        else if (hasSmtp) activeChannels.push("email")
      }
      if (lead.telemovel) {
        if (matchesMute(mutes, lead.id, agentId, eventType, "whatsapp")) mutedChannels.push("whatsapp")
        else if (hasWpp) activeChannels.push("whatsapp")
      }

      let state: State = "active"
      if (activeChannels.length === 0 && mutedChannels.length > 0) state = "muted"
      else if (activeChannels.length === 0) state = "skipped_no_channel"

      if (stateFilter && stateFilter !== state) continue

      rows.push({
        source: "virtual",
        lead_id: lead.id,
        lead_name: lead.nome || lead.full_name,
        agent_id: agentId,
        agent_name: lead.consultor?.commercial_name ?? null,
        event_type: eventType,
        next_at: nextAt.toISOString(),
        channels_active: activeChannels,
        channels_muted: mutedChannels,
        state,
      })
    }
  }

  rows.sort((a, b) => {
    const av = a.next_at ? Date.parse(a.next_at) : Infinity
    const bv = b.next_at ? Date.parse(b.next_at) : Infinity
    return av - bv
  })

  const nextCursor = leads.length === limit ? leads[leads.length - 1].id : null

  return NextResponse.json({ rows, nextCursor, total: rows.length })
}
