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
    const { pipelineType: pt } = await params

    if (!VALID_PIPELINE_TYPES.includes(pt as PipelineType)) {
      return NextResponse.json(
        { error: 'Tipo de pipeline inválido. Use: comprador, vendedor, arrendatario, arrendador' },
        { status: 400 }
      )
    }

    const pipelineType = pt as PipelineType
    const { searchParams } = new URL(request.url)
    const assigned_consultant_id = searchParams.get('assigned_consultant_id')
    const referrer_consultant_id = searchParams.get('referrer_consultant_id')
    const only_referenced = searchParams.get('only_referenced') === '1'
    const pipeline_stage_id = searchParams.get('pipeline_stage_id')
    const temperatura = searchParams.get('temperatura')
    const search = (searchParams.get('search') || '').trim()

    // ── 1. Fetch pipeline stages ──────────────────────────────────────────

    const { data: stages, error: stagesError } = await supabase
      .from('leads_pipeline_stages')
      .select('*')
      .eq('pipeline_type', pipelineType)
      .order('order_index', { ascending: true })

    if (stagesError) return NextResponse.json({ error: stagesError.message }, { status: 500 })

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const nonTerminalIds = (stages ?? []).filter((s) => !s.is_terminal).map((s) => s.id)
    const terminalIds = (stages ?? []).filter((s) => s.is_terminal).map((s) => s.id)

    // ── 2. Fetch negócios (qualified deals in the pipeline) ───────────────

    const useInnerLeadJoin = !!search
    let negociosQuery = supabase
      .from('negocios')
      .select(
        `id, lead_id, entry_id, pipeline_stage_id, tipo, expected_value, probability_pct,
         stage_entered_at, won_date, lost_date, orcamento, orcamento_max, tipo_imovel,
         preco_venda, renda_pretendida, renda_max_mensal,
         quartos_min, localizacao, has_referral, referral_pct, referral_type, referral_side,
         referrer_consultant_id,
         temperatura, observacoes, origem,
         leads${useInnerLeadJoin ? '!lead_id!inner' : '!lead_id'}(id, nome, telemovel, email, tags),
         dev_users!assigned_consultant_id(id, commercial_name),
         referrer:dev_users!negocios_referrer_consultant_id_fkey(id, commercial_name),
         leads_pipeline_stages!pipeline_stage_id(id, name, color, order_index, is_terminal, terminal_type, sla_days)`
      )

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
    if (referrer_consultant_id) {
      // Referências view: I'm owed a commission slice on these négocios but
      // I'm not the consultor working them — filter by referrer instead of
      // assigned. Kanban renders them in their current owner's pipeline
      // stages so the referrer can see where each deal is at.
      negociosQuery = negociosQuery.eq('referrer_consultant_id', referrer_consultant_id)
    }
    if (only_referenced) {
      // Surface only négocios that came in via an internal referral (any
      // referrer, not necessarily the current user). Used by the Pipeline
      // page's "Só referenciados" toggle.
      negociosQuery = negociosQuery.not('referrer_consultant_id', 'is', null)
    }
    if (pipeline_stage_id) {
      negociosQuery = negociosQuery.eq('pipeline_stage_id', pipeline_stage_id)
    }
    if (temperatura) {
      negociosQuery = negociosQuery.eq('temperatura', temperatura)
    }
    if (search) {
      negociosQuery = negociosQuery.ilike('leads.nome', `%${search}%`)
    }

    // Newest activity at the top of each column. stage_entered_at is set on
    // creation and refreshed whenever the negócio is dragged to a new stage,
    // so this orders by "most recent move into this column" — what the user
    // actually wants when scanning the pipeline. Falls back to created_at for
    // any legacy rows where stage_entered_at is null.
    negociosQuery = negociosQuery
      .order('stage_entered_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    const { data: negocios, error: negociosError } = await negociosQuery
    if (negociosError) return NextResponse.json({ error: negociosError.message }, { status: 500 })

    // ── 3. Enrich negócios with SLA data ──────────────────────────────────

    const now = new Date()
    const stageMap = new Map((stages ?? []).map((s) => [s.id, s]))

    const filteredNegocios = (negocios ?? []).filter((n: any) => {
      const stageId = n.pipeline_stage_id
      if (nonTerminalIds.includes(stageId)) return true
      if (terminalIds.includes(stageId)) {
        const terminalDate = n.won_date ?? n.lost_date
        if (!terminalDate) return true
        return new Date(terminalDate) >= thirtyDaysAgo
      }
      return true
    })

    const enrichedNegocios = filteredNegocios.map((n: any) => {
      const stage = stageMap.get(n.pipeline_stage_id)
      const enteredAt = n.stage_entered_at ? new Date(n.stage_entered_at) : now
      const days_in_stage = Math.floor((now.getTime() - enteredAt.getTime()) / (1000 * 60 * 60 * 24))
      const sla_days = stage?.sla_days ?? null
      const sla_overdue = sla_days !== null ? days_in_stage > sla_days : false
      return { ...n, days_in_stage, sla_overdue, _type: 'negocio' as const }
    })

    // ── 4. Build columns (negocios only) ─────────────────────────────────

    // Commission formula:
    //   sale (comprador / vendedor):       value × 0.05 × 0.5
    //   rental (arrendatario / arrendador): value × 1.5  × 0.5
    const isRental = pipelineType === 'arrendatario' || pipelineType === 'arrendador'
    const commissionFactor = isRental ? 1.5 * 0.5 : 0.05 * 0.5

    const negocioValue = (n: any): number => {
      // Best-effort: use expected_value when present, otherwise fall back to
      // the most relevant per-tipo field captured in the form.
      if (typeof n.expected_value === 'number' && n.expected_value > 0) return n.expected_value
      if (isRental) {
        return Number(n.renda_pretendida) || Number(n.renda_max_mensal) || 0
      }
      return Number(n.preco_venda) || Number(n.orcamento_max) || Number(n.orcamento) || 0
    }

    // "Comissão possível" — sum across all non-terminal stages (everything still
    //   in the pipeline, regardless of how early it is).
    // "Comissão prevista" — sum across non-terminal stages from order_index >= 4
    //   onwards, i.e. negotiations that are far enough along to actually count
    //   as a forecast (excludes Fecho / Perdido which are terminal).
    //
    // Referrer mode: when filtering by referrer_consultant_id, the figures
    // returned are the *referrer's slice*, i.e. each card's commission is
    // multiplied by its referral_pct (or the agency default when null).
    let totalPossibleCommission = 0
    let totalForecastCommission = 0

    const isReferrerMode = !!referrer_consultant_id
    let defaultReferralPctFraction = 0.25
    if (isReferrerMode) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: setting } = await (supabase as any)
        .from('temp_agency_settings')
        .select('value')
        .eq('key', 'default_referral_pct')
        .maybeSingle()
      const parsed = parseFloat(setting?.value ?? '')
      if (Number.isFinite(parsed)) defaultReferralPctFraction = parsed / 100
    }

    const cardCommission = (n: any): number => {
      const base = negocioValue(n) * commissionFactor
      if (!isReferrerMode) return base
      const pctFraction =
        typeof n.referral_pct === 'number' && n.referral_pct >= 0
          ? n.referral_pct / 100
          : defaultReferralPctFraction
      return base * pctFraction
    }

    const columns = (stages ?? []).map((stage) => {
      const items = enrichedNegocios.filter((n) => n.pipeline_stage_id === stage.id)

      const total_value = items.reduce((sum, n) => sum + negocioValue(n), 0)
      const weighted_value = items.reduce(
        (sum, n) => sum + negocioValue(n) * ((n.probability_pct ?? stage.probability_pct ?? 0) / 100),
        0
      )

      const total_commission = items.reduce((sum, n) => sum + cardCommission(n), 0)

      if (!stage.is_terminal) {
        totalPossibleCommission += total_commission
        if (stage.order_index >= 4) {
          totalForecastCommission += total_commission
        }
      }

      return {
        stage,
        negocios: items,
        count: items.length,
        total_value,
        weighted_value,
        total_commission,
      }
    })

    return NextResponse.json({
      pipeline_type: pipelineType,
      columns,
      totals: {
        negocios: filteredNegocios.length,
        possible_commission: totalPossibleCommission,
        forecast_commission: totalForecastCommission,
      },
    })
  } catch (err) {
    console.error('Kanban error:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
