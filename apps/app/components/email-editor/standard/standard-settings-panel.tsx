'use client'

import { useEffect, useState } from 'react'
import { type Editor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import {
  Building2,
  ExternalLink,
  ImageIcon,
  MousePointer,
  MousePointerSquareDashed,
  Paperclip,
  Pencil,
  Heading as HeadingIcon,
  Minus,
} from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  EmailButtonForm,
  EmailAttachmentForm,
  EmailImageForm,
  EMAIL_BUTTON_FORM_DEFAULTS,
  EMAIL_ATTACHMENT_FORM_DEFAULTS,
  EMAIL_IMAGE_FORM_DEFAULTS,
  type EmailButtonFormProps,
  type EmailAttachmentFormProps,
  type EmailImageFormProps,
} from '../shared/email-block-forms'
import {
  useAttachmentUploadHandler,
  useImageUploadHandler,
} from '../shared/use-attachment-upload'
import {
  EMAIL_PROPERTY_GRID_DEFAULTS,
  type EmailPropertyGridAttrs,
  type PropertyGridItem,
} from './nodes/property-grid-node'
import { PropertySelector } from './property-selector'
import {
  EMAIL_PORTAL_LINKS_DEFAULTS,
  type EmailPortalLinksAttrs,
} from './nodes/portal-links-node'

interface StandardSettingsPanelProps {
  editor: Editor | null
  onOpenPortalLinksDialog: () => void
  onOpenAttachmentDialog: () => void
  onOpenImageDialog: () => void
}

interface SelectionInfo {
  type: string
  nodeAttrs: Record<string, unknown>
}

export function StandardSettingsPanel({
  editor,
  onOpenPortalLinksDialog,
  onOpenAttachmentDialog,
  onOpenImageDialog,
}: StandardSettingsPanelProps) {
  const [selection, setSelection] = useState<SelectionInfo | null>(null)

  useEffect(() => {
    if (!editor) return

    const update = () => {
      const sel = editor.state.selection
      if (sel instanceof NodeSelection) {
        setSelection({
          type: sel.node.type.name,
          nodeAttrs: sel.node.attrs,
        })
      } else {
        // For heading / image selections that aren't NodeSelection, check
        // whether the active node at the cursor is a heading.
        const { $from } = sel
        for (let depth = $from.depth; depth >= 0; depth--) {
          const node = $from.node(depth)
          if (node?.type?.name === 'heading') {
            setSelection({
              type: 'heading',
              nodeAttrs: node.attrs,
            })
            return
          }
        }
        setSelection(null)
      }
    }

    update()
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
    }
  }, [editor])

  return (
    <div className="w-72 shrink-0 border-l bg-background flex flex-col overflow-hidden">
      <div className="border-b px-3 py-2.5">
        <h3 className="text-sm font-semibold">Propriedades</h3>
      </div>
      <div className="flex-1 overflow-auto">
        {renderPanel(selection, editor, {
          onOpenPortalLinksDialog,
          onOpenAttachmentDialog,
          onOpenImageDialog,
        })}
      </div>
    </div>
  )
}

interface PanelCallbacks {
  onOpenPortalLinksDialog: () => void
  onOpenAttachmentDialog: () => void
  onOpenImageDialog: () => void
}

function renderPanel(
  selection: SelectionInfo | null,
  editor: Editor | null,
  callbacks: PanelCallbacks
) {
  if (!editor || !selection) return <EmptyPanel />

  switch (selection.type) {
    case 'emailButton':
      return (
        <ButtonSettings
          editor={editor}
          attrs={{ ...EMAIL_BUTTON_FORM_DEFAULTS, ...(selection.nodeAttrs as Partial<EmailButtonFormProps>) }}
        />
      )
    case 'emailAttachment':
      return (
        <AttachmentSettings
          editor={editor}
          attrs={{ ...EMAIL_ATTACHMENT_FORM_DEFAULTS, ...(selection.nodeAttrs as Partial<EmailAttachmentFormProps>) }}
        />
      )
    case 'emailImage':
      return (
        <ImageSettings
          editor={editor}
          attrs={{ ...EMAIL_IMAGE_FORM_DEFAULTS, ...(selection.nodeAttrs as Partial<EmailImageFormProps>) }}
        />
      )
    case 'emailPropertyGrid':
      return (
        <PropertyGridSettings
          editor={editor}
          attrs={{ ...EMAIL_PROPERTY_GRID_DEFAULTS, ...(selection.nodeAttrs as Partial<EmailPropertyGridAttrs>) }}
        />
      )
    case 'emailPortalLinks':
      return (
        <PortalLinksSettings
          editor={editor}
          attrs={{ ...EMAIL_PORTAL_LINKS_DEFAULTS, ...(selection.nodeAttrs as Partial<EmailPortalLinksAttrs>) }}
          onOpenDialog={callbacks.onOpenPortalLinksDialog}
        />
      )
    case 'horizontalRule':
      return <DividerSettings />
    case 'heading':
      return (
        <HeadingSettings
          editor={editor}
          level={(selection.nodeAttrs.level as number) || 2}
        />
      )
    default:
      return <EmptyPanel />
  }
}

