import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyOutcomePrompt } from '@/lib/visits/notifications'

/**
 * Cron endpoint — corre a cada ~30min via Coolify/external cron.
 *
 * Trata dois prompts diferentes para visitas em estado `scheduled` cuja hora
 * já passou e que ainda não têm `outcome_set_at`:
 *
 * 1) Prompt inicial ao SELLER agent — disparado uma única vez, assim que a
 *    visita termina (visita_end < now). Marca-se através de uma coluna
 *    sentinela? Não temos uma — em vez disso, usamos a coluna
 *    `outcome_prompt_fallback_sent_at`: enquanto for NULL, ainda não fizemos
 *    fallback nenhum, mas o seller agent já recebeu o prompt inicial via cron.
 *
 *    Para evitar re-enviar o prompt inicial em cada tick, usamos uma janela:
 *    só notifica se a visita acabou nos últimos 30min.
 *
 * 2) Fallback ao BUYER agent — disparado uma única vez, 12h depois da hora
 *    da visita, se o seller agent ainda não tiver registado outcome.
 *    `outcome_prompt_fallback_sent_at` é populado para garantir idempotência.
 *
 * Call: GET /api/cron/visit-outcomes?key=<CRON_SECRET>
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
    const now = new Date()
    const PROMPT_WINDOW_MIN = 30 // janela para o prompt inicial ao seller
    const FALLBACK_DELAY_HOURS = 12

    // ------ Query base: visitas scheduled sem outcome ainda ------
    // Filtra por data até hoje (para reduzir o conjunto), e refinamos
    // o tempo no JS porque visit_date e visit_time são colunas separadas.
    const todayISO = now.toISOString().slice(0, 10)
    const { data: visits, error } = await admin
      .from('visits')
      .select(`
        id, visit_date, visit_time, duration_minutes,
        consultant_id, seller_consultant_id, client_name,
        outcome_prompt_fallback_sent_at,
        property:dev_properties!visits_property_id_fkey(title),
        lead:leads!visits_lead_id_fkey(nome)
      `)
      .eq('status', 'scheduled')
      .is('outcome_set_at', null)
      .lte('visit_date', todayISO)

    if (error) {
      console.error('[cron/visit-outcomes]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let initialSent = 0
    let fallbackSent = 0

    for (const v of visits ?? []) {
      const startMs = new Date(`${v.visit_date}T${v.visit_time}`).getTime()
      const endMs = startMs + (v.duration_minutes ?? 30) * 60_000
      const minutesSinceEnd = (now.getTime() - endMs) / 60_000

      if (minutesSinceEnd < 0) continue // ainda não terminou

      const ctx = {
        id: v.id,
        property_title: (v.property as { title?: string } | null)?.title ?? null,
        client_name: (v.lead as { nome?: string } | null)?.nome ?? v.client_name ?? null,
        visit_date: v.visit_date,
        visit_time: v.visit_time,
      }

      // 1) Prompt inicial ao seller — janela de 30min após o fim da visita
      if (minutesSinceEnd <= PROMPT_WINDOW_MIN && v.seller_consultant_id) {
        await notifyOutcomePrompt(admin, v.seller_consultant_id, ctx, 'seller')
        initialSent++
        continue
      }

      // 2) Fallback ao buyer — 12h depois da hora marcada, e ainda não enviado
      const fallbackDueMs = endMs + FALLBACK_DELAY_HOURS * 60 * 60 * 1000
      if (
        now.getTime() >= fallbackDueMs &&
        !v.outcome_prompt_fallback_sent_at &&
        v.consultant_id
      ) {
        await notifyOutcomePrompt(admin, v.consultant_id, ctx, 'buyer')
        // Marcar para nunca mais enviar
        await admin
          .from('visits')
          .update({ outcome_prompt_fallback_sent_at: now.toISOString() })
          .eq('id', v.id)
        fallbackSent++
      }
    }

    return NextResponse.json({
      checked: visits?.length ?? 0,
      initial_sent: initialSent,
      fallback_sent: fallbackSent,
    })
  } catch (err) {
    console.error('[cron/visit-outcomes]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
