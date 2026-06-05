import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/encomendas/requisitions/items-for-order
 * Returns approved requisition items that haven't been fully ordered yet,
 * grouped by agent, with the agent's billing details (personal + empresa).
 */
export async function GET() {
  try {
    const supabase = await createClient() as any

    // Get approved requisitions with invoice payment that have items not yet ordered
    const { data: requisitions, error } = await supabase
      .from('temp_requisitions')
      .select(`
        id, reference, agent_id, payment_method, total_amount, created_at,
        agent:dev_users!temp_requisitions_agent_id_fkey(id, commercial_name),
        items:temp_requisition_items(
          id, product_id, variant_id, quantity, unit_price, subtotal, personalization_data, notes, status,
          product:temp_products(id, name, sku, thumbnail_url),
          variant:temp_product_variants(id, name)
        )
      `)
      .in('status', ['approved', 'in_production'])
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Collect unique agent IDs
    const agentIds = [...new Set((requisitions || []).map((r: any) => r.agent_id))]

    if (agentIds.length === 0) {
      return NextResponse.json([])
    }

    // Fetch billing details for all agents
    const { data: privateData, error: privateError } = await supabase
      .from('dev_consultant_private_data')
      .select('user_id, full_name, nif, address_private, has_company, company_name, company_nipc, company_address, company_email')
      .in('user_id', agentIds)

    if (privateError) {
      console.error('Error fetching private data:', privateError)
    }

    const billingByAgent = new Map<string, any>()
    for (const pd of privateData || []) {
      const billing: any = {
        personal: {
          name: pd.full_name,
          nif: pd.nif,
          address: pd.address_private,
          email: null,
        },
      }
      if (pd.has_company && pd.company_name) {
        billing.empresa = {
          name: pd.company_name,
          nif: pd.company_nipc,
          address: pd.company_address,
          email: pd.company_email,
        }
      }
      billingByAgent.set(pd.user_id, billing)
    }

    // Group by agent
    const agentMap = new Map<string, any>()
    for (const req of requisitions || []) {
      if (!agentMap.has(req.agent_id)) {
        agentMap.set(req.agent_id, {
          agent_id: req.agent_id,
          agent_name: req.agent?.commercial_name ?? '—',
          billing: billingByAgent.get(req.agent_id) ?? null,
          requisitions: [],
        })
      }
      agentMap.get(req.agent_id).requisitions.push({
        id: req.id,
        reference: req.reference,
        payment_method: req.payment_method,
        total_amount: req.total_amount,
        created_at: req.created_at,
        items: req.items || [],
      })
    }

    return NextResponse.json(Array.from(agentMap.values()))
  } catch (error) {
    console.error('Erro ao listar itens para encomenda:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
