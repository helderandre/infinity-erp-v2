'use client'

import { useEffect, useState } from 'react'
import { Paperclip, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/kibo-ui/spinner'

interface ChatAttachmentPreviewProps {
  file: File
  onRemove: () => void
  /** Quando true, mostra overlay de loading e esconde o botão de
   * remover — o utilizador não deve cancelar a meio do upload. */
  isUploading?: boolean
}

function isImage(file: File): boolean {
  return file.type.startsWith('image/')
}

/**
 * Preview compacta de um anexo na barra do composer do chat.
 * - Imagens (JPEG/PNG/WebP/GIF/HEIC): thumbnail 80×80 com object-cover.
 * - Outros tipos: chip com ícone Paperclip + nome truncado.
 *
 * Em estado `isUploading`, sobrepõe spinner + overlay translúcido para
 * dar feedback claro de que o ficheiro está a ser enviado, e esconde
 * o botão X (não suportamos cancelamento mid-upload).
 */
export function ChatAttachmentPreview({ file, onRemove, isUploading }: ChatAttachmentPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!isImage(file)) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    // Revoke quando o ficheiro muda ou o componente desmonta — evita
    // reter blobs em memória depois de removidos do composer.
    return () => URL.revokeObjectURL(url)
  }, [file])

  const showRemove = !isUploading

  if (previewUrl) {
    return (
      <div className="relative h-20 w-20 shrink-0 rounded-lg overflow-hidden border bg-muted/50 group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={file.name}
          className={`h-full w-full object-cover transition-opacity ${isUploading ? 'opacity-60' : ''}`}
        />
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/30">
            <Spinner className="h-5 w-5 text-foreground" />
          </div>
        )}
        {showRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remover ${file.name}`}
            className="absolute top-1 right-1 h-5 w-5 flex items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm border border-border/40 backdrop-blur-sm transition-colors hover:bg-background"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    )
  }

  // Fallback para não-imagens — chip horizontal alinhado à altura do
  // thumbnail (h-20) para manter a row visualmente consistente.
  return (
    <div className="flex items-center gap-2 h-20 shrink-0 rounded-lg border px-3 text-xs bg-muted/50">
      {isUploading ? (
        <Spinner className="h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <span className="truncate max-w-[160px] font-medium">{file.name}</span>
      {showRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5 p-0 shrink-0"
          onClick={onRemove}
          aria-label={`Remover ${file.name}`}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}

