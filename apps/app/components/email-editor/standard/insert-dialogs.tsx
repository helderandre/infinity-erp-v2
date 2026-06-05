'use client'

import { useEffect, useState } from 'react'
import { type Editor } from '@tiptap/react'
import { toast } from 'sonner'
import { Upload, Paperclip } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/kibo-ui/spinner'
import { EMAIL_BUTTON_DEFAULTS, type EmailButtonAttrs } from './nodes/button-node'
import {
  EMAIL_ATTACHMENT_DEFAULTS,
  formatFileSize,
  type EmailAttachmentAttrs,
} from './nodes/attachment-node'
import {
  EMAIL_PROPERTY_GRID_DEFAULTS,
  type EmailPropertyGridAttrs,
  type PropertyGridMode,
} from './nodes/property-grid-node'
import { PropertySelector } from './property-selector'
import { Zap, ListChecks } from 'lucide-react'
import {
  EMAIL_PORTAL_LINKS_DEFAULTS,
  type EmailPortalLinksAttrs,
  type PortalEntry,
} from './nodes/portal-links-node'
import { Textarea } from '@/components/ui/textarea'
import { Trash2, Plus } from 'lucide-react'

// ─── Button dialog ─────────────────────────────────────────────────────────

interface ButtonDialogState {
  open: boolean
  initial: Partial<EmailButtonAttrs> | null
}

interface ButtonDialogProps {
  state: ButtonDialogState
  onClose: () => void
  onSubmit: (attrs: EmailButtonAttrs) => void
}

