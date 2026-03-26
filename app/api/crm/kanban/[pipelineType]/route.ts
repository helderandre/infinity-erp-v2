import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { NextResponse } from 'next/server'

const VALID_PIPELINE_TYPES = ['comprador', 'vendedor', 'arrendatario', 'arrendador'] as const
type PipelineType = (typeof VALID_PIPELINE_TYPES)[number]

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pipelineType: string }> }
) {
  try {
    const supabase = createCrmAdminClient()
    const { pipelineType } = await params

    if (!VALID_PIPELINE_TYPES.includes(pipelineType as PipelineType)) {
      return NextResponse.json(
        { error: 'Tipo de pipeline inválido. Use: comprador, vendedor, arrendatario, arrendador' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const assigned_consultant_id = searchParams.get('assigned_consultant_id')

    const { data: stages, error: stagesError } = await supabase
      .from('leads_pipeline_stages')
      .select('*')
      .eq('pipeline_type', pipelineType)
      .order('order_index', { ascending: true })

    if (stagesError) return NextResponse.json({ error: stagesError.message }, { status: 500 })

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const nonTerminalIds = (stages ?? [])
      .filter((s) => !s.is_terminal)
      .map((s) => s.id)

    const terminalIds = (stages ?? [])
      .filter((s) => s.is_terminal)
      .map((s) => s.id)

    let negociosQuery = supabase
      .from('negocios')
      .select(
        `id, lead_id, pipeline_stage_id, tipo, expected_value, probability_pct, stage_entered_at, won_date, lost_date, orcamento, orcamento_max, tipo_imovel, quartos_min, localizacao, leads!lead_id(id, nome, telemovel, email, tags), dev_users!assigned_consultant_id(id, commercial_name), leads_pipeline_stages!pipeline_stage_id(id, name, color, order_index, is_terminal, terminal_type, sla_days)`
      )

    // Map pipelineType to the `tipo` column values
    if (pipelineType === 'comprador') {
      negociosQuery = negociosQuery.in('tipo', ['Compra', 'Compra e Venda'])
    } else if (pipelineType === 'vendedor') {
      negociosQuery = negociosQuery.in('tipo', ['Venda', 'Compra e Venda'])
    } else if (pipelineType === 'arrendatario') {
      negociosQuery = negociosQuery.eq('tipo', 'Arrendatário')
    } else if (pipelineType === 'arrendador') {
      negociosQuery = negociosQuery.eq('tipo', 'Arrendador')
    }

    if (assigned_consultant_id) {
      negociosQuery = negociosQuery.eq('assigned_consultant_id', assigned_consultant_id)
    }

    const { data: negocios, error: negociosError } = await negociosQuery

    if (negociosError) return NextResponse.json({ error: negociosError.message }, { status: 500 })

    const now = new Date()

    const filteredNegocios = (negocios ?? []).filter((n) => {
      const stageId = n.pipeline_stage_id
      if (nonTerminalIds.includes(stageId)) return true
      if (terminalIds.includes(stageId)) {
        const terminalDate = n.won_date ?? n.lost_date
        if (!terminalDate) return true
        return new Date(terminalDate) >= thirtyDaysAgo
      }
      return true
    })

    const stageMap = new Map<string, typeof stages[number]>(
      (stages ?? []).map((s) => [s.id, s])
    )

    type NegocioEnriched = (typeof filteredNegocios)[number] & {
      days_in_stage: number
      sla_overdue: boolean
    }

    const enriched: NegocioEnriched[] = filteredNegocios.map((n) => {
      const stage = stageMap.get(n.pipeline_stage_id)
      const enteredAt = n.stage_entered_at ? new Date(n.stage_entered_at) : now
      const days_in_stage = Math.floor((now.getTime() - enteredAt.getTime()) / (1000 * 60 * 60 * 24))
      const sla_days = stage?.sla_days ?? null
      const sla_overdue = sla_days !== null ? days_in_stage > sla_days : false
      return { ...n, days_in_stage, sla_overdue }
    })

    let totalExpectedValue = 0
    let totalWeightedValue = 0

    const columns = (stages ?? []).map((stage) => {
      const stageNegocios = enriched.filter((n) => n.pipeline_stage_id === stage.id)

      const total_value = stageNegocios.reduce((sum, n) => sum + (n.expected_value ?? 0), 0)
      const weighted_value = stageNegocios.reduce(
        (sum, n) => sum + (n.expected_value ?? 0) * ((n.probability_pct ?? stage.probability_pct ?? 0) / 100),
        0
      )

      if (!stage.is_terminal) {
        totalExpectedValue += total_value
        totalWeightedValue += weighted_value
      }

      return {
        stage,
        negocios: stageNegocios,
        count: stageNegocios.length,
        total_value,
        weighted_value,
      }
    })

    return NextResponse.json({
      pipeline_type: pipelineType,
      columns,
      totals: {
        negocios: filteredNegocios.length,
        expected_value: totalExpectedValue,
        weighted_value: totalWeightedValue,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
