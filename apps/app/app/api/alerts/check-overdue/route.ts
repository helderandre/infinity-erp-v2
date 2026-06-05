import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * GET /api/alerts/check-overdue
 *
 * Chama a função SQL check_overdue_and_unblock_alerts() que detecta
 * tarefas/subtarefas vencidas ou recém-desbloqueadas e insere registos
 * pendentes no proc_alert_log.
 *
 * Depois chama /api/alerts/process-pending para processar os alertas.
 *
 * Deve ser invocado via Vercel Cron (cada hora).
 */
export async function GET(request: Request) {
  try {
    // Verificar segurança (Vercel Cron envia header Authorization)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Chamar função SQL
    const { error } = await supabase.rpc('check_overdue_and_unblock_alerts' as any)

    if (error) {
      console.error('[CheckOverdue] Erro ao executar função SQL:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Processar alertas pendentes imediatamente
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    try {
      const processRes = await fetch(`${baseUrl}/api/alerts/process-pending`)
      const processData = await processRes.json()
      return NextResponse.json({
        overdue_check: 'completed',
        processing: processData,
      })
    } catch (processError) {
      console.error('[CheckOverdue] Erro ao processar pendentes:', processError)
      return NextResponse.json({
        overdue_check: 'completed',
        processing: 'failed_to_trigger',
      })
    }
  } catch (error) {
    console.error('[CheckOverdue] Erro:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
