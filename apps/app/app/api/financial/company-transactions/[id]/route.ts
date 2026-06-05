import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { companyTransactionSchema } from '@/lib/validations/financial'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('company_transactions' as any)
      .select('*')
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: 'Transacção não encontrada' }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao obter transacção:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const body = await request.json()
    const parsed = companyTransactionSchema.partial().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const input = { ...parsed.data, updated_at: new Date().toISOString() }

    // Auto-calculate gross if net and vat provided
    if (input.amount_net && input.vat_pct != null && !input.amount_gross) {
      input.vat_amount = Math.round(input.amount_net * (input.vat_pct / 100) * 100) / 100
      input.amount_gross = Math.round((input.amount_net + input.vat_amount) * 100) / 100
    }

    const supabase = await createClient()

    // Fetch current data for audit trail
    const { data: oldData } = await supabase
      .from('company_transactions' as any)
      .select('*')
      .eq('id', id)
      .single()

    const { data, error } = await supabase
      .from('company_transactions' as any)
      .update(input)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Log audit trail for confirmed/paid transactions
    const old = oldData as any
    if (old && (old.status === 'confirmed' || old.status === 'paid')) {
      const action = input.status && input.status !== old.status ? 'status_change' : 'update'
      await supabase
        .from('company_transaction_audit' as any)
        .insert({
          transaction_id: id,
          user_id: auth.user.id,
          action,
          old_data: oldData,
          new_data: data,
        })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar transacção:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    // Fetch current data for audit trail
    const { data: oldData } = await supabase
      .from('company_transactions' as any)
      .select('*')
      .eq('id', id)
      .single()

    // Soft delete: set status to cancelled
    const { error } = await supabase
      .from('company_transactions' as any)
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Log audit trail
    if (oldData) {
      await supabase
        .from('company_transaction_audit' as any)
        .insert({
          transaction_id: id,
          user_id: auth.user.id,
          action: 'cancel',
          old_data: oldData,
          new_data: { status: 'cancelled' },
        })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao eliminar transacção:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
