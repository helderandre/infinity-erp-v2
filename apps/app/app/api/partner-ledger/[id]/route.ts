import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'

function isManagement(auth: { permissions: Record<string, boolean> }) {
  return auth.permissions.financial === true || auth.permissions.users === true
}

// DELETE — remove a ledger entry (management only). If the entry was a payment
// that settled a specific commission, revert that commission to 'pending'.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response
    if (!isManagement(auth)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { id } = await params
    const supabase = (await createClient()) as any

    const { data: entry } = await supabase
      .from('partner_ledger_entries')
      .select('id, partner_id, kind, direction, negocio_id')
      .eq('id', id)
      .single()

    if (!entry) {
      return NextResponse.json({ error: 'Movimento não encontrado' }, { status: 404 })
    }

    const { error } = await supabase
      .from('partner_ledger_entries')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Re-open the commission this payment had settled.
    if (entry.kind === 'payment' && entry.direction === 'debit' && entry.negocio_id) {
      await supabase
        .from('partner_ledger_entries')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('partner_id', entry.partner_id)
        .eq('negocio_id', entry.negocio_id)
        .eq('kind', 'commission')
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Erro ao eliminar movimento de parceiro:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
