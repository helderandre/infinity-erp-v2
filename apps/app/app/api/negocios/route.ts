import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createNegocioSchema } from '@/lib/validations/lead'
import { requirePermission } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { redactNestedLead, shouldRedactLead } from '@/lib/auth/redact-lead'
import { syncLeadEstado } from '@/lib/crm/sync-lead-estado'
import { deriveExpectedValue } from '@/lib/crm/derive-expected-value'
import { qualifyNegocioPayload } from '@/lib/negocios/assert-qualified'

export async function GET(request: Request) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const lead_id = searchParams.get('lead_id')
    const tipo = searchParams.get('tipo')
    const estado = searchParams.get('estado')
    const search = searchParams.get('search')
    const pageParam = Number(searchParams.get('page')) || 0
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100)
    const offset = pageParam > 0 ? (pageParam - 1) * limit : (Number(searchParams.get('offset')) || 0)

    let query = supabase
      .from('negocios')
      .select('*, leads_pipeline_stages!pipeline_stage_id(id, name, color, order_index, is_terminal, terminal_type), lead:leads!negocios_lead_id_fkey(id, nome, full_name, telemovel, email, agent_id, agent:dev_users!agent_id(id, commercial_name))', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (lead_id) {
      query = query.eq('lead_id', lead_id)
    }
    if (tipo) {
      query = query.ilike('tipo', `%${tipo}%`)
    }
    if (estado) {
      query = query.eq('estado', estado)
    }
    if (search) {
      query = query.or(`localizacao.ilike.%${search}%,observacoes.ilike.%${search}%`)
    }

    // Gate de visibilidade: consultor só vê onde é o `assigned_consultant_id`
    // directo. Referenciações e dono do lead não dão acesso por agora.
    if (!isManagementRole(auth.roles)) {
      query = query.eq('assigned_consultant_id', auth.user.id)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = data || []
    const isManagement = isManagementRole(auth.roles)
    const redactedRows = isManagement
      ? rows.map((row: Record<string, unknown>) =>
          shouldRedactLead(
            auth.roles,
            row.assigned_consultant_id as string | null | undefined,
            auth.user.id,
            row.referrer_consultant_id as string | null | undefined,
          )
            ? redactNestedLead(row)
            : row,
        )
      : rows

    return NextResponse.json({ data: redactedRows, total: count || 0 })
  } catch (error) {
    console.error('Erro ao listar negócios:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()

    const body = await request.json()
    const validation = createNegocioSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Normalise legacy `tipo` values into the new (business_type, tipo) pair.
    // Pre-refactor `tipo` mixed deal type + perspective. Old clients still
    // POST 'Compra'/'Venda'/'Arrendador'/'Trespasse' — we accept and split.
    const insertPayload: Record<string, unknown> = { ...validation.data }
    {
      const incomingTipo = String(insertPayload.tipo ?? '')
      const incomingBT = (insertPayload.business_type as string | null | undefined) ?? null
      const LEGACY_MAP: Record<string, { tipo: string; business_type: string }> = {
        'Compra':       { tipo: 'Comprador',    business_type: 'Venda' },
        'Venda':        { tipo: 'Vendedor',     business_type: 'Venda' },
        'Arrendador':   { tipo: 'Senhorio',     business_type: 'Arrendamento' },
        'Trespasse':    { tipo: 'Vendedor',     business_type: 'Trespasse' },
      }
      const mapped = LEGACY_MAP[incomingTipo]
      if (mapped) {
        insertPayload.tipo = mapped.tipo
        if (!incomingBT) insertPayload.business_type = mapped.business_type
      }
      // For Arrendatário (perspective unchanged) without business_type → assume Arrendamento
      if (insertPayload.tipo === 'Arrendatário' && !insertPayload.business_type) {
        insertPayload.business_type = 'Arrendamento'
      }
    }

    // Qualification guard — every path (form, voice, raw API) must provide
    // location + value. Free-text location is best-effort upgraded to a
    // structured zone here so the négocio is never created "unqualified"
    // (which would make matching return no_filter → matches all properties).
    {
      const qualified = await qualifyNegocioPayload(supabase, insertPayload)
      if (!qualified.ok) {
        return NextResponse.json(
          { error: qualified.error, field: qualified.field },
          { status: qualified.status ?? 422 },
        )
      }
      Object.assign(insertPayload, qualified.payload)
    }

    // Resolve pipeline_stage_id: if the caller didn't provide one (legacy
    // call sites like /dashboard/leads/[id]'s "Novo negócio" only send
    // {lead_id, tipo}), look up the first non-terminal stage of the matching
    // pipeline. Without this, the negócio lands with stage=null and the
    // kanban silently filters it out — looking like "lead disappeared".
    if (!insertPayload.pipeline_stage_id) {
      const TIPO_TO_PIPELINE: Record<string, string> = {
        // New perspective values
        'Comprador':    'comprador',
        'Vendedor':     'vendedor',
        'Arrendatário': 'arrendatario',
        'Senhorio':     'arrendador',
      }
      const pipelineType = TIPO_TO_PIPELINE[String(insertPayload.tipo ?? '')]
      if (pipelineType) {
        const { data: firstStage } = await supabase
          .from('leads_pipeline_stages')
          .select('id')
          .eq('pipeline_type', pipelineType)
          .eq('is_terminal', false)
          .order('order_index', { ascending: true })
          .limit(1)
          .maybeSingle()
        if (firstStage?.id) {
          insertPayload.pipeline_stage_id = firstStage.id
        }
      }
    }

    // Denormaliza zonas → distrito/concelho/freguesia/localizacao text.
    // O bloco "Vendedor" do negocio-data-card lê dos campos texto (não das
    // zonas jsonb). Sem este passo, ao "Ver tudo" o consultor via tudo
    // vazio mesmo tendo escolhido uma zona no form de criação.
    {
      const zonas = (insertPayload as { zonas?: unknown }).zonas
      const hasZonas = Array.isArray(zonas) && zonas.length > 0
      const hasLocText =
        (insertPayload as { localizacao?: string | null }).localizacao ||
        (insertPayload as { distrito?: string | null }).distrito ||
        (insertPayload as { concelho?: string | null }).concelho ||
        (insertPayload as { freguesia?: string | null }).freguesia
      if (hasZonas && !hasLocText) {
        const firstAdmin = (zonas as Array<{ kind?: string; area_id?: string; label?: string }>).find(
          (z) => z?.kind === 'admin' && typeof z?.area_id === 'string',
        )
        if (firstAdmin?.area_id) {
          // Walk up to 3 levels (freguesia → concelho → distrito).
          let cursor: string | null = firstAdmin.area_id
          const chain: { type: string; name: string }[] = []
          for (let i = 0; i < 3 && cursor; i += 1) {
            const { data } = await (supabase as unknown as {
              from: (t: 'admin_areas') => {
                select: (c: string) => {
                  eq: (c: string, v: string) => {
                    maybeSingle: () => Promise<{ data: { id: string; type: string; name: string; parent_id: string | null } | null }>
                  }
                }
              }
            })
              .from('admin_areas')
              .select('id, type, name, parent_id')
              .eq('id', cursor)
              .maybeSingle()
            if (!data) break
            chain.push({ type: data.type, name: data.name })
            cursor = data.parent_id
          }
          const byType: Record<string, string | null> = { distrito: null, concelho: null, freguesia: null }
          for (const r of chain) byType[r.type] = r.name
          if (byType.distrito) (insertPayload as Record<string, unknown>).distrito = byType.distrito
          if (byType.concelho) (insertPayload as Record<string, unknown>).concelho = byType.concelho
          if (byType.freguesia) (insertPayload as Record<string, unknown>).freguesia = byType.freguesia
          const fullLabel = [byType.freguesia, byType.concelho, byType.distrito].filter(Boolean).join(', ')
          if (fullLabel && !(insertPayload as { localizacao?: string }).localizacao) {
            ;(insertPayload as Record<string, unknown>).localizacao = fullLabel
          }
        }
      }
    }

    // Internal user→user referral inheritance for the legacy create path.
    // Looks up the active referral agreement (contact_id, to_consultant_id)
    // and copies the slice onto the new négocio if one applies.
    const leadId = (validation.data as { lead_id?: string }).lead_id
    const recipientId = (insertPayload as { assigned_consultant_id?: string }).assigned_consultant_id
    let inheritedReferral: Awaited<ReturnType<typeof import('@/lib/crm/inherit-referral-on-negocio-create').resolveInheritedReferralForNegocio>> = null
    if (leadId && recipientId) {
      const { resolveInheritedReferralForNegocio } = await import(
        '@/lib/crm/inherit-referral-on-negocio-create'
      )
      inheritedReferral = await resolveInheritedReferralForNegocio(supabase, leadId, recipientId)
      if (inheritedReferral) {
        ;(insertPayload as Record<string, unknown>).referrer_consultant_id =
          inheritedReferral.referrer_consultant_id
        ;(insertPayload as Record<string, unknown>).referral_pct =
          inheritedReferral.referral_pct
      }
    }

    // Seed `expected_value` from the price fields supplied so new négocios
    // start in sync with the kanban card / commission totals. Caller-supplied
    // explicit value wins.
    if ((insertPayload as { expected_value?: unknown }).expected_value === undefined) {
      ;(insertPayload as Record<string, unknown>).expected_value = deriveExpectedValue(
        insertPayload as Record<string, unknown>,
      )
    }

    const { data: negocio, error } = await supabase
      .from('negocios')
      .insert(insertPayload as never)
      .select('id')
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao criar negócio', details: error.message },
        { status: 500 }
      )
    }

    if (leadId) {
      await syncLeadEstado(supabase, leadId)
    }

    if (inheritedReferral?.referral_row_id && negocio?.id) {
      const { linkReferralToNewNegocio } = await import(
        '@/lib/crm/inherit-referral-on-negocio-create'
      )
      await linkReferralToNewNegocio(
        supabase,
        inheritedReferral.referral_row_id,
        negocio.id,
        {
          referrer_consultant_id: inheritedReferral.referrer_consultant_id,
          referral_pct: inheritedReferral.referral_pct,
        },
        {
          lead_id: leadId ?? null,
          recipient_consultant_id: recipientId ?? null,
        },
      )
    }

    return NextResponse.json({ id: negocio.id }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar negócio:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
