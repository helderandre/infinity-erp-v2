import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { acquisitionSchema } from '@/lib/validations/acquisition'
import { autoCompleteTasks, recalculateProgress } from '@/lib/process-engine'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Parse e validação
    const body = await request.json()
    const validation = acquisitionSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data

    // 1. Criar propriedade
    const { data: property, error: propertyError } = await supabase
      .from('dev_properties')
      .insert({
        title: data.title,
        description: data.description,
        property_type: data.property_type,
        business_type: data.business_type,
        listing_price: data.listing_price,
        status: 'pending_approval',
        city: data.city,
        zone: data.zone,
        address_parish: data.address_parish,
        address_street: data.address_street,
        postal_code: data.postal_code,
        latitude: data.latitude,
        longitude: data.longitude,
        consultant_id: user.id,
        property_condition: data.property_condition,
        energy_certificate: data.energy_certificate,
      })
      .select('id')
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        { error: 'Erro ao criar imóvel', details: propertyError?.message },
        { status: 500 }
      )
    }

    // 2. Criar specifications
    if (data.specifications) {
      const { error: specsError } = await supabase
        .from('dev_property_specifications')
        .insert({
          property_id: property.id,
          ...data.specifications,
        })

      if (specsError) {
        console.error('Erro ao criar specifications:', specsError)
      }
    }

    // 3. Criar internal data
    const { error: internalError } = await supabase
      .from('dev_property_internal')
      .insert({
        property_id: property.id,
        exact_address: data.address_street,
        postal_code: data.postal_code,
        commission_agreed: data.commission_agreed,
        commission_type: data.commission_type || 'percentage',
        contract_regime: data.contract_regime,
        contract_term: data.contract_term,
        contract_expiry: data.contract_expiry,
        imi_value: data.imi_value,
        condominium_fee: data.condominium_fee,
        internal_notes: data.internal_notes,
      })

    if (internalError) {
      console.error('Erro ao criar internal data:', internalError)
    }

    // 4. Processar owners (reutilizar existente por NIF ou email)
    const ownerIds: string[] = []
    for (const ownerData of data.owners) {
      let ownerId = ownerData.id

      if (!ownerId) {
        // Verificar se já existe owner com mesmo NIF ou email
        if (ownerData.nif && ownerData.nif.length === 9) {
          const { data: existingByNif } = await supabase
            .from('owners')
            .select('id')
            .eq('nif', ownerData.nif)
            .maybeSingle()

          if (existingByNif) {
            ownerId = existingByNif.id
            console.log(`Owner reutilizado por NIF ${ownerData.nif}: ${ownerId}`)
          }
        }

        if (!ownerId && ownerData.email && ownerData.email !== '') {
          const { data: existingByEmail } = await supabase
            .from('owners')
            .select('id')
            .eq('email', ownerData.email)
            .maybeSingle()

          if (existingByEmail) {
            ownerId = existingByEmail.id
            console.log(`Owner reutilizado por email ${ownerData.email}: ${ownerId}`)
          }
        }

        // Se não existe, criar novo
        if (!ownerId) {
          const { data: newOwner, error: ownerError } = await supabase
            .from('owners')
            .insert({
              person_type: ownerData.person_type,
              name: ownerData.name,
              email: ownerData.email || null,
              phone: ownerData.phone || null,
              nif: ownerData.nif || null,
              nationality: ownerData.nationality || null,
              marital_status: ownerData.marital_status || null,
              address: ownerData.address || null,
              observations: ownerData.observations || null,
              legal_representative_name: ownerData.legal_representative_name || null,
              legal_representative_nif: ownerData.legal_representative_nif || null,
            })
            .select('id')
            .single()

          if (ownerError || !newOwner) {
            console.error('Erro ao criar owner:', ownerError)
            continue
          }

          ownerId = newOwner.id
        }
      }

      ownerIds.push(ownerId)

      // Criar ligação property_owners
      const { error: linkError } = await supabase.from('property_owners').insert({
        property_id: property.id,
        owner_id: ownerId,
        ownership_percentage: ownerData.ownership_percentage || 100,
        is_main_contact: ownerData.is_main_contact || false,
      })

      if (linkError) {
        console.error('Erro ao ligar owner:', linkError)
      }
    }

    // 5. Upload de documentos (se fornecidos)
    if (data.documents && data.documents.length > 0) {
      const docInserts = data.documents
        .filter((doc) => doc.file_url && doc.file_name) // Só documentos com URL e nome
        .map((doc) => ({
          property_id: property.id,
          doc_type_id: doc.doc_type_id,
          file_url: doc.file_url!,
          file_name: doc.file_name!,
          uploaded_by: user.id,
          valid_until: doc.valid_until || null,
          status: 'active',
          metadata: (doc.metadata || {}) as any,
        }))

      if (docInserts.length > 0) {
        const { error: docsError } = await supabase
          .from('doc_registry')
          .insert(docInserts)

        if (docsError) {
          console.error('Erro ao registar documentos:', docsError)
        }
      }
    }

    // 6. Obter template activo (o mais recente se houver múltiplos)
    const { data: templates, error: templateError } = await supabase
      .from('tpl_processes')
      .select('id, name')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)

    if (templateError || !templates || templates.length === 0) {
      return NextResponse.json(
        {
          error: 'Nenhum template de processo activo encontrado',
          details: templateError?.message,
        },
        { status: 500 }
      )
    }

    const template = templates[0]
    console.log(`Template seleccionado: ${template.name} (${template.id})`)

    // 7. Criar instância de processo
    const { data: procInstance, error: procError } = await supabase
      .from('proc_instances')
      .insert({
        property_id: property.id,
        tpl_process_id: template.id,
        current_status: 'pending_approval',
        requested_by: user.id,
        percent_complete: 0,
      })
      .select('id')
      .single()

    if (procError || !procInstance) {
      return NextResponse.json(
        { error: 'Erro ao criar processo', details: procError?.message },
        { status: 500 }
      )
    }

    // 8. Popular tarefas do template (callable function)
    const { error: populateError } = await (supabase as any).rpc('populate_process_tasks', {
      p_instance_id: procInstance.id,
    })

    if (populateError) {
      console.error('Erro ao popular tarefas:', populateError)
    }

    // 9. Auto-completar tarefas com documentos existentes
    const autoCompleteResult = await autoCompleteTasks(procInstance.id, property.id)
    console.log('Auto-complete result:', autoCompleteResult)

    // 10. Recalcular progresso
    const progressResult = await recalculateProgress(procInstance.id)
    console.log('Progress result:', progressResult)

    return NextResponse.json({
      success: true,
      property_id: property.id,
      proc_instance_id: procInstance.id,
      message: 'Angariação criada com sucesso',
    })
  } catch (error) {
    console.error('Erro ao criar angariação:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
