import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { webhookLeadSchema } from '@/lib/validations/leads-crm'
import { NextResponse } from 'next/server'

// Map webhook pipeline_type string to the `tipo` column value in the negocios table
function pipelineTypeToTipo(pipelineType: string): string {
  switch (pipelineType) {
    case 'comprador': return 'Compra'
    case 'vendedor': return 'Venda'
    case 'arrendatario': return 'Arrendatário'
    case 'arrendador': return 'Arrendador'
    default: return pipelineType
  }
}

export async function POST(request: Request) {
  try {
    const webhookSecret = process.env.WEBHOOK_LEADS_SECRET
    if (webhookSecret) {
      const headerSecret = request.headers.get('x-webhook-secret')
      if (headerSecret !== webhookSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await request.json()

    const parsed = webhookLeadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const payload = parsed.data
    const supabase = createCrmAdminClient()

    // 1. Deduplicate contact by telemovel or email
    let contact_id: string
    let deduplicated = false

    let existingContact: { id: string } | null = null

    if (payload.phone) {
      const { data } = await supabase
        .from('leads')
        .select('id')
        .eq('telemovel', payload.phone)
        .maybeSingle()
      existingContact = data
    }

    if (!existingContact && payload.email) {
      const { data } = await supabase
        .from('leads')
        .select('id')
        .eq('email', payload.email)
        .maybeSingle()
      existingContact = data
    }

    if (existingContact) {
      contact_id = existingContact.id
      deduplicated = true

      if (payload.name) {
        await supabase
          .from('leads')
          .update({ nome: payload.name })
          .eq('id', contact_id)
      }
    } else {
      const { data: newContact, error: contactError } = await supabase
        .from('leads')
        .insert({
          nome: payload.name,
          email: payload.email ?? null,
          telemovel: payload.phone ?? null,
          origem: payload.source,
        })
        .select('id')
        .single()

      if (contactError || !newContact) {
        return NextResponse.json({ error: contactError?.message ?? 'Erro ao criar contacto' }, { status: 500 })
      }
      contact_id = newContact.id
    }

    // 2. Create entry
    const { data: entry, error: entryError } = await supabase
      .from('leads_entries')
      .insert({
        contact_id,
        source: payload.source,
        utm_source: payload.utm_source ?? null,
        utm_medium: payload.utm_medium ?? null,
        utm_campaign: payload.utm_campaign ?? null,
        utm_content: payload.utm_content ?? null,
        utm_term: payload.utm_term ?? null,
        form_data: payload.form_data ?? null,
        form_url: payload.form_url ?? null,
      })
      .select('id')
      .single()

    if (entryError || !entry) {
      return NextResponse.json({ error: entryError?.message ?? 'Erro ao criar entrada' }, { status: 500 })
    }

    // 3. Match campaign
    let campaign_id: string | null = null
    if (payload.campaign_id || payload.utm_campaign) {
      let campaignQuery = supabase.from('leads_campaigns').select('id')

      if (payload.campaign_id) {
        campaignQuery = campaignQuery.eq('external_campaign_id', payload.campaign_id)
      } else if (payload.utm_campaign) {
        campaignQuery = campaignQuery.eq('name', payload.utm_campaign)
      }

      const { data: campaign } = await campaignQuery.maybeSingle()
      if (campaign) campaign_id = campaign.id
    }

    if (campaign_id) {
      await supabase
        .from('leads_entries')
        .update({ campaign_id })
        .eq('id', entry.id)
    }

    // 4. Create negocio if pipeline_type provided
    let negocio_id: string | null = null
    if (payload.pipeline_type) {
      const { data: firstStage } = await supabase
        .from('leads_pipeline_stages')
        .select('id')
        .eq('pipeline_type', payload.pipeline_type)
        .order('order_index', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (firstStage) {
        const tipo = pipelineTypeToTipo(payload.pipeline_type)
        const { data: negocio } = await supabase
          .from('negocios')
          .insert({
            lead_id: contact_id,
            tipo,
            pipeline_stage_id: firstStage.id,
            stage_entered_at: new Date().toISOString(),
          })
          .select('id')
          .single()

        if (negocio) negocio_id = negocio.id
      }
    }

    // 5. Auto-assign if no consultant yet
    let assigned_consultant_id: string | null = null

    const { data: currentContact } = await supabase
      .from('leads')
      .select('agent_id')
      .eq('id', contact_id)
      .single()

    if (currentContact && !currentContact.agent_id) {
      const { data: rules } = await supabase
        .from('leads_assignment_rules')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false })

      if (rules) {
        for (const rule of rules) {
          const sourceMatch =
            !rule.source_match ||
            rule.source_match.length === 0 ||
            rule.source_match.includes(payload.source)

          const pipelineMatch =
            !rule.pipeline_type_match ||
            rule.pipeline_type_match.length === 0 ||
            (payload.pipeline_type && rule.pipeline_type_match.includes(payload.pipeline_type))

          if (!sourceMatch || !pipelineMatch) continue

          if (rule.consultant_id) {
            assigned_consultant_id = rule.consultant_id
            break
          }

          if (rule.team_consultant_ids && rule.team_consultant_ids.length > 0) {
            // Pick consultant with fewest active (non-terminal) negocios
            let minCount = Infinity
            let chosenId: string | null = null

            for (const cid of rule.team_consultant_ids) {
              const { count } = await supabase
                .from('negocios')
                .select('id', { count: 'exact', head: true })
                .eq('assigned_consultant_id', cid)
                .eq('is_terminal', false)

              const activeCount = count ?? 0
              if (activeCount < minCount) {
                minCount = activeCount
                chosenId = cid
              }
            }

            if (chosenId) {
              assigned_consultant_id = chosenId
              break
            }
          }
        }

        if (assigned_consultant_id) {
          await supabase
            .from('leads')
            .update({ agent_id: assigned_consultant_id })
            .eq('id', contact_id)

          if (negocio_id) {
            await supabase
              .from('negocios')
              .update({ assigned_consultant_id })
              .eq('id', negocio_id)
          }
        }
      }
    } else if (currentContact?.agent_id) {
      assigned_consultant_id = currentContact.agent_id
    }

    // 6. Log activity
    await supabase.from('leads_activities').insert({
      contact_id,
      negocio_id: negocio_id ?? null,
      activity_type: 'system',
      description: `Lead recebida via ${payload.source}`,
    })

    return NextResponse.json({
      contact_id,
      entry_id: entry.id,
      negocio_id,
      assigned_consultant_id,
      deduplicated,
    }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
