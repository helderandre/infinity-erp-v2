import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/inquerito/[token]/submit — PÚBLICO (sem auth).
 *
 * Aceita as respostas e marca o inquérito como concluído. Idempotente:
 * se já estiver `completed_at IS NOT NULL`, retorna 409.
 */

const submitSchema = z.object({
  q1_consultor_ajuda: z.enum(['sim_absolutamente', 'sim_maioria_vezes', 'parcialmente', 'nao']),
  q2_profissionalismo: z.enum(['excelente', 'bom', 'satisfatorio', 'insatisfatorio']),
  q3_acompanhamento: z.enum(['sim', 'parcialmente', 'nao']),
  q4_tempo_resposta: z.enum(['muito_rapido', 'razoavel', 'demorado', 'muito_demorado']),
  q5_transparencia: z.enum(['sim_completamente', 'sim_grande_parte', 'parcialmente', 'nao']),
  q6_experiencia_global: z.enum(['excelente', 'boa', 'razoavel', 'ma']),
  q7_recomendaria: z.enum(['sim_com_certeza', 'talvez', 'provavelmente_nao']),
  q8_referencia: z.string().max(2000).optional().nullable(),
  q9_comentarios: z.string().max(2000).optional().nullable(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    if (!token || token.length < 16) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    const parsed = submitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Respostas inválidas', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const adminDb = admin as unknown as { from: (t: string) => ReturnType<typeof admin.from> }

    // Lookup current survey
    const { data: row } = await adminDb
      .from('client_satisfaction_surveys')
      .select('id, completed_at')
      .eq('token', token)
      .maybeSingle()

    if (!row) {
      return NextResponse.json({ error: 'Inquérito não encontrado' }, { status: 404 })
    }
    const survey = row as { id: string; completed_at: string | null }
    if (survey.completed_at) {
      return NextResponse.json({ error: 'Inquérito já foi submetido' }, { status: 409 })
    }

    // Capture client metadata best-effort
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null
    const userAgent = request.headers.get('user-agent') ?? null

    const { data: updated, error: updateErr } = await adminDb
      .from('client_satisfaction_surveys')
      .update({
        ...parsed.data,
        q8_referencia: parsed.data.q8_referencia ?? null,
        q9_comentarios: parsed.data.q9_comentarios ?? null,
        completed_at: new Date().toISOString(),
        client_ip: clientIp,
        user_agent: userAgent,
      })
      .eq('id', survey.id)
      .select('q6_experiencia_global, q7_recomendaria')
      .single()

    if (updateErr || !updated) {
      return NextResponse.json({ error: 'Erro ao guardar respostas' }, { status: 500 })
    }

    const u = updated as { q6_experiencia_global: string | null; q7_recomendaria: string | null }
    const isPromoter =
      (u.q6_experiencia_global === 'excelente' || u.q6_experiencia_global === 'boa') &&
      u.q7_recomendaria === 'sim_com_certeza'

    return NextResponse.json({
      data: {
        status: 'completed',
        is_promoter: isPromoter,
        google_review_url: isPromoter ? (process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL ?? null) : null,
      },
    })
  } catch (err) {
    console.error('[POST inquerito/submit]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
