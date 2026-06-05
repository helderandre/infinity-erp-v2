'use client'

import { useNode } from '@craftjs/core'
import { Badge } from '@/components/ui/badge'
import { Paperclip, FileText, FileSpreadsheet, FileImage, File } from 'lucide-react'
import {
  EmailAttachmentForm,
  EMAIL_ATTACHMENT_FORM_DEFAULTS,
  type EmailAttachmentFormProps,
} from '@/components/email-editor/shared/email-block-forms'
import { useAttachmentUploadHandler } from '@/components/email-editor/shared/use-attachment-upload'

type EmailAttachmentProps = EmailAttachmentFormProps

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
    props,
  } = useNode((node) => ({
    props: node.data.props as EmailAttachmentFormProps,
  }))

  const { triggerUpload, uploading, fileInput } = useAttachmentUploadHandler({
    onUploaded: (data) => {
      setProp((p: EmailAttachmentProps) => {
        p.fileUrl = data.url
        p.fileName = data.fileName
        p.fileSize = data.fileSize
      })
    },
  })

  return (
    <div className="space-y-4 p-3">
      <EmailAttachmentForm
        props={props}
        onChange={(patch) =>
          setProp((p: EmailAttachmentProps) => {
            Object.assign(p, patch)
          })
        }
        onUpload={triggerUpload}
        onRemove={() =>
          setProp((p: EmailAttachmentProps) => {
            p.fileUrl = ''
            p.fileName = ''
            p.fileSize = 0
          })
        }
        uploading={uploading}
      />
      {fileInput}
      <p className="text-xs text-muted-foreground">
        PDF, DOC, DOCX, XLS, XLSX, JPG, PNG ou WebP. Máx. 10MB.
      </p>
    </div>
  )
}

EmailAttachment.craft = {
  displayName: 'Anexo',
  props: { ...EMAIL_ATTACHMENT_FORM_DEFAULTS },
  related: {
    settings: EmailAttachmentSettings,
  },
}
