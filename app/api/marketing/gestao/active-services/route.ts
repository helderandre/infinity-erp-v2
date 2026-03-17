import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient() as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // a) Active subscriptions (active or billing_failed)
    const { data: subscriptions, error: subError } = await supabase
      .from('marketing_subscriptions')
      .select(`
        *,
        catalog_item:marketing_catalog!marketing_subscriptions_catalog_item_id_fkey(
          id, name, category, description, thumbnail, price, is_subscription, billing_cycle
        )
      `)
      .eq('agent_id', user.id)
      .in('status', ['active', 'billing_failed'])
      .order('created_at', { ascending: false })

    if (subError) {
      return NextResponse.json({ error: subError.message }, { status: 500 })
    }

    // Collect subscription catalog_item_ids so we can exclude them from available items
    const subscriptionCatalogIds = new Set(
      (subscriptions || []).map((s: any) => s.catalog_item_id).filter(Boolean)
    )

    // b) Available (unused) order items for this agent
    // First get all order IDs belonging to this agent
    const { data: agentOrders, error: ordError } = await supabase
      .from('marketing_orders')
      .select('id')
      .eq('agent_id', user.id)

    if (ordError) {
      return NextResponse.json({ error: ordError.message }, { status: 500 })
    }

    const orderIds = (agentOrders || []).map((o: any) => o.id)

    let available_items: any[] = []

    if (orderIds.length > 0) {
      const { data: items, error: itemsError } = await supabase
        .from('marketing_order_items')
        .select(`
          *,
          catalog_item:marketing_catalog(
            id, name, category, description, thumbnail, is_subscription,
            requires_scheduling, requires_property
          )
        `)
        .in('order_id', orderIds)
        .eq('status', 'available')
        .order('created_at', { ascending: false })

      if (itemsError) {
        return NextResponse.json({ error: itemsError.message }, { status: 500 })
      }

      // Filter out subscription items (those are shown in the subscriptions section)
      available_items = (items || []).filter((item: any) => {
        if (!item.catalog_item) return true
        if (item.catalog_item.is_subscription) return false
        if (subscriptionCatalogIds.has(item.catalog_item_id)) return false
        return true
      })
    }

    return NextResponse.json({
      subscriptions: subscriptions || [],
      available_items,
    })
  } catch (error) {
    console.error('Erro ao carregar serviços activos:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
