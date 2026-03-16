import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createVariantSchema } from '@/lib/validations/encomenda'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  try {
    const supabase = await createClient() as any
    const { id, variantId } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createVariantSchema.partial().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('temp_product_variants')
      .update(parsed.data)
      .eq('id', variantId)
      .eq('product_id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Variante não encontrada' }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar variante:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  try {
    const supabase = await createClient() as any
    const { id, variantId } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('temp_product_variants')
      .update({ is_active: false })
      .eq('id', variantId)
      .eq('product_id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Variante não encontrada' }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao desactivar variante:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
