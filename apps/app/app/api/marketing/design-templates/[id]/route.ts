import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

import { resolveActiveDesignCategory } from '@/lib/marketing/design-categories'

// PUT: update a design template
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = (await createClient()) as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const updates: Record<string, any> = {}

    if (body.name !== undefined) updates.name = body.name
    if (body.subcategory !== undefined) updates.subcategory = body.subcategory
    if (body.description !== undefined) updates.description = body.description
    if (body.canva_url !== undefined) updates.canva_url = body.canva_url
    if (body.thumbnail_url !== undefined) updates.thumbnail_url = body.thumbnail_url
    if (body.is_team_design !== undefined) updates.is_team_design = body.is_team_design
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order

    if (body.category !== undefined) {
      const resolved = await resolveActiveDesignCategory(supabase, body.category)
      if (!resolved) {
        return NextResponse.json({ error: 'Categoria inválida' }, { status: 400 })
      }
      updates.category = resolved.slug
      updates.category_id = resolved.id
    }

    const { data, error } = await supabase
      .from('marketing_design_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar design template:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE: deactivate a design template
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = (await createClient()) as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { error } = await supabase
      .from('marketing_design_templates')
      .update({ is_active: false })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao eliminar design template:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
