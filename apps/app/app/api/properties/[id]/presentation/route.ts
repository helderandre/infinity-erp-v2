import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'
import { generatePdf } from '@/lib/pdf/generate-pdf'
import { uploadToR2 } from '@/lib/r2/upload'
import { summarizeDescriptionForFicha } from '@/lib/pdf/summarize-description'

export const runtime = 'nodejs'
export const maxDuration = 90

const bodySchema = z.object({
  format: z.enum(['ficha', 'presentation', 'both']).default('both'),
  sections: z.array(z.string()).optional(),
})

type PresentationRow = {
  id: string
  property_id: string
  format: 'ficha' | 'presentation'
  pdf_url: string
  share_url: string | null
  sections: string[] | null
  summary_override: string | null
  generated_at: string
  updated_at: string
}

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

// ── GET: list existing presentations for a property ───────────────────
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
      .from('property_presentations')
      .select('*')
      .eq('property_id', id)

    if (error) {
      // Table may not exist yet if migration hasn't been applied — fail soft.
      return NextResponse.json({ items: [] })
    }

    return NextResponse.json({ items: (data || []) as PresentationRow[] })
  } catch (error) {
    console.error('[presentation GET] erro:', error)
    return NextResponse.json({ items: [] })
  }
}

// ── POST: generate (and persist) ─────────────────────────────────────
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const { format, sections } = parsed.data

    const admin = createAdminClient() as any
    const { data: property, error: propErr } = await admin
      .from('dev_properties')
      .select('id, slug, title, external_ref, description')
      .eq('id', id)
      .maybeSingle()

    if (propErr || !property) {
      return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 })
    }

    const slugOrId = property.slug || property.id
    const origin = resolveOrigin(request)

    const internalHost =
      process.env.PDF_INTERNAL_ORIGIN ||
      (process.env.NODE_ENV === 'production'
        ? `http://127.0.0.1:${process.env.PORT || 3000}`
        : origin)

    const sectionsParam = sections?.length
      ? `&sections=${encodeURIComponent(sections.join(','))}`
      : ''
    const timestamp = Date.now()

    const results: {
      share_url: string
      ficha_url?: string
      presentation_url?: string
    } = {
      share_url: `${origin}/apresentacao/${slugOrId}`,
    }

    // If the ficha is being generated, pre-summarise the description via AI so
    // it actually fits one A4 page. Falls back to the original on any failure.
    let fichaSummary: string | null = null
    if ((format === 'ficha' || format === 'both') && property.description) {
      fichaSummary = await summarizeDescriptionForFicha(property.description)
    }

    const jobs: Array<Promise<void>> = []

    if (format === 'ficha' || format === 'both') {
      jobs.push(
        (async () => {
          const summaryParam =
            fichaSummary && fichaSummary !== property.description
              ? `&summary=${encodeURIComponent(fichaSummary)}`
              : ''
          const url = `${internalHost}/apresentacao/${slugOrId}/ficha?print=true${sectionsParam}${summaryParam}`
          const pdf = await generatePdf({ url, format: 'ficha' })
          const key = `apresentacoes/${property.id}/${timestamp}-ficha.pdf`
          const uploaded = await uploadToR2({
            key,
            body: pdf,
            contentType: 'application/pdf',
            cacheControl: 'public, max-age=31536000, immutable',
          })
          results.ficha_url = uploaded.url

          // Upsert into property_presentations (fail-soft if table missing)
          try {
            await admin
              .from('property_presentations')
              .upsert(
                {
                  property_id: property.id,
                  format: 'ficha',
                  pdf_url: uploaded.url,
                  share_url: null,
                  sections: sections ?? null,
                  summary_override: fichaSummary,
                  generated_by: (auth as any).user?.id ?? null,
                },
                { onConflict: 'property_id,format' },
              )
          } catch (err) {
            console.error('[presentation] upsert ficha failed:', err)
          }
        })(),
      )
    }

    if (format === 'presentation' || format === 'both') {
      jobs.push(
        (async () => {
          const url = `${internalHost}/apresentacao/${slugOrId}?print=true${sectionsParam}`
          const pdf = await generatePdf({ url, format: 'presentation' })
          const key = `apresentacoes/${property.id}/${timestamp}-apresentacao.pdf`
          const uploaded = await uploadToR2({
            key,
            body: pdf,
            contentType: 'application/pdf',
            cacheControl: 'public, max-age=31536000, immutable',
          })
          results.presentation_url = uploaded.url

          try {
            await admin
              .from('property_presentations')
              .upsert(
                {
                  property_id: property.id,
                  format: 'presentation',
                  pdf_url: uploaded.url,
                  share_url: results.share_url,
                  sections: sections ?? null,
                  summary_override: null,
                  generated_by: (auth as any).user?.id ?? null,
                },
                { onConflict: 'property_id,format' },
              )
          } catch (err) {
            console.error('[presentation] upsert presentation failed:', err)
          }
        })(),
      )
    }

    await Promise.all(jobs)

    // Audit log (best-effort)
    try {
      const supabase = await createClient()
      await supabase.from('log_audit').insert({
        user_id: (auth as any).user?.id,
        entity_type: 'property',
        entity_id: property.id,
        action: 'presentation.generate',
        new_data: { format, sections, ...results },
      } as any)
    } catch {
      // ignore audit failures
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('[presentation POST] erro:', error)
    return NextResponse.json(
      {
        error: 'Erro ao gerar apresentação',
        details: error instanceof Error ? error.message : 'erro desconhecido',
      },
      { status: 500 },
    )
  }
}
