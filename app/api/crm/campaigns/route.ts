import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { createCampaignSchema } from '@/lib/validations/leads-crm'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const platform = searchParams.get('platform')
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const supabase = createCrmAdminClient()

    let query = supabase
      .from('leads_campaigns')
      .select('*')
      .order('created_at', { ascending: false })

    if (platform) query = query.eq('platform', platform)
    if (status) query = query.eq('status', status)
    if (search) query = query.ilike('name', `%${search}%`)

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

    const parsed = createCampaignSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const supabase = createCrmAdminClient()

    const { data, error } = await supabase
      .from('leads_campaigns')
      .insert(parsed.data)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
