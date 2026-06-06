import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/permissions'

// Partner ledger — running account of referral commissions (credits) and
// payments (debits) per partner (referrer dev_users).
//
// Scope: management (permissions.financial || permissions.users) can read/write
// any partner; a partner can only read their own ledger.

function isManagement(auth: { permissions: Record<string, boolean> }) {
  return auth.permissions.financial === true || auth.permissions.users === true
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─── GET — entries + summary for one partner ────────────────────────────────
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(request.url)
    const requested = searchParams.get('partner_id')
    const management = isManagement(auth)

    // Non-management is locked to self.
    const partner_id = management ? requested || auth.user.id : auth.user.id
    if (!management && requested && requested !== auth.user.id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const supabase = (await createClient()) as any

    const { data: entries, error } = await supabase
      .from('partner_ledger_entries')
      .select(
        `*,
        negocio:negocios!partner_ledger_entries_negocio_id_fkey(
          id, tipo, localizacao,
          lead:leads!negocios_lead_id_fkey(nome)
        ),
        creator:dev_users!partner_ledger_entries_created_by_fkey(commercial_name)`
      )
      .eq('partner_id', partner_id)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = entries || []
    let credits = 0
    let debits = 0
    let total_comissoes = 0
    let total_a_receber = 0
    for (const e of rows) {
      const amt = Number(e.amount) || 0
      if (e.direction === 'credit') credits += amt
      else debits += amt
      if (e.kind === 'commission') {
        total_comissoes += amt
        if (e.status === 'pending') total_a_receber += amt
      }
    }

    return NextResponse.json({
      data: rows,
      summary: {
        saldo: Math.round((credits - debits) * 100) / 100,
        total_a_receber: Math.round(total_a_receber * 100) / 100,
        total_pago: Math.round(debits * 100) / 100,
        total_comissoes: Math.round(total_comissoes * 100) / 100,
        count: rows.length,
      },
    })
  } catch (err) {
    console.error('Erro ao listar conta corrente de parceiro:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// ─── POST — record a payment or adjustment (management only) ─────────────────
const createSchema = z.object({
  partner_id: z.string().regex(UUID_RE),
  kind: z.enum(['payment', 'adjustment']),
  direction: z.enum(['credit', 'debit']),
  amount: z.number().positive(),
  description: z.string().trim().min(1).max(500),
  entry_date: z.string().optional(),
  // When settling a specific confirmed commission, pass its négocio so that
  // commission flips to 'paid' and leaves "a receber".
  negocio_id: z.string().regex(UUID_RE).optional().nullable(),
})

export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response
    if (!isManagement(auth)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const parsed = createSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { partner_id, kind, direction, amount, description, entry_date, negocio_id } = parsed.data

    const supabase = (await createClient()) as any

    const { data, error } = await supabase
      .from('partner_ledger_entries')
      .insert({
        partner_id,
        kind,
        direction,
        amount,
        status: 'completed',
        negocio_id: negocio_id ?? null,
        description,
        entry_date: entry_date || new Date().toISOString().slice(0, 10),
        created_by: auth.user.id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // If this payment settles a specific commission, mark it paid.
    if (kind === 'payment' && direction === 'debit' && negocio_id) {
      await supabase
        .from('partner_ledger_entries')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('partner_id', partner_id)
        .eq('negocio_id', negocio_id)
        .eq('kind', 'commission')
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('Erro ao criar movimento de parceiro:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
