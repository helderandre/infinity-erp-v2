import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { chat_id, instance_id, contact_id, lead_id, from_me, agent_id } = body

    if (!chat_id || !instance_id || !contact_id || !lead_id) {
      return NextResponse.json({ error: 'Campos obrigatórios em falta' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get the configurable gap from crm_settings
    const { data: gapSetting } = await supabase
      .from('crm_settings')
      .select('value')
      .eq('key', 'whatsapp_activity_gap_hours')
      .single()

    const gapHours = gapSetting?.value ? Number(gapSetting.value) : 18
    const gapMs = gapHours * 60 * 60 * 1000
    const cutoff = new Date(Date.now() - gapMs).toISOString()

    // Check for existing open session within the gap
    const { data: existingSession } = await supabase
      .from('wpp_activity_sessions')
      .select('id, message_count, direction, started_at')
      .eq('chat_id', chat_id)
      .eq('lead_id', lead_id)
      .gte('started_at', cutoff)
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (existingSession) {
      // Update existing session
      const currentDirection = existingSession.direction
      let newDirection = currentDirection
      if (from_me && currentDirection === 'inbound') newDirection = 'both'
      if (!from_me && currentDirection === 'outbound') newDirection = 'both'

      await supabase
        .from('wpp_activity_sessions')
        .update({
          message_count: existingSession.message_count + 1,
          direction: newDirection,
          ended_at: new Date().toISOString(),
        })
        .eq('id', existingSession.id)

      return NextResponse.json({ session_id: existingSession.id, action: 'updated' })
    }

    // Create new session
    const direction = from_me ? 'outbound' : 'inbound'
    const { data: newSession, error } = await supabase
      .from('wpp_activity_sessions')
      .insert({
        lead_id,
        contact_id,
        instance_id,
        chat_id,
        agent_id: agent_id || null,
        message_count: 1,
        direction,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ session_id: newSession?.id, action: 'created' })
  } catch (err) {
    console.error('[activity-log]', err)
    return NextResponse.json({ error: 'Erro ao registar actividade' }, { status: 500 })
  }
}

// GET: fetch activity sessions for a lead
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('lead_id')

    if (!leadId) {
      return NextResponse.json({ error: 'lead_id obrigatório' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('wpp_activity_sessions')
      .select('*')
      .eq('lead_id', leadId)
      .order('started_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return NextResponse.json({ sessions: data || [] })
  } catch (err) {
    console.error('[activity-log-get]', err)
    return NextResponse.json({ error: 'Erro ao carregar sessões' }, { status: 500 })
  }
}
