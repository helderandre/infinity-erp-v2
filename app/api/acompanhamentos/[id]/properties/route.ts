import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { addPropertySchema } from '@/lib/validations/acompanhamento'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = addPropertySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const admin = createAdminClient() as any
    const insertData: any = {
      acompanhamento_id: id,
      property_id: parsed.data.property_id || null,
      external_url: parsed.data.external_url || null,
      external_title: parsed.data.external_title || null,
      external_price: parsed.data.external_price || null,
      external_source: parsed.data.external_source || null,
      notes: parsed.data.notes || null,
      status: 'suggested',
    }

    const { data, error } = await admin
      .from('temp_acompanhamento_properties')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Este imóvel já foi adicionado.' }, { status: 409 })
      }
      console.error('[acompanhamentos/[id]/properties POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[acompanhamentos/[id]/properties POST]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
