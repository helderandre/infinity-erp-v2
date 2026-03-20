import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'

// POST /api/deals/[id]/submit — Submit deal, create proc_instance
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    // Fetch the deal
    const { data: deal, error: fetchError } = await supabase
      .from('temp_deals')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !deal) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
    }

    if (deal.status !== 'draft') {
      return NextResponse.json({ error: 'Apenas rascunhos podem ser submetidos' }, { status: 400 })
    }

    // Create proc_instance (same pattern as acquisition)
    const { data: procInstance, error: procError } = await (supabase as any)
      .from('proc_instances')
      .insert({
        property_id: deal.property_id || null,
        tpl_process_id: null, // Template selected on approval (same as acquisition)
        current_status: 'pending_approval',
        process_type: 'negocio',
        requested_by: auth.user.id,
        percent_complete: 0,
        last_completed_step: 0,
      })
      .select('id')
      .single()

    if (procError || !procInstance) {
      return NextResponse.json(
        { error: 'Erro ao criar processo', details: procError?.message },
        { status: 500 }
      )
    }

    // Link proc_instance to deal and update status
    const { error: updateError } = await supabase
      .from('temp_deals')
      .update({
        status: 'submitted',
        proc_instance_id: procInstance.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      deal_id: id,
      proc_instance_id: procInstance.id,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
