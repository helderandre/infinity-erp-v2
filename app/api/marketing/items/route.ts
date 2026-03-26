import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Returns all individual order items with their parent order info, grouped by type
export async function GET() {
  try {
    const supabase = await createClient() as any

    // Fetch service/property items from marketing_order_items + parent order
    const { data: serviceItems, error: svcErr } = await supabase
      .from('marketing_order_items')
      .select(`
        id, name, price, status, quantity, used_count,
        catalog_item_id, pack_id,
        confirmed_date, confirmed_time, proposed_dates, notes, cancelled_reason,
        order:marketing_orders!inner(
          id, status, property_id, address, city, parish, postal_code,
          preferred_date, preferred_time, alternative_date, alternative_time,
          confirmed_date, confirmed_time, created_at, checkout_group_id,
          contact_is_agent, contact_name, contact_phone,
          property_bundle_data,
          agent:dev_users!marketing_orders_agent_id_fkey(id, commercial_name),
          property:dev_properties(id, title, slug)
        )
      `)
      .order('order(created_at)', { ascending: false })

    if (svcErr) {
      return NextResponse.json({ error: svcErr.message }, { status: 500 })
    }

    // Fetch catalog info for category
    const catalogIds = [...new Set((serviceItems || []).map((i: any) => i.catalog_item_id).filter(Boolean))]
    let catalogMap: Record<string, any> = {}
    if (catalogIds.length > 0) {
      const { data: catalogItems } = await supabase
        .from('marketing_catalog')
        .select('id, category, requires_property')
        .in('id', catalogIds)
      if (catalogItems) {
        for (const c of catalogItems) catalogMap[c.id] = c
      }
    }

    // Fetch material requisition items
    const { data: materialItems, error: matErr } = await supabase
      .from('temp_requisition_items')
      .select(`
        id, quantity, unit_price, subtotal, status, notes, personalization_data,
        product:temp_products(id, name, category_id, thumbnail_url, category:temp_product_categories(id, name)),
        requisition:temp_requisitions!inner(
          id, status, checkout_group_id, delivery_type, payment_method, created_at,
          agent:dev_users!temp_requisitions_agent_id_fkey(id, commercial_name)
        )
      `)
      .order('requisition(created_at)', { ascending: false })

    // Flatten product category name and thumbnail for frontend
    const flattenedMaterials = (materialItems || []).map((item: any) => ({
      ...item,
      product: item.product ? {
        id: item.product.id,
        name: item.product.name,
        category: item.product.category?.name || '—',
        thumbnail: item.product.thumbnail_url,
      } : null,
    }))

    // Fetch campaigns
    const { data: campaigns, error: campErr } = await supabase
      .from('marketing_campaigns')
      .select(`
        *,
        agent:dev_users!marketing_campaigns_agent_id_fkey(id, commercial_name),
        property:dev_properties!marketing_campaigns_property_id_fkey(id, title, slug)
      `)
      .order('created_at', { ascending: false })

    // Classify service items
    const propertyItems: any[] = []
    const generalServiceItems: any[] = []

    for (const item of (serviceItems || [])) {
      const catalog = catalogMap[item.catalog_item_id] || {}
      const enriched = {
        ...item,
        category: catalog.category || 'other',
        requires_property: catalog.requires_property || false,
      }
      if (enriched.requires_property) {
        propertyItems.push(enriched)
      } else {
        generalServiceItems.push(enriched)
      }
    }

    return NextResponse.json({
      property: propertyItems,
      services: generalServiceItems,
      materials: flattenedMaterials,
      campaigns: campaigns || [],
    })
  } catch (error) {
    console.error('Erro ao listar items:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
