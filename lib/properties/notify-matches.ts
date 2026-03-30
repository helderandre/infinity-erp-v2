/**
 * Property-Deal Matching Notifications
 *
 * When a property is created or activated, check all open buyer/renter deals
 * for matching criteria and notify the assigned agents.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = import('@supabase/supabase-js').SupabaseClient<any, any, any>

interface PropertyData {
  id: string
  title: string
  listing_price: number | null
  property_type: string | null
  business_type: string | null
  city: string | null
  zone: string | null
  status: string | null
}

interface MatchingDeal {
  id: string
  lead_id: string
  tipo: string
  localizacao: string | null
  orcamento: number | null
  orcamento_max: number | null
  quartos_min: number | null
  tipo_imovel: string | null
  lead: {
    nome: string
    agent_id: string | null
  }
}

export async function notifyPropertyMatches(
  supabase: SupabaseClient,
  property: PropertyData
): Promise<number> {
  // Only match sale properties
  if (property.business_type !== 'venda' && property.business_type !== 'Venda') return 0
  if (!property.listing_price) return 0

  // Find open buyer deals that could match
  const { data: deals, error } = await supabase
    .from('negocios')
    .select('id, lead_id, tipo, localizacao, orcamento, orcamento_max, quartos_min, tipo_imovel, lead:leads!inner(nome, agent_id)')
    .in('tipo', ['Compra', 'Compra e Venda'])
    .in('estado', ['Aberto', 'Em Acompanhamento', 'Em progresso'])

  if (error || !deals?.length) return 0

  const notifications: Array<{
    recipient_id: string
    type: string
    title: string
    body: string
    link: string
    contact_id: string
  }> = []

  for (const deal of deals as unknown as MatchingDeal[]) {
    const agent = deal.lead?.agent_id
    if (!agent) continue

    // Price match: property price within budget (with 15% tolerance)
    const maxBudget = deal.orcamento_max || deal.orcamento
    if (maxBudget && property.listing_price > maxBudget * 1.15) continue

    const minBudget = deal.orcamento
    if (minBudget && property.listing_price < minBudget * 0.5) continue

    // Location match (if specified)
    if (deal.localizacao) {
      const loc = deal.localizacao.toLowerCase()
      const cityMatch = property.city?.toLowerCase().includes(loc) || loc.includes(property.city?.toLowerCase() || '')
      const zoneMatch = property.zone?.toLowerCase().includes(loc) || loc.includes(property.zone?.toLowerCase() || '')
      if (!cityMatch && !zoneMatch) continue
    }

    // Property type match (if specified)
    if (deal.tipo_imovel && property.property_type) {
      const dealType = deal.tipo_imovel.toLowerCase()
      const propType = property.property_type.toLowerCase()
      if (!propType.includes(dealType) && !dealType.includes(propType)) continue
    }

    // We have a match
    const priceStr = property.listing_price
      ? `${(property.listing_price / 1000).toFixed(0)}k€`
      : ''

    notifications.push({
      recipient_id: agent,
      type: 'property_match',
      title: 'Novo imóvel compatível',
      body: `${property.title || 'Novo imóvel'} (${priceStr}) — corresponde ao negócio de ${deal.lead?.nome || 'lead'}`,
      link: `/dashboard/imoveis/${property.id}`,
      contact_id: deal.lead_id,
    })
  }

  if (notifications.length === 0) return 0

  // Deduplicate by agent (one notification per agent with count)
  const byAgent = new Map<string, typeof notifications>()
  for (const n of notifications) {
    if (!byAgent.has(n.recipient_id)) byAgent.set(n.recipient_id, [])
    byAgent.get(n.recipient_id)!.push(n)
  }

  let sent = 0
  for (const [agentId, agentNotifs] of byAgent) {
    if (agentNotifs.length === 1) {
      await supabase.from('leads_notifications').insert(agentNotifs[0])
      sent++
    } else {
      // Multiple deals match — send a summary notification
      await supabase.from('leads_notifications').insert({
        recipient_id: agentId,
        type: 'property_match',
        title: 'Novo imóvel compatível',
        body: `${property.title || 'Novo imóvel'} corresponde a ${agentNotifs.length} negócios seus`,
        link: `/dashboard/imoveis/${property.id}`,
        contact_id: agentNotifs[0].contact_id,
      })
      sent++
    }
  }

  return sent
}
