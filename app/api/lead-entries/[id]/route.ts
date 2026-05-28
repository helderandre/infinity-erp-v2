import { createClient } from '@/lib/supabase/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { NextResponse } from 'next/server'
import { updateLeadEntryStatusSchema } from '@/lib/validations/lead-entry'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient() as any

    const { data, error } = await supabase
      .from('leads_entries')
      .select(`
        *,
        contact:leads!leads_entries_contact_id_fkey(
          id, nome, email, telemovel, agent_id,
          agent:dev_users!leads_agent_id_fkey(id, commercial_name)
        ),
        campaign:leads_campaigns(id, name, platform, external_campaign_id, status, start_date, end_date),
        property:dev_properties!leads_entries_property_id_fkey(id, title, slug, external_ref),
        assigned_consultant:dev_users!leads_entries_assigned_consultant_id_fkey(id, commercial_name)
      `)
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 404 })

    // Meta leads often arrive without leads_entries.campaign_id linked to a
    // leads_campaigns row — but form_data carries the real Meta IDs. When the
    // joined campaign is missing, hydrate from the meta.* analytics raw tables
    // so the UI can render a useful Campanha card.
    const fd = (data?.form_data ?? {}) as Record<string, unknown>
    const metaCampaignId = typeof fd.meta_campaign_id === 'string' || typeof fd.meta_campaign_id === 'number' ? String(fd.meta_campaign_id) : null
    const metaAdId = typeof fd.meta_ad_id === 'string' || typeof fd.meta_ad_id === 'number' ? String(fd.meta_ad_id) : null

    // The `meta` schema is service-role-only — use the admin client just for
    // these read-only lookups; we already enforced auth via the server client
    // above and never expose the admin client beyond this block.
    if ((!data.campaign && metaCampaignId) || metaAdId) {
      const adminMeta = createCrmAdminClient().schema('meta' as never) as any

      if (!data.campaign && metaCampaignId) {
        try {
          const { data: camp } = await adminMeta
            .from('meta_campaigns_raw')
            .select('campaign_id, name, status, objective, start_time, stop_time')
            .eq('campaign_id', metaCampaignId)
            .limit(1)
            .maybeSingle()
          if (camp) {
            data.meta_campaign = {
              id: camp.campaign_id,
              name: camp.name,
              platform: 'meta',
              status: camp.status,
              objective: camp.objective,
              start_date: camp.start_time,
              end_date: camp.stop_time,
            }
          }
        } catch (err) {
          console.error('[lead-entries] meta_campaigns_raw lookup failed:', err)
        }
      }

      if (metaAdId) {
        try {
          const { data: ad } = await adminMeta
            .from('meta_ads_raw')
            .select('ad_id, name, status, creative_name')
            .eq('ad_id', metaAdId)
            .limit(1)
            .maybeSingle()
          if (ad) {
            data.meta_ad = {
              id: ad.ad_id,
              name: ad.name,
              status: ad.status,
              creative_name: ad.creative_name,
            }
          }
        } catch (err) {
          console.error('[lead-entries] meta_ads_raw lookup failed:', err)
        }
      }
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao obter lead entry:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient() as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = updateLeadEntryStatusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados invalidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { status: parsed.data.status }

    if (['converted', 'discarded'].includes(parsed.data.status)) {
      updateData.processed_at = new Date().toISOString()
      updateData.processed_by = user.id
    }

    if (parsed.data.status === 'discarded') {
      if (parsed.data.lost_reason !== undefined) updateData.lost_reason = parsed.data.lost_reason
      if (parsed.data.lost_notes !== undefined) updateData.lost_notes = parsed.data.lost_notes
    }

    const { data, error } = await supabase
      .from('leads_entries')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar lead entry:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
