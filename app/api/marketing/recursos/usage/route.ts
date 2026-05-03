import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/permissions'
import { PERSONAL_DRIVE_LIMIT_BYTES } from '@/lib/marketing/personal-drive'

/**
 * GET /api/marketing/recursos/usage
 *
 * Returns the caller's personal-drive usage and the configured limit, used
 * by the UI to render a usage bar and gate uploads client-side.
 *
 * Response: { used_bytes, limit_bytes, file_count }
 */
export async function GET() {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('marketing_resources' as any)
    .select('file_size')
    .eq('scope', 'personal')
    .eq('owner_id', auth.user.id)
    .eq('is_folder', false)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = ((data as unknown as Array<{ file_size: number | null }> | null) ?? [])
  const used_bytes = rows.reduce<number>(
    (sum, r) => sum + Number(r.file_size ?? 0),
    0,
  )

  return NextResponse.json(
    {
      used_bytes,
      limit_bytes: PERSONAL_DRIVE_LIMIT_BYTES,
      file_count: rows.length,
    },
    { headers: { 'Cache-Control': 'private, max-age=10' } },
  )
}
