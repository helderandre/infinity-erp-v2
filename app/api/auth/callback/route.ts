import { createClient } from '@/lib/supabase/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(new URL('/reset-password', request.url))
      }

      if (data.user) {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          || request.headers.get('x-real-ip')
          || null
        const userAgent = request.headers.get('user-agent') || null
        try {
          await createCrmAdminClient().from('dev_user_logins').insert({
            user_id: data.user.id,
            ip_address: ip,
            user_agent: userAgent,
          })
        } catch (e) {
          console.error('[auth callback] failed to record login', e)
        }
      }

      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  return NextResponse.redirect(new URL('/login', request.url))
}
