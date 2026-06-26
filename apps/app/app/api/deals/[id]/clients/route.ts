import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/permissions'
import { populateSubtasks } from '@/lib/processes/subtasks/populate'
import { NextResponse } from 'next/server'

// POST /api/deals/[id]/clients — adiciona um comprador (deal_client) a um
// negócio já submetido e repopula as subtarefas de documentos do fecho para o
// novo cliente (repeatPerClient). Idempotente no populate (dedup).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response
    const { id } = await params
    const body = await request.json()

    if (!body?.name || String(body.name).trim().length === 0) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    const supabase = await createClient()

    // Próximo order_index
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('deal_clients')
      .select('order_index')
      .eq('deal_id', id)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextOrder = ((existing?.order_index as number | null) ?? -1) + 1

    const {
      person_type,
      name,
      email,
      phone,
      nif,
      ...kycRest
    } = body as Record<string, unknown>

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertErr } = await (supabase as any)
      .from('deal_clients')
      .insert({
        deal_id: id,
        person_type: person_type || 'singular',
        name,
        email: email || null,
        phone: phone || null,
        nif: (nif as string) || null,
        is_main_contact: false,
        kyc: Object.keys(kycRest).length > 0 ? kycRest : null,
        order_index: nextOrder,
      })
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    // Repopular as subtarefas do fecho para o novo comprador.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deal } = await (supabase as any)
      .from('deals')
      .select('proc_instance_id')
      .eq('id', id)
      .maybeSingle()
    if (deal?.proc_instance_id) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await populateSubtasks(supabase as any, deal.proc_instance_id, 'negocio')
      } catch (err) {
        console.error('[deals/clients] repopulate falhou:', err)
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
