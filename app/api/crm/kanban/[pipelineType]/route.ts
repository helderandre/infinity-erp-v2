import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { NextResponse } from 'next/server'

const VALID_PIPELINE_TYPES = ['comprador', 'vendedor', 'arrendatario', 'arrendador'] as const
type PipelineType = (typeof VALID_PIPELINE_TYPES)[number]

// Map pipeline types to the sectors that feed into them from leads_entries
const PIPELINE_TO_SECTORS: Record<PipelineType, string[]> = {
  comprador: ['real_estate_buy'],
  vendedor: ['real_estate_sell'],
  arrendatario: ['real_estate_rent'],
  arrendador: ['real_estate_landlord'],
}

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

    // ── 1. Fetch pipeline stages ──────────────────────────────────────────

    const { data: stages, error: stagesError } = await supabase
      .from('leads_pipeline_stages')
      .select('*')
      .eq('pipeline_type', pipelineType)
      .order('order_index', { ascending: true })

    if (stagesError) return NextResponse.json({ error: stagesError.message }, { status: 500 })

    const leadsStage = (stages ?? []).find((s) => s.order_index === 0 && !s.is_terminal)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const nonTerminalIds = (stages ?? []).filter((s) => !s.is_terminal).map((s) => s.id)
    const terminalIds = (stages ?? []).filter((s) => s.is_terminal).map((s) => s.id)

    // ── 2. Fetch unqualified lead entries for the "Leads" column ──────────

    let entries: any[] = []
    if (leadsStage) {
      let entriesQuery = supabase
        .from('leads_entries')
        .select(`
          id, raw_name, raw_email, raw_phone, source, notes, created_at, status,
          sector, priority, has_referral, referral_pct, referral_consultant_id, referral_external_name,
          contact:leads!leads_entries_contact_id_fkey(id, nome, telemovel, email, tags),
          assigned_consultant:dev_users!leads_entries_assigned_consultant_id_fkey(id, commercial_name),
          campaign:leads_campaigns(id, name)
        `)
        .in('status', ['new', 'contacted', 'qualified'])

      // Filter by sectors relevant to this pipeline
      const sectors = PIPELINE_TO_SECTORS[pipelineType]
      if (sectors.length > 0) {
        // Include entries with matching sector OR null sector (unclassified)
        entriesQuery = entriesQuery.or(`sector.in.(${sectors.join(',')}),sector.is.null`)
      }

      if (assigned_consultant_id) {
        entriesQuery = entriesQuery.eq('assigned_consultant_id', assigned_consultant_id)
      }

      entriesQuery = entriesQuery.order('created_at', { ascending: false }).limit(100)

      const { data: entriesData } = await entriesQuery
      entries = (entriesData ?? [])
        // Exclude entries that already have a negócio in this pipeline
        // We'll filter client-side after fetching negócios
    }

    // ── 3. Fetch negócios (qualified deals in the pipeline) ───────────────

    let negociosQuery = supabase
      .from('negocios')
      .select(
        `id, lead_id, entry_id, pipeline_stage_id, tipo, expected_value, probability_pct,
         stage_entered_at, won_date, lost_date, orcamento, orcamento_max, tipo_imovel,
         quartos_min, localizacao, has_referral, referral_pct, referral_type, referral_side,
         origem,
         leads!lead_id(id, nome, telemovel, email, tags),
         dev_users!assigned_consultant_id(id, commercial_name),
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

    const { data: negocios, error: negociosError } = await negociosQuery
    if (negociosError) return NextResponse.json({ error: negociosError.message }, { status: 500 })

    // ── 4. Filter entries that already became negócios ─────────────────────

    const entryIdsWithNegocio = new Set(
      (negocios ?? []).map((n: any) => n.entry_id).filter(Boolean)
    )
    const unqualifiedEntries = entries.filter((e) => !entryIdsWithNegocio.has(e.id))

    // ── 5. Enrich negócios with SLA data ──────────────────────────────────

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

    // ── 6. Enrich lead entries as cards for the "Leads" column ────────────

    const enrichedEntries = unqualifiedEntries.map((e: any) => {
      const createdAt = new Date(e.created_at)
      const days_in_stage = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
      const sla_days = leadsStage?.sla_days ?? null
      const sla_overdue = sla_days !== null ? days_in_stage > sla_days : false
      return {
        ...e,
        days_in_stage,
        sla_overdue,
        _type: 'entry' as const,
        pipeline_stage_id: leadsStage?.id ?? null,
      }
    })

    // ── 7. Build columns ──────────────────────────────────────────────────

    let totalExpectedValue = 0
    let totalWeightedValue = 0

    const columns = (stages ?? []).map((stage) => {
      let items: any[]

      if (stage.id === leadsStage?.id) {
        // "Leads" column: unqualified entries + negócios still in first stage
        const stageNegocios = enrichedNegocios.filter((n) => n.pipeline_stage_id === stage.id)
        items = [...enrichedEntries, ...stageNegocios]
      } else {
        items = enrichedNegocios.filter((n) => n.pipeline_stage_id === stage.id)
      }

      const total_value = items.reduce((sum, n) => sum + (n.expected_value ?? 0), 0)
      const weighted_value = items.reduce(
        (sum, n) => sum + (n.expected_value ?? 0) * ((n.probability_pct ?? stage.probability_pct ?? 0) / 100),
        0
      )

      if (!stage.is_terminal) {
        totalExpectedValue += total_value
        totalWeightedValue += weighted_value
      }

      return {
        stage,
        negocios: items,
        count: items.length,
        total_value,
        weighted_value,
      }
    })

    return NextResponse.json({
      pipeline_type: pipelineType,
      columns,
      totals: {
        negocios: filteredNegocios.length,
        entries: unqualifiedEntries.length,
        expected_value: totalExpectedValue,
        weighted_value: totalWeightedValue,
      },
    })
  } catch (err) {
    console.error('Kanban error:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
