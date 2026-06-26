/**
 * Lead Ingestion Pipeline
 *
 * Central function for processing incoming leads from any source.
 * Handles: dedup contact → create entry → assign agent → set SLA → notify.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = import('@supabase/supabase-js').SupabaseClient<any, any, any>
import { assignLeadEntry, findMatchingRule } from './assignment-engine'
import { calculateSlaDeadline } from './sla-engine'
import type { EntrySource, LeadSector, EntryPriority } from '@/types/leads-crm'

export interface IngestLeadInput {
  // Contact data
  name: string
  email?: string | null
  phone?: string | null
  // Source tracking
  source: EntrySource
  campaign_id?: string | null
  partner_id?: string | null
  sector?: LeadSector | null
  priority?: EntryPriority
  // UTM
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  utm_content?: string | null
  utm_term?: string | null
  // Raw form data
  form_data?: Record<string, unknown> | null
  form_url?: string | null
  notes?: string | null
  // Optional override
  assigned_agent_id?: string | null
}

export interface IngestLeadResult {
  contact_id: string
  entry_id: string
  is_reactivation: boolean
  assigned_agent_id: string | null
  assignment_method: 'direct' | 'round_robin' | 'gestora_pool' | 'manual'
  sla_deadline: string | null
}

export interface IngestLeadOptions {
  /**
   * When true, abort (return null) if no active assignment rule matches the
   * lead — no contact/entry is created. Used by the Meta/Mube bridge so leads
   * without an attribution rule stay in the Análise Meta "Por atribuir" inbox
   * instead of landing in the gestora pool. The match is evaluated against
   * source + meta_ad_id / meta_adset_id / meta_campaign_id (from form_data).
   */
  requireMatchedRule?: boolean
}

/**
 * Ingest a lead from any source. Returns the created contact + entry IDs.
 */
