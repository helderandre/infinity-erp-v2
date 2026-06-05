import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { stockAdjustSchema } from '@/lib/validations/encomenda'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient() as any
    const { id } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = stockAdjustSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    // Get current stock
    const { data: stock, error: stockError } = await supabase
      .from('temp_stock')
      .select('id, quantity_available')
      .eq('id', id)
      .single()

    if (stockError || !stock) {
      return NextResponse.json({ error: 'Stock não encontrado' }, { status: 404 })
    }

    const newQuantity = stock.quantity_available + parsed.data.quantity
    if (newQuantity < 0) {
      return NextResponse.json({ error: 'Quantidade resultante não pode ser negativa' }, { status: 400 })
    }

    // Update stock
    const { data: updatedStock, error: updateError } = await supabase
      .from('temp_stock')
      .update({ quantity_available: newQuantity })
      .eq('id', id)
      .select()
      .single()

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    // Create stock movement
    const movementType = parsed.data.quantity >= 0 ? 'in_adjustment' : 'out_adjustment'

    await supabase
      .from('temp_stock_movements')
      .insert({
        stock_id: id,
        movement_type: movementType,
        quantity: Math.abs(parsed.data.quantity),
        performed_by: user.id,
        notes: parsed.data.reason,
      })

    return NextResponse.json(updatedStock)
  } catch (error) {
    console.error('Erro ao ajustar stock:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
