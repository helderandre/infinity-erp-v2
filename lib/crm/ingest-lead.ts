/**
 * Lead Ingestion Pipeline
 *
 * Central function for processing incoming leads from any source.
 * Handles: dedup contact → create entry → assign agent → set SLA → notify.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = import('@supabase/supabase-js').SupabaseClient<any, any, any>
import { assignLeadEntry } from './assignment-engine'
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

/**
 * Ingest a lead from any source. Returns the created contact + entry IDs.
 */
export async function ingestLead(
  supabase: SupabaseClient,
  input: IngestLeadInput
): Promise<IngestLeadResult> {
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

  if (!assignedAgentId) {
    const contactCity = await getContactCity(supabase, contactId!)
    const assignment = await assignLeadEntry(supabase, {
      entry: { source: input.source, campaign_id: input.campaign_id || null, sector: sector || null },
      campaign: input.campaign_id ? { id: input.campaign_id, sector: sector || null } : null,
      contact_city: contactCity,
    })
    assignedAgentId = assignment.agent_id
    assignmentMethod = assignment.method
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
    })
    .select('id')
    .single()

  if (entryError || !entry) {
    throw new Error(`Failed to create entry: ${entryError?.message}`)
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
    await supabase.from('leads_notifications').insert({
      recipient_id: assignedAgentId,
      type: 'new_lead',
      title: 'Nova lead recebida',
      body: `${input.name} — via ${formatSource(input.source)}`,
      link: `/dashboard/crm/contactos/${contactId}`,
      entry_id: entry.id,
      contact_id: contactId!,
    })

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

  // 10. Notify the property owner when this lead originated from a specific
  //     property (form_data.property_id presente — formulários do site e
  //     captura por voz embebem o id do imóvel quando aplicável). O dono do
  //     imóvel (`dev_properties.consultant_id`) merece saber que alguém se
  //     interessou pela ficha dele, mesmo que o lead acabe atribuído a outro
  //     consultor por round-robin / sector. Skip se o dono é o próprio
  //     assigned_agent (já recebeu notificação acima) ou se o imóvel não tem
  //     dono atribuído.
  const formPropertyId = typeof input.form_data?.property_id === 'string'
    ? (input.form_data.property_id as string)
    : null
  if (formPropertyId) {
    const { data: property } = await supabase
      .from('dev_properties')
      .select('consultant_id, title, slug, external_ref')
      .eq('id', formPropertyId)
      .single()

    const ownerId = property?.consultant_id ?? null
    if (ownerId && ownerId !== assignedAgentId) {
      const propertyLabel = property?.title || property?.external_ref || 'um imóvel seu'
      await supabase.from('leads_notifications').insert({
        recipient_id: ownerId,
        type: 'new_lead',
        title: 'Nova lead pelo seu imóvel',
        body: `${input.name} pediu informação sobre "${propertyLabel}" — via ${formatSource(input.source)}`,
        link: `/dashboard/imoveis/${formPropertyId}?tab=interessados&sub=site`,
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
                link: `/dashboard/imoveis/${formPropertyId}?tab=interessados&sub=site`,
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
