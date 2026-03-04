import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { notificationService } from '@/lib/notifications/service'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Load the proc_instance
    const { data: proc, error: procError } = await supabase
      .from('proc_instances')
      .select('id, property_id, current_status')
      .eq('id', id)
      .single()

    if (procError || !proc) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    if (proc.current_status !== 'draft') {
      return NextResponse.json({ error: 'Processo não é rascunho' }, { status: 400 })
    }

    // Validate required fields are present
    const { data: property } = await supabase
      .from('dev_properties')
      .select('id, title, property_type, business_type, listing_price, address_street, city')
      .eq('id', proc.property_id)
      .single()

    if (!property) {
      return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 })
    }

    const missingFields: string[] = []
    if (!property.title || property.title === 'Rascunho') missingFields.push('título')
    if (!property.property_type) missingFields.push('tipo de imóvel')
    if (!property.business_type) missingFields.push('tipo de negócio')
    if (!property.listing_price) missingFields.push('preço')
    if (!property.address_street) missingFields.push('morada')
    if (!property.city) missingFields.push('cidade')

    // Check owners
    const { count: ownerCount } = await supabase
      .from('property_owners')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', proc.property_id)

    if (!ownerCount || ownerCount === 0) missingFields.push('proprietários')

    // Check contract
    const { data: internal } = await supabase
      .from('dev_property_internal')
      .select('contract_regime, commission_agreed')
      .eq('property_id', proc.property_id)
      .single()

    if (!internal?.contract_regime) missingFields.push('regime de contrato')
    if (internal?.commission_agreed == null) missingFields.push('comissão')

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Campos obrigatórios em falta: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    // Transition to pending_approval
    const [propUpdate, procUpdate] = await Promise.all([
      supabase
        .from('dev_properties')
        .update({ status: 'pending_approval' })
        .eq('id', proc.property_id),
      supabase
        .from('proc_instances')
        .update({ current_status: 'pending_approval' })
        .eq('id', id),
    ])

    if (propUpdate.error || procUpdate.error) {
      return NextResponse.json(
        { error: 'Erro ao finalizar', details: propUpdate.error?.message || procUpdate.error?.message },
        { status: 500 }
      )
    }

    // Send notifications
    try {
      const approverIds = await notificationService.getUserIdsByRoles(['Broker/CEO', 'Gestora Processual'])
      if (approverIds.length > 0) {
        await notificationService.createBatch(approverIds, {
          senderId: user.id,
          notificationType: 'process_created',
          entityType: 'proc_instance',
          entityId: id,
          title: 'Nova angariação submetida',
          body: `${property.title} — aguarda aprovação`,
          actionUrl: `/dashboard/processos/${id}`,
          metadata: { property_title: property.title },
        })
      }
    } catch (notifError) {
      console.error('[Finalize] Erro ao enviar notificações:', notifError)
    }

    return NextResponse.json({
      success: true,
      proc_instance_id: id,
      property_id: proc.property_id,
      message: 'Angariação submetida com sucesso',
    })
  } catch (error) {
    console.error('Erro ao finalizar angariação:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