export async function ingestLead(
  supabase: SupabaseClient,
  input: IngestLeadInput
): Promise<IngestLeadResult>
export async function ingestLead(
  supabase: SupabaseClient,
  input: IngestLeadInput,
  opts: IngestLeadOptions
): Promise<IngestLeadResult | null>
export async function ingestLead(
  supabase: SupabaseClient,
  input: IngestLeadInput,
  opts?: IngestLeadOptions
): Promise<IngestLeadResult | null> {
  // 0. Attribution gate (Meta bridge). Bail out early — before creating any
  //    contact or entry — when no rule matches. Side-effect-free check.
  if (opts?.requireMatchedRule) {
    const gateMetaAdId = typeof input.form_data?.meta_ad_id === 'string' ? (input.form_data.meta_ad_id as string) : null
    const gateMetaAdsetId = typeof input.form_data?.meta_adset_id === 'string' ? (input.form_data.meta_adset_id as string) : null
    const gateMetaCampaignId = typeof input.form_data?.meta_campaign_id === 'string' ? (input.form_data.meta_campaign_id as string) : null
    const matched = await findMatchingRule(supabase, {
      entry: { source: input.source, campaign_id: input.campaign_id || null, sector: input.sector || null },
      campaign: null,
      contact_city: null,
      meta_ad_id: gateMetaAdId,
      meta_adset_id: gateMetaAdsetId,
      meta_campaign_id: gateMetaCampaignId,
    })
    if (!matched) return null
  }

  // 1. Resolve campaign sector if not provided
  let sector = input.sector
  if (!sector && input.campaign_id) {
    const { data: campaign } = await supabase
      .from('leads_campaigns')
      .select('sector')
      .eq('id', input.campaign_id)
      .single()
    if (campaign?.sector) sector = campaign.sector as LeadSector
  }

  // 2. Dedup contact — search by email or phone
  let contactId: string | null = null
  let isReactivation = false

  if (input.email) {
    const { data } = await supabase
      .from('leads')
      .select('id')
      .eq('email', input.email)
      .limit(1)
      .single()
    if (data) {
      contactId = data.id
      isReactivation = true
    }
  }

  if (!contactId && input.phone) {
    const { data } = await supabase
      .from('leads')
      .select('id')
      .eq('telemovel', input.phone)
      .limit(1)
      .single()
    if (data) {
      contactId = data.id
      isReactivation = true
    }
  }

  // 3. Create contact if new
  if (!contactId) {
    const { data: newContact, error: contactError } = await supabase
      .from('leads')
      .insert({
        nome: input.name,
        email: input.email || null,
        telemovel: input.phone || null,
        origem: input.source,
        estado: 'Lead',
      })
      .select('id')
      .single()

    if (contactError || !newContact) {
      throw new Error(`Failed to create contact: ${contactError?.message}`)
    }
    contactId = newContact.id
  }

  // 4. Run assignment engine (unless manually assigned)
  let assignedAgentId = input.assigned_agent_id || null
  let assignmentMethod: IngestLeadResult['assignment_method'] = 'manual'
  // Property linkage from the matched rule (Meta ad → imóvel mapping configurado
  // pela gestora). external_ref é canónico; property_id é a denormalização FK.
  // Fallback para form_data quando nenhuma regra ganhou — formulários do site,
  // captura por voz e bulk import já embebem property_external_ref/property_id.
  let rulePropertyExternalRef: string | null = null
  let rulePropertyId: string | null = null

  // Referral defaults pulled from the matched rule (Meta campaign/ad attribution).
  // Stamped onto the entry → inherited by the negócio → Referências page.
  let entryHasReferral = false
  let entryReferralConsultantId: string | null = null
  let entryReferralPct: number | null = null

  // Lead-type defaults declared on the campaign/ad rule. Stamped onto the entry
  // so the qualify dialog pre-fills (sector → perspective, business_type).
  let entryBusinessType: string | null = null

  // Meta ad attribution lives inside form_data (set by the Mube bridge / sync cron).
  const metaAdId = typeof input.form_data?.meta_ad_id === 'string'
    ? (input.form_data.meta_ad_id as string)
    : null
  const metaAdsetId = typeof input.form_data?.meta_adset_id === 'string'
    ? (input.form_data.meta_adset_id as string)
    : null
  const metaCampaignId = typeof input.form_data?.meta_campaign_id === 'string'
    ? (input.form_data.meta_campaign_id as string)
    : null

  if (!assignedAgentId) {
    const contactCity = await getContactCity(supabase, contactId!)
    const assignment = await assignLeadEntry(supabase, {
      entry: { source: input.source, campaign_id: input.campaign_id || null, sector: sector || null },
      campaign: input.campaign_id ? { id: input.campaign_id, sector: sector || null } : null,
      contact_city: contactCity,
      meta_ad_id: metaAdId,
      meta_adset_id: metaAdsetId,
      meta_campaign_id: metaCampaignId,
    })
    assignedAgentId = assignment.agent_id
    assignmentMethod = assignment.method
    rulePropertyExternalRef = assignment.property_external_ref
    rulePropertyId = assignment.property_id
    entryHasReferral = assignment.has_referral
    entryReferralConsultantId = assignment.referral_consultant_id
    entryReferralPct = assignment.referral_pct
    // Rule's declared lead type takes precedence for the entry stamp.
    if (assignment.lead_sector) sector = assignment.lead_sector as LeadSector
    entryBusinessType = assignment.lead_business_type
  }

  // Resolve property linkage to stamp on the entry. Priority:
  //   1) rule's external_ref (gestora-set, canónico)
  //   2) form_data.property_external_ref (voice/bulk/site forms já guardam)
  //   3) rule's property_id
  //   4) form_data.property_id (older website forms)
  //
  // Whichever side we have, resolve the missing one against dev_properties so
  // the entry always carries both columns in sync.
  const formPropertyRef = typeof input.form_data?.property_external_ref === 'string'
    ? (input.form_data.property_external_ref as string)
    : null
  const formPropertyId = typeof input.form_data?.property_id === 'string'
    ? (input.form_data.property_id as string)
    : null

  let entryPropertyExternalRef = rulePropertyExternalRef ?? formPropertyRef
  let entryPropertyId = rulePropertyId ?? formPropertyId

  if (entryPropertyExternalRef && !entryPropertyId) {
    const { data: byRef } = await supabase
      .from('dev_properties')
      .select('id')
      .eq('external_ref', entryPropertyExternalRef)
      .maybeSingle()
    if (byRef?.id) entryPropertyId = byRef.id
  } else if (entryPropertyId && !entryPropertyExternalRef) {
    const { data: byId } = await supabase
      .from('dev_properties')
      .select('external_ref')
      .eq('id', entryPropertyId)
      .maybeSingle()
    if (byId?.external_ref) entryPropertyExternalRef = byId.external_ref
  }

  // 5. Calculate SLA deadline
  const sla = await calculateSlaDeadline(supabase, {
    source: input.source,
    sector,
    priority: input.priority || 'medium',
  })

  // 6. Create entry
  const { data: entry, error: entryError } = await supabase
    .from('leads_entries')
    .insert({
      contact_id: contactId,
      source: input.source,
      campaign_id: input.campaign_id || null,
      partner_id: input.partner_id || null,
      assigned_agent_id: assignedAgentId,
      // Mirror onto assigned_consultant_id — the column the entries UI/API
      // (inbox "Leads por qualificar", Leads kanban, GET /api/lead-entries)
      // filters by. Without this, ingested leads (Meta bridge, site forms,
      // voice, bulk import) carry only assigned_agent_id and stay invisible
      // to the assigned consultant. Same person, two denormalised columns.
      assigned_consultant_id: assignedAgentId,
      property_id: entryPropertyId,
      property_external_ref: entryPropertyExternalRef,
      sector,
      is_reactivation: isReactivation,
      status: 'new',
      priority: input.priority || 'medium',
      sla_deadline: sla?.deadline.toISOString() || null,
      sla_status: 'pending',
      utm_source: input.utm_source || null,
      utm_medium: input.utm_medium || null,
      utm_campaign: input.utm_campaign || null,
      utm_content: input.utm_content || null,
      utm_term: input.utm_term || null,
      form_data: input.form_data || null,
      form_url: input.form_url || null,
      notes: input.notes || null,
      // Referral inherited from the matched attribution rule (Meta campaign/ad).
      has_referral: entryHasReferral,
      referral_consultant_id: entryReferralConsultantId,
      referral_pct: entryReferralPct,
      // Lead-type declared on the campaign/ad — pre-fills the qualify dialog.
      business_type: entryBusinessType,
    })
    .select('id')
    .single()

  if (entryError || !entry) {
    throw new Error(`Failed to create entry: ${entryError?.message}`)
  }

  // 6b. Keep the contact owner (leads.agent_id) in sync with the assigned
  //     consultant so the lead appears in the assignee's "Meus Contactos"
  //     (that page filters on leads.agent_id). Only fill when empty: never steal
  //     a contact someone already owns — the gestora's explicit reassign is the
  //     path allowed to override an existing owner.
  if (assignedAgentId) {
    await supabase
      .from('leads')
      .update({ agent_id: assignedAgentId })
      .eq('id', contactId)
      .is('agent_id', null)
  }

  // 7. Log system activity
  await supabase.from('leads_activities').insert({
    contact_id: contactId,
    activity_type: 'system',
    subject: isReactivation ? 'Contacto reactivado' : 'Novo contacto',
    description: `Lead recebida via ${input.source}${input.campaign_id ? ' (campanha)' : ''}`,
    metadata: {
      entry_id: entry.id,
      source: input.source,
      campaign_id: input.campaign_id,
      is_reactivation: isReactivation,
      assignment_method: assignmentMethod,
    },
  })

  // 8. Create assignment activity if assigned
  if (assignedAgentId) {
    await supabase.from('leads_activities').insert({
      contact_id: contactId,
      activity_type: 'assignment',
      subject: 'Lead atribuída',
      description: `Lead atribuída automaticamente (${assignmentMethod})`,
      metadata: {
        entry_id: entry.id,
        agent_id: assignedAgentId,
        method: assignmentMethod,
      },
    })
  }

  // 9. Create notification for assigned agent
  if (assignedAgentId) {
    const { data: notif } = await supabase.from('leads_notifications').insert({
      recipient_id: assignedAgentId,
      type: 'new_lead',
      title: 'Nova lead recebida',
      body: `${input.name} — via ${formatSource(input.source)}`,
      link: `/dashboard/crm/contactos/${contactId}`,
      entry_id: entry.id,
      contact_id: contactId!,
    }).select('id').single()
    const notifId = (notif as { id?: string } | null)?.id ?? null

    // Web push (fire-and-forget) — click abre o sheet "Leads por qualificar"
    // no topo (via ?openLeads=1, captado pelo <LeadsInboxButton>). O cron
    // `dispatch-pending-push` é o fallback durável; marcamos is_push_sent=true
    // só depois do envio para que uma falha seja re-tentada pelo cron.
    import('./send-push').then(({ sendPushToUser }) => {
      sendPushToUser(supabase, assignedAgentId!, {
        title: 'Nova lead recebida',
        body: `${input.name} — via ${formatSource(input.source)}`,
        url: '/dashboard?openLeads=1',
        tag: `lead-${entry.id}`,
      })
        .then((sent) => {
          if (sent > 0 && notifId) {
            return supabase
              .from('leads_notifications')
              .update({ is_push_sent: true })
              .eq('id', notifId)
          }
        })
        .catch(() => {})
    }).catch(() => {})

    // Send email notification (fire-and-forget)
    import('./send-notification-email').then(({ sendNotificationEmail }) => {
      supabase
        .from('dev_users')
        .select('professional_email, commercial_name')
        .eq('id', assignedAgentId)
        .single()
        .then(({ data: agent }) => {
          if (agent?.professional_email) {
            sendNotificationEmail({
              recipientEmail: agent.professional_email,
              recipientName: agent.commercial_name ?? 'Consultor',
              type: 'new_lead',
              title: 'Nova lead recebida',
              body: `Tem uma nova lead atribuída: ${input.name}, via ${formatSource(input.source)}.`,
              link: `/dashboard/crm/contactos/${contactId}`,
              contactName: input.name,
              contactPhone: input.phone ?? undefined,
            })
          }
        })
    }).catch(() => {})
  }

  // 10. Notify the property owner when this lead is tied to a specific imóvel
  //     (vindo de uma assignment rule Meta-ad → propriedade, ou de form_data
  //     embebido pelos formulários do site/captura por voz). O dono do imóvel
  //     (`dev_properties.consultant_id`) merece saber que alguém se interessou
  //     pela ficha dele, mesmo que o lead acabe atribuído a outro consultor
  //     por round-robin / sector. Skip se o dono é o próprio assigned_agent
  //     (já recebeu notificação acima) ou se o imóvel não tem dono.
  if (entryPropertyId) {
    const { data: property } = await supabase
      .from('dev_properties')
      .select('consultant_id, title, slug, external_ref')
      .eq('id', entryPropertyId)
      .single()

    const ownerId = property?.consultant_id ?? null
    if (ownerId && ownerId !== assignedAgentId) {
      const propertyLabel = property?.title || property?.external_ref || 'um imóvel seu'
      await supabase.from('leads_notifications').insert({
        recipient_id: ownerId,
        type: 'new_lead',
        title: 'Nova lead pelo seu imóvel',
        body: `${input.name} pediu informação sobre "${propertyLabel}" — via ${formatSource(input.source)}`,
        link: `/dashboard/imoveis/${entryPropertyId}?tab=interessados&sub=site`,
        entry_id: entry.id,
        contact_id: contactId!,
      })

      // Email best-effort — paralelo ao do assigned agent.
      import('./send-notification-email').then(({ sendNotificationEmail }) => {
        supabase
          .from('dev_users')
          .select('professional_email, commercial_name')
          .eq('id', ownerId)
          .single()
          .then(({ data: owner }) => {
            if (owner?.professional_email) {
              sendNotificationEmail({
                recipientEmail: owner.professional_email,
                recipientName: owner.commercial_name ?? 'Consultor',
                type: 'new_lead',
                title: 'Nova lead pelo seu imóvel',
                body: `${input.name} pediu informação sobre "${propertyLabel}" via ${formatSource(input.source)}.`,
                link: `/dashboard/imoveis/${entryPropertyId}?tab=interessados&sub=site`,
                contactName: input.name,
                contactPhone: input.phone ?? undefined,
              })
            }
          })
      }).catch(() => {})
    }
  }

  return {
    contact_id: contactId!,
    entry_id: entry.id,
    is_reactivation: isReactivation,
    assigned_agent_id: assignedAgentId,
    assignment_method: assignmentMethod,
    sla_deadline: sla?.deadline.toISOString() || null,
  }
}

// ============================================================================
// Helpers
// ============================================================================

async function getContactCity(supabase: SupabaseClient, contactId: string): Promise<string | null> {
  const { data } = await supabase
    .from('leads')
    .select('localidade')
    .eq('id', contactId)
    .single()
  return data?.localidade || null
}

function formatSource(source: string): string {
  const map: Record<string, string> = {
    meta_ads: 'Meta Ads',
    google_ads: 'Google Ads',
    website: 'Website',
    landing_page: 'Landing Page',
    partner: 'Parceiro',
    organic: 'Orgânico',
    walk_in: 'Walk-in',
    phone_call: 'Chamada',
    social_media: 'Redes Sociais',
    other: 'Outro',
  }
  return map[source] || source
}
