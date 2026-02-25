'use client'

import { useNode } from '@craftjs/core'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Paperclip } from 'lucide-react'

interface EmailAttachmentProps {
  label?: string
  description?: string
  docTypeId?: string
  required?: boolean
}

export const EmailAttachment = ({
  label = 'Documento anexo',
  description = '',
  docTypeId = '',
  required = true,
}: EmailAttachmentProps) => {
  const {
    connectors: { connect, drag },
  } = useNode()

  return (
    <div
      ref={(ref) => {
        if (ref) connect(drag(ref))
      }}
      className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Paperclip className="h-5 w-5" />
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{label}</span>
          <Badge variant={required ? 'default' : 'secondary'} className="text-xs">
            {required ? 'Obrigatório' : 'Opcional'}
          </Badge>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
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
  } = useNode((node) => ({
    label: node.data.props.label,
    description: node.data.props.description,
    docTypeId: node.data.props.docTypeId,
    required: node.data.props.required,
  }))

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
        <Label>ID Tipo de Documento</Label>
        <Input
          type="text"
          placeholder="UUID do doc_type (futuro)"
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
  },
  related: {
    settings: EmailAttachmentSettings,
  },
}
