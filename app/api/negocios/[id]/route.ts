import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { updateNegocioSchema } from '@/lib/validations/lead'
import { requirePermission } from '@/lib/auth/permissions'
import type { Database } from '@/types/database'

type NegocioUpdate = Database['public']['Tables']['negocios']['Update']

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('negocios')
      .select('*, pipeline_stage:leads_pipeline_stages!pipeline_stage_id(id, name, color, order_index, is_terminal, terminal_type, sla_days, pipeline_type), lead:leads(id, nome, full_name, telefone, telemovel, email, nif, data_nascimento, nacionalidade, morada, tipo_documento, numero_documento, data_validade_documento, pais_emissor, tem_empresa, empresa, nipc, email_empresa, telefone_empresa, morada_empresa, documento_identificacao_url, documento_identificacao_frente_url, documento_identificacao_verso_url)')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao obter negócio:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const body = await request.json()
    const validation = updateNegocioSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ id })
    }

    // Trim strings e converter strings vazias em null
    const updateData: NegocioUpdate = {}
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue
      if (typeof value === 'string') {
        const trimmed = value.trim()
        ;(updateData as Record<string, unknown>)[key] = trimmed || null
      } else {
        ;(updateData as Record<string, unknown>)[key] = value
      }
    }

    // If pipeline_stage_id is changing, also bump stage_entered_at and sync estado label
    if ('pipeline_stage_id' in updateData && updateData.pipeline_stage_id) {
      ;(updateData as Record<string, unknown>).stage_entered_at = new Date().toISOString()
      // Look up the stage name and mirror it into the legacy `estado` column
      const { data: stage } = await supabase
        .from('leads_pipeline_stages')
        .select('name')
        .eq('id', updateData.pipeline_stage_id as string)
        .maybeSingle()
      if (stage?.name) {
        ;(updateData as Record<string, unknown>).estado = stage.name
      }
    }

    const { error } = await supabase
      .from('negocios')
      .update(updateData)
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao actualizar negócio', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ id })
  } catch (error) {
    console.error('Erro ao actualizar negócio:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const { error } = await supabase
      .from('negocios')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao eliminar negócio', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao eliminar negócio:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
