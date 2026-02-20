'use client'

import { useRef, useState, useCallback } from 'react'
import { UploadCloud, Loader2 } from 'lucide-react'
import { MAX_FILE_SIZE } from '@/lib/validations/document'
import { toast } from 'sonner'

interface UploadZoneProps {
  docTypeId: string
  allowedExtensions: string[]
  // Modo normal (upload imediato)
  onUploaded?: (result: any, docTypeId: string) => void
  propertyId?: string
  ownerId?: string
  consultantId?: string
  // Modo deferred (guardar File no form state)
  deferred?: boolean
  onFileSelected?: (file: File, docTypeId: string) => void
}

export function UploadZone({
  docTypeId,
  allowedExtensions,
  onUploaded,
  propertyId,
  ownerId,
  consultantId,
  deferred,
  onFileSelected,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const acceptString = allowedExtensions
    .map((ext) => `.${ext.toLowerCase()}`)
    .join(',')

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error('Ficheiro excede o tamanho máximo de 20MB')
        return
      }

      const ext = file.name.split('.').pop()?.toLowerCase()
      if (ext && !allowedExtensions.map((e) => e.toLowerCase()).includes(ext)) {
        toast.error(`Extensão .${ext} não é permitida`)
        return
      }

      // Modo deferred — guardar File em vez de upload
      if (deferred && onFileSelected) {
        onFileSelected(file, docTypeId)
        return
      }

      setIsUploading(true)
      setProgress(0)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('doc_type_id', docTypeId)
      if (propertyId) formData.append('property_id', propertyId)
      if (ownerId) formData.append('owner_id', ownerId)
      if (consultantId) formData.append('consultant_id', consultantId)

      try {
        // Simulate progress during upload
        const progressInterval = setInterval(() => {
          setProgress((prev) => Math.min(prev + 10, 90))
        }, 200)

        const res = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        })

        clearInterval(progressInterval)

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Erro ao carregar documento')
        }

        setProgress(100)
        const result = await res.json()
        toast.success('Documento carregado com sucesso')
        onUploaded?.(result, docTypeId)
      } catch (error: any) {
        toast.error(error.message || 'Erro ao carregar documento')
      } finally {
        setIsUploading(false)
        setProgress(0)
      }
    },
    [docTypeId, allowedExtensions, onUploaded, propertyId, ownerId, consultantId, deferred, onFileSelected]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      // Reset input so the same file can be re-selected
      e.target.value = ''
    },
    [handleFile]
  )

  return (
    <div className="px-3 pb-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !isUploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (!isUploading) inputRef.current?.click()
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed
          px-4 py-6 transition-colors duration-200 cursor-pointer
          ${isDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40'}
          ${isUploading ? 'pointer-events-none opacity-80' : ''}
        `}
      >
        {isUploading ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              A carregar... {progress}%
            </p>
            {/* Progress bar at the bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-lg bg-muted">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <UploadCloud className="h-6 w-6 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Arraste ou clique para seleccionar
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Formatos: {allowedExtensions.join(', ').toUpperCase()} — Max: 20MB
              </p>
            </div>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={acceptString}
          onChange={handleChange}
          className="hidden"
          aria-label="Seleccionar ficheiro para upload"
        />
      </div>
    </div>
  )
}
