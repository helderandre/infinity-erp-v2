// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

/**
 * GET /api/goals/cadence
 *   ?weeks=<n>               (default: 12, max: 26)
 *   &consultant_id=<uuid>    (default: caller; ignorado se scope=team)
 *   &scope=<consultant|team> (default: consultant)
 *
 * Devolve a actividade dos últimos N completos por dia × tipo, agrupada
 * por semana ISO. Cada célula = total de eventos de funil naquele dia.
 *
 * Resposta:
 * {
 *   weeks: 12,
 *   start: '2026-02-04',  // segunda-feira da primeira semana
 *   end:   '2026-04-29',  // hoje
 *   max_count: 7,         // pico para escala de cor
 *   total_count: 184,
 *   days: [{ date: '2026-02-04', count: 3, by_stage: { contactos: 1, visita: 2 } }, ...]
 * }
 */
export async function GET(request: Request) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const weeksParam = parseInt(searchParams.get('weeks') || '12', 10)
    const weeks = Math.max(4, Math.min(26, Number.isFinite(weeksParam) ? weeksParam : 12))

    const scope = searchParams.get('scope') || 'consultant'
    if (!['consultant', 'team'].includes(scope)) {
      return NextResponse.json({ error: 'scope inválido' }, { status: 400 })
    }

    const isManager = auth.roles.some((r) =>
      ['admin', 'Broker/CEO', 'team_leader'].includes(r),
    )
    if (scope === 'team' && !isManager) {
      return NextResponse.json(
        { error: 'Apenas gestores podem ver o agregado da equipa' },
        { status: 403 },
      )
    }

    const requestedConsultantId =
      scope === 'team' ? null : searchParams.get('consultant_id') || auth.user.id
    if (
      scope === 'consultant' &&
      requestedConsultantId !== auth.user.id &&
      !isManager
    ) {
      return NextResponse.json(
        { error: 'Não pode consultar objectivos de outro consultor' },
        { status: 403 },
      )
    }

    // Calcula o início (segunda-feira da semana de hoje - (weeks-1) * 7)
    const today = new Date()
    const dow = today.getUTCDay() // 0=Sun..6=Sat
    const isoDow = dow === 0 ? 7 : dow
    const thisMonday = new Date(today)
    thisMonday.setUTCDate(today.getUTCDate() - (isoDow - 1))
    thisMonday.setUTCHours(0, 0, 0, 0)
    const start = new Date(thisMonday)
    start.setUTCDate(start.getUTCDate() - (weeks - 1) * 7)
    const end = new Date(today)
    end.setUTCHours(23, 59, 59, 999)

    let consultantIds: string[] = []
    if (scope === 'consultant' && requestedConsultantId) {
      consultantIds = [requestedConsultantId]
    } else if (scope === 'team') {
      const { data: rows } = await supabase
        .from('temp_consultant_goals')
        .select('consultant_id')
        .eq('year', today.getUTCFullYear())
        .eq('is_active', true)
      consultantIds = (rows || []).map((r) => r.consultant_id)
    }

    let events: any[] = []
    if (consultantIds.length > 0) {
      const { data } = await supabase
        .from('funnel_events')
        .select('stage_key, occurred_at')
        .in('consultant_id', consultantIds)
        .gte('occurred_at', start.toISOString())
        .lte('occurred_at', end.toISOString())
      events = data || []
    }

    // Agrega por dia (YYYY-MM-DD em UTC, lisbon ~ utc+0/+1; aproximação OK para a heatmap)
    const byDate: Record<string, { count: number; by_stage: Record<string, number> }> = {}
    for (const e of events) {
      const d = new Date(e.occurred_at)
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      if (!byDate[key]) byDate[key] = { count: 0, by_stage: {} }
      byDate[key].count++
      byDate[key].by_stage[e.stage_key] = (byDate[key].by_stage[e.stage_key] || 0) + 1
    }

    // Lista todos os dias do período (mesmo zero) para a UI renderizar a grid completa
    const days: { date: string; count: number; by_stage: Record<string, number> }[] = []
    const cursor = new Date(start)
    while (cursor <= end) {
      const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}`
      const cell = byDate[key] || { count: 0, by_stage: {} }
      days.push({ date: key, count: cell.count, by_stage: cell.by_stage })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    const maxCount = days.reduce((acc, d) => Math.max(acc, d.count), 0)
    const totalCount = days.reduce((acc, d) => acc + d.count, 0)

    return NextResponse.json(
      {
        weeks,
        start: days[0]?.date,
        end: days[days.length - 1]?.date,
        max_count: maxCount,
        total_count: totalCount,
        days,
      },
      { headers: { 'Cache-Control': 'private, max-age=120' } },
    )
  } catch (error) {
    console.error('Erro a calcular cadência:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
