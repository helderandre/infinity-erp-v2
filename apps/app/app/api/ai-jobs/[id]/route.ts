import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/permissions'

/**
 * GET /api/ai-jobs/[id]
 * Polling individual de um trabalho — usado pelo cliente para actualizar o
 * cartão flutuante de progresso. RLS garante que o utilizador só vê os
 * próprios jobs.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()
    const { data, error } = await (supabase as any)
      .from('ai_jobs')
      .select('id, type, status, payload, result, progress_done, progress_total, error_message, property_id, created_at, started_at, completed_at')
      .eq('id', id)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
    }

    return NextResponse.json({ job: data })
  } catch (err) {
    console.error('[ai-jobs GET id] erro:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/**
 * POST /api/ai-jobs/[id]/cancel — body: {}.
 * Cancela um job ainda pending (já running fica como está; o worker vê o
 * status='cancelled' e termina best-effort). RLS impede cancelar jobs de
 * outros utilizadores.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const url = new URL(request.url)
    const isCancel = url.pathname.endsWith('/cancel')
    if (!isCancel) {
      return NextResponse.json({ error: 'Endpoint não suportado' }, { status: 404 })
    }

    const supabase = await createClient()
    const { data: existing } = await (supabase as any)
      .from('ai_jobs')
      .select('id, status, user_id')
      .eq('id', id)
      .maybeSingle()
    if (!existing || existing.user_id !== auth.user.id) {
      return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })
    }
    if (existing.status === 'completed' || existing.status === 'failed') {
      return NextResponse.json({ error: 'Trabalho já terminou' }, { status: 409 })
    }
    const { error } = await (supabase as any)
      .from('ai_jobs')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      return NextResponse.json({ error: 'Erro ao cancelar', details: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[ai-jobs cancel] erro:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
