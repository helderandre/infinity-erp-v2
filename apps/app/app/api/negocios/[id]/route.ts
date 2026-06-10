import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { updateNegocioSchema } from '@/lib/validations/lead'
import { requirePermission } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { redactNestedLead, shouldRedactLead } from '@/lib/auth/redact-lead'
import { syncLeadEstado } from '@/lib/crm/sync-lead-estado'
import {
  deriveExpectedValue,
  patchTouchesExpectedValueSources,
} from '@/lib/crm/derive-expected-value'
import { resolvePartnerOriginForNegocio } from '@/lib/parceiros/resolve-partner-origin'
import { deleteNegocioCascade } from '@/lib/negocios/delete-negocio-cascade'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import type { Database } from '@/types/database'

type NegocioUpdate = Database['public']['Tables']['negocios']['Update']

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('negocios')
      .select('*, pipeline_stage:leads_pipeline_stages!pipeline_stage_id(id, name, color, order_index, is_terminal, terminal_type, sla_days, pipeline_type), lead:leads!negocios_lead_id_fkey(id, nome, full_name, telefone, telemovel, email, nif, data_nascimento, nacionalidade, morada, tipo_documento, numero_documento, data_validade_documento, pais_emissor, tem_empresa, empresa, nipc, email_empresa, telefone_empresa, morada_empresa, documento_identificacao_url, documento_identificacao_frente_url, documento_identificacao_verso_url), referrer:dev_users!negocios_referrer_consultant_id_fkey(id, commercial_name), entry:leads_entries!negocios_entry_id_fkey(id, source, form_data, form_url, notes, property_external_ref, created_at, utm_source, utm_medium, utm_campaign, utm_content), origin_property:dev_properties!negocios_property_id_fkey(id, title, external_ref, city, slug, listing_price)')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Gate: consultor só vê negócios onde é o assigned_consultant_id
    // directo OU o referrer (vista read-only da página Referências).
    // Esconde com 404 (não revela existência).
    if (!isManagementRole(auth.roles)) {
      const isAssigned = (data as any).assigned_consultant_id === auth.user.id
      const isReferrer = (data as any).referrer_consultant_id === auth.user.id
      if (!isAssigned && !isReferrer) {
        return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
      }
    }

    const row = data as Record<string, unknown>
    const payload = shouldRedactLead(
      auth.roles,
      row.assigned_consultant_id as string | null | undefined,
      auth.user.id,
      row.referrer_consultant_id as string | null | undefined,
    )
      ? redactNestedLead(row)
      : row

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Erro ao obter negócio:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const body = await request.json()
    const validation = updateNegocioSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ id })
    }

    // Gate: a re-atribuição do consultor responsável é reservada a management.
    // Sem isto, um consultor poderia "passar" o négocio para outro colega via
    // DevTools e contornar o gate de visibilidade (que filtra por
    // assigned_consultant_id). Silenciosamente removemos o campo do payload
    // antes do update para consultor não-management.
    const isManagement = isManagementRole(auth.roles)
    if (!isManagement && 'assigned_consultant_id' in data) {
      delete (data as Record<string, unknown>).assigned_consultant_id
    }

    // Trim strings e converter strings vazias em null
    const updateData: NegocioUpdate = {}
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue
      if (typeof value === 'string') {
        const trimmed = value.trim()
        ;(updateData as Record<string, unknown>)[key] = trimmed || null
      } else {
        ;(updateData as Record<string, unknown>)[key] = value
      }
    }

    // If pipeline_stage_id is changing, also bump stage_entered_at and sync estado label
    if ('pipeline_stage_id' in updateData && updateData.pipeline_stage_id) {
      ;(updateData as Record<string, unknown>).stage_entered_at = new Date().toISOString()
      // Look up the stage name and mirror it into the legacy `estado` column
      const { data: stage } = await supabase
        .from('leads_pipeline_stages')
        .select('name')
        .eq('id', updateData.pipeline_stage_id as string)
        .maybeSingle()
      if (stage?.name) {
        ;(updateData as Record<string, unknown>).estado = stage.name
      }
    }

    const { data: existing } = await supabase
      .from('negocios')
      .select('lead_id, assigned_consultant_id, tipo, preco_venda, orcamento, orcamento_max, renda_pretendida, renda_max_mensal')
      .eq('id', id)
      .maybeSingle()

    // Gate: consultor só pode editar negócios em que é o assigned_consultant_id.
    if (!isManagement) {
      if (!existing || (existing as any).assigned_consultant_id !== auth.user.id) {
        return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
      }
    }

    // Recompute denormalized `expected_value` whenever a source field is
    // touched (tipo, preco_venda, orcamento*, renda_*). Caller-supplied
    // explicit value wins.
    if (
      existing &&
      (updateData as Record<string, unknown>).expected_value === undefined &&
      patchTouchesExpectedValueSources(updateData as Record<string, unknown>)
    ) {
      const merged = {
        ...(existing as Record<string, unknown>),
        ...(updateData as Record<string, unknown>),
      }
      ;(updateData as Record<string, unknown>).expected_value = deriveExpectedValue(merged)
    }

    const { error } = await supabase
      .from('negocios')
      .update(updateData)
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao actualizar negócio', details: error.message },
        { status: 500 }
      )
    }

    if (existing?.lead_id) {
      await syncLeadEstado(supabase, existing.lead_id)
    }

    return NextResponse.json({ id })
  } catch (error) {
    console.error('Erro ao actualizar negócio:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('negocios')
      .select('lead_id, assigned_consultant_id')
      .eq('id', id)
      .maybeSingle()

    // Gate: consultor só pode eliminar negócios em que é o assigned_consultant_id.
    if (!isManagementRole(auth.roles)) {
      if (!existing || (existing as any).assigned_consultant_id !== auth.user.id) {
        return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
      }
    }

    // Partner-approval gate: oportunidades referred by a parceiro with app
    // access require that parceiro's approval, unless the caller is a manager
    // with the `users` permission (override) or is the parceiro themselves.
    // Partner-referenced oportunidade: soft-hide from the consultor side
    // instead of a hard cascade delete, so the parceiro keeps their referral
    // and still sees it in the portal. Override/manager and the parceiro
    // themselves still hard-delete.
    const admin = createCrmAdminClient()
    const canOverride = auth.permissions.users === true
    const partnerOrigin = await resolvePartnerOriginForNegocio(id, admin)
    if (partnerOrigin && partnerOrigin.partnerId !== auth.user.id && !canOverride) {
      await admin
        .from('negocios')
        .update({ consultor_hidden_at: new Date().toISOString() })
        .eq('id', id)
      return NextResponse.json({ ok: true, hidden: true }, { status: 200 })
    }

    const { error } = await deleteNegocioCascade(supabase, id)
    if (error) {
      return NextResponse.json(
        { error: 'Erro ao eliminar negócio', details: error },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao eliminar negócio:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
