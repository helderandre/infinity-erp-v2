// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { TrainingCategory } from '@/types/training'

export function GestaoCategoriasTab() {
  const isMobile = useIsMobile()
  const [categories, setCategories] = useState<TrainingCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({ name: '', description: '', color: 'blue-500' })
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchCategories = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/training/categories')
      if (!res.ok) throw new Error('Erro')
      const data = await res.json()
      setCategories(data.data || [])
    } catch {
      setCategories([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchCategories() }, [fetchCategories])

  const openCreate = () => {
    setEditingId(null)
    setFormData({ name: '', description: '', color: 'blue-500' })
    setDialogOpen(true)
  }

  const openEdit = (cat: TrainingCategory) => {
    setEditingId(cat.id)
    setFormData({ name: cat.name, description: cat.description || '', color: cat.color })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório')
      return
    }
    setIsSaving(true)
    try {
      const url = editingId ? `/api/training/categories/${editingId}` : '/api/training/categories'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error('Erro ao guardar')
      toast.success(editingId ? 'Categoria actualizada' : 'Categoria criada')
      setDialogOpen(false)
      fetchCategories()
    } catch {
      toast.error('Erro ao guardar categoria')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/training/categories/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao eliminar')
      }
      toast.success('Categoria eliminada')
      setDeleteId(null)
      fetchCategories()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao eliminar categoria')
    } finally {
      setIsDeleting(false)
    }
  }

  const colorOptions = ['blue-500', 'emerald-500', 'orange-500', 'purple-500', 'red-500', 'cyan-500', 'pink-500', 'amber-500']

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gerir categorias dos cursos de formação</p>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Nova Categoria</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-2.5">
          {categories.map(cat => (
            <div
              key={cat.id}
              className="rounded-xl border bg-card/30 backdrop-blur-sm p-4 flex items-center gap-3"
            >
              <div className={`h-7 w-7 rounded-full shrink-0 bg-${cat.color}`} />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{cat.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge variant={cat.is_active ? 'default' : 'secondary'} className="rounded-full text-[10px] px-2 py-0.5">
                    {cat.is_active ? 'Ativa' : 'Inativa'}
                  </Badge>
                  <span className="text-xs text-muted-foreground truncate">{cat.slug}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" title="Editar categoria" onClick={() => openEdit(cat)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-red-600 hover:text-red-600" title="Eliminar categoria" onClick={() => setDeleteId(cat.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar esta categoria? Esta acção pode ser revertida reactivando a categoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete() }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={cn(
            'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
            'bg-background',
            isMobile
              ? 'data-[side=bottom]:h-[80dvh] rounded-t-3xl'
              : 'w-full data-[side=right]:sm:max-w-[468px] sm:rounded-l-3xl',
          )}
        >
          {isMobile && (
            <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
          )}
          <div className="shrink-0 px-6 pt-8 pb-4 sm:pt-10">
            <SheetHeader className="p-0 gap-0">
              <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight pr-10">
                {editingId ? 'Editar categoria' : 'Nova categoria'}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Detalhes da categoria.
              </SheetDescription>
            </SheetHeader>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pt-1 pb-8 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Nome</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Comercial"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                rows={3}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Cor</Label>
              <div className="flex gap-2 mt-2">
                {colorOptions.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, color }))}
                    className={`w-8 h-8 rounded-full bg-${color} ring-2 ring-offset-2 transition-all ${formData.color === color ? 'ring-primary' : 'ring-transparent'}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <SheetFooter className="px-6 py-4 flex-row gap-2 shrink-0 bg-background border-t border-border/50">
            <Button variant="outline" size="sm" className="rounded-full flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" className="rounded-full flex-1" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
