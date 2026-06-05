// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { requirePermission } from '@/lib/auth/permissions'
import { computeAgentGoalTargets } from '@/lib/goals/v2/compute-targets'

const STAGE_LABELS_PT: Record<string, string> = {
  contacto: 'contactos',
  pre_angariacao: 'pré-angariações',
  estudo: 'estudos de mercado',
  angariacao: 'angariações',
  pesquisa: 'pesquisas',
  visita: 'visitas',
  proposta: 'propostas',
  cpcv: 'CPCVs',
  fecho: 'fechos',
}

// POST /api/agent-weekly-reports/ai-summary
// Body: { week_start: 'YYYY-MM-DD' }
// Returns: { ai_summary, ai_advice }
export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Serviço de IA não configurado' }, { status: 503 })
    }

    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const body = await request.json()
    const weekStart = body?.week_start
    if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return NextResponse.json({ error: 'week_start inválido' }, { status: 400 })
    }

    const supabase = await createClient()
    const agentId = auth.user.id

    // Fetch context: this year's goal + week's events + the report's notes
    const year = Number(weekStart.slice(0, 4))
    const { data: goalRow } = await supabase
      .from('agent_goals')
      .select('*')
      .eq('agent_id', agentId)
      .eq('period_year', year)
      .maybeSingle()

    const { data: report } = await supabase
      .from('agent_weekly_reports')
      .select('*')
      .eq('agent_id', agentId)
      .eq('week_start', weekStart)
      .maybeSingle()

    // Bound the week
    const monday = new Date(`${weekStart}T00:00:00Z`)
    const sundayEnd = new Date(monday)
    sundayEnd.setUTCDate(sundayEnd.getUTCDate() + 7)

    const { data: events } = await supabase
      .from('agent_funnel_events')
      .select('side, stage, count, source')
      .eq('agent_id', agentId)
      .gte('occurred_at', monday.toISOString())
      .lt('occurred_at', sundayEnd.toISOString())

    // Build aggregates by side+stage
    const counts: Record<string, Record<string, number>> = { vendedor: {}, comprador: {} }
    let manualCount = 0
    let autoCount = 0
    for (const e of events ?? []) {
      counts[e.side] = counts[e.side] ?? {}
      counts[e.side][e.stage] = (counts[e.side][e.stage] ?? 0) + (e.count ?? 0)
      if (e.source === 'manual') manualCount += e.count ?? 0
      else autoCount += e.count ?? 0
    }

    const targets = goalRow ? computeAgentGoalTargets(goalRow) : null
    const weeks = goalRow?.working_weeks_per_year || 48
    const weeklyTarget = (n: number) => Math.round((n / weeks) * 10) / 10

    const targetLines: string[] = []
    if (targets) {
      targetLines.push('Vendedor (alvos semanais):')
      targetLines.push(`  Contactos: ${weeklyTarget(targets.vend_target_contactos)}`)
      targetLines.push(`  Visitas: ${weeklyTarget(targets.vend_target_visitas)}`)
      targetLines.push(`  Angariações: ${weeklyTarget(targets.vend_target_angariacoes)}`)
      targetLines.push(`  Fechos: ${weeklyTarget(targets.vend_target_escrituras)}`)
      targetLines.push('Comprador (alvos semanais):')
      targetLines.push(`  Contactos: ${weeklyTarget(targets.comp_target_contactos)}`)
      targetLines.push(`  Visitas: ${weeklyTarget(targets.comp_target_visitas)}`)
      targetLines.push(`  Fechos: ${weeklyTarget(targets.comp_target_escrituras)}`)
    }

    const realizedLines: string[] = []
    for (const side of ['vendedor', 'comprador']) {
      const stages = counts[side] ?? {}
      const items = Object.entries(stages)
        .map(([stage, n]) => `${n} ${STAGE_LABELS_PT[stage] ?? stage}`)
        .join(', ')
      if (items) realizedLines.push(`${side === 'vendedor' ? 'Vendedor' : 'Comprador'}: ${items}`)
    }

    const notesBlock = [
      report?.notes_wins && `Vitórias da semana: ${report.notes_wins}`,
      report?.notes_challenges && `Desafios: ${report.notes_challenges}`,
      report?.notes_next_week && `Plano para a próxima semana: ${report.notes_next_week}`,
    ].filter(Boolean).join('\n')

    const prompt = `És um coach de consultor imobiliário em Portugal. Analisa a semana do consultor e devolve:
1. Um resumo conciso (3-4 frases) sobre como correu a semana, em PT-PT.
2. Pontos fortes (o que correu bem) — máximo 3 bullets curtos.
3. Áreas de foco (onde melhorar) — máximo 3 bullets curtos.
4. Dicas accionáveis para a próxima semana — máximo 3 bullets concretos e específicos.

Cruza SEMPRE as notas do consultor com a atividade efectivamente registada:
- Se o consultor afirma ter feito muito de uma actividade mas o número
  registado é baixo, sinaliza-o de forma construtiva como área de foco
  (ex.: "registar contactos no momento — só 2 estão registados apesar
  de mencionares ter feito muitos").
- Se o consultor menciona desafios que os dados confirmam (ex.: poucas
  visitas vs. alvo), reforça com o número.
- Se há alta atividade registada mas as notas não a celebram, traz à
  superfície como ponto forte.
Não acuses — sugere melhorias e celebra o que está visível nos dados.

Responde APENAS em JSON com esta estrutura:
{ "summary": "string", "strengths": ["..."], "focus_areas": ["..."], "tips": ["..."] }

Dados da semana (${weekStart}):

Atividade realizada (auto-capturada + manual):
${realizedLines.length ? realizedLines.join('\n') : 'Sem atividade registada esta semana.'}

(${autoCount} eventos auto-capturados, ${manualCount} manuais)

${targetLines.join('\n')}

Notas do consultor:
${notesBlock || 'Sem notas adicionadas.'}`

    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Coach pragmático para consultores imobiliários em Portugal. Sempre PT-PT.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw)

    const aiAdvice = {
      tips: Array.isArray(parsed.tips) ? parsed.tips.slice(0, 3) : [],
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 3) : [],
      focus_areas: Array.isArray(parsed.focus_areas) ? parsed.focus_areas.slice(0, 3) : [],
    }
    const aiSummary: string = typeof parsed.summary === 'string' ? parsed.summary : ''

    // Persist on the report row
    await supabase
      .from('agent_weekly_reports')
      .upsert(
        {
          agent_id: agentId,
          week_start: weekStart,
          ai_summary: aiSummary,
          ai_advice: aiAdvice,
          ai_generated_at: new Date().toISOString(),
        },
        { onConflict: 'agent_id,week_start' }
      )

    return NextResponse.json({ data: { ai_summary: aiSummary, ai_advice: aiAdvice } })
  } catch (error) {
    console.error('Erro ao gerar AI summary:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
