'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { FileText, Loader2, Trash2, Upload } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

import { MarketingDesignCategorySelect } from './design-categories/marketing-design-category-select'
import { MarketingDesignCategoryAddButton } from './design-categories/marketing-design-category-add-button'
import { MarketingDesignCategoryFormDialog } from './design-categories/marketing-design-category-form-dialog'
import type { PersonalDesign } from '@/hooks/use-personal-designs'

const IMAGE_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const PDF_MIME = ['application/pdf']
const ALLOWED_MIME = [...IMAGE_MIME, ...PDF_MIME]
const IMAGE_MAX = 10 * 1024 * 1024
const PDF_MAX = 100 * 1024 * 1024
const THUMB_MAX = 10 * 1024 * 1024

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface PersonalDesignFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When editing an existing design. */
  design?: PersonalDesign | null
  /** Pre-select a category slug for new designs. */
  defaultCategory?: string
  onCreateWithFile: (formData: FormData) => Promise<void>
  onCreateLink: (payload: {
    name: string
    category: string
    canva_url: string
    description?: string | null
  }) => Promise<void>
  onUpdate: (
    id: string,
    payload: Partial<{
      name: string
      description: string | null
      category: string
      canva_url: string | null
    }>
  ) => Promise<void>
}

export function PersonalDesignFormDialog({
  open,
  onOpenChange,
  design,
  defaultCategory,
  onCreateWithFile,
  onCreateLink,
  onUpdate,
}: PersonalDesignFormDialogProps) {
  const mode = design ? 'edit' : 'create'
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [canvaUrl, setCanvaUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [thumbnail, setThumbnail] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const thumbInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setName(design?.name ?? '')
    setDescription(design?.description ?? '')
    setCategory(design?.category?.slug ?? defaultCategory ?? '')
    setCanvaUrl(design?.canva_url ?? '')
    setFile(null)
    setThumbnail(null)
  }, [open, design, defaultCategory])

  const handlePickFile = (picked: File | null) => {
    if (!picked) return
    if (!ALLOWED_MIME.includes(picked.type)) {
      toast.error('Tipo de ficheiro não permitido (aceita PNG, JPG, WebP, PDF)')
      return
    }
    if (IMAGE_MIME.includes(picked.type) && picked.size > IMAGE_MAX) {
      toast.error('Imagem demasiado grande (máx. 10MB)')
      return
    }
    if (PDF_MIME.includes(picked.type) && picked.size > PDF_MAX) {
      toast.error('PDF demasiado grande (máx. 100MB)')
      return
    }
    setFile(picked)
  }

  const handlePickThumb = (picked: File | null) => {
    if (!picked) return
    if (!IMAGE_MIME.includes(picked.type)) {
      toast.error('Imagem de capa deve ser PNG, JPG ou WebP')
      return
    }
    if (picked.size > THUMB_MAX) {
      toast.error('Imagem de capa demasiado grande (máx. 10MB)')
      return
    }
    setThumbnail(picked)
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Nome é obrigatório')
      return
    }
    if (!category) {
      toast.error('Categoria é obrigatória')
      return
    }

    setSaving(true)
    try {
      if (mode === 'edit' && design) {
        await onUpdate(design.id, {
          name: name.trim(),
          description: description.trim() || null,
          category,
          canva_url: canvaUrl.trim() || null,
        })
        toast.success('Design actualizado')
      } else if (file) {
        const formData = new FormData()
        formData.append('name', name.trim())
        formData.append('category', category)
        formData.append('file', file)
        if (description.trim()) formData.append('description', description.trim())
        if (canvaUrl.trim()) formData.append('canva_url', canvaUrl.trim())
        if (thumbnail) formData.append('thumbnail', thumbnail)
        await onCreateWithFile(formData)
        toast.success('Design carregado')
      } else if (canvaUrl.trim()) {
        await onCreateLink({
          name: name.trim(),
          category,
          canva_url: canvaUrl.trim(),
          description: description.trim() || null,
        })
        toast.success('Design criado')
      } else {
        toast.error('Adicione um ficheiro ou um link do Canva')
        setSaving(false)
        return
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar design')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {mode === 'edit' ? 'Editar design' : 'Novo design pessoal'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'edit'
                ? 'Actualize os dados do design.'
                : 'Carregue um ficheiro (PNG, JPG, WebP, PDF) ou adicione um link Canva.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Placa Personalizada"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <MarketingDesignCategorySelect
                    value={category}
                    onValueChange={setCategory}
                  />
                </div>
                <MarketingDesignCategoryAddButton
                  onClick={() => setCategoryDialogOpen(true)}
                  label="Nova"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Descrição (opcional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Breve descrição"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Link Canva (opcional)</Label>
              <Input
                value={canvaUrl}
                onChange={(e) => setCanvaUrl(e.target.value)}
                placeholder="https://www.canva.com/design/..."
              />
            </div>

            {mode === 'create' && (
              <>
                <div className="space-y-1.5">
                  <Label>Ficheiro (opcional)</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      handlePickFile(e.target.files?.[0] || null)
                      e.target.value = ''
                    }}
                  />
                  {file ? (
                    <div className="flex items-center gap-2 text-sm rounded-lg bg-muted/30 px-3 py-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatFileSize(file.size)}
                      </span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => setFile(null)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="w-full flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-6 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-6 w-6 text-muted-foreground/40 mb-2" />
                      <p className="text-xs font-medium">Clique para escolher</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Imagens ≤ 10MB · PDF ≤ 100MB
                      </p>
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Imagem de capa (opcional)</Label>
                  <input
                    ref={thumbInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(e) => {
                      handlePickThumb(e.target.files?.[0] || null)
                      e.target.value = ''
                    }}
                  />
                  {thumbnail ? (
                    <div className="flex items-center gap-2 text-xs rounded-lg bg-muted/30 px-3 py-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{thumbnail.name}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {formatFileSize(thumbnail.size)}
                      </span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => setThumbnail(null)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="w-full flex items-center justify-center rounded-xl border border-dashed py-3 cursor-pointer hover:bg-muted/30 transition-colors text-xs text-muted-foreground"
                      onClick={() => thumbInputRef.current?.click()}
                    >
                      Carregar imagem (PNG/JPG/WebP ≤ 10MB)
                    </button>
                  )}
                </div>
              </>
            )}

            <Button
              className="w-full rounded-full"
              disabled={saving}
              onClick={handleSubmit}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  A guardar…
                </>
              ) : mode === 'edit' ? (
                'Guardar'
              ) : (
                'Adicionar'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <MarketingDesignCategoryFormDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        onSaved={(slug) => {
          setCategory(slug)
        }}
      />
    </>
  )
}
