'use client'

import { useCallback, useEffect } from 'react'
import { useUploadStore } from '@/stores/upload-store'

const MAX_CONCURRENT = 7 // Upload 7 images at a time

interface UploadOptions {
  url: string
  file: File
  fileName?: string
  context?: string
  thumbnailUrl?: string
  extraFormData?: Record<string, string>
  onSuccess?: (response: any) => void
  onError?: (error: string) => void
}

// Concurrency-limited parallel execution
async function parallelLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length)
  let nextIndex = 0

  async function runNext(): Promise<void> {
    while (nextIndex < tasks.length) {
      const idx = nextIndex++
      try {
        const value = await tasks[idx]()
        results[idx] = { status: 'fulfilled', value }
      } catch (reason: any) {
        results[idx] = { status: 'rejected', reason }
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => runNext())
  await Promise.all(workers)
  return results
}

export function useBackgroundUpload() {
  const { addItem, updateItem, items } = useUploadStore()

  // Warn user before leaving if uploads are active
  const hasActive = items.some(
    (i) => i.status === 'uploading' || i.status === 'pending'
  )

  useEffect(() => {
    if (!hasActive) return

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'Existem uploads em progresso. Tem a certeza que pretende sair?'
      return e.returnValue
    }

    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasActive])

  const upload = useCallback(
    async ({
      url,
      file,
      fileName,
      context,
      thumbnailUrl,
      extraFormData,
      onSuccess,
      onError,
    }: UploadOptions) => {
      const id = crypto.randomUUID()
      const displayName = fileName || file.name

      addItem({ id, fileName: displayName, context, thumbnailUrl })

      try {
        updateItem(id, { status: 'uploading', progress: 10 })

        const formData = new FormData()
        formData.append('file', file)

        if (extraFormData) {
          Object.entries(extraFormData).forEach(([key, value]) => {
            formData.append(key, value)
          })
        }

        const result = await new Promise<any>((resolve, reject) => {
          const xhr = new XMLHttpRequest()

          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 85) + 10
              updateItem(id, { progress: pct })
            }
          })

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              updateItem(id, { progress: 100, status: 'done' })
              try {
                resolve(JSON.parse(xhr.responseText))
              } catch {
                resolve({ ok: true })
              }
            } else {
              let errorMsg = 'Erro ao fazer upload'
              try {
                const body = JSON.parse(xhr.responseText)
                errorMsg = body.error || errorMsg
              } catch {}
              reject(new Error(errorMsg))
            }
          })

          xhr.addEventListener('error', () => reject(new Error('Erro de rede')))
          xhr.addEventListener('abort', () => reject(new Error('Upload cancelado')))

          xhr.open('POST', url)
          xhr.send(formData)
        })

        onSuccess?.(result)
        return result
      } catch (err: any) {
        const errorMsg = err?.message || 'Erro ao fazer upload'
        updateItem(id, { status: 'error', error: errorMsg })
        onError?.(errorMsg)
        return null
      }
    },
    [addItem, updateItem]
  )

  const uploadMultiple = useCallback(
    async (uploads: UploadOptions[], concurrency = MAX_CONCURRENT) => {
      const tasks = uploads.map((opts) => () => upload(opts))
      return parallelLimit(tasks, concurrency)
    },
    [upload]
  )

  return { upload, uploadMultiple }
}
