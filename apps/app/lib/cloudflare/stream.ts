/**
 * Cloudflare Stream helpers (server-only).
 *
 * Stream auto-transcodes an uploaded video into multiple qualities and serves
 * adaptive HLS/DASH, so playback quality follows the viewer's bandwidth.
 *
 * Flow used by the training module: the video is first uploaded to R2 (handles
 * large files), then Stream *copies it from the R2 URL* and transcodes it. We
 * store the resulting HLS URL on the lesson and play it with hls.js.
 *
 * Required env (set by an admin — see the setup checklist):
 *   CLOUDFLARE_ACCOUNT_ID        (falls back to R2_ACCOUNT_ID — same account)
 *   CLOUDFLARE_STREAM_API_TOKEN  (API token with "Stream: Edit")
 *
 * When the env is absent, isStreamConfigured() is false and callers fall back
 * to plain R2 playback — nothing breaks.
 */

const ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || ''
const API_TOKEN = process.env.CLOUDFLARE_STREAM_API_TOKEN || ''

const API_BASE = 'https://api.cloudflare.com/client/v4'

export function isStreamConfigured(): boolean {
  return Boolean(ACCOUNT_ID && API_TOKEN)
}

export interface StreamVideo {
  uid: string
  ready: boolean
  state: string | null
  pctComplete: number | null
  hls: string | null
  dash: string | null
  durationSeconds: number | null
  thumbnail: string | null
}

interface StreamApiResult {
  uid?: string
  readyToStream?: boolean
  duration?: number
  thumbnail?: string
  status?: { state?: string; pctComplete?: number | string }
  playback?: { hls?: string; dash?: string }
}

function parseResult(result: StreamApiResult): StreamVideo {
  const duration =
    typeof result?.duration === 'number' && result.duration > 0
      ? Math.round(result.duration)
      : null
  const pct = Number(result?.status?.pctComplete)
  return {
    uid: result?.uid,
    ready: Boolean(result?.readyToStream),
    state: result?.status?.state ?? null,
    pctComplete: Number.isFinite(pct) ? pct : null,
    hls: result?.playback?.hls ?? null,
    dash: result?.playback?.dash ?? null,
    durationSeconds: duration,
    thumbnail: result?.thumbnail ?? null,
  }
}

/**
 * Tells Stream to ingest a video from a public URL (our R2 object) and
 * transcode it. Returns immediately with the video UID + playback URLs; the
 * video keeps processing in the background (poll getStreamStatus for `ready`).
 */
export async function copyToStream(
  sourceUrl: string,
  name?: string
): Promise<StreamVideo> {
  if (!isStreamConfigured()) {
    throw new Error('Cloudflare Stream não está configurado')
  }
  const res = await fetch(`${API_BASE}/accounts/${ACCOUNT_ID}/stream/copy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: sourceUrl,
      meta: name ? { name } : undefined,
      requireSignedURLs: false,
    }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) {
    const message =
      json?.errors?.[0]?.message || `Falha ao enviar para o Stream (${res.status})`
    throw new Error(message)
  }
  return parseResult(json.result)
}

/** Fetches the current transcoding status / playback URLs for a Stream video. */
export async function getStreamStatus(uid: string): Promise<StreamVideo> {
  if (!isStreamConfigured()) {
    throw new Error('Cloudflare Stream não está configurado')
  }
  const res = await fetch(`${API_BASE}/accounts/${ACCOUNT_ID}/stream/${uid}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) {
    const message =
      json?.errors?.[0]?.message || `Falha ao obter estado do Stream (${res.status})`
    throw new Error(message)
  }
  return parseResult(json.result)
}

/** Deletes a Stream video (best-effort). UID can be parsed from an HLS URL. */
export async function deleteStreamVideo(uid: string): Promise<void> {
  if (!isStreamConfigured() || !uid) return
  await fetch(`${API_BASE}/accounts/${ACCOUNT_ID}/stream/${uid}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${API_TOKEN}` },
  })
}

/** Extracts the Stream UID from a playback URL, e.g. customer-x.cloudflarestream.com/<uid>/manifest/video.m3u8 */
export function streamUidFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const match = url.match(/cloudflarestream\.com\/([a-f0-9]{20,})/i)
  return match ? match[1] : null
}
