import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { upsertOwners } from '@/lib/acquisitions/owners'
import { requirePermission } from '@/lib/auth/permissions'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; stepNumber: string }> }
) {
  try {
    const auth = await requirePermission('processes')
    if (!auth.authorized) return auth.response

    const { id, stepNumber: stepStr } = await params
    const step = parseInt(stepStr, 10)

    if (![1, 2, 3, 4, 5].includes(step)) {
      return NextResponse.json({ error: 'Step inválido' }, { status: 400 })
    }

    const supabase = await createClient()

    // Verify proc_instance exists and belongs to user
    const { data: proc, error: procError } = await supabase
      .from('proc_instances')
      .select('id, property_id, current_status, last_completed_step, requested_by')
      .eq('id', id)
      .single()

    if (procError || !proc) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    if (proc.current_status !== 'draft') {
      return NextResponse.json({ error: 'Processo não é rascunho' }, { status: 400 })
    }

    const body = await request.json()

    // For drafts, accept partial data — full validation happens at finalize
    const data = body

    // Process each step
    switch (step) {
      case 1: {
        const d = data as any
        // Update property
        const { error: propError } = await supabase
          .from('dev_properties')
          .update({
            title: d.title,
            property_type: d.property_type,
            business_type: d.business_type,
            listing_price: d.listing_price,
            description: d.description || null,
            property_condition: d.property_condition || null,
            energy_certificate: d.energy_certificate || null,
          })
          .eq('id', proc.property_id)

        if (propError) {
          return NextResponse.json({ error: propError.message }, { status: 500 })
        }

        // Update specifications
        if (d.specifications) {
          await supabase
            .from('dev_property_specifications')
            .update({
              typology: d.specifications.typology || null,
              bedrooms: d.specifications.bedrooms ?? null,
              bathrooms: d.specifications.bathrooms ?? null,
              area_gross: d.specifications.area_gross ?? null,
              area_util: d.specifications.area_util ?? null,
              construction_year: d.specifications.construction_year ?? null,
              parking_spaces: d.specifications.parking_spaces ?? null,
              garage_spaces: d.specifications.garage_spaces ?? null,
              has_elevator: d.specifications.has_elevator ?? null,
              features: d.specifications.features || null,
            })
            .eq('property_id', proc.property_id)
        }
        break
      }

      case 2: {
        const d = data as any
        const { error: propError } = await supabase
          .from('dev_properties')
          .update({
            address_street: d.address_street,
            city: d.city,
            address_parish: d.address_parish || null,
            postal_code: d.postal_code || null,
            zone: d.zone || null,
            latitude: d.latitude ?? null,
            longitude: d.longitude ?? null,
          })
          .eq('id', proc.property_id)

        if (propError) {
          return NextResponse.json({ error: propError.message }, { status: 500 })
        }
        break
      }

      case 3: {
        const d = data as any
        try {
          await upsertOwners(supabase, proc.property_id, d.owners)
        } catch (ownerErr: any) {
          console.error('[Step 3] Owner upsert failed:', ownerErr.message)
          return NextResponse.json({ error: `Erro nos proprietários: ${ownerErr.message}` }, { status: 500 })
        }
        break
      }

      case 4: {
        const d = data as any
        const { error: intError } = await supabase
          .from('dev_property_internal')
          .update({
            commission_agreed: d.commission_agreed,
            commission_type: d.commission_type || 'percentage',
            contract_regime: d.contract_regime,
            contract_term: d.contract_term || null,
            contract_expiry: d.contract_expiry || null,
            imi_value: d.imi_value ?? null,
            condominium_fee: d.condominium_fee ?? null,
            internal_notes: d.internal_notes || null,
          })
          .eq('property_id', proc.property_id)

        if (intError) {
          return NextResponse.json({ error: intError.message }, { status: 500 })
        }
        break
      }

      case 5: {
        const d = data as any
        if (d.documents && d.documents.length > 0) {
          const { upsertDocuments } = await import('@/lib/acquisitions/documents')
          await upsertDocuments(supabase, proc.property_id, auth.user.id, d.documents)
        }
        break
      }
    }

    // Update last_completed_step
    const newStep = Math.max(proc.last_completed_step || 0, step)
    await supabase
      .from('proc_instances')
      .update({ last_completed_step: newStep })
      .eq('id', id)

    return NextResponse.json({ success: true, last_completed_step: newStep })
  } catch (error) {
    console.error('Erro ao guardar step:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
