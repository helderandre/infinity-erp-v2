import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Public endpoint — returns only the candidate's full_name for entry form pre-fill
// No auth required — the candidate ID is the secret
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const admin = createAdminClient() as any
    const { data, error } = await admin
      .from('recruitment_candidates')
      .select('full_name')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ full_name: null }, { status: 404 })
    }

    return NextResponse.json({ full_name: data.full_name })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
