const MIME_EXTENSION_MAP: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/zip': 'zip',
  'application/x-rar-compressed': 'rar',
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'text/html': 'html',
  'application/json': 'json',
}

/**
 * Derive a lowercase extension (without dot) from a file's mimeType or fileName.
 * Used to feed <DocIcon extension={...}> in file lists and upload previews.
 */
export function getExtensionFromFile(input: {
  mimeType?: string | null
  name?: string | null
}): string | undefined {
  const mime = input.mimeType?.toLowerCase()
  if (mime && MIME_EXTENSION_MAP[mime]) return MIME_EXTENSION_MAP[mime]

  const name = input.name
  if (name) {
    const dot = name.lastIndexOf('.')
    if (dot >= 0 && dot < name.length - 1) {
      return name.slice(dot + 1).toLowerCase()
    }
  }
  return undefined
}

export function isImageMime(mimeType: string | null | undefined): boolean {
  return !!mimeType && mimeType.startsWith('image/')
}

export function isPdfMime(mimeType: string | null | undefined): boolean {
  return mimeType === 'application/pdf'
}

export function isDocxMime(mimeType: string | null | undefined): boolean {
  return (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  )
}

export function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
