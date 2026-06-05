import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { createPartnerSchema } from '@/lib/validations/leads-crm'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const partner_type = searchParams.get('partner_type')
    const is_active = searchParams.get('is_active')
    const search = searchParams.get('search')

    const supabase = createCrmAdminClient()

    let query = supabase
      .from('leads_partners')
      .select('*')
      .order('created_at', { ascending: false })

    if (partner_type) query = query.eq('partner_type', partner_type)
    if (is_active !== null) query = query.eq('is_active', is_active === 'true')
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`
      )
    }

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const parsed = createPartnerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const supabase = createCrmAdminClient()

    const magic_link_token = crypto.randomUUID()
    const magic_link_expires_at = new Date(
      Date.now() + 365 * 24 * 60 * 60 * 1000
    ).toISOString()

    const { data, error } = await supabase
      .from('leads_partners')
      .insert({ ...parsed.data, magic_link_token, magic_link_expires_at })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
