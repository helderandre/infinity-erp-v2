import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET: list all active kit templates
export async function GET() {
  try {
    const supabase = await createClient() as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('marketing_kit_templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar kit templates:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST: create a new kit template
export async function POST(request: Request) {
  try {
    const supabase = await createClient() as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, category, description, canva_design_id, placeholders, thumbnail_url, sort_order } = body

    if (!name || !category) {
      return NextResponse.json({ error: 'Nome e categoria são obrigatórios' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('marketing_kit_templates')
      .insert({
        name,
        category,
        description: description || null,
        canva_design_id: canva_design_id || null,
        placeholders: placeholders || [],
        thumbnail_url: thumbnail_url || null,
        sort_order: sort_order || 0,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar kit template:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
