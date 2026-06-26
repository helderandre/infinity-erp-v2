import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'
import { generatePdf } from '@/lib/pdf/generate-pdf'
import { uploadToR2 } from '@/lib/r2/upload'
import {
  aggregateOwnerReportData,
  DEFAULT_REPORT_CONFIG,
  type OwnerReportConfig,
} from '@/lib/reports/owner-activity-report'

export const runtime = 'nodejs'
export const maxDuration = 90

const portalViewsSchema = z
  .object({
    idealista: z.number().int().nonnegative().nullable().default(null),
    imovirtual: z.number().int().nonnegative().nullable().default(null),
    casaSapo: z.number().int().nonnegative().nullable().default(null),
    website: z.number().int().nonnegative().nullable().default(null),
  })
  .partial()
  .default({})

const configSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  blocks: z
    .object({
      funnel: z.boolean(),
      meta: z.boolean(),
      visits: z.boolean(),
      feedback: z.boolean(),
      price: z.boolean(),
      portals: z.boolean(),
    })
    .partial()
    .default({}),
  metaShowSpend: z.boolean().default(false),
  metaMode: z.enum(['prorata', 'real']).default('prorata'),
  portalViews: portalViewsSchema,
  minFichas: z.number().int().min(1).max(50).default(2),
  agentNote: z.string().max(4000).nullable().default(null),
  periodFrom: z.string().nullable().default(null),
  periodTo: z.string().nullable().default(null),
})

function resolveOrigin(request: Request): string {
  const isInternalHost = (h: string | null | undefined) =>
    !h || h.startsWith('0.0.0.0') || h.startsWith('127.0.0.1') || h.startsWith('localhost')
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  const h = request.headers
  const proto = h.get('x-forwarded-proto') || 'https'
  const fwd = h.get('x-forwarded-host')
  if (!isInternalHost(fwd)) return `${proto}://${fwd}`
  const host = h.get('host')
  if (!isInternalHost(host)) return `${proto}://${host}`
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

// ── GET: histórico de relatórios do imóvel ────────────────────────────
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const admin = createAdminClient() as any
    const { data, error } = await admin
      .from('owner_activity_reports')
      .select('id, version, title, status, pdf_url, share_token, config, generated_by, created_at')
      .eq('property_id', id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ items: [] })
    return NextResponse.json({ items: data ?? [] })
  } catch (error) {
    console.error('[owner-report GET] erro:', error)
    return NextResponse.json({ items: [] })
  }
}

// ── POST: gerar (snapshot + PDF + arquivo R2 + linha de histórico) ────
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const parsed = configSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const p = parsed.data

    const config: OwnerReportConfig = {
      blocks: { ...DEFAULT_REPORT_CONFIG.blocks, ...p.blocks },
      metaShowSpend: p.metaShowSpend,
      metaMode: p.metaMode,
      portalViews: { ...DEFAULT_REPORT_CONFIG.portalViews, ...p.portalViews },
      minFichas: p.minFichas,
      agentNote: p.agentNote ?? null,
      periodFrom: p.periodFrom ?? null,
      periodTo: p.periodTo ?? null,
    }

    const admin = createAdminClient() as any

    const { data: property } = await admin
      .from('dev_properties')
      .select('id, title')
      .eq('id', id)
      .maybeSingle()
    if (!property) {
      return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 })
    }

    const userId = (auth as any).user?.id ?? null
    let generatedByName: string | null = null
    if (userId) {
      const { data: u } = await admin
        .from('dev_users')
        .select('commercial_name')
        .eq('id', userId)
        .maybeSingle()
      generatedByName = u?.commercial_name ?? null
    }

    const nowIso = new Date().toISOString()
    const dataSnapshot = await aggregateOwnerReportData(
      admin,
      id,
      config,
      generatedByName,
      nowIso,
    )

    // versão incremental por imóvel
    const { data: last } = await admin
      .from('owner_activity_reports')
      .select('version')
      .eq('property_id', id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    const version = (last?.version ?? 0) + 1

    const { data: inserted, error: insErr } = await admin
      .from('owner_activity_reports')
      .insert({
        property_id: id,
        version,
        title: p.title ?? `Relatório de atividade — ${property.title ?? 'Imóvel'}`,
        config,
        data_snapshot: dataSnapshot,
        status: 'generating',
        generated_by: userId,
      })
      .select('id, share_token')
      .single()

    if (insErr || !inserted) {
      console.error('[owner-report POST] insert falhou:', insErr)
      return NextResponse.json({ error: 'Erro ao criar relatório' }, { status: 500 })
    }

    const reportId = inserted.id as string

    // ── Gerar o PDF via página SSR (Puppeteer → R2) ───────────────────
    try {
      const origin = resolveOrigin(request)
      const internalHost =
        process.env.PDF_INTERNAL_ORIGIN ||
        (process.env.NODE_ENV === 'production'
          ? `http://127.0.0.1:${process.env.PORT || 3000}`
          : origin)

      const url = `${internalHost}/relatorio-proprietario/${reportId}?print=true`
      const pdf = await generatePdf({ url, format: 'report' })
      const key = `relatorios-proprietario/${id}/${reportId}.pdf`
      const uploaded = await uploadToR2({
        key,
        body: pdf,
        contentType: 'application/pdf',
        cacheControl: 'public, max-age=31536000, immutable',
      })

      await admin
        .from('owner_activity_reports')
        .update({ pdf_url: uploaded.url, status: 'ready', updated_at: new Date().toISOString() })
        .eq('id', reportId)

      // auditoria (best-effort)
      try {
        const supabase = await createClient()
        await supabase.from('log_audit').insert({
          user_id: userId,
          entity_type: 'property',
          entity_id: id,
          action: 'owner_report.generate',
          new_data: { report_id: reportId, version, pdf_url: uploaded.url },
        } as any)
      } catch {
        /* ignore */
      }

      return NextResponse.json({
        id: reportId,
        version,
        status: 'ready',
        pdf_url: uploaded.url,
        share_token: inserted.share_token,
      })
    } catch (pdfErr) {
      console.error('[owner-report POST] geração PDF falhou:', pdfErr)
      await admin
        .from('owner_activity_reports')
        .update({
          status: 'error',
          error: pdfErr instanceof Error ? pdfErr.message : 'erro desconhecido',
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId)
      return NextResponse.json(
        { error: 'Erro ao gerar o PDF do relatório', report_id: reportId },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error('[owner-report POST] erro:', error)
    return NextResponse.json(
      {
        error: 'Erro ao gerar relatório',
        details: error instanceof Error ? error.message : 'erro desconhecido',
      },
      { status: 500 },
    )
  }
}
