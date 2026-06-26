import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { NextResponse } from 'next/server'
import { createContactSchema } from '@/lib/validations/leads-crm'
import { requireAuth } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { redactLead, shouldRedactLead } from '@/lib/auth/redact-lead'

export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = createCrmAdminClient()
    const { searchParams } = new URL(request.url)

    const search = searchParams.get('search') || ''
    const lifecycleStageId = searchParams.get('lifecycle_stage_id')
    const assignedConsultantParam = searchParams.get('assigned_consultant_id')
    // Gestão pode filtrar por qualquer consultor; restantes ficam scoped
    // ao próprio (vê só os contactos onde é o `agent_id`).
    const canSeeAll = isManagementRole(auth.roles)
    const tagsParam = searchParams.get('tags')

    // Contacts a non-management user is allowed to see = the ones they own
    // (leads.agent_id) PLUS the ones they referred to someone else. A referral
    // keeps the referrer linked to the contacto (visibility + future deals) even
    // though day-to-day management belongs to the recipient. Single source of
    // truth for "I referred this out": leads_referrals.from_consultant_id.
    let referredIds: string[] = []
    if (!canSeeAll) {
      const { data: refs } = await supabase
        .from('leads_referrals')
        .select('contact_id')
        .eq('from_consultant_id', auth.user.id)
        .eq('referral_type', 'internal') // only consultant↔consultant hand-offs
        .neq('status', 'cancelled')
        .not('contact_id', 'is', null)
      referredIds = [
        ...new Set(
          ((refs ?? []) as Array<{ contact_id: string | null }>)
            .map((r) => r.contact_id)
            .filter((v): v is string => Boolean(v)),
        ),
      ]
    }
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get('per_page')) || 25))
    const offset = (page - 1) * perPage

    let query = supabase
      .from('leads')
      .select(
        '*, leads_contact_stages(*), dev_users!agent_id(id, commercial_name)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    if (search) {
      query = query.or(
        `nome.ilike.%${search}%,email.ilike.%${search}%,telemovel.ilike.%${search}%`
      )
    }

    if (lifecycleStageId) {
      query = query.eq('lifecycle_stage_id', lifecycleStageId)
    }

    if (canSeeAll) {
      // Management can scope to a specific consultor; otherwise sees everyone.
      if (assignedConsultantParam) query = query.eq('agent_id', assignedConsultantParam)
    } else if (referredIds.length > 0) {
      // Own contacts + contacts referred out.
      query = query.or(`agent_id.eq.${auth.user.id},id.in.(${referredIds.join(',')})`)
    } else {
      query = query.eq('agent_id', auth.user.id)
    }

    if (tagsParam) {
      const tags = tagsParam.split(',').map((t) => t.trim()).filter(Boolean)
      if (tags.length > 0) {
        query = query.overlaps('tags', tags)
      }
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = data || []
    const me = auth.user.id
    const mapped = canSeeAll
      ? rows.map((row: Record<string, unknown>) =>
          shouldRedactLead(auth.roles, row.agent_id as string | null | undefined, auth.user.id)
            ? redactLead(row)
            : row,
        )
      : rows.map((row: Record<string, unknown>) => ({
          ...row,
          // True when the contacto is shown because the viewer referred it out
          // (not because they own it) — drives the "Referenciado" badge.
          referred_out: row.agent_id !== me,
        }))

    return NextResponse.json({
      data: mapped,
      total: count || 0,
      page,
      per_page: perPage,
    })
  } catch (error) {
    console.error('Erro ao listar contactos:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createCrmAdminClient()

    const body = await request.json()
    const validation = createContactSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const input = validation.data

    // Deduplication: check existing contact by telemovel or email
    const orConditions: string[] = []
    if ((input as Record<string, unknown>).telemovel) orConditions.push(`telemovel.eq.${(input as Record<string, unknown>).telemovel}`)
    if (input.email) orConditions.push(`email.eq.${input.email}`)

    if (orConditions.length > 0) {
      const { data: existing } = await supabase
        .from('leads')
        .select('*')
        .or(orConditions.join(','))
        .limit(1)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ data: existing, deduplicated: true })
      }
    }

    const { data, error } = await supabase
      .from('leads')
      .insert(input)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao criar contacto', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data, deduplicated: false }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar contacto:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
