import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'marketing-kit'
const SIGNED_URL_EXPIRES = 3600 // 1 hour

export const IMAGE_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
export const PDF_MIME = ['application/pdf']
export const ALLOWED_MIME = [...IMAGE_MIME, ...PDF_MIME]

export const IMAGE_MAX_SIZE = 10 * 1024 * 1024 // 10MB
export const PDF_MAX_SIZE = 100 * 1024 * 1024 // 100MB
export const THUMBNAIL_MAX_SIZE = 10 * 1024 * 1024 // 10MB

export function sanitizeName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'file'
}

export function sizeLimitForMime(mime: string): number | null {
  if (IMAGE_MIME.includes(mime)) return IMAGE_MAX_SIZE
  if (PDF_MIME.includes(mime)) return PDF_MAX_SIZE
  return null
}

export function sizeErrorForMime(mime: string): string {
  if (PDF_MIME.includes(mime)) return 'PDF demasiado grande (máx. 100MB)'
  return 'Imagem demasiado grande (máx. 10MB)'
}

export async function uploadToBucket(
  agentId: string,
  file: File
): Promise<{ path: string; size: number; mime: string; originalName: string }> {
  const admin = createAdminClient()
  const timestamp = Date.now()
  const safeName = sanitizeName(file.name)
  const path = `personal/${agentId}/${timestamp}-${safeName}`

  const { error } = await admin.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })

  if (error) {
    throw new Error(`Erro ao guardar ficheiro: ${error.message}`)
  }

  return {
    path,
    size: file.size,
    mime: file.type,
    originalName: file.name,
  }
}

export async function signUrls(
  filePath: string | null,
  thumbnailPath: string | null
): Promise<{ file_url: string | null; thumbnail_url: string | null }> {
  const admin = createAdminClient()
  let fileUrl: string | null = null
  let thumbUrl: string | null = null

  if (filePath) {
    const { data } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(filePath, SIGNED_URL_EXPIRES)
    fileUrl = data?.signedUrl || null
  }
  if (thumbnailPath && thumbnailPath !== filePath) {
    const { data } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(thumbnailPath, SIGNED_URL_EXPIRES)
    thumbUrl = data?.signedUrl || null
  } else if (thumbnailPath === filePath) {
    thumbUrl = fileUrl
  }

  return { file_url: fileUrl, thumbnail_url: thumbUrl }
}

export async function removeFromBucket(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const admin = createAdminClient()
  await admin.storage.from(BUCKET).remove(paths)
}
