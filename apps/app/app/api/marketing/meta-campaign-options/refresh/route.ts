/**
 * POST /api/marketing/meta-campaign-options/refresh
 *
 * Botão "Actualizar campanhas" no portal de parceiros (e gestão). Dispara um
 * sync INCREMENTAL de campanhas Meta — só pede ao meta-api as campanhas
 * alteradas desde a última sincronização (em vez do histórico todo), pelo que
 * é rápido. As campanhas chegam ao nosso mirror (meta.meta_campaigns_raw) pelos
 * webhooks; o cliente volta a buscar as opções para mostrar a lista actual.
 *
 * O segredo de assinatura/admin do MUBE nunca toca o browser — esta rota
 * server-side é que fala com o meta-api. Acesso: parceiros + gestão (mesmo
 * gate do GET de opções).
 *
 * Resposta 202 { job_id?, since } — o sync corre em background no meta-api.
 */

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { isPartner, isManagementRole } from '@/lib/auth/roles'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { callMubeInternal, resolveConnectionId } from '@/lib/mube/internal-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Quantos dias recuar a partir da última campanha sincronizada — pequena
// margem para apanhar updates de estado/orçamento de campanhas recentes sem
// puxar o histórico todo.
const INCREMENTAL_BUFFER_DAYS = 3
// Janela usada quando ainda não há nenhuma campanha sincronizada (primeira vez).
const COLD_START_DAYS = 90

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function POST() {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const canSeeAll =
      isManagementRole(auth.roles) ||
      auth.permissions.users === true ||
      auth.permissions.marketing === true
    const allowed = canSeeAll || isPartner(auth.roles)
    if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const supabase = createCrmAdminClient()

    // ── Incremental `since`: data da última campanha que já temos, menos uma
    //    pequena margem. Sem campanhas ainda → janela de arranque a frio. ──
    const { data: last } = await supabase
      .schema('meta')
      .from('meta_campaigns_raw')
      .select('received_at')
      .order('received_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const sinceDate = new Date()
    if (last?.received_at) {
      sinceDate.setTime(new Date(last.received_at).getTime())
      sinceDate.setDate(sinceDate.getDate() - INCREMENTAL_BUFFER_DAYS)
    } else {
      sinceDate.setDate(sinceDate.getDate() - COLD_START_DAYS)
    }
    const since = ymd(sinceDate)

    // ── Dispara o sync de campanhas no meta-api (assíncrono). ──
    const connectionId = await resolveConnectionId()
    if (!connectionId) {
      return NextResponse.json(
        { error: 'Sem ligação Meta activa para sincronizar.' },
        { status: 503 },
      )
    }

    const start = await callMubeInternal<{ job_id?: string; status?: string } & Record<string, unknown>>(
      `/api/internal/sync/connection/${connectionId}`,
      {
        method: 'POST',
        body: JSON.stringify({ resources: ['campaigns'], since, async: true }),
      },
    )
    if (!start.ok) {
      console.warn('[meta-campaign-refresh] sync failed', { error: start.error })
      return NextResponse.json(
        { error: 'Não foi possível iniciar a sincronização.', details: start.error },
        { status: 502 },
      )
    }

    return NextResponse.json(
      { job_id: start.data.job_id ?? null, since },
      { status: 202 },
    )
  } catch (error) {
    console.error('Erro ao actualizar campanhas Meta:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
