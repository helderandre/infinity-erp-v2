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

    if (instanceError || !instance?.property_id) {
      return NextResponse.json({ error: 'Processo ou imóvel não encontrado' }, { status: 404 })
    }

    const propertyId = instance.property_id
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
          if (subtask.owner_id) {
            const { data: row } = await admin
              .from('owners')
              .select(fieldNames)
              .eq('id', subtask.owner_id)
              .single()
            data = row as Record<string, unknown> | null
          }
          break
        }
        case 'property_owner': {
          if (subtask.owner_id) {
            const { data: row } = await admin
              .from('property_owners')
              .select(fieldNames)
              .eq('property_id', propertyId)
              .eq('owner_id', subtask.owner_id)
              .single()
            data = row as Record<string, unknown> | null
          }
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

    if (!instance?.property_id) {
      return NextResponse.json({ error: 'Processo ou imóvel não encontrado' }, { status: 404 })
    }

    const propertyId = instance.property_id

    // Get subtask owner_id if needed
    let ownerId: string | null = null
    if (body.owner || body.property_owner) {
      const { data: subtask } = await admin
        .from('proc_subtasks')
        .select('owner_id')
        .eq('id', subtaskId)
        .single()
      ownerId = subtask?.owner_id ?? null
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

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[form/PUT] Error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
