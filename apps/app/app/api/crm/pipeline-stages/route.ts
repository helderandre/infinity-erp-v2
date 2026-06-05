import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = createCrmAdminClient()
    const { searchParams } = new URL(request.url)
    const pipelineType = searchParams.get('pipeline_type')

    let query = supabase
      .from('leads_pipeline_stages')
      .select('*')
      .order('pipeline_type')
      .order('order_index')

    if (pipelineType) {
      query = query.eq('pipeline_type', pipelineType)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar pipeline stages:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
