import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { docTypeCreateSchema } from '@/lib/validations/document'
import { requirePermission } from '@/lib/auth/permissions'

// GET — listar tipos de documento (com filtros opcionais por categoria e domínio)
// Auth: qualquer utilizador autenticado pode listar (catálogo usado pelos uploads).
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const appliesTo = searchParams.get('applies_to')

    let query = supabase
      .from('doc_types')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (category) {
      query = query.eq('category', category)
    }
    if (appliesTo) {
      // Match if the type is scoped to this domain OR is global (empty array).
      // Supabase PostgREST syntax: contains → cs, is empty array → eq.{}
      query = query.or(`applies_to.cs.{${appliesTo}},applies_to.eq.{}`)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao listar tipos de documento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — criar novo tipo de documento
export async function POST(request: Request) {
  try {
    const auth = await requirePermission('settings')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()

    const body = await request.json()
    const parsed = docTypeCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados invalidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('doc_types')
      .insert(parsed.data)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message.includes('unique') ? 400 : 500 }
      )
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar tipo de documento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
