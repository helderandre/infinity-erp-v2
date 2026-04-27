/**
 * Lead Assignment Engine
 *
 * Evaluates routing rules to determine which agent should receive a new lead entry.
 * Rules are evaluated by priority (highest first). If a rule matches and the target
 * agent isn't overloaded, the entry is assigned. Otherwise, falls through to the next rule.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = import('@supabase/supabase-js').SupabaseClient<any, any, any>
import type { LeadsAssignmentRule, LeadsEntry, LeadsCampaign } from '@/types/leads-crm'

interface AssignmentResult {
  agent_id: string | null
  rule_id: string | null
  method: 'direct' | 'round_robin' | 'gestora_pool'
  // Pulled from the matched rule so the caller (ingestLead) can stamp
  // both columns on the leads_entries row. external_ref is canonical;
  // property_id is the denormalized FK. Both null when no rule won.
  property_external_ref: string | null
  property_id: string | null
}

interface AssignmentContext {
  entry: Pick<LeadsEntry, 'source' | 'campaign_id' | 'sector'>
  campaign?: Pick<LeadsCampaign, 'id' | 'sector'> | null
  contact_city?: string | null
  // Meta ad attribution — extracted from form_data by the caller.
  meta_ad_id?: string | null
  meta_adset_id?: string | null
}

/**
 * Evaluate assignment rules and return the best agent for a new lead entry.
 */
export async function assignLeadEntry(
  supabase: SupabaseClient,
  context: AssignmentContext
): Promise<AssignmentResult> {
  // 1. Fetch active rules ordered by priority DESC
  const { data: rules, error } = await supabase
    .from('leads_assignment_rules')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: false })

  if (error || !rules?.length) {
    return { agent_id: null, rule_id: null, method: 'gestora_pool', property_external_ref: null, property_id: null }
  }

  // 2. Evaluate each rule in priority order
  for (const rule of rules as LeadsAssignmentRule[]) {
    if (!matchesRule(rule, context)) continue

    const ruleProperty = pickRuleProperty(rule)

    // Rule matches — try to assign
    if (rule.consultant_id) {
      // Direct assignment — check overflow
      const overloaded = await isAgentOverloaded(supabase, rule.consultant_id, rule.overflow_threshold)
      if (!overloaded) {
        return { agent_id: rule.consultant_id, rule_id: rule.id, method: 'direct', ...ruleProperty }
      }
      // Agent overloaded — apply fallback
      if (rule.fallback_action === 'skip') continue
      if (rule.fallback_action === 'gestora_pool') {
        // Pool fallback still surfaces the property — the entry should
        // remember which imóvel originou o pedido even sem dono atribuído.
        return { agent_id: null, rule_id: rule.id, method: 'gestora_pool', ...ruleProperty }
      }
      // round_robin fallback — but no team defined, skip
      continue
    }

    if (rule.team_consultant_ids?.length) {
      // Round-robin within team
      const agent = await pickRoundRobin(supabase, rule)
      if (agent) {
        return { agent_id: agent, rule_id: rule.id, method: 'round_robin', ...ruleProperty }
      }
      // All team members overloaded
      if (rule.fallback_action === 'gestora_pool') {
        return { agent_id: null, rule_id: rule.id, method: 'gestora_pool', ...ruleProperty }
      }
      continue
    }

    // Rule has no assignment target — skip
    continue
  }

  // No rule matched — gestora pool
  return { agent_id: null, rule_id: null, method: 'gestora_pool', property_external_ref: null, property_id: null }
}

/**
 * Extract property linkage from a matched rule. Both columns surfaced; the
 * caller can write whichever it needs (the entry row carries both).
 */
function pickRuleProperty(rule: LeadsAssignmentRule): { property_external_ref: string | null; property_id: string | null } {
  return {
    property_external_ref: rule.property_external_ref ?? null,
    property_id: rule.property_id ?? null,
  }
}

/**
 * Check if a rule's criteria match the incoming entry context.
 */
function matchesRule(rule: LeadsAssignmentRule, context: AssignmentContext): boolean {
  // Source match
  if (rule.source_match?.length && !rule.source_match.includes(context.entry.source)) {
    return false
  }

  // Campaign match
  if (rule.campaign_id_match && rule.campaign_id_match !== context.entry.campaign_id) {
    return false
  }

  // Meta ad match (most specific). When the rule pins a Meta ad_id, it only
  // matches inbound leads carrying the same ad_id. Specificity is enforced
  // via `priority` (manual convention: ad-level > adset-level > campaign).
  if (rule.ad_id_match && rule.ad_id_match !== context.meta_ad_id) {
    return false
  }

  // Meta adset match
  if (rule.adset_id_match && rule.adset_id_match !== context.meta_adset_id) {
    return false
  }

  // Sector match
  const sector = context.entry.sector || context.campaign?.sector
  if (rule.sector_match?.length && sector && !rule.sector_match.includes(sector)) {
    return false
  }

  // Zone match (city from contact)
  if (rule.zone_match?.length && context.contact_city) {
    const normalizedCity = context.contact_city.toLowerCase().trim()
    const matches = rule.zone_match.some(z => normalizedCity.includes(z.toLowerCase().trim()))
    if (!matches) return false
  }

  // Pipeline type match — only relevant if we know the sector/pipeline
  // This is optional and mainly used for sector-based routing
  if (rule.pipeline_type_match?.length) {
    const pipelineType = sectorToPipelineType(sector)
    if (pipelineType && !rule.pipeline_type_match.includes(pipelineType)) {
      return false
    }
  }

  return true
}

/**
 * Check if an agent has too many uncontacted leads.
 */
async function isAgentOverloaded(
  supabase: SupabaseClient,
  agentId: string,
  threshold: number | null
): Promise<boolean> {
  if (!threshold) return false

  // Use the cached counter on dev_users for performance
  const { data } = await supabase
    .from('dev_users')
    .select('active_lead_count')
    .eq('id', agentId)
    .single()

  return (data?.active_lead_count ?? 0) >= threshold
}

/**
 * Pick next agent via round-robin, skipping overloaded ones.
 * Updates the rule's round_robin_index.
 */
async function pickRoundRobin(
  supabase: SupabaseClient,
  rule: LeadsAssignmentRule
): Promise<string | null> {
  const team = rule.team_consultant_ids
  if (!team?.length) return null

  let currentIndex = rule.round_robin_index || 0

  // Try each team member starting from current index
  for (let i = 0; i < team.length; i++) {
    const candidateIndex = (currentIndex + i) % team.length
    const candidateId = team[candidateIndex]

    const overloaded = await isAgentOverloaded(supabase, candidateId, rule.overflow_threshold)
    if (!overloaded) {
      // Found available agent — update index for next time
      const nextIndex = (candidateIndex + 1) % team.length
      await supabase
        .from('leads_assignment_rules')
        .update({ round_robin_index: nextIndex })
        .eq('id', rule.id)

      return candidateId
    }
  }

  // All team members overloaded
  return null
}

/**
 * Map sector to pipeline type (best guess for routing).
 */
function sectorToPipelineType(sector: string | null | undefined): string | null {
  switch (sector) {
    case 'real_estate_buy': return 'comprador'
    case 'real_estate_sell': return 'vendedor'
    case 'real_estate_rent': return 'arrendatario'
    default: return null
  }
}
