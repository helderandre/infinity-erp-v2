import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { acquisitionSchema } from '@/lib/validations/acquisition'
import { notificationService } from '@/lib/notifications/service'

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
              // KYC Singular
              birth_date: ownerData.birth_date || null,
              id_doc_type: ownerData.id_doc_type || null,
              id_doc_number: ownerData.id_doc_number || null,
              id_doc_expiry: ownerData.id_doc_expiry || null,
              id_doc_issued_by: ownerData.id_doc_issued_by || null,
              is_pep: ownerData.is_pep ?? false,
              pep_position: ownerData.pep_position || null,
              funds_origin: ownerData.funds_origin || null,
              profession: ownerData.profession || null,
              last_profession: ownerData.last_profession || null,
              is_portugal_resident: ownerData.is_portugal_resident ?? true,
              residence_country: ownerData.residence_country || null,
              postal_code: ownerData.postal_code || null,
              city: ownerData.city || null,
              marital_regime: ownerData.marital_regime || null,
              legal_rep_id_doc: ownerData.legal_rep_id_doc || null,
              // KYC Colectiva
              company_object: ownerData.company_object || null,
              company_branches: ownerData.company_branches || null,
              legal_nature: ownerData.legal_nature || null,
              country_of_incorporation: ownerData.country_of_incorporation || 'Portugal',
              cae_code: ownerData.cae_code || null,
              rcbe_code: ownerData.rcbe_code || null,
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

      // Inserir beneficiarios se for colectiva com beneficiarios
      if (ownerData.person_type === 'coletiva' && ownerData.beneficiaries && ownerData.beneficiaries.length > 0) {
        const beneficiariesToInsert = ownerData.beneficiaries.map((b: any) => ({
          owner_id: ownerId,
          full_name: b.full_name,
          position: b.position || null,
          share_percentage: b.share_percentage || null,
          id_doc_type: b.id_doc_type || null,
          id_doc_number: b.id_doc_number || null,
          id_doc_expiry: b.id_doc_expiry || null,
          id_doc_issued_by: b.id_doc_issued_by || null,
          nif: b.nif || null,
        }))

        const { error: benError } = await supabase
          .from('owner_beneficiaries')
          .insert(beneficiariesToInsert)

        if (benError) {
          console.error('Erro ao inserir beneficiarios:', benError)
        }
      }

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
          owner_id: doc.owner_id || null,
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

    // 6. Criar instância de processo (SEM template — será seleccionado na aprovação)
    const { data: procInstance, error: procError } = await supabase
      .from('proc_instances')
      .insert({
        property_id: property.id,
        tpl_process_id: null,
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

    // Notificar Gestora Processual + Broker/CEO (evento #1)
    try {
      const approverIds = await notificationService.getUserIdsByRoles(['Broker/CEO', 'Gestora Processual'])
      if (approverIds.length > 0) {
        await notificationService.createBatch(approverIds, {
          senderId: user.id,
          notificationType: 'process_created',
          entityType: 'proc_instance',
          entityId: procInstance.id,
          title: 'Nova angariação submetida',
          body: `${data.title} — aguarda aprovação`,
          actionUrl: `/dashboard/processos/${procInstance.id}`,
          metadata: { property_title: data.title },
        })
      }
    } catch (notifError) {
      console.error('[Acquisitions] Erro ao enviar notificações:', notifError)
    }

    return NextResponse.json({
      success: true,
      property_id: property.id,
      proc_instance_id: procInstance.id,
      owner_ids: ownerIds,
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
