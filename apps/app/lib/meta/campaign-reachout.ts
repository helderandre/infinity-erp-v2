/**
 * Reach-out performance for a single Meta campaign: how fast its CRM leads got
 * called, which are still waiting, and how many turned into won deals.
 *
 * Linkage (verified against live data): the CRM contact is written back onto
 * meta.meta_leads_raw.lead_id when a lead is bridged (processed=true). The
 * leads_entries rows are NOT stamped with the Meta campaign, so we go
 *   meta.meta_leads_raw (campaign_id, processed, lead_id)
 *     → public.leads (id)
 *       → public.leads_entries (contact_id)   -- SLA / first_contact timing
 *       → public.negocios (lead_id)           -- deal conversion
 */

import type { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { timestampBounds, type MetaDateRange } from './date-range'

type AdminClient = ReturnType<typeof createCrmAdminClient>

const SCAN_LIMIT = 5000

export interface ReachOutLead {
  lead_id: string
  nome: string | null
  email: string | null
  phone: string | null
  agent_id: string | null
  agent_name: string | null
  arrived_at: string | null
  first_contact_at: string | null
  /** contacted → hours from arrival to first contact */
  hours_to_contact: number | null
  /** still waiting → hours from arrival to now */
  waiting_hours: number | null
  sla_status: string | null
  entry_status: string | null
  deal_stage: 'won' | 'lost' | 'open' | null
  deal_value: number | null
}

export interface ReachOutStats {
  leads: number
  contacted: number
  waiting: number
  breached: number
  qualified: number
  won: number
  wonValue: number
  avgHoursToContact: number | null
  medianHoursToContact: number | null
}

export interface CampaignReachOut {
  stats: ReachOutStats
  leads: ReachOutLead[]
}

function hoursBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000
}

function dealValue(n: {
  preco_venda: number | null
  expected_value: number | null
  orcamento: number | null
}): number | null {
  return (
    (n.preco_venda != null ? Number(n.preco_venda) : null) ??
    (n.expected_value != null ? Number(n.expected_value) : null) ??
    (n.orcamento != null ? Number(n.orcamento) : null)
  )
}

