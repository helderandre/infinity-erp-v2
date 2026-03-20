import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { updatePropertySchema } from '@/lib/validations/property'
import { requirePermission } from '@/lib/auth/permissions'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('dev_properties')
      .select(
        `*,
        dev_property_specifications(*),
        dev_property_internal(*),
        dev_property_media(*),
        consultant:dev_users!consultant_id(id, commercial_name),
        property_owners(ownership_percentage, is_main_contact, owner_role_id, owners(*))`
      )
      .eq('id', id)
      .order('order_index', { referencedTable: 'dev_property_media', ascending: true })
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao obter imóvel:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const body = await request.json()
    const { property, specifications, internal } = body

    // Update property data
    if (property && Object.keys(property).length > 0) {
      const validation = updatePropertySchema.safeParse(property)
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Dados inválidos', details: validation.error.flatten() },
          { status: 400 }
        )
      }

      const { error } = await supabase
        .from('dev_properties')
        .update(validation.data)
        .eq('id', id)

      if (error) {
        return NextResponse.json(
          { error: 'Erro ao actualizar imóvel', details: error.message },
          { status: 500 }
        )
      }
    }

    // Upsert specifications
    if (specifications && Object.keys(specifications).length > 0) {
      const { error } = await supabase
        .from('dev_property_specifications')
        .upsert({ property_id: id, ...specifications })

      if (error) {
        return NextResponse.json(
          { error: 'Erro ao actualizar especificações', details: error.message },
          { status: 500 }
        )
      }
    }

    // Upsert internal data
    if (internal && Object.keys(internal).length > 0) {
      const { error } = await supabase
        .from('dev_property_internal')
        .upsert({ property_id: id, ...internal })

      if (error) {
        return NextResponse.json(
          { error: 'Erro ao actualizar dados internos', details: error.message },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ id })
  } catch (error) {
    console.error('Erro ao actualizar imóvel:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'cancel'
    const supabase = await createClient()

    if (mode === 'permanent') {
      // Hard delete: remove from DB entirely
      // First nullify NO ACTION foreign keys that would block deletion
      await Promise.all([
        supabase.from('temp_deals').update({ property_id: null }).eq('property_id', id),
        supabase.from('temp_financial_transactions' as any).update({ property_id: null }).eq('property_id', id),
        supabase.from('temp_portal_favorites' as any).update({ property_id: null }).eq('property_id', id),
        supabase.from('temp_requisitions' as any).update({ property_id: null }).eq('property_id', id),
        supabase.from('calendar_events' as any).update({ property_id: null }).eq('property_id', id),
        supabase.from('marketing_campaigns' as any).update({ property_id: null }).eq('property_id', id),
        supabase.from('marketing_content_calendar' as any).update({ property_id: null }).eq('property_id', id),
        supabase.from('marketing_content_requests' as any).update({ property_id: null }).eq('property_id', id),
        supabase.from('marketing_orders' as any).update({ property_id: null }).eq('property_id', id),
        supabase.from('marketing_requests' as any).update({ property_id: null }).eq('property_id', id),
        supabase.from('portal_visit_requests' as any).update({ property_id: null }).eq('property_id', id),
      ])

      // Now delete the property (CASCADE handles specs, internal, media, docs, owners, processes, visits, etc.)
      const { error } = await supabase
        .from('dev_properties')
        .delete()
        .eq('id', id)

      if (error) {
        return NextResponse.json(
          { error: 'Erro ao eliminar imóvel permanentemente', details: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ ok: true, mode: 'permanent' })
    }

    // Soft delete: set status to cancelled
    const { error } = await supabase
      .from('dev_properties')
      .update({ status: 'cancelled' })
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao cancelar imóvel', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, mode: 'cancel' })
  } catch (error) {
    console.error('Erro ao eliminar imóvel:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
