import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/permissions'

/**
 * GET /api/deals/thumbnails?ids=a,b,c
 *
 * Para cada deal_id, retorna a primeira foto de `deal_marketing_moments`
 * (ordenada por created_at ASC). Usado pela listing `/dashboard/negocios`
 * para hidratar o hero do <NegocioCard> sem N+1 queries.
 *
 * Resposta: `{ data: { [dealId]: string | null } }`. Deals sem moment
 * ficam com `null` — o card usa deal logo como placeholder.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const url = new URL(request.url)
    const idsParam = url.searchParams.get('ids')
    if (!idsParam) {
      return NextResponse.json({ data: {} })
    }
    const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 100)
    if (ids.length === 0) return NextResponse.json({ data: {} })

    const admin = createAdminClient()
    const adminDb = admin as unknown as { from: (t: string) => ReturnType<typeof admin.from> }

    const { data, error } = await adminDb
      .from('deal_marketing_moments')
      .select('deal_id, photo_urls, created_at')
      .in('deal_id', ids)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    type Row = { deal_id: string; photo_urls: string[] | null; created_at: string }
    const result: Record<string, string | null> = Object.fromEntries(ids.map((id) => [id, null]))
    for (const row of (data ?? []) as Row[]) {
      if (result[row.deal_id]) continue // already filled with the earliest
      const first = (row.photo_urls ?? [])[0]
      if (first) result[row.deal_id] = first
    }

    return NextResponse.json({ data: result })
  } catch (err) {
    console.error('[GET deals/thumbnails]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
