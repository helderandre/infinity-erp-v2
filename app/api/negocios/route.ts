import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createNegocioSchema } from '@/lib/validations/lead'
import { requirePermission } from '@/lib/auth/permissions'

export async function GET(request: Request) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const lead_id = searchParams.get('lead_id')
    const tipo = searchParams.get('tipo')
    const estado = searchParams.get('estado')
    const search = searchParams.get('search')
    const pageParam = Number(searchParams.get('page')) || 0
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100)
    const offset = pageParam > 0 ? (pageParam - 1) * limit : (Number(searchParams.get('offset')) || 0)

    let query = supabase
      .from('negocios')
      .select('*, leads_pipeline_stages!pipeline_stage_id(id, name, color, order_index, is_terminal, terminal_type), lead:leads(id, nome, full_name, telemovel, email, agent_id, agent:dev_users(id, commercial_name))', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (lead_id) {
      query = query.eq('lead_id', lead_id)
    }
    if (tipo) {
      query = query.ilike('tipo', `%${tipo}%`)
    }
    if (estado) {
      query = query.eq('estado', estado)
    }
    if (search) {
      query = query.or(`localizacao.ilike.%${search}%,observacoes.ilike.%${search}%`)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [], total: count || 0 })
  } catch (error) {
    console.error('Erro ao listar negócios:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()

    const body = await request.json()
    const validation = createNegocioSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Resolve pipeline_stage_id: if the caller didn't provide one (legacy
    // call sites like /dashboard/leads/[id]'s "Novo negócio" only send
    // {lead_id, tipo}), look up the first non-terminal stage of the matching
    // pipeline. Without this, the negócio lands with stage=null and the
    // kanban silently filters it out — looking like "lead disappeared".
    const insertPayload: Record<string, unknown> = { ...validation.data }
    if (!insertPayload.pipeline_stage_id) {
      const TIPO_TO_PIPELINE: Record<string, string> = {
        'Compra': 'comprador',
        'Compra e Venda': 'comprador',
        'Venda': 'vendedor',
        'Arrendatário': 'arrendatario',
        'Arrendador': 'arrendador',
      }
      const pipelineType = TIPO_TO_PIPELINE[validation.data.tipo as string]
      if (pipelineType) {
        const { data: firstStage } = await supabase
          .from('leads_pipeline_stages')
          .select('id')
          .eq('pipeline_type', pipelineType)
          .eq('is_terminal', false)
          .order('order_index', { ascending: true })
          .limit(1)
          .maybeSingle()
        if (firstStage?.id) {
          insertPayload.pipeline_stage_id = firstStage.id
        }
      }
    }

    const { data: negocio, error } = await supabase
      .from('negocios')
      .insert(insertPayload as never)
      .select('id')
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao criar negócio', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ id: negocio.id }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar negócio:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
