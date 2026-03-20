import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'

// GET /api/deals/[id] — Get deal with clients
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const { data: deal, error } = await supabase
      .from('temp_deals')
      .select(`
        *,
        property:dev_properties(id, title, external_ref, city, listing_price),
        consultant:dev_users!temp_deals_consultant_id_fkey(id, commercial_name),
        colleague:dev_users!temp_deals_internal_colleague_id_fkey(id, commercial_name)
      `)
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 })
    }

    // Fetch clients (table not in generated types yet)
    const { data: clients } = await (supabase as any)
      .from('temp_deal_clients')
      .select('*')
      .eq('deal_id', id)
      .order('order_index')

    return NextResponse.json({ ...deal, clients: clients || [] })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PUT /api/deals/[id] — Update deal (partial)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    // Separate clients from deal data
    const { clients, ...dealData } = body

    // Calculate derived fields
    if (dealData.deal_value && dealData.commission_pct) {
      dealData.commission_total = dealData.deal_value * dealData.commission_pct / 100
    }
    if (dealData.cpcv_pct !== undefined) {
      dealData.escritura_pct = 100 - dealData.cpcv_pct
    }
    if (dealData.scenario) {
      dealData.deal_type = dealData.scenario
      dealData.has_share = dealData.scenario !== 'pleno'
      dealData.share_type = dealData.scenario === 'comprador_externo' ? 'external_buyer'
        : dealData.scenario === 'pleno_agencia' ? 'internal_agency'
        : dealData.scenario === 'angariacao_externa' ? 'external_agency'
        : null
      delete dealData.scenario
    }

    // Remove fields that don't map to columns
    delete dealData.colleague_property_id
    delete dealData.property
    delete dealData.consultant
    delete dealData.colleague
    delete dealData.person_type
    delete dealData._aiFilledFields
    delete dealData._raw
    delete dealData.id
    delete dealData.created_at
    delete dealData.created_by

    dealData.updated_at = new Date().toISOString()

    const { error: updateError } = await supabase
      .from('temp_deals')
      .update(dealData)
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Update clients if provided
    if (clients !== undefined) {
      // Delete existing (table not in generated types yet)
      await (supabase as any).from('temp_deal_clients').delete().eq('deal_id', id)

      // Insert new
      if (clients.length > 0) {
        const clientRows = clients.map((c: Record<string, unknown>, i: number) => ({
          deal_id: id,
          person_type: c.person_type || 'singular',
          name: c.name,
          email: c.email || null,
          phone: c.phone || null,
          order_index: i,
        }))

        const { error: clientsError } = await (supabase as any)
          .from('temp_deal_clients')
          .insert(clientRows)

        if (clientsError) {
          return NextResponse.json({ error: 'Erro ao guardar clientes', details: clientsError.message }, { status: 500 })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE /api/deals/[id] — Delete draft
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const { error } = await supabase
      .from('temp_deals')
      .delete()
      .eq('id', id)
      .eq('status', 'draft')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