// ─── Empty state ─────────────────────────────────────────────────────────

function EmptyPanel() {
  return (
    <div className="p-4 text-center">
      <MousePointerSquareDashed className="mx-auto h-8 w-8 text-muted-foreground/40" />
      <p className="mt-2 text-xs text-muted-foreground">
        Seleccione um bloco para editar as propriedades.
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground/80">
        Para formatar texto, selecione-o para abrir a barra flutuante.
      </p>
    </div>
  )
}

function PanelHeader({
  icon: Icon,
  title,
}: {
  icon: typeof MousePointer
  title: string
}) {
  return (
    <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </span>
    </div>
  )
}

// ─── Button (shared form — identical to advanced) ────────────────────────

function ButtonSettings({
  editor,
  attrs,
}: {
  editor: Editor
  attrs: EmailButtonFormProps
}) {
  return (
    <div>
      <PanelHeader icon={MousePointer} title="Botão" />
      <div className="p-3">
        <EmailButtonForm
          props={attrs}
          onChange={(patch) => editor.commands.updateEmailButton(patch)}
        />
      </div>
    </div>
  )
}

// ─── Attachment (shared form — identical to advanced) ────────────────────

function AttachmentSettings({
  editor,
  attrs,
}: {
  editor: Editor
  attrs: EmailAttachmentFormProps
}) {
  const { triggerUpload, uploading, fileInput } = useAttachmentUploadHandler({
    onUploaded: (data) =>
      editor.commands.updateEmailAttachment({
        fileUrl: data.url,
        fileName: data.fileName,
        fileSize: data.fileSize,
      }),
  })

  return (
    <div>
      <PanelHeader icon={Paperclip} title="Anexo" />
      <div className="p-3 space-y-3">
        <EmailAttachmentForm
          props={attrs}
          onChange={(patch) => editor.commands.updateEmailAttachment(patch)}
          onUpload={triggerUpload}
          onRemove={() =>
            editor.commands.updateEmailAttachment({
              fileUrl: '',
              fileName: '',
              fileSize: 0,
            })
          }
          uploading={uploading}
        />
        {fileInput}
      </div>
    </div>
  )
}

// ─── Property grid ───────────────────────────────────────────────────────

