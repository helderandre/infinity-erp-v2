'use client'

import { useRef, useState, type ReactElement } from 'react'
import { toast } from 'sonner'

const ACCEPT_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp'
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ATTACHMENT_EXT_WHITELIST = /\.(pdf|docx?|xlsx?|jpe?g|png|webp)$/i

export interface AttachmentUploadResult {
  url: string
  fileName: string
  fileSize: number
}

/**
 * POST a File to `/api/libraries/emails/upload-attachment` and return the
 * stored metadata. Throws on validation failure or non-OK responses so the
 * caller can show a toast.
 */
export async function uploadAttachmentFile(
  file: File
): Promise<AttachmentUploadResult> {
  if (file.size > MAX_SIZE) {
    throw new Error('Ficheiro demasiado grande. Máximo 10MB.')
  }
  if (!ATTACHMENT_EXT_WHITELIST.test(file.name)) {
    throw new Error('Tipo de ficheiro não suportado.')
  }
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/libraries/emails/upload-attachment', {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro ao carregar' }))
    throw new Error(err.error || 'Erro ao carregar ficheiro')
  }
  const data = await res.json()
  return {
    url: data.url as string,
    fileName: data.fileName as string,
    fileSize: data.fileSize as number,
  }
}

/**
 * POST an image File to `/api/libraries/emails/upload` and return the URL.
 */
export async function uploadImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('O ficheiro tem de ser uma imagem.')
  }
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/libraries/emails/upload', {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro ao carregar' }))
    throw new Error(err.error || 'Erro ao carregar imagem')
  }
  const data = await res.json()
  return data.url as string
}

export function useAttachmentUploadHandler({
  onUploaded,
}: {
  onUploaded: (data: AttachmentUploadResult) => void
}): {
  triggerUpload: () => void
  uploading: boolean
  fileInput: ReactElement
} {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setUploading(true)
    try {
      const data = await uploadAttachmentFile(file)
      onUploaded(data)
      toast.success('Ficheiro carregado com sucesso')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao carregar ficheiro'
      )
    } finally {
      setUploading(false)
    }
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT_TYPES}
      className="hidden"
      onChange={handleFileSelect}
      aria-label="Escolher ficheiro anexo"
    />
  )

  return {
    triggerUpload: () => inputRef.current?.click(),
    uploading,
    fileInput,
  }
}

/** Same pattern for image uploads (separate endpoint, accepts only images). */
export function useImageUploadHandler({
  onUploaded,
}: {
  onUploaded: (url: string) => void
}): {
  triggerUpload: () => void
  uploading: boolean
  fileInput: ReactElement
} {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setUploading(true)
    try {
      const url = await uploadImageFile(file)
      onUploaded(url)
      toast.success('Imagem carregada com sucesso')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao carregar imagem'
      )
    } finally {
      setUploading(false)
    }
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={handleFileSelect}
      aria-label="Escolher imagem"
    />
  )

  return {
    triggerUpload: () => inputRef.current?.click(),
    uploading,
    fileInput,
  }
}
