// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Bulk-mark all `leads_entries` of this contact (lead) with status='new' as
 * 'seen'. Triggered when the consultant opens the "Leads" sheet on the
 * lead detail page — so the unread badge clears.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('leads_entries')
      .update({ status: 'seen' })
      .eq('contact_id', id)
      .eq('status', 'new')
      .select('id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ updated: data?.length ?? 0 })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
