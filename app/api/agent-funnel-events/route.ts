// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { createFunnelEventSchema } from '@/lib/validations/funnel-event'
import { MANUAL_BLOCKED_STAGES } from '@/types/funnel-event'

// POST /api/agent-funnel-events
// Creates one funnel event for the authenticated agent. Always uses
// auth.user.id as agent_id and created_by — no impersonation.
export async function POST(request: Request) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const body = await request.json()
    const validation = createFunnelEventSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const source = validation.data.source ?? 'manual'
    const isAutoSource = source.startsWith('auto:') || source === 'call_picker'
    if (!isAutoSource && MANUAL_BLOCKED_STAGES.includes(validation.data.stage as never)) {
      return NextResponse.json(
        { error: 'Esta etapa só pode ser capturada automaticamente.' },
        { status: 400 }
      )
    }

    const payload = {
      agent_id: auth.user.id,
      side: validation.data.side,
      stage: validation.data.stage,
      occurred_at: validation.data.occurred_at ?? new Date().toISOString(),
      count: validation.data.count ?? 1,
      source: validation.data.source ?? 'manual',
      source_ref_type: validation.data.source_ref_type ?? null,
      source_ref_id: validation.data.source_ref_id ?? null,
      notes: validation.data.notes ?? null,
      created_by: auth.user.id,
    }

    const { data, error } = await supabase
      .from('agent_funnel_events')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      // Idempotency conflict — return the existing row instead of 500
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Este evento já foi registado.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('Erro ao gravar funnel event:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
