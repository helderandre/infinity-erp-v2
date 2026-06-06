import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/permissions'
import { computeReferralCommission } from '@/lib/partner-ledger/referral-commission'

function isManagement(auth: { permissions: Record<string, boolean> }) {
  return auth.permissions.financial === true || auth.permissions.users === true
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const schema = z.object({
  negocio_id: z.string().regex(UUID_RE),
  // Optional override; defaults to the computed referral commission.
  amount: z.number().positive().optional(),
})

// POST — management confirms a won deal's referral commission, creating a
// 'pending' credit entry (the "a receber"). Idempotent via the unique index
// on (negocio_id) WHERE kind='commission'.
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response
    if (!isManagement(auth)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { negocio_id } = parsed.data

    const supabase = (await createClient()) as any

    const { data: negocio, error: nErr } = await supabase
      .from('negocios')
      .select(
        `id, tipo, localizacao, referrer_consultant_id, referral_pct, expected_value,
         preco_venda, orcamento, orcamento_max, renda_pretendida, renda_max_mensal,
         lead:leads!negocios_lead_id_fkey(nome)`
      )
      .eq('id', negocio_id)
      .single()
    if (nErr || !negocio) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
    }
    if (!negocio.referrer_consultant_id) {
      return NextResponse.json(
        { error: 'Este negócio não tem parceiro de referência' },
        { status: 400 }
      )
    }

    // Already confirmed? Return it (idempotent).
    const { data: existing } = await supabase
      .from('partner_ledger_entries')
      .select('*')
      .eq('negocio_id', negocio_id)
      .eq('kind', 'commission')
      .maybeSingle()
    if (existing) return NextResponse.json(existing, { status: 200 })

    const { data: setting } = await supabase
      .from('temp_agency_settings')
      .select('value')
      .eq('key', 'default_referral_pct')
      .maybeSingle()
    const parsedPct = parseFloat(setting?.value ?? '')
    const defaultPctFraction = Number.isFinite(parsedPct) ? parsedPct / 100 : 0.25

    const amount =
      parsed.data.amount ??
      computeReferralCommission(negocio, { defaultPctFraction })
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Comissão calculada é zero — defina um valor manualmente' },
        { status: 400 }
      )
    }

    const leadName = negocio.lead?.nome ?? 'Negócio'
    const where = negocio.localizacao ? ` (${negocio.localizacao})` : ''

    const { data, error } = await supabase
      .from('partner_ledger_entries')
      .insert({
        partner_id: negocio.referrer_consultant_id,
        kind: 'commission',
        direction: 'credit',
        amount,
        status: 'pending',
        negocio_id,
        description: `Comissão — ${leadName}${where}`,
        entry_date: new Date().toISOString().slice(0, 10),
        created_by: auth.user.id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('Erro ao confirmar comissão:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
