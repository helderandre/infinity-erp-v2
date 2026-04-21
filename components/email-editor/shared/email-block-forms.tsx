'use client'

/**
 * Headless settings forms for the Email* block components, reused by BOTH:
 * - The Craft.js advanced mode (wrapped in `related.settings` with useNode)
 * - The Tiptap standard mode (wrapped in updateAttributes calls)
 *
 * Each form is a pure React component that takes `(props, onChange)` and
 * renders the same controls regardless of the host. This guarantees the
 * two modes present identical properties for each block.
 */

import type { ReactElement } from 'react'
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ColorPickerField } from '@/components/email-editor/color-picker-field'
import { UnitInput, RadiusInput } from '@/components/email-editor/settings'

// ─── Shared shadow presets ────────────────────────────────────────────────

export const SHADOW_PRESETS = [
  { value: 'none', label: 'Nenhuma' },
  { value: '0 1px 2px 0 rgba(0,0,0,0.05)', label: 'Extra Leve' },
  { value: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)', label: 'Leve' },
  { value: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)', label: 'Média' },
  { value: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)', label: 'Grande' },
]

// ─── Button ───────────────────────────────────────────────────────────────

export interface EmailButtonFormProps {
  text?: string
  href?: string
  backgroundColor?: string
  color?: string
  borderRadius?: string
  fontSize?: number
  paddingX?: number
  paddingY?: number
  align?: string
  fullWidth?: boolean
  boxShadow?: string
}

export const EMAIL_BUTTON_FORM_DEFAULTS: Required<EmailButtonFormProps> = {
  text: 'Clique aqui',
  href: '#',
  backgroundColor: '#576c98',
  color: '#fafafa',
  borderRadius: '65px',
  fontSize: 16,
  paddingX: 24,
  paddingY: 12,
  align: 'center',
  fullWidth: false,
  boxShadow: 'none',
}

