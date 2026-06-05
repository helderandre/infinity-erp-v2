import { createClient } from '@/lib/supabase/server'
import { recordUserActivity } from '@/lib/auth/record-user-activity'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
  const userAgent = req.headers.get('user-agent') || null

  const result = await recordUserActivity(user.id, ip, userAgent)
  return NextResponse.json(result)
}
