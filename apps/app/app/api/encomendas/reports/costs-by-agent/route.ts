import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient() as any
    const { searchParams } = new URL(request.url)

    const date_from = searchParams.get('date_from')
    const date_to = searchParams.get('date_to')

    let query = supabase
      .from('temp_requisitions')
      .select('agent_id, total_amount, agent:dev_users!temp_requisitions_agent_id_fkey(id, commercial_name)')
      .eq('status', 'delivered')

    if (date_from) query = query.gte('actual_delivery_date', date_from)
    if (date_to) query = query.lte('actual_delivery_date', date_to)

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Group by agent
    const grouped: Record<string, { agent_id: string; commercial_name: string; total: number; count: number }> = {}

    for (const row of data || []) {
      const agentId = row.agent_id
      if (!grouped[agentId]) {
        grouped[agentId] = {
          agent_id: agentId,
          commercial_name: row.agent?.commercial_name || 'Desconhecido',
          total: 0,
          count: 0,
        }
      }
      grouped[agentId].total += row.total_amount || 0
      grouped[agentId].count += 1
    }

    const result = Object.values(grouped).sort((a, b) => b.total - a.total)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao obter custos por consultor:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
