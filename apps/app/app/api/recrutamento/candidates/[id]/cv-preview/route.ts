import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Proxy the CV with proper headers for inline viewing
// No auth required — the candidate ID is the secret
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const admin = createAdminClient() as any
    const { data: candidate, error: dbErr } = await admin.from('recruitment_candidates').select('cv_url').eq('id', id).single()

    if (dbErr) {
      console.error('[cv-preview] DB error:', dbErr)
      return NextResponse.json({ error: dbErr.message }, { status: 500 })
    }

    if (!candidate?.cv_url) {
      return NextResponse.json({ error: 'CV não encontrado' }, { status: 404 })
    }

    console.log('[cv-preview] Fetching:', candidate.cv_url)

    const res = await fetch(candidate.cv_url)
    if (!res.ok) return NextResponse.json({ error: 'Erro ao carregar CV' }, { status: 500 })

    const buffer = await res.arrayBuffer()
    const url = candidate.cv_url as string
    const ext = url.split('.').pop()?.toLowerCase() || ''

    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeMap[ext] || res.headers.get('content-type') || 'application/octet-stream',
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
