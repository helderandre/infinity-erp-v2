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
