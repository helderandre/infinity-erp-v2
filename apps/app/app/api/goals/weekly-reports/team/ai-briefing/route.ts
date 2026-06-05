// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { calcSellerFunnel, calcBuyerFunnel, calcFinancial } from '@/lib/goals/calculations'
import type { ConsultantGoal } from '@/types/goal'
import OpenAI from 'openai'

/**
 * POST /api/goals/weekly-reports/team/ai-briefing
 * Generate AI team briefing for the manager's weekly meeting.
 * Body: { week_start: 'YYYY-MM-DD' }
 */
export async function POST(request: Request) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Serviço de IA não configurado' }, { status: 503 })
    }

    const body = await request.json()
    const weekStart = body.week_start

    if (!weekStart) {
      return NextResponse.json({ error: 'week_start é obrigatório' }, { status: 400 })
    }

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    const weekEndStr = weekEnd.toISOString().split('T')[0]
    const year = new Date(weekStart).getFullYear()

    const supabase = await createClient()

    // 1. Get all goals + reports + activities
    const { data: goals } = await supabase
      .from('temp_consultant_goals')
      .select(`
        *,
        consultant:dev_users!temp_consultant_goals_consultant_id_fkey(
          id, commercial_name
        )
      `)
      .eq('year', year)
      .eq('is_active', true)

    if (!goals || goals.length === 0) {
      return NextResponse.json({ briefing: 'Sem objectivos activos para este ano.' })
    }

    const consultantIds = goals.map(g => g.consultant_id)

    const { data: reports } = await supabase
      .from('weekly_reports')
      .select('*')
      .in('consultant_id', consultantIds)
      .eq('week_start', weekStart)

    const { data: activities } = await supabase
      .from('temp_goal_activity_log')
      .select('consultant_id, activity_type, origin_type, quantity, revenue_amount')
      .in('consultant_id', consultantIds)
      .gte('activity_date', weekStart)
      .lte('activity_date', weekEndStr)

    const acts = activities || []
    const reportMap = new Map((reports || []).map(r => [r.consultant_id, r]))

    // 2. Build per-consultant summaries
    const consultantSummaries = goals.map(goal => {
      const g = goal as unknown as ConsultantGoal
      const name = (goal.consultant as any)?.commercial_name || 'N/A'
      const sellerFunnel = calcSellerFunnel(g)
      const buyerFunnel = calcBuyerFunnel(g)

      const cActs = acts.filter(a => a.consultant_id === goal.consultant_id)
      const calls = cActs.filter(a => a.activity_type === 'call').reduce((s, a) => s + (a.quantity || 1), 0)
      const visits = cActs.filter(a => a.activity_type === 'visit').reduce((s, a) => s + (a.quantity || 1), 0)
      const leads = cActs.filter(a => a.activity_type === 'lead_contact').reduce((s, a) => s + (a.quantity || 1), 0)
      const listings = cActs.filter(a => a.activity_type === 'listing').reduce((s, a) => s + (a.quantity || 1), 0)

      const report = reportMap.get(goal.consultant_id)

      return `${name}:
  Chamadas: ${calls}/${Math.ceil(sellerFunnel.weekly.calls + buyerFunnel.weekly.calls)} | Visitas: ${visits}/${Math.ceil(sellerFunnel.weekly.visits)} | Leads: ${leads}/${Math.ceil(sellerFunnel.weekly.leads + buyerFunnel.weekly.leads)} | Angariações: ${listings}/${Math.ceil(sellerFunnel.weekly.listings)}
  Relatório: ${report ? report.status : 'não submetido'}
  ${report?.notes_wins ? `Pontos positivos: ${report.notes_wins}` : ''}
  ${report?.notes_challenges ? `Dificuldades: ${report.notes_challenges}` : ''}`
    })

    // 3. Generate briefing
    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `És um assistente de gestão para uma equipa de consultores imobiliários em Portugal.
Gera um briefing semanal para o Team Leader usar na reunião de equipa.

FORMATO:
1. Visão geral da semana (2-3 frases)
2. Destaques positivos (quem se destacou e porquê)
3. Áreas de atenção (quem precisa de apoio e porquê)
4. Sugestões para a reunião (2-3 pontos de discussão)

REGRAS:
- Tom profissional mas motivador
- Específico com nomes e números
- Máximo 400 palavras
- Português de Portugal`,
        },
        {
          role: 'user',
          content: `Semana: ${weekStart} a ${weekEndStr}\n\n${consultantSummaries.join('\n\n')}`,
        },
      ],
      max_tokens: 800,
      temperature: 0.4,
    })

    const briefing = completion.choices[0]?.message?.content || ''

    return NextResponse.json({ briefing })
  } catch (error) {
    console.error('Erro ao gerar briefing:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
