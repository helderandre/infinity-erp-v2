import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import type { FormFieldConfig } from '@/types/subtask'

type Params = { params: Promise<{ id: string; taskId: string; subtaskId: string }> }

// ─── GET: Load current values for form/field subtask ─────

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id: processId, subtaskId } = await params
    const supabase = await createClient()

    // Verify auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Get subtask config
    const { data: subtask, error: subtaskError } = await admin
      .from('proc_subtasks')
      .select('id, config, owner_id')
      .eq('id', subtaskId)
      .single()

    if (subtaskError || !subtask) {
      return NextResponse.json({ error: 'Subtarefa não encontrada' }, { status: 404 })
    }

    // Get property_id from process instance
    const { data: instance, error: instanceError } = await admin
      .from('proc_instances')
      .select('property_id')
      .eq('id', processId)
      .single()

    if (instanceError || !instance) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    const propertyId = instance.property_id

    // Resolve dealId from proc_instance_id
    let dealId: string | null = null
    const { data: dealRow } = await admin
      .from('deals')
      .select('id')
      .eq('proc_instance_id', processId)
      .maybeSingle()
    dealId = dealRow?.id ?? null
    let config = subtask.config as Record<string, unknown>

    // Se tem form_template_id, resolver secções do template da DB
    if (config.form_template_id && typeof config.form_template_id === 'string') {
      const { data: formTemplate } = await admin
        .from('tpl_form_templates')
        .select('sections')
        .eq('id', config.form_template_id)
        .eq('is_active', true)
        .single()

      if (formTemplate?.sections) {
        // Usar secções do template, mantendo o resto da config
        config = { ...config, sections: formTemplate.sections }
      }
    }

    // Extract fields from config
    let fields: FormFieldConfig[] = []
    if (config.type === 'form' && Array.isArray(config.sections)) {
      fields = (config.sections as { fields: FormFieldConfig[] }[]).flatMap(s => s.fields)
    } else if (config.type === 'field' && config.field) {
      fields = [config.field as FormFieldConfig]
    }

    if (fields.length === 0) {
      return NextResponse.json({ values: {}, config, property_id: propertyId })
    }

    // Expandir campos address_map para os 6 sub-campos e filtrar media_upload
    const expandedFields: FormFieldConfig[] = []
    for (const f of fields) {
      if (f.field_type === 'media_upload') continue // uploads são directos, não precisam de valores
      if (f.field_type === 'address_map') {
        // Expandir para os 6 sub-campos
        const subFields = ['address_street', 'postal_code', 'city', 'zone', 'latitude', 'longitude']
        for (const sf of subFields) {
          expandedFields.push({
            ...f,
            field_name: sf,
            field_type: sf === 'latitude' || sf === 'longitude' ? 'number' : 'text',
          })
        }
      } else {
        expandedFields.push(f)
      }
    }

    // Determine unique entities
    const entities = [...new Set(expandedFields.map(f => f.target_entity))]
    const values: Record<string, unknown> = {}

    // Fetch data per entity
    for (const entity of entities) {
      const entityFields = expandedFields.filter(f => f.target_entity === entity)
      const fieldNames = entityFields.map(f => f.field_name).join(', ')

      let data: Record<string, unknown> | null = null

      switch (entity) {
        case 'property': {
          const { data: row } = await admin
            .from('dev_properties')
            .select(fieldNames)
            .eq('id', propertyId)
            .single()
          data = row as Record<string, unknown> | null
          break
        }
        case 'property_specs': {
          const { data: row } = await admin
            .from('dev_property_specifications')
            .select(fieldNames)
            .eq('property_id', propertyId)
            .single()
          data = row as Record<string, unknown> | null
          break
        }
        case 'property_internal': {
          const { data: row } = await admin
            .from('dev_property_internal')
            .select(fieldNames)
            .eq('property_id', propertyId)
            .single()
          data = row as Record<string, unknown> | null
          break
        }
        case 'owner': {
          // Use subtask.owner_id, or fallback to main contact owner of the property
          let ownerId = subtask.owner_id
          if (!ownerId && propertyId) {
            const { data: mainOwner } = await admin
              .from('property_owners')
              .select('owner_id')
              .eq('property_id', propertyId)
              .eq('is_main_contact', true)
              .limit(1)
              .maybeSingle()
            ownerId = mainOwner?.owner_id ?? null
            // If no main contact, use first owner
            if (!ownerId) {
              const { data: firstOwner } = await admin
                .from('property_owners')
                .select('owner_id')
                .eq('property_id', propertyId)
                .limit(1)
                .maybeSingle()
              ownerId = firstOwner?.owner_id ?? null
            }
          }
          if (ownerId) {
            const { data: row } = await admin
              .from('owners')
              .select(fieldNames)
              .eq('id', ownerId)
              .single()
            data = row as Record<string, unknown> | null
          }
          break
        }
        case 'property_owner': {
          let poOwnerId = subtask.owner_id
          if (!poOwnerId && propertyId) {
            const { data: mainOwner } = await admin
              .from('property_owners')
              .select('owner_id')
              .eq('property_id', propertyId)
              .eq('is_main_contact', true)
              .limit(1)
              .maybeSingle()
            poOwnerId = mainOwner?.owner_id ?? null
            if (!poOwnerId) {
              const { data: firstOwner } = await admin
                .from('property_owners')
                .select('owner_id')
                .eq('property_id', propertyId)
                .limit(1)
                .maybeSingle()
              poOwnerId = firstOwner?.owner_id ?? null
            }
          }
          if (poOwnerId && propertyId) {
            const { data: row } = await admin
              .from('property_owners')
              .select(fieldNames)
              .eq('property_id', propertyId)
              .eq('owner_id', poOwnerId)
              .single()
            data = row as Record<string, unknown> | null
          }
          break
        }
        case 'deal': {
          if (dealId) {
            const { data: row } = await admin
              .from('deals')
              .select(fieldNames)
              .eq('id', dealId)
              .single()
            data = row as Record<string, unknown> | null
          }
          break
        }
        case 'deal_client': {
          if (dealId) {
            const clientIndex = (subtask.config as Record<string, unknown>)?.client_index ?? 0
            const { data: row } = await admin
              .from('deal_clients')
              .select(fieldNames)
              .eq('deal_id', dealId)
              .order('order_index')
              .range(clientIndex as number, clientIndex as number)
              .maybeSingle()
            data = row as Record<string, unknown> | null
          }
          break
        }
        case 'deal_payment': {
          if (dealId) {
            const paymentMoment = (subtask.config as Record<string, unknown>)?.payment_moment as string | undefined
            let query = admin
              .from('deal_payments')
              .select(fieldNames)
              .eq('deal_id', dealId)
            if (paymentMoment) {
              query = query.eq('payment_moment', paymentMoment)
            }
            const { data: row } = await query.limit(1).maybeSingle()
            data = row as Record<string, unknown> | null
          }
          break
        }
        case 'consultant': {
          if (propertyId) {
            const { data: prop } = await admin
              .from('dev_properties')
              .select('consultant_id')
              .eq('id', propertyId)
              .single()
            if (prop?.consultant_id) {
              const { data: row } = await admin
                .from('dev_users')
                .select(`${fieldNames}, dev_consultant_profiles(*)`)
                .eq('id', prop.consultant_id)
                .single()
              // Flatten dev_users + dev_consultant_profiles
              const r = row as Record<string, unknown> | null
              if (r) {
                const profile = (r.dev_consultant_profiles ?? {}) as Record<string, unknown>
                delete r.dev_consultant_profiles
                data = { ...r, ...profile }
              }
            }
          }
          break
        }
        case 'process': {
          const { data: row } = await admin
            .from('proc_instances')
            .select(fieldNames)
            .eq('id', processId)
            .single()
          data = row as Record<string, unknown> | null
          break
        }
      }

      if (data) {
        for (const f of entityFields) {
          const key = `${entity}__${f.field_name}`
          values[key] = data[f.field_name] ?? null
        }
      }
    }

    return NextResponse.json({ values, config, property_id: propertyId })
  } catch (error) {
    console.error('[form/GET] Error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ─── PUT: Upsert form data by entity ─────────────────────

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id: processId, subtaskId } = await params
    const supabase = await createClient()

    // Verify auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json() as Record<string, Record<string, unknown>>
    const admin = createAdminClient()

    // Get property_id
    const { data: instance } = await admin
      .from('proc_instances')
      .select('property_id')
      .eq('id', processId)
      .single()

    if (!instance) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    const propertyId = instance.property_id

    // Get subtask config if needed for owner_id, client_index, payment_moment
    let ownerId: string | null = null
    let subtaskConfig: Record<string, unknown> = {}
    if (body.owner || body.property_owner || body.deal_client || body.deal_payment) {
      const { data: subtask } = await admin
        .from('proc_subtasks')
        .select('owner_id, config')
        .eq('id', subtaskId)
        .single()
      ownerId = subtask?.owner_id ?? null
      subtaskConfig = (subtask?.config as Record<string, unknown>) ?? {}

      // Fallback: if no owner_id on subtask, use main contact owner of the property
      if (!ownerId && propertyId && (body.owner || body.property_owner)) {
        const { data: mainOwner } = await admin
          .from('property_owners')
          .select('owner_id')
          .eq('property_id', propertyId)
          .eq('is_main_contact', true)
          .limit(1)
          .maybeSingle()
        ownerId = mainOwner?.owner_id ?? null
        if (!ownerId) {
          const { data: firstOwner } = await admin
            .from('property_owners')
            .select('owner_id')
            .eq('property_id', propertyId)
            .limit(1)
            .maybeSingle()
          ownerId = firstOwner?.owner_id ?? null
        }
      }
    }

    // Resolve dealId for deal entities
    let dealId: string | null = null
    if (body.deal || body.deal_client || body.deal_payment) {
      const { data: dealRow } = await admin
        .from('deals')
        .select('id')
        .eq('proc_instance_id', processId)
        .maybeSingle()
      dealId = dealRow?.id ?? null
    }

    // Upsert per entity
    const errors: string[] = []

    if (body.property && Object.keys(body.property).length > 0) {
      const { error } = await admin
        .from('dev_properties')
        .update(body.property)
        .eq('id', propertyId)
      if (error) errors.push(`property: ${error.message}`)
    }

    if (body.property_specs && Object.keys(body.property_specs).length > 0) {
      const { error } = await admin
        .from('dev_property_specifications')
        .upsert({ property_id: propertyId, ...body.property_specs })
      if (error) errors.push(`property_specs: ${error.message}`)
    }

    if (body.property_internal && Object.keys(body.property_internal).length > 0) {
      const { error } = await admin
        .from('dev_property_internal')
        .upsert({ property_id: propertyId, ...body.property_internal })
      if (error) errors.push(`property_internal: ${error.message}`)
    }

    if (body.owner && Object.keys(body.owner).length > 0 && ownerId) {
      const { error } = await admin
        .from('owners')
        .update(body.owner)
        .eq('id', ownerId)
      if (error) errors.push(`owner: ${error.message}`)
    }

    if (body.property_owner && Object.keys(body.property_owner).length > 0 && ownerId) {
      const { error } = await admin
        .from('property_owners')
        .update(body.property_owner)
        .eq('property_id', propertyId)
        .eq('owner_id', ownerId)
      if (error) errors.push(`property_owner: ${error.message}`)
    }

    if (body.deal && Object.keys(body.deal).length > 0 && dealId) {
      const { error } = await admin
        .from('deals')
        .update(body.deal)
        .eq('id', dealId)
      if (error) errors.push(`deal: ${error.message}`)
    }

    if (body.deal_client && Object.keys(body.deal_client).length > 0 && dealId) {
      const clientIndex = (subtaskConfig.client_index ?? 0) as number
      const { data: clientRow } = await admin
        .from('deal_clients')
        .select('id')
        .eq('deal_id', dealId)
        .order('order_index')
        .range(clientIndex, clientIndex)
        .maybeSingle()
      if (clientRow?.id) {
        const { error } = await admin
          .from('deal_clients')
          .update(body.deal_client)
          .eq('id', clientRow.id)
        if (error) errors.push(`deal_client: ${error.message}`)
      }
    }

    if (body.deal_payment && Object.keys(body.deal_payment).length > 0 && dealId) {
      const paymentMoment = subtaskConfig.payment_moment as string | undefined
      let query = admin
        .from('deal_payments')
        .select('id')
        .eq('deal_id', dealId)
      if (paymentMoment) {
        query = query.eq('payment_moment', paymentMoment)
      }
      const { data: paymentRow } = await query.limit(1).maybeSingle()
      if (paymentRow?.id) {
        const { error } = await admin
          .from('deal_payments')
          .update(body.deal_payment)
          .eq('id', paymentRow.id)
        if (error) errors.push(`deal_payment: ${error.message}`)
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[form/PUT] Error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
