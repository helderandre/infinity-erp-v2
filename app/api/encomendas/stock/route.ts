import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient() as any
    const { searchParams } = new URL(request.url)

    const alerts_only = searchParams.get('alerts_only')

    const { data, error } = await supabase
      .from('temp_stock')
      .select(`
        *,
        product:temp_products(
          id, name, sku, thumbnail_url, min_stock_alert,
          category:temp_product_categories(id, name)
        ),
        variant:temp_product_variants(id, name)
      `)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let result = data || []

    // Filter for low stock alerts
    if (alerts_only === 'true') {
      result = result.filter((item: any) => {
        const minAlert = item.product?.min_stock_alert || 0
        return item.quantity_available <= minAlert
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao listar stock:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
