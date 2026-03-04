import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Upsert owners for a property: reuse by NIF/email or create new.
 * Returns array of owner IDs in order.
 */
export async function upsertOwners(
  supabase: SupabaseClient,
  propertyId: string,
  owners: any[],
): Promise<string[]> {
  // Clear existing links first
  await supabase.from('property_owners').delete().eq('property_id', propertyId)

  const ownerIds: string[] = []

  for (const ownerData of owners) {
    let ownerId = ownerData.id as string | undefined

    if (!ownerId) {
      // Check existing by NIF
      if (ownerData.nif && ownerData.nif.length === 9) {
        const { data: existingByNif } = await supabase
          .from('owners')
          .select('id')
          .eq('nif', ownerData.nif)
          .maybeSingle()
        if (existingByNif) ownerId = existingByNif.id
      }

      // Check existing by email
      if (!ownerId && ownerData.email && ownerData.email !== '') {
        const { data: existingByEmail } = await supabase
          .from('owners')
          .select('id')
          .eq('email', ownerData.email)
          .maybeSingle()
        if (existingByEmail) ownerId = existingByEmail.id
      }

      // Create new owner
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

    if (!ownerId) continue
    ownerIds.push(ownerId)

    // Beneficiaries for coletiva
    if (ownerData.person_type === 'coletiva' && ownerData.beneficiaries?.length > 0) {
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
      if (benError) console.error('Erro ao inserir beneficiarios:', benError)
    }

    // Link to property
    const { error: linkError } = await supabase.from('property_owners').insert({
      property_id: propertyId,
      owner_id: ownerId,
      ownership_percentage: ownerData.ownership_percentage || 100,
      is_main_contact: ownerData.is_main_contact || false,
    })
    if (linkError) console.error('Erro ao ligar owner:', linkError)
  }

  return ownerIds
}
