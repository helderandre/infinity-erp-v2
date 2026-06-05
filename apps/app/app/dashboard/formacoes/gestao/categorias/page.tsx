'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, Plus, Pencil, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { TrainingCategory } from '@/types/training'

export default function CategoriasPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <CategoriasContent />
    </Suspense>
  )
}

function CategoriasContent() {
  const [categories, setCategories] = useState<TrainingCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({ name: '', description: '', color: 'blue-500' })

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

  const handleDeactivate = async (id: string) => {
    try {
      const res = await fetch(`/api/training/categories/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro')
      toast.success('Categoria desactivada')
      fetchCategories()
    } catch {
      toast.error('Erro ao desativar')
    }
  }

  const colorOptions = ['blue-500', 'emerald-500', 'orange-500', 'purple-500', 'red-500', 'cyan-500', 'pink-500', 'amber-500']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/formacoes/gestao"><ChevronLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Categorias de Formação</h1>
            <p className="text-muted-foreground">Gerir categorias dos cursos</p>
          </div>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Nova Categoria</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Cor</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-24">Acções</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map(cat => (
              <TableRow key={cat.id}>
                <TableCell className="font-medium">{cat.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{cat.slug}</TableCell>
                <TableCell>
                  <div className={`w-6 h-6 rounded-full bg-${cat.color}`} />
                </TableCell>
                <TableCell>
                  <Badge variant={cat.is_active ? 'default' : 'secondary'}>
                    {cat.is_active ? 'Ativa' : 'Inativa'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Comercial"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 mt-2">
                {colorOptions.map(color => (
                  <button
                    key={color}
                    onClick={() => setFormData(p => ({ ...p, color }))}
                    className={`w-8 h-8 rounded-full bg-${color} ring-2 ring-offset-2 transition-all ${formData.color === color ? 'ring-primary' : 'ring-transparent'}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
