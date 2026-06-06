import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'

function isManagement(auth: { permissions: Record<string, boolean> }) {
  return auth.permissions.financial === true || auth.permissions.users === true
}

// GET — overview of all referral partners (dev_users that are referrers on any
// négocio OR already have a ledger entry) with their balance + "a receber".
// Management only.
export async function GET() {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response
    if (!isManagement(auth)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const supabase = (await createClient()) as any

    // Partner ids: referrers on négocios + anyone with a ledger entry.
    const [{ data: refRows }, { data: ledgerRows }] = await Promise.all([
      supabase
        .from('negocios')
        .select('referrer_consultant_id')
        .not('referrer_consultant_id', 'is', null),
      supabase.from('partner_ledger_entries').select('partner_id'),
    ])

    const ids = new Set<string>()
    for (const r of refRows || []) if (r.referrer_consultant_id) ids.add(r.referrer_consultant_id)
    for (const r of ledgerRows || []) if (r.partner_id) ids.add(r.partner_id)
    const partnerIds = Array.from(ids)
    if (partnerIds.length === 0) return NextResponse.json({ data: [] })

    const [{ data: users }, { data: entries }] = await Promise.all([
      supabase
        .from('dev_users')
        .select('id, commercial_name, dev_consultant_profiles(profile_photo_url)')
        .in('id', partnerIds),
      supabase
        .from('partner_ledger_entries')
        .select('partner_id, kind, direction, amount, status')
        .in('partner_id', partnerIds),
    ])

    const agg: Record<string, { credits: number; debits: number; a_receber: number }> = {}
    for (const id of partnerIds) agg[id] = { credits: 0, debits: 0, a_receber: 0 }
    for (const e of entries || []) {
      const a = agg[e.partner_id]
      if (!a) continue
      const amt = Number(e.amount) || 0
      if (e.direction === 'credit') a.credits += amt
      else a.debits += amt
      if (e.kind === 'commission' && e.status === 'pending') a.a_receber += amt
    }

    const data = (users || [])
      .map((u: any) => {
        const a = agg[u.id] || { credits: 0, debits: 0, a_receber: 0 }
        return {
          partner_id: u.id,
          commercial_name: u.commercial_name,
          profile_photo_url: u.dev_consultant_profiles?.profile_photo_url ?? null,
          saldo: Math.round((a.credits - a.debits) * 100) / 100,
          total_a_receber: Math.round(a.a_receber * 100) / 100,
        }
      })
      .sort((a: any, b: any) => a.commercial_name?.localeCompare(b.commercial_name ?? '') ?? 0)

    return NextResponse.json({ data })
  } catch (err) {
    console.error('Erro ao listar parceiros:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