export function EmailButtonDialog({ state, onClose, onSubmit }: ButtonDialogProps) {
  const [attrs, setAttrs] = useState<EmailButtonAttrs>(EMAIL_BUTTON_DEFAULTS)

  useEffect(() => {
    if (state.open) {
      setAttrs({ ...EMAIL_BUTTON_DEFAULTS, ...(state.initial || {}) })
    }
  }, [state.open, state.initial])

  const handleSubmit = () => {
    if (!attrs.text.trim()) {
      toast.error('O texto do botão é obrigatório')
      return
    }
    if (!attrs.href.trim()) {
      toast.error('O URL do botão é obrigatório')
      return
    }
    onSubmit(attrs)
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inserir botão</DialogTitle>
          <DialogDescription>
            Configure o texto, link e aparência do botão.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label className="text-xs">Texto</Label>
            <Input
              value={attrs.text}
              onChange={(e) => setAttrs((a) => ({ ...a, text: e.target.value }))}
              placeholder="Saber mais"
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">URL</Label>
            <Input
              value={attrs.href}
              onChange={(e) => setAttrs((a) => ({ ...a, href: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Cor de fundo</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  title="Cor de fundo do botão"
                  aria-label="Cor de fundo do botão"
                  value={attrs.backgroundColor}
                  onChange={(e) =>
                    setAttrs((a) => ({ ...a, backgroundColor: e.target.value }))
                  }
                  className="h-8 w-8 rounded border cursor-pointer"
                />
                <Input
                  value={attrs.backgroundColor}
                  onChange={(e) =>
                    setAttrs((a) => ({ ...a, backgroundColor: e.target.value }))
                  }
                  className="flex-1 text-xs"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Cor do texto</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  title="Cor do texto do botão"
                  aria-label="Cor do texto do botão"
                  value={attrs.color}
                  onChange={(e) => setAttrs((a) => ({ ...a, color: e.target.value }))}
                  className="h-8 w-8 rounded border cursor-pointer"
                />
                <Input
                  value={attrs.color}
                  onChange={(e) => setAttrs((a) => ({ ...a, color: e.target.value }))}
                  className="flex-1 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Alinhamento</Label>
            <Select
              value={attrs.align}
              onValueChange={(v) =>
                setAttrs((a) => ({
                  ...a,
                  align: v as EmailButtonAttrs['align'],
                }))
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Esquerda</SelectItem>
                <SelectItem value="center">Centro</SelectItem>
                <SelectItem value="right">Direita</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>Inserir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function useButtonDialog(editor: Editor | null) {
  const [state, setState] = useState<ButtonDialogState>({
    open: false,
    initial: null,
  })

  const openForInsert = () => {
    setState({ open: true, initial: null })
  }

  const openForEdit = (attrs: Partial<EmailButtonAttrs>) => {
    setState({ open: true, initial: attrs })
  }

  const close = () => setState({ open: false, initial: null })

  const submit = (attrs: EmailButtonAttrs) => {
    if (!editor) return
    if (state.initial) {
      editor.commands.updateEmailButton(attrs)
    } else {
      editor.chain().focus().insertEmailButton(attrs).run()
    }
    close()
  }

  return { state, openForInsert, openForEdit, close, submit }
}

// ─── Image upload dialog ───────────────────────────────────────────────────

interface ImageDialogProps {
  open: boolean
  onClose: () => void
  onInsert: (src: string) => void
}

export function EmailImageDialog({ open, onClose, onInsert }: ImageDialogProps) {
  const [url, setUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setUrl('')
      setError(null)
    }
  }, [open])

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('O ficheiro tem de ser uma imagem.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/libraries/emails/upload', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao carregar imagem')
      }
      const data = await res.json()
      onInsert(data.url as string)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar imagem')
    } finally {
      setUploading(false)
    }
  }

  const handleUrlInsert = () => {
    if (!url.trim()) {
      setError('Cola um URL ou carrega um ficheiro.')
      return
    }
    onInsert(url.trim())
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inserir imagem</DialogTitle>
          <DialogDescription>
            Carregue um ficheiro local ou cole um URL público.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <label
            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm text-muted-foreground cursor-pointer hover:bg-muted/30"
          >
            <Upload className="h-5 w-5" />
            <span>Clique para escolher um ficheiro</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFile(file)
              }}
              disabled={uploading}
            />
          </label>

          <div className="text-center text-xs text-muted-foreground">ou</div>

          <div className="grid gap-1.5">
            <Label className="text-xs">URL da imagem</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              disabled={uploading}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={uploading}>
            Cancelar
          </Button>
          <Button onClick={handleUrlInsert} disabled={uploading || !url.trim()}>
            {uploading ? (
              <Spinner variant="infinite" size={14} className="mr-2" />
            ) : null}
            Inserir URL
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Attachment dialog ─────────────────────────────────────────────────────

interface AttachmentDialogProps {
  open: boolean
  initial?: Partial<EmailAttachmentAttrs> | null
  onClose: () => void
  onInsert: (attrs: EmailAttachmentAttrs) => void
}

export function EmailAttachmentDialog({
  open,
  initial,
  onClose,
  onInsert,
}: AttachmentDialogProps) {
  const [label, setLabel] = useState(EMAIL_ATTACHMENT_DEFAULTS.label)
  const [file, setFile] = useState<{
    url: string
    name: string
    size: number
  } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setLabel(initial?.label ?? EMAIL_ATTACHMENT_DEFAULTS.label)
      setFile(
        initial?.fileUrl
          ? {
              url: initial.fileUrl,
              name: initial.fileName ?? '',
              size: initial.fileSize ?? 0,
            }
          : null
      )
      setError(null)
    }
  }, [open, initial])

  const handleFile = async (f: File) => {
    if (f.size > 10 * 1024 * 1024) {
      setError('Ficheiro demasiado grande. Máximo 10MB.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', f)
      const res = await fetch('/api/libraries/emails/upload-attachment', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao carregar ficheiro')
      }
      const data = await res.json()
      setFile({
        url: data.url,
        name: data.fileName,
        size: data.fileSize,
      })
      toast.success('Ficheiro carregado')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar ficheiro')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = () => {
    if (!file) {
      setError('Carrega um ficheiro para continuar.')
      return
    }
    onInsert({
      ...EMAIL_ATTACHMENT_DEFAULTS,
      label: label.trim() || EMAIL_ATTACHMENT_DEFAULTS.label,
      fileUrl: file.url,
      fileName: file.name,
      fileSize: file.size,
      required: true,
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inserir anexo</DialogTitle>
          <DialogDescription>
            Carregue um ficheiro (PDF, imagens, docs). Máximo 10MB.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label className="text-xs">Etiqueta</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Documento anexo"
            />
          </div>

          <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm text-muted-foreground cursor-pointer hover:bg-muted/30">
            <Upload className="h-5 w-5" />
            <span>Clique para escolher um ficheiro</span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleFile(f)
              }}
              disabled={uploading}
            />
          </label>

          {file && (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{file.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={uploading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={uploading || !file}>
            Inserir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Link dialog (simple) ──────────────────────────────────────────────────

interface LinkDialogProps {
  open: boolean
  initialUrl?: string
  onClose: () => void
  onSubmit: (url: string) => void
  onRemove?: () => void
}

export function EmailLinkDialog({
  open,
  initialUrl,
  onClose,
  onSubmit,
  onRemove,
}: LinkDialogProps) {
  const [url, setUrl] = useState(initialUrl || '')

  useEffect(() => {
    if (open) setUrl(initialUrl || '')
  }, [open, initialUrl])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialUrl ? 'Editar link' : 'Inserir link'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label className="text-xs">URL</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          {initialUrl && onRemove ? (
            <Button variant="ghost" onClick={onRemove}>
              Remover link
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={() => onSubmit(url.trim())} disabled={!url.trim()}>
              {initialUrl ? 'Actualizar' : 'Inserir'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Property grid dialog ──────────────────────────────────────────────────

interface PropertyGridDialogState {
  open: boolean
  initial: Partial<EmailPropertyGridAttrs> | null
}

interface PropertyGridDialogProps {
  state: PropertyGridDialogState
  onClose: () => void
  onSubmit: (attrs: EmailPropertyGridAttrs) => void
}

export function EmailPropertyGridDialog({
  state,
  onClose,
  onSubmit,
}: PropertyGridDialogProps) {
  const [attrs, setAttrs] = useState<EmailPropertyGridAttrs>(EMAIL_PROPERTY_GRID_DEFAULTS)

  useEffect(() => {
    if (state.open) {
      setAttrs({ ...EMAIL_PROPERTY_GRID_DEFAULTS, ...(state.initial || {}) })
    }
  }, [state.open, state.initial])

  const setMode = (mode: PropertyGridMode) => {
    setAttrs((a) =>
      mode === 'dynamic'
        ? { ...a, mode, properties: [] }
        : { ...a, mode }
    )
  }

  const handleSubmit = () => {
    const final: EmailPropertyGridAttrs =
      attrs.mode === 'dynamic' ? { ...attrs, properties: [] } : attrs
    if (final.mode === 'manual' && final.properties.length === 0) {
      toast.error('Seleccione pelo menos um imóvel ou mude para modo Dinâmico.')
      return
    }
    onSubmit(final)
  }

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Grelha de Imóveis</DialogTitle>
          <DialogDescription>
            Escolha como esta grelha é preenchida.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2 rounded-lg border p-1 bg-muted/30">
            <ModeOption
              active={attrs.mode === 'dynamic'}
              icon={Zap}
              title="Dinâmica"
              description="Preenchida no envio (dossier)"
              onClick={() => setMode('dynamic')}
            />
            <ModeOption
              active={attrs.mode === 'manual'}
              icon={ListChecks}
              title="Seleccionar imóveis"
              description="Lista fixa escolhida agora"
              onClick={() => setMode('manual')}
            />
          </div>

          {attrs.mode === 'dynamic' ? (
            <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
              Os imóveis serão preenchidos automaticamente a partir do dossier do
              negócio no momento do envio. Só precisa de definir o número de
              colunas e o texto do botão abaixo.
            </div>
          ) : (
            <div className="grid gap-1.5">
              <Label className="text-xs">Imóveis</Label>
              <PropertySelector
                value={attrs.properties}
                onChange={(properties) => setAttrs((a) => ({ ...a, properties }))}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Colunas</Label>
              <Select
                value={String(attrs.columns)}
                onValueChange={(v) =>
                  setAttrs((a) => ({ ...a, columns: Number(v) }))
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Texto do botão</Label>
              <Input
                value={attrs.ctaLabel}
                onChange={(e) =>
                  setAttrs((a) => ({ ...a, ctaLabel: e.target.value }))
                }
                placeholder="Ver imóvel"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            {state.initial ? 'Actualizar' : 'Inserir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ModeOptionProps {
  active: boolean
  icon: typeof Zap
  title: string
  description: string
  onClick: () => void
}

function ModeOption({ active, icon: Icon, title, description, onClick }: ModeOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors ${
        active
          ? 'border-primary bg-background shadow-sm'
          : 'border-transparent bg-transparent hover:bg-background'
      }`}
    >
      <Icon className={`mt-0.5 h-4 w-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-semibold ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
          {title}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
          {description}
        </div>
      </div>
    </button>
  )
}

export function usePropertyGridDialog(editor: Editor | null) {
  const [state, setState] = useState<PropertyGridDialogState>({
    open: false,
    initial: null,
  })

  const openForInsert = () => setState({ open: true, initial: null })
  const openForEdit = (attrs: Partial<EmailPropertyGridAttrs>) =>
    setState({ open: true, initial: attrs })
  const close = () => setState({ open: false, initial: null })
  const submit = (attrs: EmailPropertyGridAttrs) => {
    if (!editor) return
    if (state.initial) {
      editor.commands.updateEmailPropertyGrid(attrs)
    } else {
      editor.chain().focus().insertEmailPropertyGrid(attrs).run()
    }
    close()
  }

  return { state, openForInsert, openForEdit, close, submit }
}

// ─── Portal links dialog ───────────────────────────────────────────────────

const PORTAL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'idealista', label: 'Idealista' },
  { value: 'imovirtual', label: 'Imovirtual' },
  { value: 'casa_sapo', label: 'Casa Sapo' },
  { value: 'supercasa', label: 'SuperCasa' },
  { value: 'remax', label: 'RE/MAX' },
  { value: 'custom', label: 'Personalizado' },
]

interface PortalLinksDialogState {
  open: boolean
  initial: Partial<EmailPortalLinksAttrs> | null
}

interface PortalLinksDialogProps {
  state: PortalLinksDialogState
  onClose: () => void
  onSubmit: (attrs: EmailPortalLinksAttrs) => void
}

export function EmailPortalLinksDialog({
  state,
  onClose,
  onSubmit,
}: PortalLinksDialogProps) {
  const [attrs, setAttrs] = useState<EmailPortalLinksAttrs>(EMAIL_PORTAL_LINKS_DEFAULTS)

  useEffect(() => {
    if (state.open) {
      setAttrs({ ...EMAIL_PORTAL_LINKS_DEFAULTS, ...(state.initial || {}) })
    }
  }, [state.open, state.initial])

  const updatePortal = (idx: number, patch: Partial<PortalEntry>) => {
    setAttrs((a) => ({
      ...a,
      portals: a.portals.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    }))
  }

  const addPortal = () => {
    setAttrs((a) => ({
      ...a,
      portals: [...a.portals, { portal: 'idealista', name: 'Idealista', url: '' }],
    }))
  }

  const removePortal = (idx: number) => {
    setAttrs((a) => ({
      ...a,
      portals: a.portals.filter((_, i) => i !== idx),
    }))
  }

  const handleSubmit = () => {
    if (attrs.portals.length === 0) {
      toast.error('Adicione pelo menos um portal.')
      return
    }
    if (attrs.portals.some((p) => !p.url.trim())) {
      toast.error('Todos os portais precisam de um URL.')
      return
    }
    onSubmit(attrs)
  }

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Links de Portais</DialogTitle>
          <DialogDescription>
            Cartões clicáveis para os portais onde o imóvel está anunciado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label className="text-xs">Título da secção</Label>
            <Input
              value={attrs.title}
              onChange={(e) => setAttrs((a) => ({ ...a, title: e.target.value }))}
              placeholder="Anúncios nos Portais"
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <input
                type="checkbox"
                checked={attrs.showTitle}
                onChange={(e) =>
                  setAttrs((a) => ({ ...a, showTitle: e.target.checked }))
                }
                id="portal-show-title"
              />
              <label htmlFor="portal-show-title">Mostrar título</label>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Layout</Label>
            <Select
              value={attrs.layout}
              onValueChange={(v) =>
                setAttrs((a) => ({
                  ...a,
                  layout: v as EmailPortalLinksAttrs['layout'],
                }))
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vertical">Vertical (um por linha)</SelectItem>
                <SelectItem value="horizontal">Horizontal (lado a lado)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Portais</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addPortal}
                className="h-7 gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </Button>
            </div>
            <div className="grid gap-2 max-h-[240px] overflow-y-auto pr-1">
              {attrs.portals.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg bg-muted/30">
                  Ainda sem portais. Clique em "Adicionar".
                </p>
              )}
              {attrs.portals.map((portal, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_2fr_auto] gap-2 rounded-lg border bg-muted/20 p-2"
                >
                  <Select
                    value={portal.portal}
                    onValueChange={(v) => {
                      const label =
                        PORTAL_OPTIONS.find((p) => p.value === v)?.label ?? v
                      updatePortal(idx, { portal: v, name: label })
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PORTAL_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="text-xs">
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={portal.url}
                    onChange={(e) => updatePortal(idx, { url: e.target.value })}
                    placeholder="https://..."
                    className="h-8 text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removePortal(idx)}
                    className="h-8 w-8 p-0 text-destructive"
                    title="Remover portal"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            {state.initial ? 'Actualizar' : 'Inserir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function usePortalLinksDialog(editor: Editor | null) {
  const [state, setState] = useState<PortalLinksDialogState>({
    open: false,
    initial: null,
  })

  const openForInsert = () => setState({ open: true, initial: null })
  const openForEdit = (attrs: Partial<EmailPortalLinksAttrs>) =>
    setState({ open: true, initial: attrs })
  const close = () => setState({ open: false, initial: null })
  const submit = (attrs: EmailPortalLinksAttrs) => {
    if (!editor) return
    if (state.initial) {
      editor.commands.updateEmailPortalLinks(attrs)
    } else {
      editor.chain().focus().insertEmailPortalLinks(attrs).run()
    }
    close()
  }

  return { state, openForInsert, openForEdit, close, submit }
}
