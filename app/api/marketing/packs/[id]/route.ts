import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { updatePackSchema } from '@/lib/validations/marketing'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient() as any

    const { data, error } = await supabase
      .from('marketing_packs')
      .select(`
        *,
        marketing_pack_items (
          id,
          catalog_item_id,
          marketing_catalog (id, name, price, category)
        )
      `)
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 404 })

    const pack = {
      ...data,
      items: (data.marketing_pack_items || []).map((pi: any) => pi.marketing_catalog).filter(Boolean),
      marketing_pack_items: undefined,
    }

    return NextResponse.json(pack)
  } catch (error) {
    console.error('Erro ao obter pack:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient() as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = updatePackSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { item_ids, ...packData } = parsed.data

    // Update pack fields
    if (Object.keys(packData).length > 0) {
      const { error } = await supabase
        .from('marketing_packs')
        .update(packData)
        .eq('id', id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update items if provided
    if (item_ids) {
      // Remove existing
      await supabase.from('marketing_pack_items').delete().eq('pack_id', id)

      // Insert new
      const packItems = item_ids.map(catalog_item_id => ({
        pack_id: id,
        catalog_item_id,
      }))

      const { error: itemsError } = await supabase
        .from('marketing_pack_items')
        .insert(packItems)

      if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    // Return updated pack
    const { data, error } = await supabase
      .from('marketing_packs')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar pack:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient() as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Soft delete
    const { error } = await supabase
      .from('marketing_packs')
      .update({ is_active: false })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao eliminar pack:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
