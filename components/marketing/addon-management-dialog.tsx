'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createAddonSchema } from '@/lib/validations/marketing'
import type { MarketingCatalogItem, MarketingCatalogAddon } from '@/types/marketing'
import { formatCurrency } from '@/lib/constants'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Loader2, Plus, Pencil, Trash2, Gift } from 'lucide-react'
import { toast } from 'sonner'
import type { z } from 'zod'

type AddonFormData = z.infer<typeof createAddonSchema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: MarketingCatalogItem
  onAddonsChanged: () => void
}

export function AddonManagementDialog({ open, onOpenChange, item, onAddonsChanged }: Props) {
  const [addons, setAddons] = useState<MarketingCatalogAddon[]>([])
  const [loading, setLoading] = useState(false)
  const [editingAddon, setEditingAddon] = useState<MarketingCatalogAddon | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const form = useForm<AddonFormData>({
    resolver: zodResolver(createAddonSchema) as any,
    defaultValues: { name: '', description: '', price: 0, is_active: true },
  })

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = form

  const fetchAddons = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/marketing/catalog/${item.id}/addons`)
      if (res.ok) setAddons(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => {
    if (open) fetchAddons()
  }, [open, item.id])

  const openCreateForm = () => {
    setEditingAddon(null)
    reset({ name: '', description: '', price: 0, is_active: true })
    setShowForm(true)
  }

  const openEditForm = (addon: MarketingCatalogAddon) => {
    setEditingAddon(addon)
    reset({ name: addon.name, description: addon.description, price: addon.price, is_active: addon.is_active })
    setShowForm(true)
  }

  const onSubmit = async (data: AddonFormData) => {
    try {
      const url = editingAddon
        ? `/api/marketing/catalog/${item.id}/addons/${editingAddon.id}`
        : `/api/marketing/catalog/${item.id}/addons`
      const method = editingAddon ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao guardar add-on')
      }

      toast.success(editingAddon ? 'Add-on actualizado' : 'Add-on criado')
      setShowForm(false)
      fetchAddons()
      onAddonsChanged()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/marketing/catalog/${item.id}/addons/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao eliminar')
      toast.success('Add-on eliminado')
      setDeleteId(null)
      fetchAddons()
      onAddonsChanged()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add-ons — {item.name}</DialogTitle>
          </DialogHeader>

          {showForm ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="addon-name">Nome</Label>
                <Input id="addon-name" {...register('name')} placeholder="Ex: Home Staging com AI" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="addon-desc">Descrição</Label>
                <Textarea id="addon-desc" {...register('description')} rows={2} placeholder="Descrição opcional..." />
              </div>

              <div className="space-y-2">
                <Label htmlFor="addon-price">Preço (€)</Label>
                <Input id="addon-price" type="number" step="0.01" min="0" {...register('price')} />
                <p className="text-xs text-muted-foreground">Coloque 0 para add-ons incluídos (oferta).</p>
                {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Activo</Label>
                  <p className="text-xs text-muted-foreground">Visível na loja</p>
                </div>
                <Switch checked={watch('is_active')} onCheckedChange={(v) => setValue('is_active', v)} />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Voltar</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingAddon ? 'Guardar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-6">A carregar...</p>
              ) : addons.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum add-on criado para este serviço.</p>
              ) : (
                <div className="space-y-2">
                  {addons.map((addon) => (
                    <div key={addon.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{addon.name}</p>
                          {!addon.is_active && (
                            <Badge variant="secondary" className="text-[10px]">Inactivo</Badge>
                          )}
                        </div>
                        {addon.description && (
                          <p className="text-xs text-muted-foreground truncate">{addon.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {addon.price === 0 ? (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Gift className="h-3 w-3" />
                            Oferta
                          </Badge>
                        ) : (
                          <span className="text-sm font-medium">{formatCurrency(addon.price)}</span>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditForm(addon)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(addon.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button variant="outline" className="w-full" onClick={openCreateForm}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Add-on
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar add-on</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar este add-on? Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
