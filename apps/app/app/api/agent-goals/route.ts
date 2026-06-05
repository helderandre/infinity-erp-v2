// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { agentGoalSchema } from '@/lib/validations/agent-goal'
import { computeAgentGoalTargets } from '@/lib/goals/v2/compute-targets'

// GET /api/agent-goals?year=YYYY[&agent_id=<uuid>]
// Returns the goal (with targets) for the given year. Defaults to caller.
export async function GET(request: Request) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const yearParam = searchParams.get('year')
    const agentParam = searchParams.get('agent_id')
    const year = yearParam ? Number(yearParam) : new Date().getFullYear()

    const canSeeAll = isManagementRole(auth.roles)
    const agent_id = canSeeAll && agentParam ? agentParam : auth.user.id

    const { data: goal, error: goalErr } = await supabase
      .from('agent_goals')
      .select('*')
      .eq('agent_id', agent_id)
      .eq('period_year', year)
      .maybeSingle()

    if (goalErr) {
      return NextResponse.json({ error: goalErr.message }, { status: 500 })
    }

    if (!goal) {
      return NextResponse.json({ data: null })
    }

    const { data: targets } = await supabase
      .from('agent_goal_targets')
      .select('*')
      .eq('agent_goal_id', goal.id)
      .maybeSingle()

    return NextResponse.json({ data: { ...goal, targets: targets ?? null } })
  } catch (error) {
    console.error('Erro ao obter agent_goal:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST /api/agent-goals — upsert by (agent_id, period_year). Recomputes targets.
export async function POST(request: Request) {
  try {
    const auth = await requirePermission('goals')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const body = await request.json()
    const validation = agentGoalSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const callerIsManagement = isManagementRole(auth.roles)
    const payload = callerIsManagement
      ? validation.data
      : { ...validation.data, agent_id: auth.user.id }

    const { data: goal, error: upsertErr } = await supabase
      .from('agent_goals')
      .upsert(payload, { onConflict: 'agent_id,period_year' })
      .select('*')
      .single()

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    // Recompute targets cache
    const computed = computeAgentGoalTargets(payload)
    const { data: targets, error: targetsErr } = await supabase
      .from('agent_goal_targets')
      .upsert(
        { agent_goal_id: goal.id, ...computed, computed_at: new Date().toISOString() },
        { onConflict: 'agent_goal_id' }
      )
      .select('*')
      .single()

    if (targetsErr) {
      // Don't fail the whole request — goal is saved. Log and return without targets.
      console.error('Erro ao gravar agent_goal_targets:', targetsErr)
      return NextResponse.json({ data: { ...goal, targets: null }, warning: 'Targets não foram gravados' }, { status: 200 })
    }

    return NextResponse.json({ data: { ...goal, targets } }, { status: 200 })
  } catch (error) {
    console.error('Erro ao gravar agent_goal:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
