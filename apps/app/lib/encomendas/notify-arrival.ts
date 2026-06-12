import { notificationService } from '@/lib/notifications/service'
import { sendPushToUser } from '@/lib/crm/send-push'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Side-effects de chegada de uma encomenda à agência (status → at_store):
 * 1. Tarefa de levantamento no to-do do consultor comprador
 * 2. Notificação in-app
 * 3. Push imediato
 *
 * Best-effort — cada passo falha isolado sem reverter a transição de estado.
 * Chamado pelo PUT /supplier-orders/[id] e pelo POST /receive quando a
 * recepção fica completa.
 */
export async function notifyOrderArrival(
  admin: SupabaseClient,
  params: {
    orderId: string
    agentId: string
    reference: string | null
    actorId: string
  }
): Promise<void> {
  const { orderId, agentId, reference, actorId } = params
  const ref = reference || 'encomenda'
  const db = admin as any

  try {
    // entity_type fica null — o CHECK da tabela tasks não inclui
    // supplier_order; a referência vai no título.
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 2)
    await db.from('tasks').insert({
      title: `Levantar encomenda ${ref} na agência`,
      description:
        'A tua encomenda chegou à agência. Levanta-a e confirma o levantamento em Encomendas → Minhas encomendas.',
      assigned_to: agentId,
      created_by: actorId,
      priority: 2,
      due_date: dueDate.toISOString(),
    })
  } catch (e) {
    console.error('[encomendas] Falha ao criar tarefa de levantamento:', e)
  }

  try {
    await notificationService.create({
      recipientId: agentId,
      senderId: actorId,
      notificationType: 'encomenda_at_store',
      entityType: 'supplier_order',
      entityId: orderId,
      title: 'Encomenda pronta para levantamento',
      body: `A encomenda ${ref} chegou à agência.`,
      actionUrl: '/dashboard/encomendas/minhas',
    })
  } catch (e) {
    console.error('[encomendas] Falha ao criar notificação in-app:', e)
  }

  try {
    await sendPushToUser(admin, agentId, {
      title: 'Encomenda pronta 📦',
      body: `${ref} chegou à agência — passa para levantar.`,
      url: '/dashboard/encomendas/minhas',
      tag: `encomenda-at-store-${orderId}`,
    })
  } catch (e) {
    console.error('[encomendas] Falha ao enviar push:', e)
  }
}
