import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PUT — Update an individual order item (confirm date, change status, edit)
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
    const { action, ...extra } = body

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

    switch (action) {
      case 'confirm_date':
        // Marketing picks one of the proposed dates to confirm
        if (!extra.confirmed_date) {
          return NextResponse.json({ error: 'Data confirmada é obrigatória' }, { status: 400 })
        }
        updateData.status = 'scheduled'
        updateData.confirmed_date = extra.confirmed_date
        updateData.confirmed_time = extra.confirmed_time || null
        break

      case 'accept':
        updateData.status = 'accepted'
        break

      case 'start':
        updateData.status = 'in_progress'
        break

      case 'complete':
        updateData.status = 'completed'
        break

      case 'cancel':
        updateData.status = 'cancelled'
        updateData.cancelled_reason = extra.reason || null
        break

      case 'edit':
        // Admin can edit any field
        if (extra.status !== undefined) updateData.status = extra.status
        if (extra.price !== undefined) updateData.price = extra.price
        if (extra.proposed_dates !== undefined) updateData.proposed_dates = extra.proposed_dates
        if (extra.confirmed_date !== undefined) updateData.confirmed_date = extra.confirmed_date
        if (extra.confirmed_time !== undefined) updateData.confirmed_time = extra.confirmed_time
        if (extra.notes !== undefined) updateData.notes = extra.notes
        break

      default:
        return NextResponse.json({ error: 'Acção inválida' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('marketing_order_items')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar item:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// DELETE — Remove an individual order item
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

    const { error } = await supabase
      .from('marketing_order_items')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao eliminar item:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
