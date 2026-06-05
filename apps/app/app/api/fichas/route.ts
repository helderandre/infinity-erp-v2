import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { createFichaSchema } from '@/lib/validations/visit-ficha'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const property_id = searchParams.get('property_id')
    if (!property_id) return NextResponse.json({ error: 'property_id é obrigatório.' }, { status: 400 })

    const admin = createAdminClient() as any
    const { data, error } = await admin
      .from('visit_fichas')
      .select('*')
      .eq('property_id', property_id)
      .order('visit_date', { ascending: false, nullsFirst: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [] })
  } catch (err) {
    console.error('[fichas GET]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const body = await request.json()
    const parsed = createFichaSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const admin = createAdminClient() as any
    const { data, error } = await admin
      .from('visit_fichas')
      .insert({ ...parsed.data, created_by: user.id })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[fichas POST]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
