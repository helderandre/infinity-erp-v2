import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient() as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200)
    const offset = Number(searchParams.get('offset')) || 0

    // a) Completed services (marketing_requests with status = 'completed')
    const { data: completedServices, error: svcError } = await supabase
      .from('marketing_requests')
      .select(`
        id, status, confirmed_date, preferred_date, completed_at, property_id, notes,
        order_item:marketing_order_items(id, name, price, catalog_item_id)
      `)
      .eq('agent_id', user.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })

    if (svcError) {
      console.error('Erro ao buscar serviços concluídos:', svcError)
    }

    // b) Delivered materials (temp_requisitions with status = 'delivered')
    const { data: deliveredMaterials, error: matError } = await supabase
      .from('temp_requisitions')
      .select(`
        id, status, delivered_at, created_at, total_cost, property_id, notes,
        items:temp_requisition_items(
          id, quantity, unit_price,
          product:temp_products(id, name, sku)
        )
      `)
      .eq('agent_id', user.id)
      .eq('status', 'delivered')
      .order('delivered_at', { ascending: false })

    if (matError) {
      console.error('Erro ao buscar materiais entregues:', matError)
    }

    // Build unified timeline
    const items: Array<{
      id: string
      type: string
      name: string
      date: string
      amount: number | null
      metadata: Record<string, any>
    }> = []

    // Map completed services
    if (completedServices) {
      for (const svc of completedServices as any[]) {
        items.push({
          id: svc.id,
          type: 'service_used',
          name: svc.order_item?.name || 'Serviço concluído',
          date: svc.completed_at || svc.confirmed_date || svc.preferred_date || '',
          amount: svc.order_item?.price || null,
          metadata: {
            request_id: svc.id,
            property_id: svc.property_id,
            catalog_item_id: svc.order_item?.catalog_item_id,
            notes: svc.notes,
          },
        })
      }
    }

    // Map delivered materials
    if (deliveredMaterials) {
      for (const mat of deliveredMaterials as any[]) {
        const productNames = (mat.items || [])
          .map((i: any) => i.product?.name)
          .filter(Boolean)
          .join(', ')

        items.push({
          id: mat.id,
          type: 'material_delivered',
          name: productNames || 'Material entregue',
          date: mat.delivered_at || mat.created_at || '',
          amount: mat.total_cost || null,
          metadata: {
            requisition_id: mat.id,
            property_id: mat.property_id,
            items: (mat.items || []).map((i: any) => ({
              product_name: i.product?.name,
              quantity: i.quantity,
              unit_price: i.unit_price,
            })),
            notes: mat.notes,
          },
        })
      }
    }

    // Sort by date descending
    items.sort((a, b) => {
      if (!a.date) return 1
      if (!b.date) return -1
      return b.date.localeCompare(a.date)
    })

    const total = items.length

    // Apply offset and limit
    const paged = items.slice(offset, offset + limit)

    return NextResponse.json({ items: paged, total })
  } catch (error) {
    console.error('Erro ao carregar histórico gestão:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
