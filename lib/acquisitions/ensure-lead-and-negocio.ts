import type { SupabaseClient } from '@supabase/supabase-js'

const PIPELINE_STAGE_VENDEDOR_ANGARIACAO = 'f2c9ab0e-e7d6-4564-b529-0ca91d705138'
const PIPELINE_STAGE_ARRENDADOR_ANGARIACAO = 'd450fbef-e7d7-4a1f-a18c-9d6eb64ba3fe'

function mapBusinessTypeToTipo(businessType: string | null | undefined) {
  if (businessType === 'arrendamento') return 'Arrendador'
  return 'Venda'
}

function mapBusinessTypeToStageId(businessType: string | null | undefined) {
  if (businessType === 'arrendamento') return PIPELINE_STAGE_ARRENDADOR_ANGARIACAO
  return PIPELINE_STAGE_VENDEDOR_ANGARIACAO
}

function mapBusinessTypeToLeadType(businessType: string | null | undefined) {
  if (businessType === 'arrendamento') return 'landlord'
  return 'seller'
}

export async function ensureLeadAndNegocioForAcquisition(
  supabase: SupabaseClient,
  args: {
    procInstanceId: string
    propertyId: string
    consultantId: string
  },
): Promise<{ leadId: string; negocioId: string } | null> {
  const { procInstanceId, propertyId, consultantId } = args

  const { data: mainLink } = await supabase
    .from('property_owners')
    .select('owner_id, owners(*)')
    .eq('property_id', propertyId)
    .eq('is_main_contact', true)
    .maybeSingle()

  let owner: any = (mainLink as any)?.owners || null

  if (!owner) {
    const { data: anyLink } = await supabase
      .from('property_owners')
      .select('owner_id, owners(*)')
      .eq('property_id', propertyId)
      .limit(1)
      .maybeSingle()
    owner = (anyLink as any)?.owners || null
  }

  if (!owner || !owner.name) {
    console.error('[ensureLeadAndNegocio] no owner found for property', propertyId)
    return null
  }

  const { data: property } = await supabase
    .from('dev_properties')
    .select('id, business_type, listing_price, address_street, city, zone, postal_code, property_type')
    .eq('id', propertyId)
    .single()

  if (!property) {
    console.error('[ensureLeadAndNegocio] property not found', propertyId)
    return null
  }

  let resolvedLeadId: string | null = null

  if (owner.nif && /^\d{9}$/.test(String(owner.nif))) {
    const { data: byNif } = await supabase
      .from('leads')
      .select('id')
      .eq('nif', owner.nif)
      .maybeSingle()
    if (byNif) resolvedLeadId = byNif.id
  }

  if (!resolvedLeadId && owner.email) {
    const { data: byEmail } = await supabase
      .from('leads')
      .select('id')
      .eq('email', owner.email)
      .maybeSingle()
    if (byEmail) resolvedLeadId = byEmail.id
  }

  if (!resolvedLeadId) {
    const { data: newLead, error: leadErr } = await supabase
      .from('leads')
      .insert({
        nome: owner.name,
        full_name: owner.name,
        email: owner.email || null,
        telemovel: owner.phone || null,
        telefone: owner.phone || null,
        nif: owner.nif || null,
        nacionalidade: owner.nationality || null,
        codigo_postal: owner.postal_code || null,
        localidade: owner.city || null,
        morada: owner.address || null,
        agent_id: consultantId,
        origem: 'Angariação',
        lead_type: mapBusinessTypeToLeadType(property.business_type),
        estado: 'Lead',
      })
      .select('id')
      .single()

    if (leadErr || !newLead) {
      console.error('[ensureLeadAndNegocio] failed to create lead:', leadErr)
      return null
    }
    resolvedLeadId = newLead.id
  }

  const leadId: string = resolvedLeadId!

  const tipo = mapBusinessTypeToTipo(property.business_type)
  const stageId = mapBusinessTypeToStageId(property.business_type)
  const localizacao =
    [property.address_street, property.zone, property.city]
      .filter((v) => typeof v === 'string' && v.trim().length > 0)
      .join(', ') || property.city || null

  const negocioInsert: Record<string, any> = {
    lead_id: leadId,
    tipo,
    estado: 'Aberto',
    pipeline_stage_id: stageId,
    property_id: propertyId,
    assigned_consultant_id: consultantId,
    tipo_imovel_venda: property.property_type || null,
    localizacao_venda: localizacao,
    origem: 'Angariação',
  }

  if (property.business_type === 'arrendamento') {
    negocioInsert.renda_pretendida = property.listing_price || null
  } else {
    negocioInsert.preco_venda = property.listing_price || null
  }

  const { data: newNegocio, error: negocioErr } = await supabase
    .from('negocios')
    .insert(negocioInsert)
    .select('id')
    .single()

  if (negocioErr || !newNegocio) {
    console.error('[ensureLeadAndNegocio] failed to create negocio:', negocioErr)
    return null
  }

  const { error: linkErr } = await supabase
    .from('proc_instances')
    .update({ negocio_id: newNegocio.id })
    .eq('id', procInstanceId)

  if (linkErr) {
    console.error('[ensureLeadAndNegocio] failed to link proc_instance:', linkErr)
  }

  return { leadId, negocioId: newNegocio.id }
}
