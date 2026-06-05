import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser } from '@/lib/crm/send-push'

/**
 * Cron endpoint — runs every 1 min via Coolify Scheduled Task.
 *
 * Dispatches Web Push for notifications created by SQL triggers (which
 * cannot call web-push directly). Filters to the new owner-submission
 * notification types so we don't double-send for any other notifications
 * already dispatched eagerly in TS handlers.
 *
 * Auth: GET /api/cron/dispatch-pending-push?key=<CRON_SECRET>
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && key !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient() as any
    const ELIGIBLE_TYPES = [
      'owner_doc_submitted',
      'owner_cmi_signed',
      'owner_field_edited',
      // ai_jobs queue: trigger insere row em notifications quando o job
      // termina; o cron entrega o push.
      'ai_job_completed',
    ] as const

    const { data: pending, error } = await admin
      .from('notifications')
      .select('id, recipient_id, notification_type, title, body, action_url, entity_id')
      .eq('push_dispatched', false)
      .in('notification_type', ELIGIBLE_TYPES as unknown as string[])
      .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) {
      console.error('[dispatch-pending-push] fetch:', error.message)
      return NextResponse.json({ error: 'Erro a carregar notificações pendentes' }, { status: 500 })
    }

    if (!pending?.length) {
      return NextResponse.json({ processed: 0, sent_total: 0, failed_total: 0 })
    }

    let sentTotal = 0
    let failedTotal = 0

    for (const n of pending as Array<{
      id: string
      recipient_id: string
      notification_type: string
      title: string
      body: string | null
      action_url: string
      entity_id: string
    }>) {
      try {
        const sent = await sendPushToUser(admin, n.recipient_id, {
          title: n.title,
          body: n.body ?? '',
          url: n.action_url,
          tag: `${n.notification_type}:${n.entity_id}`,
        })
        sentTotal += sent
      } catch (err: any) {
        console.error('[dispatch-pending-push] sendPush:', err?.message ?? err)
        failedTotal++
      }

      // Mark dispatched even when sent=0 (no subscriptions) to avoid re-trying forever.
      const { error: updErr } = await admin
        .from('notifications')
        .update({ push_dispatched: true })
        .eq('id', n.id)

      if (updErr) {
        console.error('[dispatch-pending-push] mark dispatched:', updErr.message)
      }
    }

    return NextResponse.json({
      processed: pending.length,
      sent_total: sentTotal,
      failed_total: failedTotal,
    })
  } catch (err: any) {
    console.error('[dispatch-pending-push] error:', err?.message ?? err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
