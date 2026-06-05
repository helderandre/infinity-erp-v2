/**
 * POST /api/crm/negocios/bulk-update
 *
 * Bulk wrapper around the existing single-target negócio update routes:
 *   • PUT /api/crm/negocios/[id]/stage  — stage moves (incl. lost-reason)
 *   • PUT /api/crm/negocios/[id]        — generic patch (consultor,
 *                                         temperatura, etc.)
 *
 * Used by the kanban multi-select for these actions:
 *   • Mover de fase em massa
 *   • Marcar como perdido em massa     (sets a terminal-lost stage)
 *   • Reatribuir consultor em massa
 *   • Mudar temperatura em massa
 *
 * Body shape:
 *   {
 *     negocio_ids: string[],
 *     patch: {
 *       pipeline_stage_id?: string,         // moves stage (uses /stage)
 *       lost_reason?: string,               // required when target is terminal_lost
 *       lost_notes?: string,
 *       assigned_consultant_id?: string,    // reassign — null clears
 *       temperatura?: 'Frio' | 'Morno' | 'Quente'
 *     }
 *   }
 *
 * For each id, the endpoint decides which underlying route to forward
 * to: pipeline_stage_id sets go through `/stage` (so the lost-reason
 * validation + terminal_type bookkeeping stays in one place); everything
 * else goes through the generic update route. Auth is preserved via the
 * caller's cookie.
 *
 * Returns:
 *   { results: [{ negocio_id, ok, error? }] }
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const TEMPERATURAS = ['Frio', 'Morno', 'Quente'] as const

const PatchSchema = z
  .object({
    pipeline_stage_id: z.string().min(1).optional(),
    lost_reason: z.string().min(1).max(500).optional(),
    lost_notes: z.string().max(2000).optional(),
    assigned_consultant_id: z.string().min(1).nullable().optional(),
    temperatura: z.enum(TEMPERATURAS).nullable().optional(),
  })
  .refine(
    (p) =>
      p.pipeline_stage_id !== undefined ||
      p.assigned_consultant_id !== undefined ||
      p.temperatura !== undefined,
    { message: 'Indique pelo menos uma alteração' },
  )

const BodySchema = z.object({
  negocio_ids: z.array(z.string().min(1)).min(1).max(100),
  patch: PatchSchema,
})

interface Result {
  negocio_id: string
  ok: boolean
  error?: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { negocio_ids, patch } = parsed.data
    const cookieHeader = request.headers.get('cookie') ?? ''
    const reqUrl = new URL(request.url)
    const base = `${reqUrl.protocol}//${reqUrl.host}`

    const isStageMove = !!patch.pipeline_stage_id
    const stageBody: Record<string, unknown> = isStageMove
      ? {
          pipeline_stage_id: patch.pipeline_stage_id,
          ...(patch.lost_reason ? { lost_reason: patch.lost_reason } : {}),
          ...(patch.lost_notes ? { lost_notes: patch.lost_notes } : {}),
        }
      : {}

    // Generic patch (everything that's not a stage move)
    const genericBody: Record<string, unknown> = {}
    if (patch.assigned_consultant_id !== undefined) {
      genericBody.assigned_consultant_id = patch.assigned_consultant_id
    }
    if (patch.temperatura !== undefined) {
      genericBody.temperatura = patch.temperatura
    }
    const hasGeneric = Object.keys(genericBody).length > 0

    const results: Result[] = []

    for (const id of negocio_ids) {
      try {
        if (isStageMove) {
          const res = await fetch(
            `${base}/api/crm/negocios/${encodeURIComponent(id)}/stage`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                cookie: cookieHeader,
              },
              body: JSON.stringify(stageBody),
            },
          )
          if (!res.ok) {
            const j = await res.json().catch(() => ({}))
            results.push({
              negocio_id: id,
              ok: false,
              error: j?.error?.message ?? j?.error ?? `HTTP ${res.status}`,
            })
            continue
          }
        }

        if (hasGeneric) {
          const res = await fetch(
            `${base}/api/crm/negocios/${encodeURIComponent(id)}`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                cookie: cookieHeader,
              },
              body: JSON.stringify(genericBody),
            },
          )
          if (!res.ok) {
            const j = await res.json().catch(() => ({}))
            results.push({
              negocio_id: id,
              ok: false,
              error: j?.error?.message ?? j?.error ?? `HTTP ${res.status}`,
            })
            continue
          }
        }

        results.push({ negocio_id: id, ok: true })
      } catch (e) {
        results.push({
          negocio_id: id,
          ok: false,
          error: e instanceof Error ? e.message : 'Erro desconhecido',
        })
      }
    }

    return NextResponse.json({ results })
  } catch (err) {
    console.error('[bulk-update]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno do servidor' },
      { status: 500 },
    )
  }
}
