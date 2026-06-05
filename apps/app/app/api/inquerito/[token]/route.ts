import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/inquerito/[token] — endpoint PÚBLICO (sem auth).
 *
 * Devolve o estado do inquérito identificado pelo token:
 *   - 404 se token inválido
 *   - { status: 'pending', deal_reference, consultant_name } se ainda não preenchido
 *   - { status: 'completed', completed_at } se já submetido (idempotente)
 *
 * Não devolve as respostas em si — só o estado.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    if (!token || token.length < 16) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 404 })
    }

    const admin = createAdminClient()
    const adminDb = admin as unknown as { from: (t: string) => ReturnType<typeof admin.from> }

    const { data: row } = await adminDb
      .from('client_satisfaction_surveys')
      .select(`
        id, token, completed_at,
        deal:deals!client_satisfaction_surveys_deal_id_fkey(
          id, reference,
          property:dev_properties!deals_property_id_fkey(address_street, city)
        ),
        consultant:dev_users!client_satisfaction_surveys_consultant_id_fkey(commercial_name)
      `)
      .eq('token', token)
      .maybeSingle()

    if (!row) {
      return NextResponse.json({ error: 'Inquérito não encontrado' }, { status: 404 })
    }

    const survey = row as {
      id: string
      token: string
      completed_at: string | null
      deal?: {
        id: string
        reference: string | null
        property?: { address_street: string | null; city: string | null } | null
      } | null
      consultant?: { commercial_name: string | null } | null
    }

    return NextResponse.json({
      data: {
        status: survey.completed_at ? 'completed' : 'pending',
        completed_at: survey.completed_at,
        deal_reference: survey.deal?.reference ?? null,
        property_address: survey.deal?.property
          ? [survey.deal.property.address_street, survey.deal.property.city].filter(Boolean).join(', ')
          : null,
        consultant_name: survey.consultant?.commercial_name ?? null,
      },
    })
  } catch (err) {
    console.error('[GET inquerito/token]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
