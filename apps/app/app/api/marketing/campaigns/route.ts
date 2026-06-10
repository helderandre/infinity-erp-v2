import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createCampaignSchema } from '@/lib/validations/marketing'
import { requireAuth } from '@/lib/auth/permissions'
import { isPartner } from '@/lib/auth/roles'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { getMetaCampaignSummaries } from '@/lib/meta/campaign-queries'

// GET — listagem de campanhas.
//
// Scope:
//   - gestão (permissions.users) vê tudo + pode filtrar por agent_id;
//   - parceiro (role Parceiro) vê as campanhas que lhe foram atribuídas
//     (partner_id = self) — alimenta a secção Meta do portal de parceiros;
//   - consultor só vê as suas (agent_id = self).
// Quando há meta_campaign_id ligado, dobramos os dados Meta ao vivo (nome,
// estado, leads, anúncios, investimento) por campanha.
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = await createClient() as any
    const canSeeAll = auth.permissions.users === true
    const partner = isPartner(auth.roles)
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const partnerStatus = searchParams.get('partner_status')
    const agent_id_param = searchParams.get('agent_id')

    let query = supabase
      .from('marketing_campaigns')
      .select(`
        *,
        agent:dev_users!marketing_campaigns_agent_id_fkey(id, commercial_name),
        partner:dev_users!marketing_campaigns_partner_id_fkey(id, commercial_name),
        property:dev_properties!marketing_campaigns_property_id_fkey(id, title, slug)
      `)
      .order('created_at', { ascending: false })

    if (partner && !canSeeAll) {
      // A partner only ever sees campaigns routed to them.
      query = query.eq('partner_id', auth.user.id)
    } else {
      const effectiveAgentId = canSeeAll ? agent_id_param : auth.user.id
      if (effectiveAgentId) query = query.eq('agent_id', effectiveAgentId)
    }

    if (status) query = query.eq('status', status)
    if (partnerStatus) query = query.eq('partner_status', partnerStatus)

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = (data || []) as any[]

    // Fold in live Meta data for campaigns that have been linked.
    const linkedIds = rows.map((r) => r.meta_campaign_id).filter(Boolean) as string[]
    if (linkedIds.length > 0) {
      try {
        const summaries = await getMetaCampaignSummaries(createCrmAdminClient(), linkedIds)
        for (const r of rows) {
          if (r.meta_campaign_id && summaries[r.meta_campaign_id]) {
            r.meta = summaries[r.meta_campaign_id]
          }
        }
      } catch (e) {
        // Live Meta enrichment is best-effort — never fail the listing.
        console.error('Erro ao enriquecer campanhas com dados Meta:', e)
      }
    }

    return NextResponse.json(rows)
  } catch (error) {
    console.error('Erro ao listar campanhas:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient() as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createCampaignSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { checkout_group_id, payment_method, management_fee, ...campaignData } = parsed.data

    // Compute total cost (ads budget + management fee, when applicable)
    const ads_budget = campaignData.budget_type === 'daily'
      ? campaignData.budget_amount * campaignData.duration_days
      : campaignData.budget_amount
    const total_cost = ads_budget + (management_fee ?? 0)

    // Create campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('marketing_campaigns')
      .insert({
        ...campaignData,
        agent_id: user.id,
        total_cost,
        management_fee: management_fee ?? 0,
        payment_method,
        status: 'pending',
        partner_status: 'pedido',
        ...(checkout_group_id ? { checkout_group_id } : {}),
      })
      .select()
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: campaignError?.message || 'Erro ao criar campanha' }, { status: 500 })
    }

    // Debit conta corrente if applicable
    if (payment_method === 'conta_corrente') {
      const { data: lastTx } = await supabase
        .from('conta_corrente_transactions')
        .select('balance_after')
        .eq('agent_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const currentBalance = lastTx?.balance_after ?? 0
      const newBalance = currentBalance - total_cost

      // category 'marketing_campaign' não existe no CHECK da tabela — usar
      // 'marketing_purchase' como as encomendas; reference_type distingue.
      const { error: txError } = await supabase.from('conta_corrente_transactions').insert({
        agent_id: user.id,
        type: 'DEBIT',
        category: 'marketing_purchase',
        amount: total_cost,
        description: `Campanha Marketing — ${campaignData.objective}`,
        settlement_status: 'pending',
        reference_id: campaign.id,
        reference_type: 'marketing_campaign',
        balance_after: newBalance,
        created_by: user.id,
      })
      if (txError) {
        console.error('Erro ao debitar conta corrente da campanha:', campaign.id, txError)
        return NextResponse.json(
          { error: 'Campanha criada mas falhou o débito em conta corrente. Contacte a gestão.' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(campaign, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar campanha:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
