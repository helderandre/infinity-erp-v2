'use client'

import { useRef, useState, type ReactElement } from 'react'
import { toast } from 'sonner'

const ACCEPT_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp'
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export interface AttachmentUploadResult {
  url: string
  fileName: string
  fileSize: number
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

    if (file.size > MAX_SIZE) {
      toast.error('Ficheiro demasiado grande. Máximo 10MB.')
      return
    }

    setUploading(true)
    try {
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
      onUploaded({
        url: data.url,
        fileName: data.fileName,
        fileSize: data.fileSize,
      })
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

    if (!file.type.startsWith('image/')) {
      toast.error('O ficheiro tem de ser uma imagem.')
      return
    }

    setUploading(true)
    try {
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
      onUploaded(data.url as string)
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
