import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * GET /api/financial/moloni/deal-payments/[id]/history
 * Full ledger of every Moloni fiscal document emitted for this payment
 * (faturas, notas de crédito, recibos) across all re-emission cycles.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const admin = createAdminClient() as any

    const { data, error } = await admin
      .from('deal_payment_moloni_documents')
      .select(
        `id, kind, moloni_document_id, moloni_status, number,
         amount_net, amount_gross, related_moloni_document_id,
         reissue_seq, is_current, created_at`,
      )
      .eq('deal_payment_id', id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (error) {
    console.error('Erro histórico Moloni:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
