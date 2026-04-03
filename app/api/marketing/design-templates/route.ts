import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET: list marketing design templates
export async function GET(request: Request) {
  try {
    const supabase = await createClient() as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const team = searchParams.get('team') // 'true' | 'false' | null

    let query = supabase
      .from('marketing_design_templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    if (team === 'true') {
      query = query.eq('is_team_design', true)
    } else if (team === 'false') {
      query = query.eq('is_team_design', false)
    }

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar design templates:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST: create a new design template
export async function POST(request: Request) {
  try {
    const supabase = await createClient() as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()

    const { data, error } = await supabase
      .from('marketing_design_templates')
      .insert({
        name: body.name,
        category: body.category,
        subcategory: body.subcategory || null,
        description: body.description || null,
        canva_url: body.canva_url || null,
        thumbnail_url: body.thumbnail_url || null,
        is_team_design: body.is_team_design || false,
        sort_order: body.sort_order || 0,
        uploaded_by: user.id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar design template:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
