/**
 * Manage the current consultant's iCalendar feed token.
 *
 *  GET  → returns { token, url }, lazily creating one if missing.
 *  POST → rotates the token (invalidates the old URL).
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function generateToken(): string {
  // 32 hex chars from a UUID v4 — 122 bits of entropy is plenty for a
  // non-public read URL. Strip dashes for a cleaner URL.
  return globalThis.crypto.randomUUID().replace(/-/g, '')
}

function buildFeedUrl(request: Request, token: string): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ||
    new URL(request.url).origin
  ).replace(/\/$/, '')
  return `${base}/api/calendar/feed/${token}`
}

async function getOrCreateToken(userId: string): Promise<string> {
  const admin = createAdminClient() as ReturnType<typeof createAdminClient> & {
    from: (table: string) => any
  }

  const { data: existing } = await admin
    .from('dev_consultant_profiles')
    .select('calendar_feed_token')
    .eq('user_id', userId)
    .maybeSingle() as { data: { calendar_feed_token: string | null } | null }

  if (existing?.calendar_feed_token) {
    return existing.calendar_feed_token
  }

  const token = generateToken()

  // Upsert in case the profile row doesn't exist yet (first-time consultants).
  const { error } = await admin
    .from('dev_consultant_profiles')
    .upsert(
      { user_id: userId, calendar_feed_token: token },
      { onConflict: 'user_id' },
    )

  if (error) throw error
  return token
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const token = await getOrCreateToken(user.id)
    return NextResponse.json({ token, url: buildFeedUrl(request, token) })
  } catch (err) {
    console.error('[calendar/feed/token] GET error:', err)
    return NextResponse.json(
      { error: 'Erro ao obter token de calendário' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const newToken = generateToken()
    const admin = createAdminClient() as ReturnType<typeof createAdminClient> & {
      from: (table: string) => any
    }

    const { error } = await admin
      .from('dev_consultant_profiles')
      .upsert(
        { user_id: user.id, calendar_feed_token: newToken },
        { onConflict: 'user_id' },
      )

    if (error) throw error

    return NextResponse.json({
      token: newToken,
      url: buildFeedUrl(request, newToken),
    })
  } catch (err) {
    console.error('[calendar/feed/token] POST error:', err)
    return NextResponse.json(
      { error: 'Erro ao regenerar token de calendário' },
      { status: 500 },
    )
  }
}