export function EmailButtonForm({
  props,
  onChange,
}: {
  props: EmailButtonFormProps
  onChange: (patch: Partial<EmailButtonFormProps>) => void
}): ReactElement {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Texto</Label>
        <Input
          type="text"
          value={props.text ?? ''}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>URL (href)</Label>
        <Input
          type="text"
          placeholder="https://..."
          className="font-mono text-xs"
          value={props.href ?? ''}
          onChange={(e) => onChange({ href: e.target.value })}
        />
      </div>
      <ColorPickerField
        label="Cor de fundo"
        value={props.backgroundColor || EMAIL_BUTTON_FORM_DEFAULTS.backgroundColor}
        onChange={(v) => onChange({ backgroundColor: v })}
      />
      <ColorPickerField
        label="Cor do texto"
        value={props.color || EMAIL_BUTTON_FORM_DEFAULTS.color}
        onChange={(v) => onChange({ color: v })}
      />
      <div className="space-y-2">
        <Label>Alinhamento</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={props.align}
          onValueChange={(v) => {
            if (v) onChange({ align: v })
          }}
        >
          <ToggleGroupItem value="left" aria-label="Esquerda">
            <AlignLeft className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="center" aria-label="Centro">
            <AlignCenter className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="right" aria-label="Direita">
            <AlignRight className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Padding</Label>
        <UnitInput
          value={`${props.paddingY ?? EMAIL_BUTTON_FORM_DEFAULTS.paddingY}px`}
          onChange={(v) =>
            onChange({ paddingY: parseFloat(v) || EMAIL_BUTTON_FORM_DEFAULTS.paddingY })
          }
          units={['px']}
        />
      </div>
      <RadiusInput
        value={props.borderRadius || EMAIL_BUTTON_FORM_DEFAULTS.borderRadius}
        onChange={(v) => onChange({ borderRadius: v })}
      />
      <div className="space-y-2">
        <Label>Largura</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          className="w-full"
          value={props.fullWidth ? '100%' : 'auto'}
          onValueChange={(val) => {
            if (val) onChange({ fullWidth: val === '100%' })
          }}
        >
          <ToggleGroupItem value="auto" className="flex-1 text-xs">
            Auto
          </ToggleGroupItem>
          <ToggleGroupItem value="100%" className="flex-1 text-xs">
            100%
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="space-y-2">
        <Label>Sombra</Label>
        <Select
          value={props.boxShadow || 'none'}
          onValueChange={(v) => onChange({ boxShadow: v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SHADOW_PRESETS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

// ─── Image ────────────────────────────────────────────────────────────────

export interface EmailImageFormProps {
  src?: string
  alt?: string
  width?: number
  height?: number
  align?: string
  href?: string
  borderRadius?: string
  boxShadow?: string
}

export const EMAIL_IMAGE_FORM_DEFAULTS: Required<EmailImageFormProps> = {
  src: '',
  alt: '',
  width: 100,
  height: 0,
  align: 'center',
  href: '',
  borderRadius: '0px',
  boxShadow: 'none',
}

export function EmailImageForm({
  props,
  onChange,
  onUpload,
  uploading,
}: {
  props: EmailImageFormProps
  onChange: (patch: Partial<EmailImageFormProps>) => void
  onUpload?: () => void
  uploading?: boolean
}): ReactElement {
  return (
    <div className="space-y-3">
      {props.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={props.src}
          alt={props.alt || ''}
          className="w-full h-auto rounded border"
        />
      ) : (
        <div className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-xs text-muted-foreground">
          Sem imagem carregada
        </div>
      )}
      <div className="space-y-2">
        <Label>URL (src)</Label>
        <Input
          type="text"
          placeholder="https://..."
          value={props.src ?? ''}
          onChange={(e) => onChange({ src: e.target.value })}
          className="text-xs"
        />
        {onUpload && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full text-xs"
            disabled={uploading}
            onClick={onUpload}
          >
            {uploading ? 'A carregar...' : 'Carregar imagem'}
          </Button>
        )}
      </div>
      <div className="space-y-2">
        <Label>Texto alternativo</Label>
        <Input
          value={props.alt ?? ''}
          onChange={(e) => onChange({ alt: e.target.value })}
          placeholder="Descrição da imagem"
        />
      </div>
      <div className="space-y-2">
        <Label>Link ao clicar (opcional)</Label>
        <Input
          type="text"
          placeholder="https://..."
          value={props.href ?? ''}
          onChange={(e) => onChange({ href: e.target.value })}
          className="font-mono text-xs"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Largura (%)</Label>
          <Input
            type="number"
            min={10}
            max={100}
            value={props.width ?? EMAIL_IMAGE_FORM_DEFAULTS.width}
            onChange={(e) =>
              onChange({ width: Number(e.target.value) || EMAIL_IMAGE_FORM_DEFAULTS.width })
            }
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Altura (px)</Label>
          <Input
            type="number"
            min={0}
            value={props.height ?? 0}
            onChange={(e) => onChange({ height: Number(e.target.value) || 0 })}
            placeholder="auto"
            className="h-8 text-xs"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Alinhamento</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={props.align}
          onValueChange={(v) => {
            if (v) onChange({ align: v })
          }}
        >
          <ToggleGroupItem value="left" aria-label="Esquerda">
            <AlignLeft className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="center" aria-label="Centro">
            <AlignCenter className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="right" aria-label="Direita">
            <AlignRight className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <RadiusInput
        value={props.borderRadius || EMAIL_IMAGE_FORM_DEFAULTS.borderRadius}
        onChange={(v) => onChange({ borderRadius: v })}
      />
      <div className="space-y-2">
        <Label>Sombra</Label>
        <Select
          value={props.boxShadow || 'none'}
          onValueChange={(v) => onChange({ boxShadow: v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SHADOW_PRESETS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

// ─── Attachment ───────────────────────────────────────────────────────────

export interface EmailAttachmentFormProps {
  label?: string
  description?: string
  docTypeId?: string
  required?: boolean
  fileUrl?: string
  fileName?: string
  fileSize?: number
}

export const EMAIL_ATTACHMENT_FORM_DEFAULTS: Required<EmailAttachmentFormProps> = {
  label: 'Documento anexo',
  description: '',
  docTypeId: '',
  required: true,
  fileUrl: '',
  fileName: '',
  fileSize: 0,
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function EmailAttachmentForm({
  props,
  onChange,
  onUpload,
  onRemove,
  uploading,
}: {
  props: EmailAttachmentFormProps
  onChange: (patch: Partial<EmailAttachmentFormProps>) => void
  onUpload?: () => void
  onRemove?: () => void
  uploading?: boolean
}): ReactElement {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Etiqueta</Label>
        <Input
          value={props.label ?? ''}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Documento anexo"
        />
      </div>
      <div className="space-y-2">
        <Label>Descrição (opcional)</Label>
        <Input
          value={props.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Notas para o utilizador"
        />
      </div>
      <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
        <Label className="text-xs cursor-pointer" htmlFor="attachment-required">
          Obrigatório
        </Label>
        <Switch
          id="attachment-required"
          checked={props.required !== false}
          onCheckedChange={(v) => onChange({ required: v })}
        />
      </div>

      <div className="rounded-md border bg-muted/20 p-3 text-xs space-y-2">
        {props.fileName ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{props.fileName}</div>
                {props.fileSize ? (
                  <div className="text-[11px] text-muted-foreground">
                    {formatFileSize(props.fileSize)}
                  </div>
                ) : null}
              </div>
              <Badge
                variant={props.required !== false ? 'default' : 'secondary'}
                className="text-[10px] shrink-0"
              >
                {props.required !== false ? 'Obrigatório' : 'Opcional'}
              </Badge>
            </div>
            {onRemove && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-destructive"
                onClick={onRemove}
              >
                Remover ficheiro
              </Button>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">Nenhum ficheiro carregado.</p>
        )}
        {onUpload && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs"
            disabled={uploading}
            onClick={onUpload}
          >
            {uploading
              ? 'A carregar...'
              : props.fileName
                ? 'Substituir ficheiro'
                : 'Carregar ficheiro'}
          </Button>
        )}
      </div>
    </div>
  )
}
