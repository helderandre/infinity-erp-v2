// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('leads_entries')
      .select(`
        *,
        campaign:leads_campaigns(id, name, platform, description, budget, start_date, end_date, status, sector),
        partner:leads_partners(id, name),
        assigned_consultant:dev_users!leads_entries_assigned_consultant_id_fkey(id, commercial_name),
        referral_consultant:dev_users!leads_entries_referral_consultant_id_fkey(id, commercial_name)
      `)
      .eq('contact_id', id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
