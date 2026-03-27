// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { calcSellerFunnel, calcBuyerFunnel, calcFinancial, calcRealityCheck } from '@/lib/goals/calculations'
import type { ConsultantGoal } from '@/types/goal'
import OpenAI from 'openai'

/**
 * POST /api/goals/weekly-reports/[id]/ai-advice
 * Generate AI coaching advice for a consultant based on their data.
 * Body: { type: 'weekly' | 'monthly' | 'manager_prep' }
 * Saves advice to the report's ai_advice field.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Serviço de IA não configurado' }, { status: 503 })
    }

    const { id } = await params
    const body = await request.json()
    const adviceType = body.type || 'weekly'

    const supabase = await createClient()

    // 1. Get the report
    const { data: report, error: reportErr } = await supabase
      .from('weekly_reports')
      .select('*')
      .eq('id', id)
      .single()

    if (reportErr || !report) {
      return NextResponse.json({ error: 'Relatório não encontrado' }, { status: 404 })
    }

    // 2. Get the goal
    const { data: goal, error: goalErr } = await supabase
      .from('temp_consultant_goals')
      .select(`
        *,
        consultant:dev_users!temp_consultant_goals_consultant_id_fkey(
          id, commercial_name
        )
      `)
      .eq('consultant_id', report.consultant_id)
      .eq('year', new Date(report.week_start).getFullYear())
      .eq('is_active', true)
      .single()

    if (goalErr || !goal) {
      return NextResponse.json({ error: 'Objetivo não encontrado' }, { status: 404 })
    }

    const g = goal as unknown as ConsultantGoal
    const financial = calcFinancial(g)
    const sellerFunnel = calcSellerFunnel(g)
    const buyerFunnel = calcBuyerFunnel(g)

    // 3. Get last 8 weeks of activities for trend analysis
    const weekStart = new Date(report.week_start)
    const eightWeeksAgo = new Date(weekStart)
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    const { data: activities } = await supabase
      .from('temp_goal_activity_log')
      .select('activity_type, origin, origin_type, quantity, activity_date, revenue_amount')
      .eq('consultant_id', report.consultant_id)
      .gte('activity_date', eightWeeksAgo.toISOString().split('T')[0])
      .lte('activity_date', weekEnd.toISOString().split('T')[0])

    const acts = activities || []

    // 4. Get year-to-date revenue for reality check
    const yearStart = `${goal.year}-01-01`
    const totalRealized = acts
      .filter(a => a.revenue_amount && a.activity_date >= yearStart &&
        (a.activity_type === 'sale_close' || a.activity_type === 'buyer_close'))
      .reduce((sum, a) => sum + (a.revenue_amount || 0), 0)

    const realityCheck = calcRealityCheck(g, totalRealized)

    // 5. Aggregate weekly trends
    const weeklyTrends: Record<string, Record<string, number>> = {}
    for (const act of acts) {
      const actDate = new Date(act.activity_date)
      const dow = actDate.getDay()
      const mondayOff = dow === 0 ? -6 : 1 - dow
      const monday = new Date(actDate)
      monday.setDate(actDate.getDate() + mondayOff)
      const weekKey = monday.toISOString().split('T')[0]

      if (!weeklyTrends[weekKey]) weeklyTrends[weekKey] = {}
      weeklyTrends[weekKey][act.activity_type] = (weeklyTrends[weekKey][act.activity_type] || 0) + (act.quantity || 1)
    }

    // 6. Get team averages for benchmarking
    const { data: teamGoals } = await supabase
      .from('temp_consultant_goals')
      .select('consultant_id')
      .eq('year', goal.year)
      .eq('is_active', true)
      .neq('consultant_id', report.consultant_id)

    const teamIds = (teamGoals || []).map(tg => tg.consultant_id)
    let teamAvgData = ''

    if (teamIds.length > 0) {
      const { data: teamActs } = await supabase
        .from('temp_goal_activity_log')
        .select('consultant_id, activity_type, quantity')
        .in('consultant_id', teamIds)
        .gte('activity_date', report.week_start)
        .lte('activity_date', weekEnd.toISOString().split('T')[0])

      if (teamActs && teamActs.length > 0) {
        const teamTotals: Record<string, number> = {}
        for (const a of teamActs) {
          teamTotals[a.activity_type] = (teamTotals[a.activity_type] || 0) + (a.quantity || 1)
        }
        const n = teamIds.length
        teamAvgData = Object.entries(teamTotals)
          .map(([type, total]) => `${type}: ${(total / n).toFixed(1)} média/consultor`)
          .join(', ')
      }
    }

    // 7. Build context for AI
    const consultantName = (goal.consultant as any)?.commercial_name || 'o consultor'
    const currentWeekActs = acts.filter(a => a.activity_date >= report.week_start && a.activity_date <= weekEnd.toISOString().split('T')[0])
    const weekSummary = Object.entries(
      currentWeekActs.reduce((acc, a) => {
        acc[a.activity_type] = (acc[a.activity_type] || 0) + (a.quantity || 1)
        return acc
      }, {} as Record<string, number>)
    ).map(([type, count]) => `${type}: ${count}`).join(', ')

    const weeklyTargets = `chamadas: ${Math.ceil(sellerFunnel.weekly.calls + buyerFunnel.weekly.calls)}, leads: ${Math.ceil(sellerFunnel.weekly.leads + buyerFunnel.weekly.leads)}, visitas: ${Math.ceil(sellerFunnel.weekly.visits)}, angariações: ${Math.ceil(sellerFunnel.weekly.listings)}`

    const trendsStr = Object.entries(weeklyTrends)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, data]) => `${week}: ${JSON.stringify(data)}`)
      .join('\n')

    const systemPrompts: Record<string, string> = {
      weekly: `És um coach de negócio imobiliário experiente no mercado português. Analisa os dados do consultor e dá 2-3 conselhos específicos e accionáveis para a próxima semana.

REGRAS:
- Sê directo mas encorajador
- Referencia números concretos (não dês conselhos genéricos como "faz mais chamadas")
- Compara com médias de equipa quando relevante
- Se o consultor está a ir bem, reconhece e sugere como manter/melhorar
- Se há área fraca, identifica a causa provável e sugere solução prática
- Máximo 300 palavras total
- Responde em Português de Portugal
- Retorna JSON: {"weekly_tips": ["..."], "strengths": ["..."], "focus_areas": ["..."]}`,

      monthly: `És um coach de negócio imobiliário sénior no mercado português. Faz uma análise profunda do funil e das tendências do consultor.

REGRAS:
- Analisa taxas de conversão reais vs targets
- Identifica gargalos no funil (onde está a perder mais)
- Sugere acções estratégicas (não tácticas)
- Máximo 400 palavras
- Responde em Português de Portugal
- Retorna JSON: {"weekly_tips": ["..."], "strengths": ["..."], "focus_areas": ["..."]}`,

      manager_prep: `És um coach executivo que ajuda team leaders de imobiliárias em Portugal. Prepara pontos de conversa para um 1:1 com o consultor.

REGRAS:
- Tom construtivo e orientado para soluções
- Identifica padrões (positivos e negativos)
- Sugere perguntas a fazer ao consultor
- Sugere acções concretas que o manager pode tomar
- Máximo 300 palavras
- Responde em Português de Portugal
- Retorna JSON: {"weekly_tips": ["..."], "strengths": ["..."], "focus_areas": ["..."], "manager_talking_points": ["..."]}`,
    }

    const userContext = `Consultor: ${consultantName}
Semana: ${report.week_start}

Actividades desta semana: ${weekSummary || '(nenhuma)'}
Targets semanais: ${weeklyTargets}

Notas do consultor:
- O que correu bem: ${report.notes_wins || '(não preenchido)'}
- Dificuldades: ${report.notes_challenges || '(não preenchido)'}
- Plano próxima semana: ${report.notes_next_week || '(não preenchido)'}

Reality check anual: ${realityCheck.pct_achieved.toFixed(0)}% do target (${realityCheck.status})
${realityCheck.message}

Tendências últimas 8 semanas:
${trendsStr || '(sem dados)'}

${teamAvgData ? `Médias da equipa esta semana: ${teamAvgData}` : ''}`

    // 8. Call OpenAI
    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompts[adviceType] || systemPrompts.weekly },
        { role: 'user', content: userContext },
      ],
      max_tokens: 800,
      temperature: 0.4,
    })

    const text = completion.choices[0]?.message?.content || ''
    let advice
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      advice = JSON.parse(cleaned)
    } catch {
      advice = { weekly_tips: [text], strengths: [], focus_areas: [] }
    }

    // 9. Save AI advice to the report
    const aiAdviceStr = JSON.stringify(advice)
    await supabase
      .from('weekly_reports')
      .update({
        ai_advice: aiAdviceStr,
        ai_summary: `Gerado em ${new Date().toISOString()} (${adviceType})`,
      })
      .eq('id', id)

    return NextResponse.json(advice)
  } catch (error) {
    console.error('Erro ao gerar conselho IA:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
