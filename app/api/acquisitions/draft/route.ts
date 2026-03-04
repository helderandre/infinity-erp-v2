import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { prefillData, negocioId } = body as {
      prefillData?: Record<string, any>
      negocioId?: string
    }

    // 1. Create property with draft status
    const { data: property, error: propertyError } = await supabase
      .from('dev_properties')
      .insert({
        title: prefillData?.title || 'Rascunho',
        property_type: prefillData?.property_type || null,
        business_type: prefillData?.business_type || 'venda',
        listing_price: prefillData?.listing_price || null,
        description: prefillData?.description || null,
        property_condition: prefillData?.property_condition || null,
        energy_certificate: prefillData?.energy_certificate || null,
        city: prefillData?.city || null,
        zone: prefillData?.zone || null,
        address_street: prefillData?.address_street || null,
        address_parish: prefillData?.address_parish || null,
        postal_code: prefillData?.postal_code || null,
        latitude: prefillData?.latitude || null,
        longitude: prefillData?.longitude || null,
        consultant_id: user.id,
        status: 'draft',
      })
      .select('id')
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        { error: 'Erro ao criar rascunho', details: propertyError?.message },
        { status: 500 }
      )
    }

    // 2. Create empty specifications
    const specs = prefillData?.specifications || {}
    await supabase.from('dev_property_specifications').insert({
      property_id: property.id,
      typology: specs.typology || null,
      bedrooms: specs.bedrooms || null,
      bathrooms: specs.bathrooms || null,
      area_gross: specs.area_gross || null,
      area_util: specs.area_util || null,
      construction_year: specs.construction_year || null,
      parking_spaces: specs.parking_spaces || null,
      garage_spaces: specs.garage_spaces || null,
      has_elevator: specs.has_elevator || null,
      features: specs.features || null,
    })

    // 3. Create empty internal data
    await supabase.from('dev_property_internal').insert({
      property_id: property.id,
    })

    // 4. Create proc_instance with draft status
    const { data: procInstance, error: procError } = await supabase
      .from('proc_instances')
      .insert({
        property_id: property.id,
        tpl_process_id: null,
        current_status: 'draft',
        requested_by: user.id,
        percent_complete: 0,
        last_completed_step: 0,
        negocio_id: negocioId || null,
      })
      .select('id')
      .single()

    if (procError || !procInstance) {
      return NextResponse.json(
        { error: 'Erro ao criar processo', details: procError?.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      property_id: property.id,
      proc_instance_id: procInstance.id,
    })
  } catch (error) {
    console.error('Erro ao criar rascunho:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
