import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET: Listar form templates (filtro opcional por category)
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    const admin = createAdminClient()
    let query = admin
      .from('tpl_form_templates')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .order('name')

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[form-templates/GET] Error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST: Criar novo form template
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, category, sections } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    if (!sections || !Array.isArray(sections)) {
      return NextResponse.json({ error: 'Secções são obrigatórias' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('tpl_form_templates')
      .insert({
        name: name.trim(),
        description: description || null,
        category: category || null,
        sections,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('[form-templates/POST] Error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
