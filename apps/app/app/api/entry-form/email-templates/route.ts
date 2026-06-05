import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Returns entry-related email templates from tpl_email_library
export async function GET() {
  try {
    const admin = createAdminClient() as any
    const { data, error } = await admin
      .from('tpl_email_library')
      .select('id, name, subject, description, slug, body_html')
      .eq('category', 'recruitment_entry')
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ templates: [] }, { status: 200 })
    }

    return NextResponse.json({ templates: data || [] })
  } catch {
    return NextResponse.json({ templates: [] }, { status: 200 })
  }
}
