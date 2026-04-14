import { GetObjectCommand } from '@aws-sdk/client-s3'
import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from '@/lib/r2/client'

/**
 * Proxies a file from Cloudflare R2 back through the Next.js server so the
 * browser can fetch it without tripping CORS. The legacy batch-download
 * flow in the client uses `fetch(file.url)` against the R2 public domain;
 * that fails because R2 doesn't emit `Access-Control-Allow-Origin` headers
 * by default. Routing through this handler sidesteps the issue and also
 * gives us a natural place to add auth checks or signed URLs later.
 *
 * Query params:
 *   - `url` (required): fully qualified R2 URL; must start with R2_PUBLIC_DOMAIN.
 *   - `key` (alternative): the object key inside the bucket.
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const urlParam = searchParams.get('url')
  const keyParam = searchParams.get('key')

  let key: string | null = null
  if (keyParam) {
    key = keyParam.replace(/^\/+/, '')
  } else if (urlParam) {
    if (!R2_PUBLIC_DOMAIN) {
      return NextResponse.json(
        { error: 'R2_PUBLIC_DOMAIN não configurado' },
        { status: 500 }
      )
    }
    if (!urlParam.startsWith(R2_PUBLIC_DOMAIN)) {
      return NextResponse.json({ error: 'URL não autorizado' }, { status: 400 })
    }
    key = urlParam.slice(R2_PUBLIC_DOMAIN.length).replace(/^\/+/, '')
  }

  if (!key) {
    return NextResponse.json({ error: 'Parâmetro url ou key em falta' }, { status: 400 })
  }

  try {
    const r2 = getR2Client()
    const res = await r2.send(
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: key })
    )
    if (!res.Body) {
      return NextResponse.json({ error: 'Objecto não encontrado' }, { status: 404 })
    }

    const arrayBuffer = await res.Body.transformToByteArray()
    const contentType = res.ContentType ?? 'application/octet-stream'
    const contentLength = res.ContentLength?.toString()

    const filename = key.split('/').pop() ?? 'documento'
    const headers = new Headers({
      'content-type': contentType,
      'content-disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
      'cache-control': 'private, max-age=60',
    })
    if (contentLength) headers.set('content-length', contentLength)

    return new NextResponse(new Uint8Array(arrayBuffer), { status: 200, headers })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao obter ficheiro'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
