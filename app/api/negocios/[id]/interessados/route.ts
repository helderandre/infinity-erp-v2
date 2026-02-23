import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Buscar o negocio actual
    const { data: negocio, error: negError } = await supabase
      .from('negocios')
      .select('tipo, lead:leads(agent_id)')
      .eq('id', id)
      .single()

    if (negError || !negocio) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
    }

    // Interessados so faz sentido para negocios de Venda
    if (negocio.tipo !== 'Venda') {
      return NextResponse.json({ data: [] })
    }

    const currentAgentId = (negocio.lead as { agent_id: string | null } | null)?.agent_id

    // Buscar negocios de Compra/Compra e Venda abertos de outros agentes
    let query = supabase
      .from('negocios')
      .select(`
        id,
        lead:leads(
          nome,
          agent:dev_users(commercial_name, phone_commercial:dev_consultant_profiles(phone_commercial))
        )
      `)
      .in('tipo', ['Compra', 'Compra e Venda'])
      .eq('estado', 'Aberto')

    const { data: negocios, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const interessados = (negocios || [])
      .filter((n: Record<string, unknown>) => {
        const lead = n.lead as { agent_id?: string | null } | null
        // Excluir negocios do mesmo agente
        return lead && (!currentAgentId || (lead as Record<string, unknown>).agent_id !== currentAgentId)
      })
      .map((n: Record<string, unknown>) => {
        const lead = n.lead as Record<string, unknown> | null
        const nome = (lead?.nome as string) || ''
        const firstName = nome.split(' ')[0] || nome
        const agent = lead?.agent as Record<string, unknown> | null
        const profile = agent?.phone_commercial as Record<string, unknown>[] | null

        return {
          negocioId: n.id as string,
          firstName,
          colleague: (agent?.commercial_name as string) || 'Sem consultor',
          phone: profile?.[0]?.phone_commercial as string | null ?? null,
        }
      })

    return NextResponse.json({ data: interessados })
  } catch (error) {
    console.error('Erro ao obter interessados:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
