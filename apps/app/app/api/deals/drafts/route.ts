import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'

// GET /api/deals/drafts — List current user's drafts
export async function GET() {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('deals')
      .select(`
        id, deal_type, business_type, deal_value, status, created_at, updated_at,
        property:dev_properties(id, title, external_ref)
      `)
      .eq('created_by', auth.user.id)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
