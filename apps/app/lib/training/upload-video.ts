/**
 * Client-side helpers for uploading training videos to R2.
 *
 * Uses XMLHttpRequest (not fetch) so we get real upload progress events. The
 * file is sent as the raw request body to `/api/training/videos/upload`, which
 * streams it to R2 — see that route for the server side.
 */

export interface VideoUploadResult {
  url: string
}

/**
 * Uploads a video file to R2 via the streaming endpoint, reporting progress
 * (0-100) through the optional callback. Resolves with the public R2 URL.
 */
export function uploadVideoToR2(
  file: File,
  onProgress?: (percent: number) => void
): Promise<VideoUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const qs = new URLSearchParams({ name: file.name })
    xhr.open('POST', `/api/training/videos/upload?${qs.toString()}`)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText)
          if (data?.url) {
            onProgress?.(100)
            resolve({ url: data.url })
          } else {
            reject(new Error('Resposta inválida do servidor'))
          }
        } catch {
          reject(new Error('Resposta inválida do servidor'))
        }
      } else {
        let message = `Falha no upload (${xhr.status})`
        try {
          const data = JSON.parse(xhr.responseText)
          if (data?.error) message = data.error
        } catch {
          /* keep default message */
        }
        reject(new Error(message))
      }
    }

    xhr.onerror = () => reject(new Error('Erro de rede durante o upload'))
    xhr.onabort = () => reject(new Error('Upload cancelado'))

    xhr.send(file)
  })
}

export type VideoProvider = 'cloudflare_stream' | 'r2'

export interface AdaptiveVideoResult {
  /** 'cloudflare_stream' when adaptive transcoding kicked in, else 'r2'. */
  provider: VideoProvider
  /** Playback URL: HLS manifest for Stream, public file URL for R2. */
  url: string
  durationSeconds: number | null
  /** Stream video UID (null for plain R2). */
  streamUid: string | null
  /** True while Stream is still transcoding (R2 fallback unavailable yet). */
  processing: boolean
}

/**
 * Full upload pipeline for a training video:
 *  1. upload the file to R2 (progress 0-85%),
 *  2. ask Cloudflare Stream to ingest it from the R2 URL for adaptive quality.
 *
 * If Stream isn't configured on the server, it transparently falls back to
 * plain R2 playback. Returns everything the lesson form needs to persist.
 */
export async function uploadTrainingVideo(
  file: File,
  onProgress?: (percent: number) => void
): Promise<AdaptiveVideoResult> {
  const duration = await getVideoDurationFromFile(file)

  // R2 upload takes most of the visible progress; Stream copy is quick to kick off.
  const { url: r2Url } = await uploadVideoToR2(file, (p) =>
    onProgress?.(Math.round(p * 0.85))
  )

  try {
    const res = await fetch('/api/training/videos/stream/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: r2Url, name: file.name }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data?.configured && data?.uid && data?.hls) {
        onProgress?.(100)
        return {
          provider: 'cloudflare_stream',
          url: data.hls,
          durationSeconds: data.duration_seconds ?? duration,
          streamUid: data.uid,
          processing: !data.ready,
        }
      }
    }
  } catch {
    // Stream copy failed → fall back to plain R2 below.
  }

  onProgress?.(100)
  return {
    provider: 'r2',
    url: r2Url,
    durationSeconds: duration,
    streamUid: null,
    processing: false,
  }
}

/**
 * Reads a video file's duration (in whole seconds) in the browser, without
 * uploading it. Returns null if the duration can't be determined.
 */
export function getVideoDurationFromFile(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file)
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url)
        resolve(
          Number.isFinite(video.duration) && video.duration > 0
            ? Math.round(video.duration)
            : null
        )
      }
      video.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null)
      }
      video.src = url
    } catch {
      resolve(null)
    }
  })
}
