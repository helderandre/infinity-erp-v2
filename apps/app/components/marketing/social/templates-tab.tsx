'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getTemplates,
  upsertTemplate,
  deleteTemplate,
} from '@/app/dashboard/marketing/redes-sociais/actions'
import type { MarketingTemplate, TemplateCategory } from '@/types/marketing-social'
import { TEMPLATE_CATEGORIES } from '@/types/marketing-social'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Palette,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Search,
  Image,
  Loader2,
} from 'lucide-react'

const EMPTY_FORM: Partial<MarketingTemplate> & { name: string; category: TemplateCategory } = {
  name: '',
  category: 'post',
  canva_url: null,
  thumbnail_url: null,
  description: null,
}

export function SocialTemplatesTab() {
  const [templates, setTemplates] = useState<MarketingTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<Partial<MarketingTemplate> & { name: string; category: TemplateCategory }>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<MarketingTemplate | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    const { templates: data, error } = await getTemplates()
    if (error) {
      toast.error('Erro ao carregar templates')
    } else {
      setTemplates(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  // Filtered templates
  const filtered = useMemo(() => {
    if (!search.trim()) return templates
    const q = search.toLowerCase()
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        TEMPLATE_CATEGORIES[t.category]?.toLowerCase().includes(q)
    )
  }, [templates, search])

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, MarketingTemplate[]> = {}
    for (const t of filtered) {
      const key = t.category
      if (!groups[key]) groups[key] = []
      groups[key].push(t)
    }
    // Sort categories by the order in TEMPLATE_CATEGORIES
    const orderedKeys = (Object.keys(TEMPLATE_CATEGORIES) as TemplateCategory[]).filter(
      (k) => groups[k]
    )
    return orderedKeys.map((key) => ({
      category: key,
      label: TEMPLATE_CATEGORIES[key],
      items: groups[key],
    }))
  }, [filtered])

  // Open dialog for create
  const handleCreate = () => {
    setForm({ ...EMPTY_FORM })
    setDialogOpen(true)
  }

  // Open dialog for edit
  const handleEdit = (template: MarketingTemplate) => {
    setForm({
      id: template.id,
      name: template.name,
      category: template.category,
      canva_url: template.canva_url,
      thumbnail_url: template.thumbnail_url,
      description: template.description,
    })
    setDialogOpen(true)
  }

  // Save (create or update)
  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('O nome e obrigatorio')
      return
    }
    setSaving(true)
    const { success, error } = await upsertTemplate(form)
    if (error || !success) {
      toast.error(error || 'Erro ao guardar template')
    } else {
      toast.success(form.id ? 'Template actualizado' : 'Template criado')
      setDialogOpen(false)
      fetchTemplates()
    }
    setSaving(false)
  }

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { success, error } = await deleteTemplate(deleteTarget.id)
    if (error || !success) {
      toast.error(error || 'Erro ao eliminar template')
    } else {
      toast.success('Template eliminado')
      setDeleteTarget(null)
      fetchTemplates()
    }
    setDeleting(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-full bg-muted/50 border-0"
          />
        </div>
        <Button className="rounded-full" onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Template
        </Button>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <Palette className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-medium">Nenhum template encontrado</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search
              ? 'Tente alterar os termos de pesquisa.'
              : 'Crie o primeiro template para organizar os seus designs.'}
          </p>
          {!search && (
            <Button className="mt-4 rounded-full" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Template
            </Button>
          )}
        </div>
      ) : (
        /* Grouped templates */
        <div className="space-y-8">
          {grouped.map((group) => (
            <div key={group.category}>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <Palette className="h-4 w-4" />
                {group.label}
                <span className="rounded-full bg-muted text-[11px] px-2 py-0.5 font-medium ml-1">
                  {group.items.length}
                </span>
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.items.map((template) => (
                  <Card
                    key={template.id}
                    className="group relative overflow-hidden rounded-xl transition-all duration-300 hover:shadow-lg"
                  >
                    {/* Thumbnail */}
                    {template.thumbnail_url ? (
                      <div className="relative h-36 w-full overflow-hidden bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={template.thumbnail_url}
                          alt={template.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                    ) : (
                      <div className="flex h-36 w-full items-center justify-center bg-muted/50">
                        <Image className="h-10 w-10 text-muted-foreground/30" />
                      </div>
                    )}
                    <CardHeader className="pb-2 pt-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="line-clamp-1 text-sm font-medium">
                          {template.name}
                        </CardTitle>
                        <span className="shrink-0 rounded-full bg-muted text-[11px] px-2 py-0.5 font-medium">
                          {TEMPLATE_CATEGORIES[template.category]}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-3 pt-0">
                      {template.description && (
                        <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
                          {template.description}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5">
                        {template.canva_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs rounded-full"
                            asChild
                          >
                            <a
                              href={template.canva_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="mr-1 h-3 w-3" />
                              Abrir no Canva
                            </a>
                          </Button>
                        )}
                        <div className="ml-auto flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 rounded-full"
                            onClick={() => handleEdit(template)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">Editar</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 rounded-full text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(template)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Eliminar</span>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {form.id ? 'Editar Template' : 'Novo Template'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                placeholder="Ex: Post Imóvel Destaque"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-full bg-muted/50 border-0"
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm({ ...form, category: v as TemplateCategory })
                }
              >
                <SelectTrigger className="rounded-full bg-muted/50 border-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(TEMPLATE_CATEGORIES) as [TemplateCategory, string][]).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>URL do Canva</Label>
              <Input
                placeholder="https://www.canva.com/design/..."
                value={form.canva_url ?? ''}
                onChange={(e) =>
                  setForm({ ...form, canva_url: e.target.value || null })
                }
                className="rounded-full bg-muted/50 border-0"
              />
            </div>
            <div className="space-y-2">
              <Label>URL da Miniatura</Label>
              <Input
                placeholder="https://..."
                value={form.thumbnail_url ?? ''}
                onChange={(e) =>
                  setForm({ ...form, thumbnail_url: e.target.value || null })
                }
                className="rounded-full bg-muted/50 border-0"
              />
            </div>
            <div className="space-y-2">
              <Label>Descricao</Label>
              <Textarea
                placeholder="Breve descricao do template..."
                value={form.description ?? ''}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value || null })
                }
                rows={3}
              />
            </div>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button className="rounded-full" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {form.id ? 'Guardar' : 'Criar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar o template{' '}
              <strong>{deleteTarget?.name}</strong>? Esta accao nao pode ser
              revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
