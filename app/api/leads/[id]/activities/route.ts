// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Try CRM activities first (leads_activities — new system)
    const { data: crmActivities } = await supabase
      .from('leads_activities')
      .select('*, created_by_user:dev_users!created_by(id, commercial_name)')
      .eq('contact_id', id)
      .order('created_at', { ascending: false })
      .limit(100)

    // Also fetch old lead_activities table
    const { data: oldActivities } = await supabase
      .from('lead_activities')
      .select('*, agent:dev_users!agent_id(id, commercial_name)')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
      .limit(100)

    // Normalize old activities to match CRM format
    const normalizedOld = (oldActivities || []).map((a) => ({
      id: a.id,
      contact_id: a.lead_id,
      negocio_id: null,
      activity_type: a.activity_type,
      direction: a.metadata?.direction || null,
      subject: a.metadata?.outcome
        ? (a.metadata.outcome === 'success' ? 'Chamada atendida' : 'Chamada não atendida')
        : null,
      description: a.description,
      metadata: a.metadata,
      created_by: a.agent_id,
      created_at: a.created_at,
      created_by_user: a.agent,
    }))

    // Merge and sort by date
    const all = [...(crmActivities || []), ...normalizedOld]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 100)

    return NextResponse.json({ data: all })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
