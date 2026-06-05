import { SupabaseClient } from '@supabase/supabase-js'

// Map form doc type values to DB check constraint values
const DOC_TYPE_MAP: Record<string, string> = {
  'CC': 'citizen_card',
  'BI': 'id_card',
  'Passaporte': 'passport',
  'Titulo de Residencia': 'other',
  'Outro': 'other',
  'cc': 'citizen_card',
  'bi': 'id_card',
  'passaporte': 'passport',
  'titulo_residencia': 'other',
  'outro': 'other',
  'citizen_card': 'citizen_card',
  'id_card': 'id_card',
  'passport': 'passport',
  'other': 'other',
}

function sanitizeOwnerData(ownerData: any) {
  const clean: Record<string, any> = {
    person_type: ownerData.person_type || 'singular',
    name: ownerData.name,
  }

  // Only add optional fields if they have actual values
  const optionalStrings = [
    'email', 'phone', 'nif', 'nationality', 'naturality', 'marital_status',
    'address', 'observations', 'legal_representative_name', 'legal_representative_nif',
    'birth_date', 'id_doc_number', 'id_doc_expiry', 'id_doc_issued_by',
    'pep_position', 'profession', 'last_profession', 'residence_country',
    'postal_code', 'city', 'marital_regime', 'legal_rep_id_doc',
    'company_object', 'company_branches', 'legal_nature',
    'country_of_incorporation', 'cae_code', 'rcbe_code',
  ]

  for (const field of optionalStrings) {
    const val = ownerData[field]
    if (val && typeof val === 'string' && val.trim() !== '') {
      clean[field] = val.trim()
    }
  }

  // id_doc_type needs mapping to DB constraint values
  if (ownerData.id_doc_type) {
    const mapped = DOC_TYPE_MAP[ownerData.id_doc_type]
    if (mapped) clean.id_doc_type = mapped
  }

  // Booleans
  if (ownerData.is_pep != null) clean.is_pep = !!ownerData.is_pep
  if (ownerData.is_portugal_resident != null) clean.is_portugal_resident = !!ownerData.is_portugal_resident

  // Arrays
  if (Array.isArray(ownerData.funds_origin) && ownerData.funds_origin.length > 0) {
    clean.funds_origin = ownerData.funds_origin
  }

  return clean
}

/**
 * Upsert owners for a property: reuse by NIF/email or create new.
 */
export async function upsertOwners(
  supabase: SupabaseClient,
  propertyId: string,
  owners: any[],
): Promise<string[]> {
  if (!owners || owners.length === 0) return []

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
        const sanitized = sanitizeOwnerData(ownerData)
        console.log('[upsertOwners] Creating owner:', JSON.stringify(sanitized))

        const { data: newOwner, error: ownerError } = await supabase
          .from('owners')
          .insert(sanitized)
          .select('id')
          .single()

        if (ownerError || !newOwner) {
          console.error('[upsertOwners] Erro ao criar owner:', ownerError)
          throw new Error(`Erro ao criar proprietário "${ownerData.name}": ${ownerError?.message || 'desconhecido'}`)
        }
        ownerId = newOwner.id
      } else {
        // Update existing owner with new data
        const sanitized = sanitizeOwnerData(ownerData)
        delete sanitized.person_type // don't change type of existing
        delete sanitized.name // don't overwrite name
        await supabase.from('owners').update(sanitized).eq('id', ownerId)
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
        id_doc_type: b.id_doc_type ? (DOC_TYPE_MAP[b.id_doc_type] || null) : null,
        id_doc_number: b.id_doc_number || null,
        id_doc_expiry: b.id_doc_expiry || null,
        id_doc_issued_by: b.id_doc_issued_by || null,
        nif: b.nif || null,
      }))

      const { error: benError } = await supabase
        .from('owner_beneficiaries')
        .insert(beneficiariesToInsert)
      if (benError) console.error('[upsertOwners] Erro ao inserir beneficiarios:', benError)
    }

    // Link to property
    const { error: linkError } = await supabase.from('property_owners').insert({
      property_id: propertyId,
      owner_id: ownerId,
      ownership_percentage: ownerData.ownership_percentage || 100,
      is_main_contact: ownerData.is_main_contact || false,
      owner_role_id: '010848f5-19ad-4660-a63a-aa99bdd08a0d',
    })
    if (linkError) {
      console.error('[upsertOwners] Erro ao ligar owner:', linkError)
      throw new Error(`Erro ao associar proprietário "${ownerData.name}": ${linkError.message}`)
    }
  }

  return ownerIds
}
