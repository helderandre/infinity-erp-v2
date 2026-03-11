import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createPackSchema } from '@/lib/validations/marketing'

export async function GET(request: Request) {
  try {
    const supabase = await createClient() as any
    const { searchParams } = new URL(request.url)
    const active = searchParams.get('active')
    const search = searchParams.get('search')

    let query = supabase
      .from('marketing_packs')
      .select(`
        *,
        marketing_pack_items (
          id,
          catalog_item_id,
          marketing_catalog (id, name, price, category)
        )
      `)
      .order('created_at', { ascending: false })

    if (active === 'true') query = query.eq('is_active', true)
    if (active === 'false') query = query.eq('is_active', false)
    if (search) query = query.ilike('name', `%${search}%`)

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Flatten pack items
    const packs = (data || []).map((pack: any) => ({
      ...pack,
      items: (pack.marketing_pack_items || []).map((pi: any) => pi.marketing_catalog).filter(Boolean),
      marketing_pack_items: undefined,
    }))

    return NextResponse.json(packs)
  } catch (error) {
    console.error('Erro ao listar packs:', error)
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
    const parsed = createPackSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { item_ids, ...packData } = parsed.data

    // Create pack
    const { data: pack, error: packError } = await supabase
      .from('marketing_packs')
      .insert(packData)
      .select()
      .single()

    if (packError || !pack) {
      return NextResponse.json({ error: packError?.message || 'Erro ao criar pack' }, { status: 500 })
    }

    // Create pack items
    const packItems = item_ids.map(catalog_item_id => ({
      pack_id: pack.id,
      catalog_item_id,
    }))

    const { error: itemsError } = await supabase
      .from('marketing_pack_items')
      .insert(packItems)

    if (itemsError) {
      // Rollback
      await supabase.from('marketing_packs').delete().eq('id', pack.id)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    return NextResponse.json(pack, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar pack:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
