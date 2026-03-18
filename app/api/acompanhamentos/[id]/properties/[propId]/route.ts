import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { updatePropertyStatusSchema } from '@/lib/validations/acompanhamento'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; propId: string }> }
) {
  try {
    const { id, propId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = updatePropertyStatusSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const admin = createAdminClient() as any

    const updateData: any = { ...parsed.data }
    if (parsed.data.status === 'sent') updateData.sent_at = new Date().toISOString()
    if (parsed.data.status === 'visited') updateData.visited_at = new Date().toISOString()

    const { data, error } = await admin
      .from('temp_acompanhamento_properties')
      .update(updateData)
      .eq('id', propId)
      .eq('acompanhamento_id', id)
      .select()
      .single()

    if (error) {
      console.error('[acompanhamentos/properties PUT]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[acompanhamentos/properties PUT]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; propId: string }> }
) {
  try {
    const { id, propId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const admin = createAdminClient() as any
    const { error } = await admin
      .from('temp_acompanhamento_properties')
      .delete()
      .eq('id', propId)
      .eq('acompanhamento_id', id)

    if (error) {
      console.error('[acompanhamentos/properties DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[acompanhamentos/properties DELETE]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
