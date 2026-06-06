import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { computeReferralCommission } from '@/lib/partner-ledger/referral-commission'

function isManagement(auth: { permissions: Record<string, boolean> }) {
  return auth.permissions.financial === true || auth.permissions.users === true
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET — won referred deals for a partner that do NOT yet have a confirmed
// commission entry, each with the computed commission amount. Management only.
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response
    if (!isManagement(auth)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const partner_id = new URL(request.url).searchParams.get('partner_id')
    if (!partner_id || !UUID_RE.test(partner_id)) {
      return NextResponse.json({ error: 'partner_id em falta' }, { status: 400 })
    }

    const supabase = (await createClient()) as any

    // Won terminal stages.
    const { data: stages } = await supabase
      .from('leads_pipeline_stages')
      .select('id, pipeline_type')
      .eq('is_terminal', true)
      .eq('terminal_type', 'won')
    const wonStageIds = (stages || []).map((s: any) => s.id)
    if (wonStageIds.length === 0) return NextResponse.json({ data: [] })

    // Agency default referral pct.
    const { data: setting } = await supabase
      .from('temp_agency_settings')
      .select('value')
      .eq('key', 'default_referral_pct')
      .maybeSingle()
    const parsedPct = parseFloat(setting?.value ?? '')
    const defaultPctFraction = Number.isFinite(parsedPct) ? parsedPct / 100 : 0.25

    // Won deals referred by this partner.
    const { data: negocios, error } = await supabase
      .from('negocios')
      .select(
        `id, tipo, localizacao, won_date, referral_pct, expected_value,
         preco_venda, orcamento, orcamento_max, renda_pretendida, renda_max_mensal,
         lead:leads!negocios_lead_id_fkey(nome)`
      )
      .eq('referrer_consultant_id', partner_id)
      .in('pipeline_stage_id', wonStageIds)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Exclude deals that already have a commission entry.
    const { data: existing } = await supabase
      .from('partner_ledger_entries')
      .select('negocio_id')
      .eq('partner_id', partner_id)
      .eq('kind', 'commission')
    const done = new Set((existing || []).map((e: any) => e.negocio_id))

    const data = (negocios || [])
      .filter((n: any) => !done.has(n.id))
      .map((n: any) => ({
        negocio_id: n.id,
        lead_name: n.lead?.nome ?? 'Sem nome',
        tipo: n.tipo,
        localizacao: n.localizacao,
        won_date: n.won_date,
        referral_pct: n.referral_pct,
        amount: computeReferralCommission(n, { defaultPctFraction }),
      }))
      .filter((d: any) => d.amount > 0)

    return NextResponse.json({ data })
  } catch (err) {
    console.error('Erro ao listar comissões pendentes:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
