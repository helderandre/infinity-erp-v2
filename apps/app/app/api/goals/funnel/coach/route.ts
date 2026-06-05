// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import OpenAI from 'openai'
import type { FunnelResponse, FunnelData, FunnelStageResult } from '@/types/funnel'

/**
 * POST /api/goals/funnel/coach
 *
 * AI Coach que usa o snapshot do funil (FunnelResponse) já calculado pelo
 * cliente. Não recalcula nada — apenas constrói o prompt com os dados
 * realizados / objectivo / gap por etapa, e responde de forma accionável.
 *
 * Também mete na frente do diagnóstico os 3 problemas críticos de qualidade
 * de dados que distorcem o funil (calculados em tempo real para o consultor):
 *   - Negócios sem consultor atribuído
 *   - Deals sem ligação ao negócio
 *   - CPCV/Escritura sem timestamp real
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
    const { messages, funnel_snapshot, consultant_name } = body as {
      messages: { role: string; content: string }[]
      funnel_snapshot: FunnelResponse | null
      consultant_name?: string | null
    }
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Mensagens em falta' }, { status: 400 })
    }
    if (!funnel_snapshot) {
      return NextResponse.json({ error: 'Snapshot do funil em falta' }, { status: 400 })
    }

    // ── Critical data-quality flags scoped to the consultant (or team) ──
    const supabase = await createClient()
    const issues: string[] = []
    if (funnel_snapshot.scope === 'consultant') {
      const consultantId = funnel_snapshot.consultant.id
      const today = new Date().toISOString().slice(0, 10)
      const [escWithoutTs, dealsNoNegocio] = await Promise.all([
        supabase
          .from('deals')
          .select('id', { count: 'exact', head: true })
          .eq('consultant_id', consultantId)
          .is('escritura_signed_at', null)
          .lte('deal_date', today),
        supabase
          .from('deals')
          .select('id', { count: 'exact', head: true })
          .eq('consultant_id', consultantId)
          .is('negocio_id', null),
      ])
      if ((escWithoutTs.count ?? 0) > 0) {
        issues.push(
          `${escWithoutTs.count} escritura(s) sem timestamp real (\`escritura_signed_at\`) — métrica de fecho está a usar a data planeada.`,
        )
      }
      if ((dealsNoNegocio.count ?? 0) > 0) {
        issues.push(
          `${dealsNoNegocio.count} deal(s) sem ligação a negócio — classificação buyer/seller é aproximada.`,
        )
      }
    } else {
      // team: flag broad issues
      const [orphanNeg, orphanDeals, dealsNoNegocio] = await Promise.all([
        supabase
          .from('negocios')
          .select('id', { count: 'exact', head: true })
          .is('assigned_consultant_id', null),
        supabase
          .from('deals')
          .select('id', { count: 'exact', head: true })
          .is('escritura_signed_at', null)
          .lte('deal_date', new Date().toISOString().slice(0, 10)),
        supabase
          .from('deals')
          .select('id', { count: 'exact', head: true })
          .is('negocio_id', null),
      ])
      if ((orphanNeg.count ?? 0) > 0) {
        issues.push(
          `${orphanNeg.count} negócio(s) sem consultor atribuído — invisíveis no funil.`,
        )
      }
      if ((dealsNoNegocio.count ?? 0) > 0) {
        issues.push(
          `${dealsNoNegocio.count} deal(s) sem ligação a negócio — classificação buyer/seller é aproximada.`,
        )
      }
      if ((orphanDeals.count ?? 0) > 0) {
        issues.push(
          `${orphanDeals.count} escritura(s) sem timestamp real — métrica de fecho usa data planeada.`,
        )
      }
    }

    const periodLabel = {
      daily: 'hoje',
      weekly: 'esta semana',
      monthly: 'este mês',
      annual: 'este ano',
    }[funnel_snapshot.period]

    function describeFunnel(data: FunnelData, label: string): string {
      const lines = data.stages.map((s: FunnelStageResult) => {
        const sourceTag = s.source_breakdown.manual > 0 ? ` (${s.source_breakdown.system}auto+${s.source_breakdown.manual}manual)` : ''
        return `  - ${s.label}: ${s.realized}/${Math.round(s.target)} → ${Math.round(s.percent)}% [${s.status}]${sourceTag}`
      }).join('\n')
      return `${label} [${data.status}]:\n${lines}\nConv. total ${data.summary.conv_total_pct}% · Realizado ${data.summary.realized_eur}€`
    }

    const eurFmt = new Intl.NumberFormat('pt-PT', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
    })

    const scopeLabel =
      funnel_snapshot.scope === 'team'
        ? `Equipa (${funnel_snapshot.team_member_count ?? '?'} consultores)`
        : (consultant_name || funnel_snapshot.consultant.commercial_name || 'consultor')

    const issuesBlock = issues.length > 0
      ? `\nPROBLEMAS DE QUALIDADE DE DADOS (a resolver antes de afinar performance):\n${issues.map(i => `- ${i}`).join('\n')}`
      : ''

    const systemPrompt = `És um coach comercial directo e prático. Estás a falar com ${scopeLabel}, sobre o funil ${periodLabel}.

OBJECTIVO DO PERÍODO: ${eurFmt.format(funnel_snapshot.period_target_eur)}
PERÍODO: ${funnel_snapshot.period_start} → ${funnel_snapshot.period_end}

${describeFunnel(funnel_snapshot.buyer, 'FUNIL COMPRADORES')}

${describeFunnel(funnel_snapshot.seller, 'FUNIL VENDEDORES')}
${issuesBlock}

ESTILO:
- Responde sempre em PT-PT.
- Sê directo, conciso, accionável. Evita conselhos genéricos.
- Quando perguntarem "porquê", aponta para a etapa com pior status (late > attention) ou maior gap absoluto.
- Quando perguntarem "o que fazer", recomenda acções concretas para a etapa-bottleneck (ex.: "Faltam 13 contactos esta semana" → "agenda 3 chamadas amanhã de manhã").
- Se houver problemas de qualidade de dados, FLAG-OS PRIMEIRO antes de qualquer análise — explica que os números podem estar enganados até serem corrigidos.
- Se uma etapa tem muitos eventos manuais, refere isso (sinal de que o sistema não está a capturar bem).
- Não inventes números. Se não tiveres dados, diz.
- Mantém respostas curtas (máximo 4 linhas) excepto se pedirem detalhe.`

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
    return NextResponse.json({ reply, data_issues: issues })
  } catch (error) {
    console.error('Erro no Funnel Coach:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
