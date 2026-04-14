'use client'

import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { DOCUMENT_LABELS } from '@/lib/documents/labels'

import type { DocumentFile, DocumentFolder } from './types'

const SIZE_LIMIT_BYTES = 200 * 1024 * 1024

function sanitizeSegment(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'ficheiro'
}

const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
  'text/plain': 'txt',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'application/zip': 'zip',
}

/**
 * Ensure the zip entry for a file has a sensible extension. Some records
 * (e.g. property media named "Imagem 3") come from the DB without one; we
 * infer it from the mime type, falling back to the blob type, then the URL.
 */
function resolveFileName(file: DocumentFile, blob: Blob | null): string {
  const base = sanitizeSegment(file.name)
  const hasExt = /\.[a-z0-9]{2,5}$/i.test(base)
  if (hasExt) return base

  const mime = (file.mimeType || blob?.type || '').toLowerCase()
  const fromMime = MIME_TO_EXT[mime]
  if (fromMime) return `${base}.${fromMime}`

  try {
    const urlName = new URL(file.url, 'http://x').pathname.split('/').pop() ?? ''
    const urlExt = urlName.match(/\.([a-z0-9]{2,5})$/i)?.[1]
    if (urlExt) return `${base}.${urlExt.toLowerCase()}`
  } catch {
    // ignore — URL may be relative/malformed
  }
  return base
}

function todayStamp(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

type FetchedFile = {
  folder: DocumentFolder
  file: DocumentFile
  blob: Blob | null
  error?: string
}

/**
 * Fetches a document's bytes through our Next.js proxy. Direct `fetch()` to
 * R2 public URLs is blocked by CORS, so we always route through
 * `/api/documents/proxy` which streams the bytes server-side.
 */
async function fetchWithProgress(file: DocumentFile): Promise<Blob> {
  const proxied = `/api/documents/proxy?url=${encodeURIComponent(file.url)}`
  const res = await fetch(proxied, { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`${res.status}`)
  return await res.blob()
}

export function useBatchDownload() {
  const [isDownloading, setIsDownloading] = useState(false)

  const downloadFromFolders = useCallback(
    async (opts: {
      folders: DocumentFolder[]
      entityName: string
      onComplete?: () => void
    }) => {
      const { folders, entityName } = opts
      const allFiles = folders.flatMap((folder) =>
        folder.files.map((file) => ({ folder, file }))
      )

      if (allFiles.length === 0) return

      const totalSize = allFiles.reduce((sum, { file }) => sum + (file.size || 0), 0)
      if (totalSize > SIZE_LIMIT_BYTES) {
        const mb = Math.round(totalSize / (1024 * 1024))
        toast.warning(DOCUMENT_LABELS.toasts.tooLarge(mb))
        return
      }

      setIsDownloading(true)
      try {
        if (allFiles.length === 1) {
          const only = allFiles[0].file
          const promise = fetchWithProgress(only).then((blob) =>
            saveAs(blob, resolveFileName(only, blob))
          )
          await toast.promise(promise, {
            loading: DOCUMENT_LABELS.toasts.preparingZip,
            success: DOCUMENT_LABELS.toasts.zipReady,
            error: DOCUMENT_LABELS.toasts.zipError,
          }).unwrap()
          return
        }

        const zipPromise = (async () => {
          const zip = new JSZip()
          const fetched: FetchedFile[] = await Promise.all(
            allFiles.map(async ({ folder, file }) => {
              try {
                const blob = await fetchWithProgress(file)
                return { folder, file, blob }
              } catch (err) {
                return {
                  folder,
                  file,
                  blob: null,
                  error: err instanceof Error ? err.message : 'unknown',
                }
              }
            })
          )

          const errors: string[] = []
          for (const item of fetched) {
            const folderName = sanitizeSegment(item.folder.name)
            const fileName = resolveFileName(item.file, item.blob)
            if (item.blob) {
              zip.file(`${folderName}/${fileName}`, item.blob)
            } else {
              errors.push(`${folderName}/${fileName}: ${item.error}`)
            }
          }
          if (errors.length > 0) {
            zip.file('_erros.txt', errors.join('\n'))
          }

          const blob = await zip.generateAsync({ type: 'blob' })
          const zipName = `documentos-${sanitizeSegment(entityName)}-${todayStamp()}.zip`
          saveAs(blob, zipName)
          return errors.length
        })()

        await toast.promise(zipPromise, {
          loading: DOCUMENT_LABELS.toasts.preparingZip,
          success: (count) =>
            count === 0
              ? DOCUMENT_LABELS.toasts.zipReady
              : DOCUMENT_LABELS.toasts.zipPartial(count),
          error: DOCUMENT_LABELS.toasts.zipError,
        }).unwrap()
      } finally {
        setIsDownloading(false)
        opts.onComplete?.()
      }
    },
    []
  )

  return { isDownloading, downloadFromFolders }
}
