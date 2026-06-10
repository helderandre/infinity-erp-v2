// @ts-nocheck
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { copyToStream, isStreamConfigured } from '@/lib/cloudflare/stream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Asks Cloudflare Stream to ingest + transcode a video from a public URL
 * (typically the R2 object we just uploaded). Returns the Stream UID + HLS URL.
 *
 * If Stream isn't configured, responds 200 { configured: false } so the client
 * can fall back to plain R2 playback without treating it as an error.
 */
export async function POST(request: Request) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    if (!isStreamConfigured()) {
      return NextResponse.json({ configured: false })
    }

    const body = await request.json().catch(() => ({}))
    const url = typeof body?.url === 'string' ? body.url : ''
    const name = typeof body?.name === 'string' ? body.name : undefined

    if (!url || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: 'URL de origem inválido' }, { status: 400 })
    }

    const video = await copyToStream(url, name)

    return NextResponse.json({
      configured: true,
      uid: video.uid,
      hls: video.hls,
      ready: video.ready,
      duration_seconds: video.durationSeconds,
    })
  } catch (error) {
    console.error('Erro ao enviar vídeo para o Cloudflare Stream:', error)
    return NextResponse.json(
      { error: 'Erro ao enviar o vídeo para o Stream' },
      { status: 500 }
    )
  }
}
