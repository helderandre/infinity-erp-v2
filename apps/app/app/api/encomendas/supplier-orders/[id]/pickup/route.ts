import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST — consultant marks order as picked up
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const admin = createAdminClient() as any

    // Verify order exists and is at_store
    const { data: order, error: orderErr } = await admin
      .from('temp_supplier_orders')
      .select('id, status, agent_id, reference')
      .eq('id', id)
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Encomenda não encontrada.' }, { status: 404 })
    }

    if (order.status !== 'at_store') {
      return NextResponse.json({ error: 'Encomenda não está na loja.' }, { status: 400 })
    }

    // Update to picked_up
    const { error: updateErr } = await admin
      .from('temp_supplier_orders')
      .update({
        status: 'picked_up',
        delivered_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Fecha a tarefa de levantamento criada na chegada à agência. O título
    // contém a referência única da encomenda — chave de matching suficiente
    // (a tabela tasks não permite entity_type='supplier_order'). Best-effort.
    if (order.agent_id && order.reference) {
      try {
        await admin
          .from('tasks')
          .update({
            is_completed: true,
            completed_at: new Date().toISOString(),
            completed_by: user.id,
          })
          .eq('assigned_to', order.agent_id)
          .eq('is_completed', false)
          .eq('title', `Levantar encomenda ${order.reference} na agência`)
      } catch (e) {
        console.error('[encomendas] Falha ao fechar tarefa de levantamento:', e)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[supplier-order pickup POST]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