export async function getCampaignReachOut(
  supabase: AdminClient,
  campaignId: string,
  range?: MetaDateRange,
): Promise<CampaignReachOut> {
  const bounds = timestampBounds(range ?? {})

  // 1. Campaign's CRM-bridged leads (processed raw rows carry the contact id).
  let rawQ = supabase
    .schema('meta')
    .from('meta_leads_raw')
    .select('lead_id, fb_created_time')
    .eq('campaign_id', campaignId)
    .eq('processed', true)
    .not('lead_id', 'is', null)
  if (bounds.gte) rawQ = rawQ.gte('fb_created_time', bounds.gte)
  if (bounds.lte) rawQ = rawQ.lte('fb_created_time', bounds.lte)
  const { data: rawRows } = await rawQ.limit(SCAN_LIMIT)

  const leadIds = Array.from(
    new Set(((rawRows ?? []) as { lead_id: string | null }[]).map((r) => r.lead_id).filter(Boolean) as string[]),
  )
  if (leadIds.length === 0) {
    return {
      stats: { leads: 0, contacted: 0, waiting: 0, breached: 0, qualified: 0, won: 0, wonValue: 0, avgHoursToContact: null, medianHoursToContact: null },
      leads: [],
    }
  }

  // 2. Contacts, their entries (timing), their deals — in parallel.
  const [leadsRes, entriesRes, dealsRes] = await Promise.all([
    supabase.from('leads').select('id, nome, email, telemovel, agent_id, created_at').in('id', leadIds),
    supabase
      .from('leads_entries')
      .select('contact_id, created_at, first_contact_at, sla_status, status')
      .in('contact_id', leadIds)
      .limit(SCAN_LIMIT),
    supabase
      .from('negocios')
      .select('lead_id, won_date, lost_date, expected_value, preco_venda, orcamento')
      .in('lead_id', leadIds)
      .limit(SCAN_LIMIT),
  ])

  const leadRows = (leadsRes.data ?? []) as Array<{
    id: string; nome: string | null; email: string | null; telemovel: string | null; agent_id: string | null; created_at: string | null
  }>

  // Earliest entry per contact = arrival (SLA clock start). Keep its timing.
  const entryByLead = new Map<string, { created_at: string | null; first_contact_at: string | null; sla_status: string | null; status: string | null }>()
  for (const e of (entriesRes.data ?? []) as Array<{ contact_id: string | null; created_at: string | null; first_contact_at: string | null; sla_status: string | null; status: string | null }>) {
    if (!e.contact_id) continue
    const prev = entryByLead.get(e.contact_id)
    if (!prev || (e.created_at && prev.created_at && e.created_at < prev.created_at)) {
      entryByLead.set(e.contact_id, { created_at: e.created_at, first_contact_at: e.first_contact_at, sla_status: e.sla_status, status: e.status })
    }
  }

  // Best deal per contact: won > open > lost (so a lead's headline reflects success).
  const dealByLead = new Map<string, { stage: 'won' | 'lost' | 'open'; value: number | null }>()
  for (const n of (dealsRes.data ?? []) as Array<{ lead_id: string | null; won_date: string | null; lost_date: string | null; expected_value: number | null; preco_venda: number | null; orcamento: number | null }>) {
    if (!n.lead_id) continue
    const stage: 'won' | 'lost' | 'open' = n.won_date ? 'won' : n.lost_date ? 'lost' : 'open'
    const rank = { won: 3, open: 2, lost: 1 } as const
    const prev = dealByLead.get(n.lead_id)
    if (!prev || rank[stage] > rank[prev.stage]) {
      dealByLead.set(n.lead_id, { stage, value: dealValue(n) })
    }
  }

  // Agent names.
  const agentIds = Array.from(new Set(leadRows.map((l) => l.agent_id).filter(Boolean) as string[]))
  const agentNameById = new Map<string, string | null>()
  if (agentIds.length) {
    const { data: users } = await supabase.from('dev_users').select('id, commercial_name').in('id', agentIds)
    for (const u of (users ?? []) as Array<{ id: string; commercial_name: string | null }>) {
      agentNameById.set(u.id, u.commercial_name)
    }
  }

  const now = new Date().toISOString()
  const leads: ReachOutLead[] = leadRows.map((l) => {
    const entry = entryByLead.get(l.id)
    const arrived = entry?.created_at ?? l.created_at ?? null
    const firstContact = entry?.first_contact_at ?? null
    const deal = dealByLead.get(l.id) ?? null
    const hours_to_contact = arrived && firstContact ? Math.max(0, hoursBetween(arrived, firstContact)) : null
    const waiting_hours = arrived && !firstContact ? Math.max(0, hoursBetween(arrived, now)) : null
    return {
      lead_id: l.id,
      nome: l.nome,
      email: l.email,
      phone: l.telemovel,
      agent_id: l.agent_id,
      agent_name: l.agent_id ? (agentNameById.get(l.agent_id) ?? null) : null,
      arrived_at: arrived,
      first_contact_at: firstContact,
      hours_to_contact,
      waiting_hours,
      sla_status: entry?.sla_status ?? null,
      entry_status: entry?.status ?? null,
      deal_stage: deal?.stage ?? null,
      deal_value: deal?.value ?? null,
    }
  })

  // Aggregate.
  const contactedDurations = leads.map((l) => l.hours_to_contact).filter((h): h is number => h !== null)
  const sorted = [...contactedDurations].sort((a, b) => a - b)
  const median = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null
  const avg = contactedDurations.length ? contactedDurations.reduce((a, b) => a + b, 0) / contactedDurations.length : null

  const stats: ReachOutStats = {
    leads: leads.length,
    contacted: leads.filter((l) => l.first_contact_at).length,
    waiting: leads.filter((l) => !l.first_contact_at).length,
    breached: leads.filter((l) => !l.first_contact_at && l.sla_status === 'breached').length,
    qualified: leads.filter((l) => l.deal_stage !== null || l.entry_status === 'qualified' || l.entry_status === 'converted').length,
    won: leads.filter((l) => l.deal_stage === 'won').length,
    wonValue: leads.filter((l) => l.deal_stage === 'won').reduce((s, l) => s + (l.deal_value ?? 0), 0),
    avgHoursToContact: avg,
    medianHoursToContact: median,
  }

  // Waiting longest first, then contacted by recency.
  leads.sort((a, b) => (b.waiting_hours ?? -1) - (a.waiting_hours ?? -1))

  return { stats, leads }
}
