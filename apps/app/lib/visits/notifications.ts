/**
 * Push notifications para o workflow de visitas.
 *
 * Centraliza as mensagens e os destinos para que cada endpoint da API só
 * tenha de chamar uma função em vez de duplicar título/corpo/URL.
 *
 * Falhas em enviar a notificação NÃO devem fazer falhar a operação principal
 * (criar proposta, confirmar, etc.) — por isso todas as funções aqui dentro
 * fazem swallow de erros e retornam silenciosamente.
 */

import { sendPushToUser } from '@/lib/crm/send-push'
import { notificationService } from '@/lib/notifications/service'
import type { SupabaseClient } from '@supabase/supabase-js'

interface VisitContext {
  id: string
  property_title: string | null
  client_name: string | null
  visit_date: string
  visit_time: string
}

function formatVisitWhen(v: VisitContext): string {
  // "01 Mai · 15:00"
  try {
    const d = new Date(`${v.visit_date}T${v.visit_time}`)
    const day = String(d.getDate()).padStart(2, '0')
    const month = d.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${day} ${month} · ${hh}:${mm}`
  } catch {
    return v.visit_date
  }
}

function visitTitle(v: VisitContext): string {
  return `${v.property_title ?? 'Imóvel'} — ${v.client_name ?? 'Cliente'}`
}

/**
 * 1. Nova proposta criada → notificar o seller agent (push + in-app).
 */
export async function notifyProposalCreated(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  sellerAgentId: string,
  visit: VisitContext,
  buyerAgentId?: string | null,
) {
  const url = `/dashboard/calendario?event=visit:${visit.id}`
  const title = 'Nova proposta de visita'
  const body = `${visitTitle(visit)} · ${formatVisitWhen(visit)}`
  try {
    await sendPushToUser(supabase, sellerAgentId, { title, body, url, tag: `visit-proposal-${visit.id}` })
  } catch (err) {
    console.error('[notifyProposalCreated push]', err)
  }
  try {
    await notificationService.create({
      recipientId: sellerAgentId,
      senderId: buyerAgentId ?? null,
      notificationType: 'visit_proposal_created',
      entityType: 'visit',
      entityId: visit.id,
      title,
      body,
      actionUrl: url,
    })
  } catch (err) {
    console.error('[notifyProposalCreated in-app]', err)
  }
}

/**
 * 2. Proposta confirmada → notificar o buyer agent (push + in-app).
 */
export async function notifyProposalConfirmed(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  buyerAgentId: string,
  visit: VisitContext,
  sellerAgentId?: string | null,
) {
  const url = `/dashboard/calendario?event=visit:${visit.id}`
  const title = 'Visita confirmada'
  const body = `${visitTitle(visit)} · ${formatVisitWhen(visit)}`
  try {
    await sendPushToUser(supabase, buyerAgentId, { title, body, url, tag: `visit-confirmed-${visit.id}` })
  } catch (err) {
    console.error('[notifyProposalConfirmed push]', err)
  }
  try {
    await notificationService.create({
      recipientId: buyerAgentId,
      senderId: sellerAgentId ?? null,
      notificationType: 'visit_proposal_confirmed',
      entityType: 'visit',
      entityId: visit.id,
      title,
      body,
      actionUrl: url,
    })
  } catch (err) {
    console.error('[notifyProposalConfirmed in-app]', err)
  }
}

/**
 * 3. Proposta rejeitada → notificar o buyer agent (push + in-app), com motivo.
 */
export async function notifyProposalRejected(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  buyerAgentId: string,
  visit: VisitContext,
  reason: string,
  sellerAgentId?: string | null,
) {
  const url = `/dashboard/calendario?event=visit:${visit.id}`
  const title = 'Proposta de visita rejeitada'
  const body = `${visitTitle(visit)} · Motivo: ${reason}`
  try {
    await sendPushToUser(supabase, buyerAgentId, { title, body, url, tag: `visit-rejected-${visit.id}` })
  } catch (err) {
    console.error('[notifyProposalRejected push]', err)
  }
  try {
    await notificationService.create({
      recipientId: buyerAgentId,
      senderId: sellerAgentId ?? null,
      notificationType: 'visit_proposal_rejected',
      entityType: 'visit',
      entityId: visit.id,
      title,
      body,
      actionUrl: url,
      metadata: { reason },
    })
  } catch (err) {
    console.error('[notifyProposalRejected in-app]', err)
  }
}

/**
 * 4. Outcome prompt — disparado depois da hora marcada.
 *    Inicialmente vai ao seller agent. Após 12h sem resposta, o cron de
 *    fallback chama de novo com `target = 'buyer'` para notificar a outra parte.
 */
export async function notifyOutcomePrompt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  agentId: string,
  visit: VisitContext,
  target: 'seller' | 'buyer',
) {
  try {
    await sendPushToUser(supabase, agentId, {
      title: target === 'seller'
        ? 'A visita já terminou — desfecho?'
        : 'Visita sem resposta — podes marcar o desfecho',
      body: `${visitTitle(visit)} · ${formatVisitWhen(visit)}`,
      url: `/dashboard/calendario?event=visit:${visit.id}`,
      tag: `visit-outcome-${visit.id}`,
    })
  } catch (err) {
    console.error('[notifyOutcomePrompt]', err)
  }
}

/**
 * 5. Visita marcada como completed → buyer agent recebe link para preencher
 *    a ficha de visita pública.
 */
export async function notifyFichaPending(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  buyerAgentId: string,
  visit: VisitContext & { property_slug: string | null },
) {
  try {
    const fichaUrl = visit.property_slug
      ? `/fichas/${visit.property_slug}?visit=${visit.id}`
      : `/dashboard/calendario?event=visit:${visit.id}`
    await sendPushToUser(supabase, buyerAgentId, {
      title: 'Preenche a ficha de visita',
      body: visitTitle(visit),
      url: fichaUrl,
      tag: `visit-ficha-${visit.id}`,
    })
  } catch (err) {
    console.error('[notifyFichaPending]', err)
  }
}
