import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Auth gate for the partners app. Role-based access to this surface is
// enforced in the dashboard server component via canAccessSurface('parceiros').
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Public auth routes (no session required).
  const authPaths = ['/login', '/forgot-password', '/verify-otp', '/reset-password']
  const isAuthPath = authPaths.some((p) => request.nextUrl.pathname.startsWith(p))

  // Logged-in users skipping login/forgot land on the portal. We allow
  // /reset-password even when authed (verify-otp signs the user in before they
  // set the new password).
  const isResetPassword = request.nextUrl.pathname.startsWith('/reset-password')
  if (user && isAuthPath && !isResetPassword) {
    return NextResponse.redirect(new URL('/leads', request.url))
  }
  if (!user && !isAuthPath) {
    const url = new URL('/login', request.url)
    url.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
