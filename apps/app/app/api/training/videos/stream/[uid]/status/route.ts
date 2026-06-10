// @ts-nocheck
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { getStreamStatus, isStreamConfigured } from '@/lib/cloudflare/stream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Polls the transcoding status of a Cloudflare Stream video. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    if (!isStreamConfigured()) {
      return NextResponse.json({ configured: false })
    }

    const { uid } = await params
    const video = await getStreamStatus(uid)

    return NextResponse.json({
      configured: true,
      uid: video.uid,
      ready: video.ready,
      state: video.state,
      pct_complete: video.pctComplete,
      hls: video.hls,
      duration_seconds: video.durationSeconds,
      thumbnail: video.thumbnail,
    })
  } catch (error) {
    console.error('Erro ao obter estado do Cloudflare Stream:', error)
    return NextResponse.json(
      { error: 'Erro ao obter estado do vídeo' },
      { status: 500 }
    )
  }
}