function PropertyGridSettings({
  editor,
  attrs,
}: {
  editor: Editor
  attrs: EmailPropertyGridAttrs
}) {
  const update = (patch: Partial<EmailPropertyGridAttrs>) => {
    editor.commands.updateEmailPropertyGrid(patch)
  }

  const isDynamic = attrs.mode === 'dynamic'

  const handlePropertiesChange = (properties: PropertyGridItem[]) => {
    update({ properties })
  }

  return (
    <div>
      <PanelHeader icon={Building2} title="Grelha de Imóveis" />
      <div className="p-3 space-y-3">
        <Field label="Modo">
          <Select
            value={attrs.mode}
            onValueChange={(v) => {
              const mode = v as 'dynamic' | 'manual'
              if (mode === 'dynamic') {
                update({ mode, properties: [] })
              } else {
                update({ mode })
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dynamic">Dinâmica (preenchida no envio)</SelectItem>
              <SelectItem value="manual">Seleccionar imóveis</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Texto do botão">
          <Input
            value={attrs.ctaLabel}
            onChange={(e) => update({ ctaLabel: e.target.value })}
            className="h-8 text-xs"
          />
        </Field>
        <Field label="Colunas">
          <Select
            value={String(attrs.columns)}
            onValueChange={(v) => update({ columns: Number(v) })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 coluna</SelectItem>
              <SelectItem value="2">2 colunas</SelectItem>
              <SelectItem value="3">3 colunas</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {isDynamic ? (
          <div className="rounded-md border bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
            Os imóveis serão preenchidos automaticamente a partir do dossier do
            negócio no momento do envio.
          </div>
        ) : (
          <Field label="Imóveis">
            <PropertySelector
              value={attrs.properties}
              onChange={handlePropertiesChange}
            />
          </Field>
        )}
      </div>
    </div>
  )
}

// ─── Portal links ────────────────────────────────────────────────────────

function PortalLinksSettings({
  editor,
  attrs,
  onOpenDialog,
}: {
  editor: Editor
  attrs: EmailPortalLinksAttrs
  onOpenDialog: () => void
}) {
  const update = (patch: Partial<EmailPortalLinksAttrs>) => {
    editor.commands.updateEmailPortalLinks(patch)
  }

  return (
    <div>
      <PanelHeader icon={ExternalLink} title="Links de Portais" />
      <div className="p-3 space-y-3">
        <Field label="Título">
          <Input
            value={attrs.title}
            onChange={(e) => update({ title: e.target.value })}
            className="h-8 text-xs"
          />
        </Field>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Mostrar título</Label>
          <input
            type="checkbox"
            checked={attrs.showTitle}
            onChange={(e) => update({ showTitle: e.target.checked })}
            aria-label="Mostrar título"
          />
        </div>
        <Field label="Layout">
          <Select
            value={attrs.layout}
            onValueChange={(v) =>
              update({ layout: v as EmailPortalLinksAttrs['layout'] })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vertical">Vertical</SelectItem>
              <SelectItem value="horizontal">Horizontal</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="rounded-md border bg-muted/30 p-2.5 text-xs">
          <div className="font-medium">
            {attrs.portals.length} portal{attrs.portals.length === 1 ? '' : 'is'}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs gap-1.5"
          onClick={onOpenDialog}
        >
          <Pencil className="h-3 w-3" />
          Editar portais
        </Button>
      </div>
    </div>
  )
}

// ─── Image (shared form — identical to advanced) ─────────────────────────

function ImageSettings({
  editor,
  attrs,
}: {
  editor: Editor
  attrs: EmailImageFormProps
}) {
  const { triggerUpload, uploading, fileInput } = useImageUploadHandler({
    onUploaded: (url) => editor.commands.updateEmailImage({ src: url }),
  })

  return (
    <div>
      <PanelHeader icon={ImageIcon} title="Imagem" />
      <div className="p-3 space-y-3">
        <EmailImageForm
          props={attrs}
          onChange={(patch) => editor.commands.updateEmailImage(patch)}
          onUpload={triggerUpload}
          uploading={uploading}
        />
        {fileInput}
      </div>
    </div>
  )
}

// ─── Heading ─────────────────────────────────────────────────────────────

function HeadingSettings({
  editor,
  level,
}: {
  editor: Editor
  level: number
}) {
  return (
    <div>
      <PanelHeader icon={HeadingIcon} title="Título" />
      <div className="p-3 space-y-3">
        <Field label="Nível">
          <Select
            value={String(level)}
            onValueChange={(v) => {
              const lvl = Number(v) as 1 | 2 | 3 | 4
              editor.chain().focus().setHeading({ level: lvl }).run()
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Título 1</SelectItem>
              <SelectItem value="2">Título 2</SelectItem>
              <SelectItem value="3">Título 3</SelectItem>
              <SelectItem value="4">Título 4</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          Converter em parágrafo
        </Button>
      </div>
    </div>
  )
}

// ─── Divider ─────────────────────────────────────────────────────────────

function DividerSettings() {
  return (
    <div>
      <PanelHeader icon={Minus} title="Divisor" />
      <div className="p-3">
        <p className="text-xs text-muted-foreground">
          O divisor não tem configurações. Prima <code>Backspace</code> para o remover.
        </p>
      </div>
    </div>
  )
}

// ─── Reusable bits ───────────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}

function ColorInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        title="Cor"
        aria-label="Seleccionar cor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-7 shrink-0 rounded border cursor-pointer"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 text-xs flex-1 min-w-0"
      />
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
