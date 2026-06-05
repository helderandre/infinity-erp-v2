import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { updatePayoutSchema } from '@/lib/validations/marketing'

// GET — Payout detail with lines and linked transactions
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const supabase = await createClient() as any

    const { data: payout, error } = await supabase
      .from('consultant_payouts')
      .select(`
        *,
        agent:dev_users!consultant_payouts_agent_id_fkey(id, commercial_name)
      `)
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 404 })

    // Fetch lines with transaction details
    const { data: lines } = await supabase
      .from('consultant_payout_lines')
      .select(`
        *,
        transaction:conta_corrente_transactions!consultant_payout_lines_transaction_id_fkey(
          id, date, type, category, amount, description, reference_type, reference_id, settlement_status
        )
      `)
      .eq('payout_id', id)
      .order('line_type', { ascending: true })
      .order('created_at', { ascending: true })

    return NextResponse.json({ ...payout, lines: lines || [] })
  } catch (error) {
    console.error('Erro ao obter pagamento:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// PUT — Update payout status (submit, receive_invoice, mark_paid, cancel)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const supabase = await createClient() as any
    const body = await request.json()
    const parsed = updatePayoutSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    // Get current payout
    const { data: payout, error: payoutError } = await supabase
      .from('consultant_payouts')
      .select('*')
      .eq('id', id)
      .single()

    if (payoutError || !payout) {
      return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 })
    }

    const { action, ...extra } = parsed.data
    let updateData: Record<string, unknown> = {}

    switch (action) {
      case 'submit':
        // draft → pending_invoice (if we ever use draft status)
        if (payout.status !== 'draft') {
          return NextResponse.json({ error: 'Pagamento não está em rascunho' }, { status: 400 })
        }
        updateData = { status: 'pending_invoice' }
        break

      case 'receive_invoice':
        if (payout.status !== 'pending_invoice') {
          return NextResponse.json({ error: 'Pagamento não está a aguardar fatura' }, { status: 400 })
        }
        if (!extra.consultant_invoice_number) {
          return NextResponse.json({ error: 'Número da fatura é obrigatório' }, { status: 400 })
        }
        updateData = {
          status: 'invoice_received',
          consultant_invoice_number: extra.consultant_invoice_number,
          consultant_invoice_date: extra.consultant_invoice_date || new Date().toISOString().split('T')[0],
          consultant_invoice_type: extra.consultant_invoice_type || null,
          consultant_invoice_url: extra.consultant_invoice_url || null,
        }
        break

      case 'mark_paid': {
        if (payout.status !== 'invoice_received') {
          return NextResponse.json({ error: 'Pagamento não tem fatura recebida' }, { status: 400 })
        }

        const paidDate = extra.paid_date || new Date().toISOString().split('T')[0]
        const paidAmount = extra.paid_amount ?? payout.net_amount

        updateData = {
          status: 'paid',
          paid_date: paidDate,
          paid_amount: paidAmount,
          payment_method: extra.payment_method || null,
          payment_reference: extra.payment_reference || null,
        }

        // Settle all linked transactions
        const { data: lines } = await supabase
          .from('consultant_payout_lines')
          .select('transaction_id')
          .eq('payout_id', id)

        if (lines && lines.length > 0) {
          const txIds = lines.map((l: any) => l.transaction_id)
          await supabase
            .from('conta_corrente_transactions')
            .update({
              settlement_status: 'settled',
              settled_at: new Date().toISOString(),
            })
            .in('id', txIds)
        }

        // Update deal_payment_splits.consultant_paid for linked commission credits
        const { data: creditLines } = await supabase
          .from('consultant_payout_lines')
          .select('transaction:conta_corrente_transactions!consultant_payout_lines_transaction_id_fkey(reference_type, reference_id)')
          .eq('payout_id', id)
          .eq('line_type', 'credit')

        const splitIds = (creditLines || [])
          .filter((l: any) => l.transaction?.reference_type === 'deal_payment_split' && l.transaction?.reference_id)
          .map((l: any) => l.transaction.reference_id)

        if (splitIds.length > 0) {
          await supabase
            .from('deal_payment_splits')
            .update({
              consultant_paid: true,
              consultant_paid_date: paidDate,
            })
            .in('id', splitIds)
        }

        break
      }

      case 'cancel': {
        if (['paid', 'cancelled'].includes(payout.status)) {
          return NextResponse.json({ error: 'Não é possível cancelar este pagamento' }, { status: 400 })
        }

        updateData = { status: 'cancelled' }

        // Release all allocated transactions back to available/confirmed
        const { data: cancelLines } = await supabase
          .from('consultant_payout_lines')
          .select('transaction_id, line_type')
          .eq('payout_id', id)

        if (cancelLines && cancelLines.length > 0) {
          const creditIds = cancelLines.filter((l: any) => l.line_type === 'credit').map((l: any) => l.transaction_id)
          const debitIds = cancelLines.filter((l: any) => l.line_type === 'deduction').map((l: any) => l.transaction_id)

          if (creditIds.length > 0) {
            await supabase
              .from('conta_corrente_transactions')
              .update({ settlement_status: 'available', payout_id: null })
              .in('id', creditIds)
          }
          if (debitIds.length > 0) {
            await supabase
              .from('conta_corrente_transactions')
              .update({ settlement_status: 'confirmed', payout_id: null })
              .in('id', debitIds)
          }
        }

        break
      }

      default:
        return NextResponse.json({ error: 'Acção inválida' }, { status: 400 })
    }

    if (extra.notes !== undefined) updateData.notes = extra.notes

    const { data, error } = await supabase
      .from('consultant_payouts')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        agent:dev_users!consultant_payouts_agent_id_fkey(id, commercial_name)
      `)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar pagamento:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
