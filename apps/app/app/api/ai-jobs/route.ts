import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/permissions'
import { createJobSchema } from '@/lib/validations/ai-jobs'

/**
 * POST /api/ai-jobs
 * Enfileira um trabalho assíncrono. Retorna imediatamente com o `id` do job —
 * o cron worker (`/api/cron/process-ai-jobs`) processa em background. O
 * cliente faz polling em GET /api/ai-jobs/[id] OU recebe push notification
 * quando termina.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const body = await request.json().catch(() => ({}))
    const parsed = createJobSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const supabase = await createClient()

    // Verificar que o caller tem acesso ao imóvel (via consultant_id ou
    // gestão). Reusa o RLS — `dev_properties` SELECT vai filtrar.
    const { data: property, error: propErr } = await supabase
      .from('dev_properties')
      .select('id, consultant_id')
      .eq('id', parsed.data.property_id)
      .maybeSingle()
    if (propErr || !property) {
      return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 })
    }

    // Calcular progress_total a partir do payload (varia por tipo).
    let progressTotal = 1
    if (parsed.data.type === 'image_stage' || parsed.data.type === 'image_enhance') {
      progressTotal = parsed.data.payload.media_ids.length
    } else if (parsed.data.type === 'planta_3d') {
      progressTotal = parsed.data.payload.variants
    }

    const { data: job, error: insertErr } = await (supabase as any)
      .from('ai_jobs')
      .insert({
        user_id: auth.user.id,
        property_id: parsed.data.property_id,
        type: parsed.data.type,
        status: 'pending',
        payload: parsed.data.payload,
        progress_total: progressTotal,
      })
      .select('id, type, status, progress_done, progress_total, created_at')
      .single()

    if (insertErr || !job) {
      console.error('[ai-jobs POST] insert error:', insertErr)
      return NextResponse.json(
        { error: 'Erro ao criar trabalho', details: insertErr?.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ job })
  } catch (err) {
    console.error('[ai-jobs POST] erro:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/**
 * GET /api/ai-jobs?status=pending,running
 * Lista os trabalhos do utilizador (por defeito apenas em curso) — usado
 * pelo cliente ao montar a app para restaurar o cartão flutuante de
 * progresso.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status') || 'pending,running'
    const statuses = statusParam.split(',').map((s) => s.trim()).filter(Boolean)
    const propertyId = searchParams.get('property_id')

    const supabase = await createClient()
    let q = (supabase as any)
      .from('ai_jobs')
      .select('id, type, status, payload, result, progress_done, progress_total, error_message, property_id, created_at, started_at, completed_at')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    if (statuses.length > 0) q = q.in('status', statuses)
    if (propertyId) q = q.eq('property_id', propertyId)

    const { data, error } = await q
    if (error) {
      console.error('[ai-jobs GET] erro:', error)
      return NextResponse.json({ jobs: [] })
    }

    return NextResponse.json({ jobs: data ?? [] })
  } catch (err) {
    console.error('[ai-jobs GET] erro:', err)
    return NextResponse.json({ jobs: [] })
  }
}
