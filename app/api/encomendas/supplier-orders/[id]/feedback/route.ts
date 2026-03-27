import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST — submit feedback for a supplier order
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const body = await request.json()
    const { rating, comment, would_recommend, is_anonymous } = body

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Avaliação inválida (1-5).' }, { status: 400 })
    }

    const admin = createAdminClient() as any

    // Check order exists
    const { data: order, error: orderErr } = await admin
      .from('temp_supplier_orders')
      .select('id, supplier_id')
      .eq('id', id)
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Encomenda não encontrada.' }, { status: 404 })
    }

    // Check if user already gave feedback for this order
    const { data: existing } = await admin
      .from('supplier_order_feedback')
      .select('id')
      .eq('order_id', id)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Já submeteu feedback para esta encomenda.' }, { status: 409 })
    }

    // Insert feedback
    const { data: feedback, error: insertErr } = await admin
      .from('supplier_order_feedback')
      .insert({
        order_id: id,
        user_id: user.id,
        rating,
        comment: comment || null,
        would_recommend: would_recommend !== false,
        is_anonymous: is_anonymous === true,
        is_public: false, // admin toggles this later
      })
      .select()
      .single()

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    // Recalculate supplier rating
    const { data: allFeedback } = await admin
      .from('supplier_order_feedback')
      .select('rating')
      .in('order_id',
        (await admin.from('temp_supplier_orders').select('id').eq('supplier_id', order.supplier_id)).data?.map((o: any) => o.id) || []
      )

    if (allFeedback && allFeedback.length > 0) {
      const avg = allFeedback.reduce((s: number, f: any) => s + f.rating, 0) / allFeedback.length
      await admin
        .from('temp_partners')
        .update({ rating_avg: Math.round(avg * 10) / 10, rating_count: allFeedback.length })
        .eq('id', order.supplier_id)
    }

    return NextResponse.json({ data: feedback }, { status: 201 })
  } catch (err) {
    console.error('[supplier-order feedback POST]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

// GET — list feedback for an order
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const admin = createAdminClient() as any

    const { data, error } = await admin
      .from('supplier_order_feedback')
      .select('*, user:dev_users!user_id(id, commercial_name)')
      .eq('order_id', id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [] })
  } catch (err) {
    console.error('[supplier-order feedback GET]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
