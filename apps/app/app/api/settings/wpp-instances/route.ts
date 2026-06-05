import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

export async function GET() {
  try {
    const supabase = createAdminClient()
    const db = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }

    const { data, error } = await (db.from('auto_wpp_instances') as SA)
      .select('id, name, phone, connection_status')
      .eq('status', 'active')
      .order('name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching WhatsApp instances:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
