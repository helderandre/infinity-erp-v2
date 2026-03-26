import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { updateNegocioSchema } from '@/lib/validations/leads-crm'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createCrmAdminClient()
    const { id } = await params

    const { data, error } = await supabase
      .from('negocios')
      .select(
        `*, leads_pipeline_stages!pipeline_stage_id(*), leads!lead_id(id, nome, email, telemovel, tags, lifecycle_stage_id), dev_users!assigned_consultant_id(id, commercial_name), dev_properties!property_id(id, title, external_ref, city, listing_price)`
      )
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createCrmAdminClient()
    const { id } = await params
    const body = await request.json()

    const parsed = updateNegocioSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const input = parsed.data
    const updatePayload: Record<string, unknown> = { ...input }

    // Remap contact_id → lead_id if present
    if ('contact_id' in updatePayload) {
      updatePayload.lead_id = updatePayload.contact_id
      delete updatePayload.contact_id
    }

    if (input.pipeline_stage_id) {
      const { data: stage, error: stageError } = await supabase
        .from('leads_pipeline_stages')
        .select('id, is_terminal, terminal_type')
        .eq('id', input.pipeline_stage_id)
        .single()

      if (stageError || !stage) {
        return NextResponse.json({ error: 'Fase de pipeline não encontrada' }, { status: 404 })
      }

      if (stage.is_terminal) {
        if (stage.terminal_type === 'won') {
          updatePayload.won_date = new Date().toISOString()
          updatePayload.lost_date = null
        } else if (stage.terminal_type === 'lost') {
          updatePayload.lost_date = new Date().toISOString()
          updatePayload.won_date = null
        }
      }
    }

    const { data, error } = await supabase
      .from('negocios')
      .update(updatePayload)
      .eq('id', id)
      .select(
        `*, leads_pipeline_stages!pipeline_stage_id(*), leads!lead_id(id, nome, email, telemovel, tags, lifecycle_stage_id), dev_users!assigned_consultant_id(id, commercial_name), dev_properties!property_id(id, title, external_ref, city, listing_price)`
      )
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createCrmAdminClient()
    const { id } = await params

    const { error } = await supabase.from('negocios').delete().eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
