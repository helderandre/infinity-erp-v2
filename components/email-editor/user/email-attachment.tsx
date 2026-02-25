'use client'

import { useRef, useState } from 'react'
import { useNode } from '@craftjs/core'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Paperclip, Upload, Loader2, X, FileText, FileSpreadsheet, FileImage, File } from 'lucide-react'
import { toast } from 'sonner'

const ACCEPT_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp'
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

interface EmailAttachmentProps {
  label?: string
  description?: string
  docTypeId?: string
  required?: boolean
  fileUrl?: string
  fileName?: string
  fileSize?: number
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') return FileText
  if (['doc', 'docx'].includes(ext)) return FileText
  if (['xls', 'xlsx'].includes(ext)) return FileSpreadsheet
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return FileImage
  return File
}

export const EmailAttachment = ({
  label = 'Documento anexo',
  description = '',
  required = true,
  fileUrl = '',
  fileName = '',
  fileSize = 0,
}: EmailAttachmentProps) => {
  const {
    connectors: { connect, drag },
  } = useNode()

  const FileIcon = fileName ? getFileIcon(fileName) : Paperclip

  return (
    <div
      ref={(ref) => {
        if (ref) connect(drag(ref))
      }}
      className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <FileIcon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{label}</span>
          <Badge variant={required ? 'default' : 'secondary'} className="text-xs shrink-0">
            {required ? 'Obrigatório' : 'Opcional'}
          </Badge>
        </div>
        {fileUrl && fileName ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Paperclip className="h-3 w-3 shrink-0" />
            <span className="truncate">{fileName}</span>
            {fileSize > 0 && (
              <span className="shrink-0">({formatFileSize(fileSize)})</span>
            )}
          </div>
        ) : description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : (
          <p className="text-xs text-muted-foreground italic">Nenhum ficheiro carregado</p>
        )}
      </div>
    </div>
  )
}

const EmailAttachmentSettings = () => {
  const {
    actions: { setProp },
    label,
    description,
    docTypeId,
    required,
    fileUrl,
    fileName,
    fileSize,
  } = useNode((node) => ({
    label: node.data.props.label,
    description: node.data.props.description,
    docTypeId: node.data.props.docTypeId,
    required: node.data.props.required,
    fileUrl: node.data.props.fileUrl,
    fileName: node.data.props.fileName,
    fileSize: node.data.props.fileSize,
  }))

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    e.target.value = ''

    if (file.size > MAX_SIZE) {
      toast.error('Ficheiro demasiado grande. Máximo 10MB.')
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/libraries/emails/upload-attachment', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao carregar ficheiro')
      }

      const data = await res.json()
      setProp((p: EmailAttachmentProps) => {
        p.fileUrl = data.url
        p.fileName = data.fileName
        p.fileSize = data.fileSize
      })
      toast.success('Ficheiro carregado com sucesso')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar ficheiro')
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveFile = () => {
    setProp((p: EmailAttachmentProps) => {
      p.fileUrl = ''
      p.fileName = ''
      p.fileSize = 0
    })
  }

  const FileIcon = fileName ? getFileIcon(fileName) : null

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Título</Label>
        <Input
          type="text"
          value={label}
          onChange={(e) => setProp((p: EmailAttachmentProps) => { p.label = e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Input
          type="text"
          placeholder="Descrição opcional..."
          value={description}
          onChange={(e) => setProp((p: EmailAttachmentProps) => { p.description = e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Ficheiro Anexo</Label>
        {fileUrl && fileName ? (
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
            {FileIcon && <FileIcon className="h-5 w-5 shrink-0 text-primary" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{fileName}</p>
              {fileSize > 0 && (
                <p className="text-xs text-muted-foreground">{formatFileSize(fileSize)}</p>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-1.5 h-3 w-3" />
                Trocar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handleRemoveFile}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {isUploading ? 'A carregar...' : 'Carregar ficheiro'}
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_TYPES}
          className="hidden"
          onChange={handleFileSelect}
        />
        <p className="text-xs text-muted-foreground">
          PDF, DOC, DOCX, XLS, XLSX, JPG, PNG ou WebP. Máx. 10MB.
        </p>
      </div>

      <div className="space-y-2">
        <Label>ID Tipo de Documento</Label>
        <Input
          type="text"
          placeholder="UUID do doc_type (opcional)"
          value={docTypeId}
          onChange={(e) => setProp((p: EmailAttachmentProps) => { p.docTypeId = e.target.value })}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label>Obrigatório</Label>
        <Switch
          checked={required}
          onCheckedChange={(v) => setProp((p: EmailAttachmentProps) => { p.required = v })}
        />
      </div>
    </div>
  )
}

EmailAttachment.craft = {
  displayName: 'Anexo',
  props: {
    label: 'Documento anexo',
    description: '',
    docTypeId: '',
    required: true,
    fileUrl: '',
    fileName: '',
    fileSize: 0,
  },
  related: {
    settings: EmailAttachmentSettings,
  },
}
