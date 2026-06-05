'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createPackSchema } from '@/lib/validations/marketing'
import { MARKETING_CATEGORIES, formatCurrency } from '@/lib/constants'
import type { MarketingCatalogItem, MarketingPack } from '@/types/marketing'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'
import type { z } from 'zod'

type FormData = z.infer<typeof createPackSchema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  pack?: MarketingPack | null
  catalogItems: MarketingCatalogItem[]
  onSubmit: (data: FormData) => Promise<void>
}

export function PackFormDialog({ open, onOpenChange, pack, catalogItems, onSubmit }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const form = useForm<FormData>({
    resolver: zodResolver(createPackSchema) as any,
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      is_active: true,
      item_ids: [],
    },
  })

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = form

  useEffect(() => {
    if (pack) {
      const ids = pack.items?.map(i => i.id) || []
      reset({
        name: pack.name,
        description: pack.description,
        price: pack.price,
        is_active: pack.is_active,
        item_ids: ids,
      })
      setSelectedIds(ids)
    } else {
      reset({
        name: '',
        description: '',
        price: 0,
        is_active: true,
        item_ids: [],
      })
      setSelectedIds([])
    }
  }, [pack, reset, open])

  const toggleItem = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter(x => x !== id)
      : [...selectedIds, id]
    setSelectedIds(next)
    setValue('item_ids', next)
  }

  const selectedTotal = catalogItems
    .filter(i => selectedIds.includes(i.id))
    .reduce((sum, i) => sum + i.price, 0)

  const handleFormSubmit = async (data: FormData) => {
    await onSubmit({ ...data, item_ids: selectedIds })
    onOpenChange(false)
  }

  const activeItems = catalogItems.filter(i => i.is_active)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pack ? 'Editar Pack' : 'Novo Pack'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pack-name">Nome</Label>
            <Input id="pack-name" {...register('name')} placeholder="Ex: Pack Premium: Fotos + Vídeo" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pack-desc">Descrição</Label>
            <Textarea id="pack-desc" {...register('description')} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pack-price">Preço do Pack (€)</Label>
              <Input id="pack-price" type="number" step="0.01" min="0" {...register('price')} />
              {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Total Individual</Label>
              <div className="flex items-center h-9 px-3 rounded-md border bg-muted/50 text-sm">
                {formatCurrency(selectedTotal)}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>Ativo</Label>
            <Switch checked={watch('is_active')} onCheckedChange={(v) => setValue('is_active', v)} />
          </div>

          {/* Service Selection */}
          <div className="space-y-2">
            <Label>Serviços incluídos ({selectedIds.length})</Label>
            {errors.item_ids && <p className="text-xs text-destructive">{errors.item_ids.message}</p>}
            <div className="rounded-md border max-h-[250px] overflow-y-auto divide-y">
              {activeItems.map(item => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedIds.includes(item.id)}
                    onCheckedChange={() => toggleItem(item.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {MARKETING_CATEGORIES[item.category]}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {formatCurrency(item.price)}
                  </Badge>
                </label>
              ))}
              {activeItems.length === 0 && (
                <p className="text-sm text-muted-foreground p-4 text-center">Nenhum serviço activo</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pack ? 'Guardar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
