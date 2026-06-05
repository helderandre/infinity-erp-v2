import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

// GET — Load draft data for resuming
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('processes')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    // Load proc_instance
    const { data: proc, error: procError } = await supabase
      .from('proc_instances')
      .select('id, property_id, current_status, last_completed_step, negocio_id')
      .eq('id', id)
      .single()

    if (procError || !proc) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    // Load all related data in parallel
    const [propertyResult, specsResult, internalResult, ownersResult, docsResult] = await Promise.all([
      supabase
        .from('dev_properties')
        .select('*')
        .eq('id', proc.property_id)
        .single(),
      supabase
        .from('dev_property_specifications')
        .select('*')
        .eq('property_id', proc.property_id)
        .single(),
      supabase
        .from('dev_property_internal')
        .select('*')
        .eq('property_id', proc.property_id)
        .single(),
      supabase
        .from('property_owners')
        .select('ownership_percentage, is_main_contact, owner:owners(*)')
        .eq('property_id', proc.property_id),
      supabase
        .from('doc_registry')
        .select('id, doc_type_id, file_url, file_name, valid_until, metadata, owner_id')
        .eq('property_id', proc.property_id)
        .eq('status', 'active'),
    ])

    const property = propertyResult.data
    const specs = specsResult.data
    const internal = internalResult.data

    // Assemble form-shaped response
    const formData = {
      // Step 1
      title: property?.title || '',
      property_type: property?.property_type || '',
      business_type: property?.business_type || 'venda',
      listing_price: property?.listing_price || 0,
      description: property?.description || '',
      property_condition: property?.property_condition || '',
      energy_certificate: property?.energy_certificate || '',
      specifications: specs
        ? {
            typology: specs.typology || '',
            bedrooms: specs.bedrooms ?? undefined,
            bathrooms: specs.bathrooms ?? undefined,
            area_gross: specs.area_gross ?? undefined,
            area_util: specs.area_util ?? undefined,
            construction_year: specs.construction_year ?? undefined,
            parking_spaces: specs.parking_spaces ?? undefined,
            garage_spaces: specs.garage_spaces ?? undefined,
            has_elevator: specs.has_elevator ?? undefined,
            features: specs.features || [],
          }
        : undefined,

      // Step 2
      address_street: property?.address_street || '',
      city: property?.city || '',
      address_parish: property?.address_parish || '',
      postal_code: property?.postal_code || '',
      zone: property?.zone || '',
      latitude: property?.latitude ?? null,
      longitude: property?.longitude ?? null,

      // Step 3
      owners: (ownersResult.data || []).map((po: any) => ({
        id: po.owner?.id,
        person_type: po.owner?.person_type || 'singular',
        name: po.owner?.name || '',
        email: po.owner?.email || '',
        phone: po.owner?.phone || '',
        nif: po.owner?.nif || '',
        nationality: po.owner?.nationality || '',
        naturality: po.owner?.naturality || '',
        marital_status: po.owner?.marital_status || '',
        address: po.owner?.address || '',
        observations: po.owner?.observations || '',
        ownership_percentage: po.ownership_percentage || 100,
        is_main_contact: po.is_main_contact || false,
        legal_representative_name: po.owner?.legal_representative_name || '',
        legal_representative_nif: po.owner?.legal_representative_nif || '',
        birth_date: po.owner?.birth_date || '',
        id_doc_type: po.owner?.id_doc_type || '',
        id_doc_number: po.owner?.id_doc_number || '',
        id_doc_expiry: po.owner?.id_doc_expiry || '',
        id_doc_issued_by: po.owner?.id_doc_issued_by || '',
        is_pep: po.owner?.is_pep ?? false,
        pep_position: po.owner?.pep_position || '',
        funds_origin: po.owner?.funds_origin || [],
        profession: po.owner?.profession || '',
        last_profession: po.owner?.last_profession || '',
        is_portugal_resident: po.owner?.is_portugal_resident ?? true,
        residence_country: po.owner?.residence_country || '',
        postal_code: po.owner?.postal_code || '',
        city: po.owner?.city || '',
        marital_regime: po.owner?.marital_regime || '',
        legal_rep_id_doc: po.owner?.legal_rep_id_doc || '',
        company_object: po.owner?.company_object || '',
        company_branches: po.owner?.company_branches || '',
        legal_nature: po.owner?.legal_nature || '',
        country_of_incorporation: po.owner?.country_of_incorporation || 'Portugal',
        cae_code: po.owner?.cae_code || '',
        rcbe_code: po.owner?.rcbe_code || '',
        beneficiaries: [],
      })),

      // Step 4
      contract_regime: internal?.contract_regime || '',
      commission_agreed: internal?.commission_agreed ?? 0,
      commission_type: internal?.commission_type || 'percentage',
      contract_term: internal?.contract_term || '',
      contract_expiry: internal?.contract_expiry || '',
      imi_value: internal?.imi_value ?? undefined,
      condominium_fee: internal?.condominium_fee ?? undefined,
      internal_notes: internal?.internal_notes || '',

      // Step 5
      documents: (docsResult.data || []).map((d: any) => ({
        doc_type_id: d.doc_type_id,
        file_url: d.file_url,
        file_name: d.file_name,
        valid_until: d.valid_until,
        metadata: d.metadata,
        owner_id: d.owner_id,
      })),
    }

    return NextResponse.json({
      proc_instance_id: proc.id,
      property_id: proc.property_id,
      current_status: proc.current_status,
      last_completed_step: proc.last_completed_step || 0,
      negocio_id: proc.negocio_id,
      formData,
    })
  } catch (error) {
    console.error('Erro ao carregar rascunho:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// DELETE — Delete a draft
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authDel = await requirePermission('processes')
    if (!authDel.authorized) return authDel.response

    const { id } = await params
    const supabase = await createClient()

    // Load proc_instance
    const { data: proc, error: procError } = await supabase
      .from('proc_instances')
      .select('id, property_id, current_status')
      .eq('id', id)
      .single()

    if (procError || !proc) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    if (proc.current_status !== 'draft') {
      return NextResponse.json({ error: 'Só é possível eliminar rascunhos' }, { status: 400 })
    }

    // Delete in reverse dependency order
    await Promise.all([
      supabase.from('doc_registry').delete().eq('property_id', proc.property_id),
      supabase.from('property_owners').delete().eq('property_id', proc.property_id),
    ])

    await Promise.all([
      supabase.from('dev_property_specifications').delete().eq('property_id', proc.property_id),
      supabase.from('dev_property_internal').delete().eq('property_id', proc.property_id),
    ])

    // Delete proc_instance first (has FK to property)
    await supabase.from('proc_instances').delete().eq('id', id)

    // Delete property
    await supabase.from('dev_properties').delete().eq('id', proc.property_id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao eliminar rascunho:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
