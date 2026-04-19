import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'
import { generatePdf } from '@/lib/pdf/generate-pdf'
import { uploadToR2 } from '@/lib/r2/upload'

export const runtime = 'nodejs'
export const maxDuration = 60

const bodySchema = z.object({
  format: z.enum(['ficha', 'presentation', 'both']).default('both'),
  sections: z.array(z.string()).optional(),
})

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

    // Fetch the property's slug (authoritative) via admin client, since the
    // public presentation URL uses the slug.
    const admin = createAdminClient()
    const { data: property, error: propErr } = await admin
      .from('dev_properties')
      .select('id, slug, title, external_ref')
      .eq('id', id)
      .maybeSingle()

    if (propErr || !property) {
      return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 })
    }

    const slugOrId = property.slug || property.id
    const origin = (() => {
      if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
      const h = request.headers
      const proto = h.get('x-forwarded-proto') || 'https'
      const host = h.get('x-forwarded-host') || h.get('host')
      if (host && !host.startsWith('0.0.0.0') && !host.startsWith('127.0.0.1')) {
        return `${proto}://${host}`
      }
      // Last resort — the original request URL
      const url = new URL(request.url)
      return `${url.protocol}//${url.host}`
    })()

    // Internal URL used by Puppeteer to render the pages. In production we
    // hit the same container via 127.0.0.1 to skip DNS / TLS.
    const internalHost =
      process.env.PDF_INTERNAL_ORIGIN ||
      (process.env.NODE_ENV === 'production'
        ? `http://127.0.0.1:${process.env.PORT || 3000}`
        : origin)

    const sectionsParam = sections?.length ? `&sections=${encodeURIComponent(sections.join(','))}` : ''
    const timestamp = Date.now()

    const results: { share_url: string; ficha_url?: string; presentation_url?: string } = {
      share_url: `${origin}/apresentacao/${slugOrId}`,
    }

    const jobs: Array<Promise<void>> = []

    if (format === 'ficha' || format === 'both') {
      jobs.push(
        (async () => {
          const url = `${internalHost}/apresentacao/${slugOrId}/ficha?print=true${sectionsParam}`
          const pdf = await generatePdf({ url, format: 'ficha' })
          const key = `apresentacoes/${property.id}/${timestamp}-ficha.pdf`
          const uploaded = await uploadToR2({
            key,
            body: pdf,
            contentType: 'application/pdf',
            cacheControl: 'public, max-age=31536000, immutable',
          })
          results.ficha_url = uploaded.url
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
    console.error('[presentation] erro:', error)
    return NextResponse.json(
      {
        error: 'Erro ao gerar apresentação',
        details: error instanceof Error ? error.message : 'erro desconhecido',
      },
      { status: 500 },
    )
  }
}
