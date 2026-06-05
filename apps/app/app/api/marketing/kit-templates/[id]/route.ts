import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PUT: update a kit template
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient() as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, category, description, canva_design_id, placeholders, thumbnail_url, sort_order, is_active } = body

    const updates: Record<string, any> = {}
    if (name !== undefined) updates.name = name
    if (category !== undefined) updates.category = category
    if (description !== undefined) updates.description = description
    if (canva_design_id !== undefined) updates.canva_design_id = canva_design_id
    if (placeholders !== undefined) updates.placeholders = placeholders
    if (thumbnail_url !== undefined) updates.thumbnail_url = thumbnail_url
    if (sort_order !== undefined) updates.sort_order = sort_order
    if (is_active !== undefined) updates.is_active = is_active

    const { data, error } = await supabase
      .from('marketing_kit_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar kit template:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE: soft delete (deactivate) a kit template
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient() as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { error } = await supabase
      .from('marketing_kit_templates')
      .update({ is_active: false })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao desactivar kit template:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
