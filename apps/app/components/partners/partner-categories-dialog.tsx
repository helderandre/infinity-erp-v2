// @ts-nocheck
'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, Loader2, Lock } from 'lucide-react'
import {
  usePartnerCategories,
  resolvePartnerCategoryColor,
  PARTNER_CATEGORY_COLOR_OPTIONS,
  type PartnerCategoryRow,
} from '@/hooks/use-partner-categories'
import {
  PARTNER_CATEGORY_ICON_MAP,
  PARTNER_CATEGORY_ICON_OPTIONS,
  resolvePartnerCategoryIcon,
} from '@/lib/partners/category-icons'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface PartnerCategoriesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged?: () => void
}

export function PartnerCategoriesDialog({ open, onOpenChange, onChanged }: PartnerCategoriesDialogProps) {
  const { categories, isLoading, createCategory, updateCategory, deleteCategory } = usePartnerCategories()

  const [editing, setEditing] = useState<PartnerCategoryRow | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PartnerCategoryRow | null>(null)
  const [reassignBusy, setReassignBusy] = useState(false)
  const [reassignCount, setReassignCount] = useState<number | null>(null)
  const [reassignSlug, setReassignSlug] = useState<string | undefined>()

  const handleAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const handleEdit = (c: PartnerCategoryRow) => {
    setEditing(c)
    setFormOpen(true)
  }

  const handleDelete = async (c: PartnerCategoryRow) => {
    setDeleteTarget(c)
    setReassignCount(null)
    setReassignSlug(undefined)
    // first attempt without reassign to learn if it's in use
    const result = await deleteCategory(c.id)
    if (result.ok) {
      setDeleteTarget(null)
      onChanged?.()
    } else if (typeof result.partnerCount === 'number') {
      setReassignCount(result.partnerCount)
    } else {
      setDeleteTarget(null)
    }
  }

  const handleConfirmReassign = async () => {
    if (!deleteTarget || !reassignSlug) return
    setReassignBusy(true)
    const result = await deleteCategory(deleteTarget.id, reassignSlug)
    setReassignBusy(false)
    if (result.ok) {
      setDeleteTarget(null)
      setReassignCount(null)
      setReassignSlug(undefined)
      onChanged?.()
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Categorias de parceiros</DialogTitle>
            <DialogDescription>
              Gere as categorias usadas para classificar parceiros. As categorias de sistema não podem ser eliminadas.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Button size="sm" className="rounded-full gap-1.5" onClick={handleAdd}>
              <Plus className="h-3.5 w-3.5" />
              Nova categoria
            </Button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 -mx-1 px-1">
            {isLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">A carregar...</div>
            ) : categories.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Sem categorias.</div>
            ) : (
              categories.map((c) => {
                const color = resolvePartnerCategoryColor(c.color)
                const Icon = resolvePartnerCategoryIcon(c.icon)
                return (
                  <div key={c.id} className="flex items-center gap-3 px-2.5 py-2 rounded-xl border bg-background hover:bg-muted/40 transition-colors">
                    <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', color.bg)}>
                      <Icon className={cn('h-4 w-4', color.text)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{c.label}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{c.slug}</p>
                    </div>
                    {c.is_system && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground px-2 py-0.5 rounded-full border bg-muted/40">
                        <Lock className="h-2.5 w-2.5" />
                        Sistema
                      </span>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleEdit(c)} title="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {!c.is_system && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full text-destructive hover:text-destructive"
                        onClick={() => handleDelete(c)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        category={editing}
        onSubmit={async (data) => {
          if (editing) {
            const ok = await updateCategory(editing.id, data)
            if (ok) { setFormOpen(false); onChanged?.() }
          } else {
            const row = await createCategory(data as any)
            if (row) { setFormOpen(false); onChanged?.() }
          }
        }}
      />

      {/* Reassign dialog shown when category is in use */}
      <AlertDialog
        open={!!deleteTarget && reassignCount !== null}
        onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setReassignCount(null); setReassignSlug(undefined) } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Categoria em uso</AlertDialogTitle>
            <AlertDialogDescription>
              {reassignCount} {reassignCount === 1 ? 'parceiro utiliza' : 'parceiros utilizam'} esta categoria.
              Escolhe uma categoria para onde transferir antes de eliminar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Transferir parceiros para</Label>
            <Select value={reassignSlug} onValueChange={setReassignSlug}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Seleccionar categoria..." />
              </SelectTrigger>
              <SelectContent>
                {categories
                  .filter((c) => c.id !== deleteTarget?.id && c.is_active)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.slug}>{c.label}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reassignBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReassign}
              disabled={!reassignSlug || reassignBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {reassignBusy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Transferir e eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─── Category form dialog (create / edit) ───────────────────────────
function CategoryFormDialog({
  open, onOpenChange, category, onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  category: PartnerCategoryRow | null
  onSubmit: (data: { slug?: string; label: string; icon: string; color: string }) => Promise<void>
}) {
  const isEditing = !!category
  const [label, setLabel] = useState('')
  const [slug, setSlug] = useState('')
  const [icon, setIcon] = useState('Briefcase')
  const [color, setColor] = useState('slate')
  const [busy, setBusy] = useState(false)

  // Reset on open change
  if (open && category && label === '') {
    setLabel(category.label)
    setSlug(category.slug)
    setIcon(category.icon)
    setColor(category.color)
  }

  const slugify = (s: string) =>
    s.toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

  const handleSubmit = async () => {
    if (!label.trim()) return
    setBusy(true)
    try {
      const payload: any = { label: label.trim(), icon, color }
      if (!isEditing) payload.slug = slug.trim() || slugify(label)
      await onSubmit(payload)
    } finally {
      setBusy(false)
    }
  }

  const handleClose = (o: boolean) => {
    if (!o) {
      setLabel(''); setSlug(''); setIcon('Briefcase'); setColor('slate')
    }
    onOpenChange(o)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'O slug não pode ser alterado porque é usado como identificador estável.' : 'Define como a categoria é apresentada na listagem de parceiros.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Nome</Label>
            <Input
              className="rounded-xl"
              placeholder="Ex: Consultor imobiliário"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value)
                if (!isEditing) setSlug(slugify(e.target.value))
              }}
              autoFocus
            />
          </div>

          {!isEditing && (
            <div className="space-y-2">
              <Label className="text-xs">Slug</Label>
              <Input
                className="rounded-xl font-mono text-xs"
                placeholder="consultor_imobiliario"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
              />
              <p className="text-[10px] text-muted-foreground">Apenas letras minúsculas, números, - ou _. Gerado automaticamente a partir do nome.</p>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs">Ícone</Label>
            <div className="grid grid-cols-8 gap-1.5 max-h-48 overflow-y-auto p-1 rounded-xl border bg-muted/40">
              {PARTNER_CATEGORY_ICON_OPTIONS.map((name) => {
                const Icon = PARTNER_CATEGORY_ICON_MAP[name]
                const isActive = icon === name
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setIcon(name)}
                    className={cn(
                      'h-9 w-9 inline-flex items-center justify-center rounded-lg transition-colors',
                      isActive ? 'bg-foreground text-background' : 'hover:bg-background',
                    )}
                    title={name}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Cor</Label>
            <div className="flex flex-wrap gap-1.5">
              {PARTNER_CATEGORY_COLOR_OPTIONS.map((token) => {
                const c = resolvePartnerCategoryColor(token)
                const isActive = color === token
                return (
                  <button
                    key={token}
                    type="button"
                    onClick={() => setColor(token)}
                    className={cn(
                      'h-7 w-7 rounded-full border-2 transition-all flex items-center justify-center',
                      c.bg,
                      isActive ? 'border-foreground scale-110' : 'border-transparent hover:scale-105',
                    )}
                    title={token}
                  >
                    {isActive && <Check className={cn('h-3.5 w-3.5', c.text)} />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => handleClose(false)} disabled={busy}>Cancelar</Button>
          <Button className="rounded-full" onClick={handleSubmit} disabled={!label.trim() || busy}>
            {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            {isEditing ? 'Guardar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
