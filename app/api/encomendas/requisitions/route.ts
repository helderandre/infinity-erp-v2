import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createRequisitionSchema } from '@/lib/validations/encomenda'

export async function GET(request: Request) {
  try {
    const supabase = await createClient() as any
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const agent_id = searchParams.get('agent_id')
    const priority = searchParams.get('priority')
    const date_from = searchParams.get('date_from')
    const date_to = searchParams.get('date_to')

    let query = supabase
      .from('temp_requisitions')
      .select(`
        *,
        agent:dev_users!temp_requisitions_agent_id_fkey(id, commercial_name),
        property:dev_properties!temp_requisitions_property_id_fkey(id, title, slug),
        items:temp_requisition_items(
          *,
          product:temp_products(id, name, sku, thumbnail_url),
          variant:temp_product_variants(id, name)
        )
      `)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (agent_id) query = query.eq('agent_id', agent_id)
    if (priority) query = query.eq('priority', priority)
    if (date_from) query = query.gte('created_at', date_from)
    if (date_to) query = query.lte('created_at', date_to)

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar requisições:', error)
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
    const parsed = createRequisitionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { items, ...requisitionData } = parsed.data

    // Lookup products to get prices and check approval requirements
    let needsApproval = false
    const itemsWithPrices = []

    for (const item of items) {
      const { data: product, error: productError } = await supabase
        .from('temp_products')
        .select('id, sell_price, requires_approval, approval_threshold, is_personalizable')
        .eq('id', item.product_id)
        .single()

      if (productError || !product) {
        return NextResponse.json({ error: `Produto não encontrado: ${item.product_id}` }, { status: 400 })
      }

      let unitPrice = product.sell_price || 0

      // Add variant additional cost if applicable
      if (item.variant_id) {
        const { data: variant } = await supabase
          .from('temp_product_variants')
          .select('additional_cost')
          .eq('id', item.variant_id)
          .single()

        if (variant?.additional_cost) {
          unitPrice += variant.additional_cost
        }
      }

      const subtotal = unitPrice * item.quantity

      itemsWithPrices.push({
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal,
        personalization_data: item.personalization_data || null,
        notes: item.notes || null,
      })

      // Check if approval is needed
      if (product.requires_approval) {
        needsApproval = true
      }
      if (product.approval_threshold && subtotal > product.approval_threshold) {
        needsApproval = true
      }
    }

    const totalAmount = itemsWithPrices.reduce((sum, item) => sum + item.subtotal, 0)
    const status = needsApproval ? 'pending' : 'approved'

    // Insert requisition
    const { data: requisition, error: reqError } = await supabase
      .from('temp_requisitions')
      .insert({
        ...requisitionData,
        agent_id: user.id,
        total_amount: totalAmount,
        status,
        ...(status === 'approved' ? { approved_by: user.id, approved_at: new Date().toISOString() } : {}),
      })
      .select()
      .single()

    if (reqError) return NextResponse.json({ error: reqError.message }, { status: 500 })

    // Insert items
    const itemsToInsert = itemsWithPrices.map((item) => ({
      ...item,
      requisition_id: requisition.id,
    }))

    const { error: itemsError } = await supabase
      .from('temp_requisition_items')
      .insert(itemsToInsert)

    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })

    // Return full requisition with items
    const { data: fullRequisition, error: fetchError } = await supabase
      .from('temp_requisitions')
      .select(`
        *,
        agent:dev_users!temp_requisitions_agent_id_fkey(id, commercial_name),
        items:temp_requisition_items(
          *,
          product:temp_products(id, name, sku, thumbnail_url),
          variant:temp_product_variants(id, name)
        )
      `)
      .eq('id', requisition.id)
      .single()

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
    return NextResponse.json(fullRequisition, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar requisição:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
