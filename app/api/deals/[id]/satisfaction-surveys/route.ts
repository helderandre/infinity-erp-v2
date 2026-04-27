import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/permissions'

/**
 * GET /api/deals/[id]/satisfaction-surveys — lista convites + respostas
 * de um deal. Não devolve as respostas detalhadas (só meta-data).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id: dealId } = await params
    const admin = createAdminClient()
    const adminDb = admin as unknown as { from: (t: string) => ReturnType<typeof admin.from> }

    const { data, error } = await adminDb
      .from('client_satisfaction_surveys')
      .select(`
        id, token, invited_at, completed_at,
        q6_experiencia_global, q7_recomendaria, google_review_clicked_at
      `)
      .eq('deal_id', dealId)
      .order('invited_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    console.error('[GET satisfaction-surveys]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
