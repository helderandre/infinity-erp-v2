import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { createNegocioSchema } from '@/lib/validations/leads-crm'
import { NextResponse } from 'next/server'
import {
  resolveInheritedReferralForNegocio,
  linkReferralToNewNegocio,
} from '@/lib/crm/inherit-referral-on-negocio-create'
import { syncLeadEstado } from '@/lib/crm/sync-lead-estado'
import { requireAuth } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { redactNestedLead, shouldRedactLead } from '@/lib/auth/redact-lead'
import { deriveExpectedValue } from '@/lib/crm/derive-expected-value'
import { qualifyNegocioPayload } from '@/lib/negocios/assert-qualified'

export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = createCrmAdminClient()
    const { searchParams } = new URL(request.url)

    // Gestão (admin/Broker/CEO/Gestor Processual/Office Manager/Team Leader)
    // vê os négocios de todos os consultores. Restantes papéis (Consultor,
    // etc.) ficam scoped aos seus próprios. Atenção: `permissions.pipeline`
    // NÃO é um proxy fiável aqui — o role Consultor também o tem.
    const canSeeAll = isManagementRole(auth.roles)

    const pipeline_type = searchParams.get('pipeline_type')
    const assignedParam = searchParams.get('assigned_consultant_id')
    const referrerParam = searchParams.get('referrer_consultant_id')
    // Referrer scope (used by "Referenciadas" view + its tab counters).
    // For non-management users `referrer_consultant_id` is locked to self —
    // we can't trust the client to claim referrer status for someone else.
    // In referrer mode we DON'T also force assigned_consultant_id = self,
    // because a deal you referred is by definition worked by someone else.
    const referrerMode = !!referrerParam
    let assigned_consultant_id: string | null
    let referrer_consultant_id: string | null
    if (canSeeAll) {
      assigned_consultant_id = assignedParam
      referrer_consultant_id = referrerParam
    } else if (referrerMode) {
      assigned_consultant_id = null
      referrer_consultant_id = auth.user.id
    } else {
      assigned_consultant_id = auth.user.id
      referrer_consultant_id = null
    }
    const pipeline_stage_id = searchParams.get('pipeline_stage_id')
    const temperatura = searchParams.get('temperatura')
    const only_referenced = searchParams.get('only_referenced') === '1'
    const search = (searchParams.get('search') || '').trim()
    const contact_id = searchParams.get('contact_id') || searchParams.get('lead_id')
    const tipo_imovel = (searchParams.get('tipo_imovel') || '').trim()
    const localizacao = (searchParams.get('localizacao') || '').trim()
    const orcamento_min = searchParams.get('orcamento_min')
    const orcamento_max = searchParams.get('orcamento_max')
    const date_from = searchParams.get('date_from')
    const date_to = searchParams.get('date_to')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const per_page = Math.min(200, Math.max(1, parseInt(searchParams.get('per_page') ?? '50', 10)))
    const from = (page - 1) * per_page
    const to = from + per_page - 1

    let query = supabase
      .from('negocios')
      .select(
        `*, leads_pipeline_stages!pipeline_stage_id(*), lead:leads!lead_id!inner(id, nome, full_name, email, telemovel, tags, agent:dev_users!agent_id(id, commercial_name)), dev_users!assigned_consultant_id(id, commercial_name), dev_properties!property_id(id, title, external_ref, city, listing_price)`,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to)

    if (pipeline_type) {
      // 2026-06-XX: `tipo` is now perspective-only post-refactor
      if (pipeline_type === 'comprador') {
        query = query.eq('tipo', 'Comprador')
      } else if (pipeline_type === 'vendedor') {
        query = query.eq('tipo', 'Vendedor')
      } else if (pipeline_type === 'arrendatario') {
        query = query.eq('tipo', 'Arrendatário')
      } else if (pipeline_type === 'arrendador') {
        query = query.eq('tipo', 'Senhorio')
      }
    }
    if (assigned_consultant_id) query = query.eq('assigned_consultant_id', assigned_consultant_id)
    if (referrer_consultant_id) query = query.eq('referrer_consultant_id', referrer_consultant_id)
    if (only_referenced) query = query.not('referrer_consultant_id', 'is', null)
    if (pipeline_stage_id) query = query.eq('pipeline_stage_id', pipeline_stage_id)
    if (temperatura) query = query.eq('temperatura', temperatura)
    if (contact_id) query = query.eq('lead_id', contact_id)
    if (search) query = query.ilike('leads.nome', `%${search}%`)
    if (tipo_imovel) query = query.ilike('tipo_imovel', `%${tipo_imovel}%`)
    if (localizacao) query = query.ilike('localizacao', `%${localizacao}%`)
    // Orçamento: aplica ao orcamento_max (compradores) ou preco_venda (vendedores).
    // Uso OR para cobrir os dois lados do pipeline.
    if (orcamento_min) {
      const min = Number(orcamento_min)
      if (!Number.isNaN(min)) {
        query = query.or(`orcamento_max.gte.${min},preco_venda.gte.${min}`)
      }
    }
    if (orcamento_max) {
      const max = Number(orcamento_max)
      if (!Number.isNaN(max)) {
        query = query.or(`orcamento.lte.${max},preco_venda.lte.${max}`)
      }
    }
    if (date_from) query = query.gte('created_at', date_from)
    if (date_to) query = query.lte('created_at', date_to)

    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = data || []
    const redactedRows = canSeeAll
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

    return NextResponse.json({ data: redactedRows, total: count ?? 0, page, per_page })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createCrmAdminClient()
    const body = await request.json()

    const parsed = createNegocioSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const input = parsed.data

    // Qualification guard — same data obligation as the legacy /api/negocios
    // path: location + value required; free-text location best-effort upgraded
    // to a structured zone. No path may create an unqualified oportunidade.
    const qualified = await qualifyNegocioPayload(supabase, input as Record<string, unknown>)
    if (!qualified.ok) {
      return NextResponse.json(
        { error: qualified.error, field: qualified.field },
        { status: qualified.status ?? 422 },
      )
    }
    const qInput = qualified.payload as typeof input

    const { data: stage, error: stageError } = await supabase
      .from('leads_pipeline_stages')
      .select('id, pipeline_type')
      .eq('id', input.pipeline_stage_id)
      .single()

    if (stageError || !stage) {
      return NextResponse.json({ error: 'Fase de pipeline não encontrada' }, { status: 404 })
    }

    // If created from a lead entry, copy referral data + carry the property
    // the lead manifested interest in (Meta Ads / portal attribution) so the
    // négocio keeps the "memory" of where the lead came from.
    let referralFields: Record<string, any> = {}
    // property_id resolved from the entry — also used to seed the dossier
    // (negocio_properties) after the négocio is inserted.
    let entryPropertyId: string | null = null
    if (input.entry_id) {
      const { data: entry } = await supabase
        .from('leads_entries')
        .select('has_referral, referral_pct, referral_consultant_id, referral_external_name, referral_external_phone, referral_external_email, referral_external_agency, source, property_id, property_external_ref')
        .eq('id', input.entry_id)
        .single()

      if (entry) {
        if (entry.has_referral) {
          const isInternalReferral = !!entry.referral_consultant_id
          referralFields = {
            has_referral: true,
            referral_pct: entry.referral_pct,
            referral_consultant_id: entry.referral_consultant_id,
            referral_external_name: entry.referral_external_name,
            referral_external_phone: entry.referral_external_phone,
            referral_external_email: entry.referral_external_email,
            referral_external_agency: entry.referral_external_agency,
            referral_type: isInternalReferral ? 'interna' : 'externa',
            // Canonical internal-referral credit. The rest of the CRM
            // (Referenciadas view, kanban referrer badge, commission calc,
            // detail-sheet referral block) keys off `referrer_consultant_id`,
            // NOT `referral_consultant_id`. Without stamping it here an internal
            // referral captured on the lead entry would carry only the generic
            // `has_referral` badge once qualified — the referring consultor would
            // never be credited nor see the deal. An explicit leads_referrals
            // agreement (resolved below) still wins via the inheritedReferral
            // spread, which is applied after these fields on insert.
            ...(isInternalReferral
              ? {
                  referrer_consultant_id: entry.referral_consultant_id,
                  referral_pct: entry.referral_pct ?? 25,
                }
              : {}),
          }
        }
        // Copy source from entry if not provided
        if (!input.origem && entry.source) {
          referralFields.origem = entry.source
        }
        // Carry the property the lead came from — but ONLY for buyer-side deals
        // (Comprador / Arrendatário). For a seller/landlord deal the entry's
        // property_id is just the listing whose ad the lead clicked, not a
        // property the deal is about; attaching it as "interested" would be
        // wrong (e.g. a buyers-campaign lead qualified as a seller). The entry
        // keeps property_id either way for campaign attribution. Caller-supplied
        // property_id wins regardless of side.
        const isBuyerSide =
          stage.pipeline_type === 'comprador' || stage.pipeline_type === 'arrendatario'
        if (isBuyerSide && !input.property_id && entry.property_id) {
          referralFields.property_id = entry.property_id
          entryPropertyId = entry.property_id
        }
      }

      // Mark entry as converted
      await supabase
        .from('leads_entries')
        .update({ status: 'converted', processed_at: new Date().toISOString() })
        .eq('id', input.entry_id)
    }

    // Internal user→user referral inheritance: if there's an active
    // leads_referrals row pairing this contacto with the recipient
    // consultor, this négocio (and every future one with the same pair)
    // inherits the referrer's commission slice automatically.
    const inheritedReferral = await resolveInheritedReferralForNegocio(
      supabase,
      input.lead_id,
      input.assigned_consultant_id ?? null,
    )

    // Seed `expected_value` from the price fields the caller supplied so new
    // négocios start in sync with the kanban card / commission totals.
    // Caller-supplied `expected_value` wins.
    const seededExpectedValue =
      input.expected_value ?? deriveExpectedValue(input as Record<string, unknown>)

    const { data, error } = await supabase
      .from('negocios')
      .insert({
        ...qInput,
        ...referralFields,
        ...(inheritedReferral
          ? {
              referrer_consultant_id: inheritedReferral.referrer_consultant_id,
              referral_pct: inheritedReferral.referral_pct,
            }
          : {}),
        expected_value: seededExpectedValue,
        stage_entered_at: new Date().toISOString(),
      })
      .select(
        `*, leads_pipeline_stages!pipeline_stage_id(*), leads!lead_id(id, nome, email, telemovel, tags), dev_users!assigned_consultant_id(id, commercial_name)`
      )
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Seed the dossier with the property of origin so it shows up in the
    // négocio's "Imóveis" tab from day one (status='interested' — the lead
    // already manifested interest in it). Best-effort: a failure here must not
    // abort the qualification. Resolve the final property_id from the inserted
    // row (covers both caller-supplied and entry-inherited cases).
    const finalPropertyId =
      ((data as Record<string, unknown> | null)?.property_id as string | null) ??
      input.property_id ??
      entryPropertyId
    if (data?.id && finalPropertyId) {
      try {
        await supabase.from('negocio_properties').insert({
          negocio_id: data.id,
          property_id: finalPropertyId,
          status: 'interested',
          notes: 'Imóvel de origem do lead (campanha/portal)',
        })
      } catch {
        // dossier seed is non-critical — ignore
      }
    }

    // Log the conversion on the timeline so the lead's history has no gap at
    // the exact moment it became an opportunity. Written with both contact_id
    // and negocio_id so it surfaces on the lead timeline AND inside the
    // négocio's notes feed. Best-effort — never aborts the qualification.
    if (data?.id) {
      try {
        await supabase.from('leads_activities').insert({
          contact_id: input.lead_id,
          negocio_id: data.id,
          activity_type: 'system',
          subject: 'Oportunidade criada',
          description: 'Lead qualificado — oportunidade criada no pipeline.',
          created_by: input.assigned_consultant_id ?? null,
          metadata: {
            event: 'qualified',
            entry_id: input.entry_id ?? null,
            pipeline_stage_id: input.pipeline_stage_id,
            property_id: finalPropertyId ?? null,
          },
        })
      } catch {
        // activity log is non-critical — ignore
      }
    }

    if (inheritedReferral?.referral_row_id && data?.id) {
      await linkReferralToNewNegocio(
        supabase,
        inheritedReferral.referral_row_id,
        data.id,
        {
          referrer_consultant_id: inheritedReferral.referrer_consultant_id,
          referral_pct: inheritedReferral.referral_pct,
        },
        {
          lead_id: input.lead_id ?? null,
          recipient_consultant_id: input.assigned_consultant_id ?? null,
        },
      )
    }

    if (input.lead_id) {
      await syncLeadEstado(supabase, input.lead_id)
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
