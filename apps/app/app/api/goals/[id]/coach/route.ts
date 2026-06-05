// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import {
  calcFinancial, calcSellerFunnel, calcBuyerFunnel, calcRealityCheck, getGoalStatus,
} from '@/lib/goals/calculations'
import type { ConsultantGoal } from '@/types/goal'
import OpenAI from 'openai'

/**
 * POST /api/goals/[id]/coach
 *
 * AI Coach conversacional para um objetivo específico.
 * Recebe o histórico da conversa e devolve uma resposta contextualizada com
 * o estado actual do objetivo (ritmo, gaps, actividades semanais).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const { id } = await params

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Serviço de IA não configurado' }, { status: 503 })
    }

    const body = await request.json()
    const { messages } = body as { messages: { role: string; content: string }[] }
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Mensagens em falta' }, { status: 400 })
    }

    const supabase = await createClient()

    // 1. Goal
    const { data: goal, error: goalError } = await supabase
      .from('temp_consultant_goals')
      .select(`
        *,
        consultant:dev_users!temp_consultant_goals_consultant_id_fkey(id, commercial_name)
      `)
      .eq('id', id)
      .single()

    if (goalError || !goal) {
      return NextResponse.json({ error: 'Objetivo não encontrado' }, { status: 404 })
    }

    // 2. Activities
    const { data: activities } = await supabase
      .from('temp_goal_activity_log')
      .select('activity_type, revenue_amount, activity_date')
      .eq('consultant_id', goal.consultant_id)
      .gte('activity_date', `${goal.year}-01-01`)
      .lte('activity_date', `${goal.year}-12-31`)

    const acts = activities || []
    const totalRealized = acts
      .filter(a => a.revenue_amount && (a.activity_type === 'sale_close' || a.activity_type === 'buyer_close'))
      .reduce((sum, a) => sum + (a.revenue_amount || 0), 0)

    const financial = calcFinancial(goal as ConsultantGoal)
    const sellerFunnel = calcSellerFunnel(goal as ConsultantGoal)
    const buyerFunnel = calcBuyerFunnel(goal as ConsultantGoal)
    const reality = calcRealityCheck(goal as ConsultantGoal, totalRealized)

    // 3. Today + week
    const today = new Date().toISOString().split('T')[0]
    const todayActs = acts.filter(a => a.activity_date === today)
    const dailyLeads = Math.ceil(sellerFunnel.daily.leads + buyerFunnel.daily.leads)
    const dailyCalls = Math.ceil(sellerFunnel.daily.calls + buyerFunnel.daily.calls)
    const dailyVisits = Math.ceil(sellerFunnel.daily.visits)
    const dailyFollowUps = Math.ceil((sellerFunnel.daily.leads + buyerFunnel.daily.leads) * 0.5)

    const todayLeadsDone = todayActs.filter(a => a.activity_type === 'lead_contact').length
    const todayCallsDone = todayActs.filter(a => a.activity_type === 'call').length
    const todayVisitsDone = todayActs.filter(a => a.activity_type === 'visit').length
    const todayFollowUpsDone = todayActs.filter(a => a.activity_type === 'follow_up').length

    const fmt = (n: number) => new Intl.NumberFormat('pt-PT', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
    }).format(n)

    const consultantName = goal.consultant?.commercial_name || 'o consultor'

    const systemPrompt = `És um coach comercial directo e prático que ajuda ${consultantName} a atingir os objetivos dele para ${goal.year}.

ESTADO ACTUAL DO OBJETIVO:
- Objetivo anual: ${fmt(financial.annual.total)} (Vendedores ${goal.pct_sellers}% · Compradores ${goal.pct_buyers}%)
- Realizado YTD: ${fmt(reality.total_realized)} (${reality.pct_achieved.toFixed(0)}% do esperado a esta altura)
- Projeção fim de ano a este ritmo: ${fmt(reality.projected_annual)}
- Status: ${reality.status === 'green' ? 'Em rota' : reality.status === 'orange' ? 'A acompanhar' : 'Atrás do ritmo'}
- Objetivo semanal: ${fmt(financial.weekly.total)}
- Objetivo diário: ${fmt(financial.daily.total)}

ACÇÕES DE HOJE (feito / objetivo):
- Leads a contactar: ${todayLeadsDone} / ${dailyLeads} (${getGoalStatus(todayLeadsDone, dailyLeads)})
- Chamadas: ${todayCallsDone} / ${dailyCalls} (${getGoalStatus(todayCallsDone, dailyCalls)})
- Visitas: ${todayVisitsDone} / ${dailyVisits} (${getGoalStatus(todayVisitsDone, dailyVisits)})
- Follow-ups: ${todayFollowUpsDone} / ${dailyFollowUps} (${getGoalStatus(todayFollowUpsDone, dailyFollowUps)})

ESTILO:
- Responde sempre em PT-PT.
- Sê directo, conciso, accionável. Evita conselhos genéricos.
- Quando ele perguntar "porque estou atrás" ou similar, diagnostica com base nos números acima (qual a fase do funil mais fraca? está em défice de actividade ou de conversão?).
- Quando ele perguntar "o que fazer hoje/amanhã", aponta para a acção concreta com maior gap.
- Se ele te pedir para registar actividades, diz-lhe que tem de o fazer no botão "Registar" — não tens essa capacidade.
- Não inventes números. Se não tiveres dados, diz-lhe.
- Mantém respostas curtas (máximo 4 linhas) excepto se ele pedir detalhe.`

    const openai = new OpenAI({ apiKey })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
      max_tokens: 400,
      temperature: 0.4,
    })

    const reply = completion.choices[0]?.message?.content || 'Sem resposta.'

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('Erro no AI Coach de objetivos:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
