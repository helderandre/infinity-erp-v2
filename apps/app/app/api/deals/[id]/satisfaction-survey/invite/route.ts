import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/permissions'

/**
 * POST /api/deals/[id]/satisfaction-survey/invite
 *
 * Cria uma row em `client_satisfaction_surveys` com token aleatório
 * opaco. Retorna o link público partilhável `/inquerito/{token}` para
 * o consultor enviar ao cliente (email, WhatsApp, etc.).
 *
 * Idempotência: por defeito permite múltiplos convites por deal (cada
 * com token único). Caller pode passar `?reuse=pending` para reutilizar
 * o último convite ainda não respondido.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id: dealId } = await params
    const url = new URL(request.url)
    const reusePending = url.searchParams.get('reuse') === 'pending'

    const admin = createAdminClient()
    const adminDb = admin as unknown as { from: (t: string) => ReturnType<typeof admin.from> }

    // Fetch deal context to derive consultant_id + lead_id
    const { data: dealRow, error: dealErr } = await adminDb
      .from('deals')
      .select(`
        id, consultant_id, negocio_id,
        negocio:negocios!deals_negocio_id_fkey(lead_id)
      `)
      .eq('id', dealId)
      .maybeSingle()

    if (dealErr || !dealRow) {
      return NextResponse.json({ error: 'Deal não encontrado' }, { status: 404 })
    }

    const deal = dealRow as { id: string; consultant_id: string | null; negocio_id: string | null; negocio?: { lead_id: string | null } | null }

    if (reusePending) {
      const { data: existing } = await adminDb
        .from('client_satisfaction_surveys')
        .select('id, token, invited_at')
        .eq('deal_id', dealId)
        .is('completed_at', null)
        .order('invited_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (existing) {
        const e = existing as { id: string; token: string; invited_at: string }
        return NextResponse.json({
          data: {
            id: e.id,
            token: e.token,
            invited_at: e.invited_at,
            public_url: buildPublicUrl(e.token),
            reused: true,
          },
        })
      }
    }

    // Generate opaque token (32 bytes hex = 64 chars)
    const token = randomBytes(24).toString('base64url')

    const { data: inserted, error: insertErr } = await adminDb
      .from('client_satisfaction_surveys')
      .insert({
        deal_id: dealId,
        consultant_id: deal.consultant_id,
        lead_id: deal.negocio?.lead_id ?? null,
        token,
        invited_by: auth.user.id,
      })
      .select('id, token, invited_at')
      .single()

    if (insertErr || !inserted) {
      return NextResponse.json(
        { error: 'Erro ao criar convite', details: insertErr?.message },
        { status: 500 }
      )
    }

    const ins = inserted as { id: string; token: string; invited_at: string }
    return NextResponse.json({
      data: {
        id: ins.id,
        token: ins.token,
        invited_at: ins.invited_at,
        public_url: buildPublicUrl(ins.token),
        reused: false,
      },
    })
  } catch (err) {
    console.error('[satisfaction-survey/invite]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

function buildPublicUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || ''
  if (base) return `${base.replace(/\/$/, '')}/inquerito/${token}`
  return `/inquerito/${token}`
}
