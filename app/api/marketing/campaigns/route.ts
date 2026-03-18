import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createCampaignSchema } from '@/lib/validations/marketing'

export async function GET(request: Request) {
  try {
    const supabase = await createClient() as any
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const agent_id = searchParams.get('agent_id')

    let query = supabase
      .from('marketing_campaigns')
      .select(`
        *,
        agent:dev_users!marketing_campaigns_agent_id_fkey(id, commercial_name),
        property:dev_properties!marketing_campaigns_property_id_fkey(id, title, slug)
      `)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (agent_id) query = query.eq('agent_id', agent_id)

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
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

    const { checkout_group_id, payment_method, ...campaignData } = parsed.data

    // Compute total cost
    const total_cost = campaignData.budget_type === 'daily'
      ? campaignData.budget_amount * campaignData.duration_days
      : campaignData.budget_amount

    // Create campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('marketing_campaigns')
      .insert({
        ...campaignData,
        agent_id: user.id,
        total_cost,
        payment_method,
        status: 'pending',
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

      await supabase.from('conta_corrente_transactions').insert({
        agent_id: user.id,
        type: 'DEBIT',
        category: 'marketing_campaign',
        amount: total_cost,
        description: `Campanha Marketing — ${campaignData.objective}`,
        reference_id: campaign.id,
        reference_type: 'marketing_campaign',
        balance_after: newBalance,
        created_by: user.id,
      })
    }

    return NextResponse.json(campaign, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar campanha:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
