'use client'

import { useState, useCallback } from 'react'
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadList,
  FileUploadItem,
  FileUploadItemPreview,
  FileUploadItemMetadata,
  FileUploadItemProgress,
  FileUploadItemDelete,
} from '@/components/ui/file-upload'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { MAX_FILE_SIZE } from '@/lib/validations/document'
import type { UploadResult } from '@/types/document'

interface DocumentUploaderProps {
  docTypeId: string
  allowedExtensions: string[]
  propertyId?: string
  ownerId?: string
  consultantId?: string
  validUntil?: string
  maxFiles?: number
  disabled?: boolean
  onUploaded: (result: UploadResult) => void
  onError?: (error: string) => void
}

export function DocumentUploader({
  docTypeId,
  allowedExtensions,
  propertyId,
  ownerId,
  consultantId,
  validUntil,
  maxFiles = 1,
  disabled = false,
  onUploaded,
  onError,
}: DocumentUploaderProps) {
  const [files, setFiles] = useState<File[]>([])

  // Convert extensions to accept string format: ".pdf,.jpg,.jpeg"
  const acceptString = allowedExtensions
    .map((ext) => `.${ext.toLowerCase()}`)
    .join(',')

  const handleUpload = useCallback(
    async (
      filesToUpload: File[],
      options: {
        onProgress: (file: File, progress: number) => void
        onSuccess: (file: File) => void
        onError: (file: File, error: Error) => void
      }
    ) => {
      for (const file of filesToUpload) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('doc_type_id', docTypeId)
        if (propertyId) formData.append('property_id', propertyId)
        if (ownerId) formData.append('owner_id', ownerId)
        if (consultantId) formData.append('consultant_id', consultantId)
        if (validUntil) formData.append('valid_until', validUntil)

        try {
          const result = await new Promise<UploadResult>((resolve, reject) => {
            const xhr = new XMLHttpRequest()

            xhr.upload.addEventListener('progress', (e) => {
              if (e.lengthComputable) {
                // Upload to API = 0-85%, saving to DB = 85-100%
                const percent = Math.round((e.loaded / e.total) * 85)
                options.onProgress(file, percent)
              }
            })

            xhr.addEventListener('load', () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                options.onProgress(file, 100)
                try {
                  resolve(JSON.parse(xhr.responseText))
                } catch {
                  reject(new Error('Resposta inválida do servidor'))
                }
              } else {
                try {
                  const err = JSON.parse(xhr.responseText)
                  reject(new Error(err.error || 'Erro ao carregar documento'))
                } catch {
                  reject(new Error('Erro ao carregar documento'))
                }
              }
            })

            xhr.addEventListener('error', () => {
              reject(new Error('Erro de rede ao carregar documento'))
            })

            xhr.addEventListener('abort', () => {
              reject(new Error('Upload cancelado'))
            })

            xhr.open('POST', '/api/documents/upload')
            xhr.send(formData)
          })

          options.onSuccess(file)
          toast.success('Documento carregado com sucesso')
          onUploaded(result)
        } catch (error: any) {
          const msg = error.message || 'Erro ao carregar documento'
          options.onError(file, new Error(msg))
          toast.error(msg)
          onError?.(msg)
        }
      }
    },
    [docTypeId, propertyId, ownerId, consultantId, validUntil, onUploaded, onError]
  )

  return (
    <FileUpload
      value={files}
      onValueChange={setFiles}
      onUpload={handleUpload}
      maxFiles={maxFiles}
      maxSize={MAX_FILE_SIZE}
      accept={acceptString}
      disabled={disabled}
    >
      <FileUploadDropzone className="min-h-[120px] flex flex-col items-center justify-center gap-2 border-dashed">
        <Upload className="h-6 w-6 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Arraste ficheiros ou clique para seleccionar
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Formatos: {allowedExtensions.join(', ').toUpperCase()} — Max: 20MB
          </p>
        </div>
      </FileUploadDropzone>
      <FileUploadList>
        {files.map((file, index) => (
          <FileUploadItem key={index} value={file} className="flex-wrap">
            <FileUploadItemPreview />
            <FileUploadItemMetadata />
            <FileUploadItemDelete />
            <FileUploadItemProgress className="w-full basis-full" />
          </FileUploadItem>
        ))}
      </FileUploadList>
    </FileUpload>
  )
}
