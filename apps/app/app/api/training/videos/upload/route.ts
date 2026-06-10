// @ts-nocheck
import { NextResponse } from 'next/server'
import { Readable } from 'node:stream'
import { requirePermission } from '@/lib/auth/permissions'
import {
  uploadVideoStream,
  getVideoContentType,
  ALLOWED_VIDEO_EXTENSIONS,
  MAX_VIDEO_SIZE,
} from '@/lib/r2/training'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Best-effort hint for serverless platforms; ignored on self-hosted (Coolify).
export const maxDuration = 300

/**
 * Streams a raw video body straight to R2.
 *
 * The client sends the file as the request body (not multipart form-data) so we
 * can pipe it to R2 in parts without buffering the whole file. This avoids
 * proxy body-size limits / server memory blow-ups for large videos (up to 500MB)
 * and needs no R2 CORS config (same-origin POST). The file name comes via the
 * `?name=` query param. Returns the public R2 URL — the caller persists it on
 * the lesson row (lesson editor) or in the course-create payload.
 */
export async function POST(request: Request) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(request.url)
    const fileName = (searchParams.get('name') || 'video.mp4').trim() || 'video.mp4'

    const extension = fileName.split('.').pop()?.toLowerCase()
    if (!extension || !ALLOWED_VIDEO_EXTENSIONS.includes(extension as any)) {
      return NextResponse.json(
        {
          error: `Extensão não permitida. Extensões aceites: ${ALLOWED_VIDEO_EXTENSIONS.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Best-effort size guard from Content-Length (the stream is the real bound).
    const declaredSize = Number(request.headers.get('content-length') || 0)
    if (declaredSize && declaredSize > MAX_VIDEO_SIZE) {
      return NextResponse.json(
        { error: 'Ficheiro excede o tamanho máximo de 500MB' },
        { status: 413 }
      )
    }

    if (!request.body) {
      return NextResponse.json({ error: 'Nenhum ficheiro recebido' }, { status: 400 })
    }

    const contentType = getVideoContentType(fileName)
    const nodeStream = Readable.fromWeb(request.body as any)

    const { url } = await uploadVideoStream(nodeStream, fileName, contentType)

    return NextResponse.json({ url }, { status: 201 })
  } catch (error) {
    console.error('Erro ao fazer upload do vídeo:', error)
    return NextResponse.json({ error: 'Erro ao enviar o vídeo' }, { status: 500 })
  }
}
