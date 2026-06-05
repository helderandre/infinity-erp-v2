import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

export async function GET() {
  try {
    const auth = await requirePermission('processes')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()

    // Get all draft proc_instances for the current user
    const { data: drafts, error } = await supabase
      .from('proc_instances')
      .select(`
        id,
        property_id,
        last_completed_step,
        negocio_id,
        created_at,
        updated_at,
        property:dev_properties(
          title,
          property_type,
          city,
          listing_price
        )
      `)
      .eq('current_status', 'draft')
      .eq('requested_by', auth.user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = (drafts || []).map((d: any) => ({
      proc_instance_id: d.id,
      property_id: d.property_id,
      title: d.property?.title || 'Rascunho',
      property_type: d.property?.property_type || null,
      city: d.property?.city || null,
      listing_price: d.property?.listing_price || null,
      last_completed_step: d.last_completed_step || 0,
      negocio_id: d.negocio_id,
      created_at: d.created_at,
      updated_at: d.updated_at,
    }))

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Erro ao listar rascunhos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
