import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { alertService } from '@/lib/alerts/service'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

/**
 * GET /api/alerts/process-pending
 *
 * Processa alertas pendentes do proc_alert_log (overdue + unblock).
 * Chamado pelo cron ou manualmente.
 */
export async function GET() {
  try {
    const supabase = createAdminClient()
    const db = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }

    // Buscar alertas pendentes (max 50 por execução)
    const { data: pendingAlerts, error } = await (db.from('proc_alert_log') as SA)
      .select('id, proc_instance_id, entity_type, entity_id, event_type, metadata')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!pendingAlerts || pendingAlerts.length === 0) {
      return NextResponse.json({ processed: 0 })
    }

    let processed = 0
    let failed = 0

    for (const alert of pendingAlerts) {
      try {
        const metadata = alert.metadata as Record<string, any> || {}
        const alertConfig = metadata.alert_config

        if (!alertConfig?.enabled) {
          // Marcar como skipped se não tem config válida
          await (db.from('proc_alert_log') as SA)
            .update({ status: 'skipped' })
            .eq('id', alert.id)
          continue
        }

        await alertService.processAlert(alertConfig, {
          procInstanceId: alert.proc_instance_id,
          entityType: alert.entity_type,
          entityId: alert.entity_id,
          eventType: alert.event_type,
          title: metadata.title || '',
          processRef: metadata.process_ref || '',
          triggeredBy: metadata.triggered_by || 'system',
          assignedTo: metadata.assigned_to,
        })

        // Marcar como processado
        await (db.from('proc_alert_log') as SA)
          .update({ status: 'sent' })
          .eq('id', alert.id)

        processed++
      } catch (alertError) {
        console.error(`[ProcessPending] Erro ao processar alerta ${alert.id}:`, alertError)

        await (db.from('proc_alert_log') as SA)
          .update({ status: 'failed', metadata: { ...alert.metadata, error: String(alertError) } })
          .eq('id', alert.id)

        failed++
      }
    }

    return NextResponse.json({ processed, failed, total: pendingAlerts.length })
  } catch (error) {
    console.error('[ProcessPending] Erro:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
