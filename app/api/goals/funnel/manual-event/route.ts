// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { z } from 'zod'

const FUNNEL_TYPES = ['buyer', 'seller'] as const
const STAGE_KEYS = [
  'contactos', 'pesquisa', 'visita', 'proposta', 'cpcv', 'escritura',
  'pre_angariacao', 'estudo_mercado', 'angariacao',
] as const

const createSchema = z.object({
  consultant_id: z.string().uuid(),
  funnel_type: z.enum(FUNNEL_TYPES),
  stage_key: z.enum(STAGE_KEYS),
  occurred_at: z.string().min(1),
  notes: z.string().max(500).optional().nullable(),
  ref_lead_id: z.string().uuid().optional().nullable(),
  ref_negocio_id: z.string().uuid().optional().nullable(),
  ref_property_id: z.string().uuid().optional().nullable(),
})

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const isManager = auth.roles.some((r) =>
      ['admin', 'Broker/CEO', 'team_leader'].includes(r),
    )
    if (parsed.data.consultant_id !== auth.user.id && !isManager) {
      return NextResponse.json(
        { error: 'Não pode registar eventos para outro consultor' },
        { status: 403 },
      )
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('funnel_manual_events')
      .insert({
        consultant_id: parsed.data.consultant_id,
        funnel_type: parsed.data.funnel_type,
        stage_key: parsed.data.stage_key,
        occurred_at: parsed.data.occurred_at,
        notes: parsed.data.notes ?? null,
        ref_lead_id: parsed.data.ref_lead_id ?? null,
        ref_negocio_id: parsed.data.ref_negocio_id ?? null,
        ref_property_id: parsed.data.ref_property_id ?? null,
        created_by: auth.user.id,
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (error) {
    console.error('Erro a registar evento manual:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id em falta' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: existing } = await supabase
      .from('funnel_manual_events')
      .select('id, consultant_id, created_by')
      .eq('id', id)
      .maybeSingle()
    if (!existing) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
    }

    const isManager = auth.roles.some((r) =>
      ['admin', 'Broker/CEO', 'team_leader'].includes(r),
    )
    const isOwner =
      existing.consultant_id === auth.user.id || existing.created_by === auth.user.id
    if (!isOwner && !isManager) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { error } = await supabase.from('funnel_manual_events').delete().eq('id', id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro a remover evento manual:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
