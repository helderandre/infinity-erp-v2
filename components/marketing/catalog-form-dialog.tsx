'use client'

import { useEffect, useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createCatalogItemSchema } from '@/lib/validations/marketing'
import { MARKETING_CATEGORIES } from '@/lib/constants'
import type { MarketingCatalogItem } from '@/types/marketing'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Loader2, Upload, X, ImageIcon, Plus, Trash2, Puzzle } from 'lucide-react'
import { toast } from 'sonner'
import type { z } from 'zod'
import type { MarketingCatalogAddon } from '@/types/marketing'

type FormData = z.infer<typeof createCatalogItemSchema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: MarketingCatalogItem | null
  onSubmit: (data: FormData) => Promise<void>
}

export function CatalogFormDialog({ open, onOpenChange, item, onSubmit }: Props) {
  const form = useForm<FormData>({
    resolver: zodResolver(createCatalogItemSchema) as any,
    defaultValues: {
      name: '',
      description: '',
      category: 'photography',
      price: 0,
      estimated_delivery_days: 5,
      is_active: true,
      requires_scheduling: false,
      requires_property: true,
    },
  })

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = form

  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Add-ons
  const [addons, setAddons] = useState<MarketingCatalogAddon[]>([])
  const [newAddonName, setNewAddonName] = useState('')
  const [newAddonPrice, setNewAddonPrice] = useState('')
  const [newAddonDesc, setNewAddonDesc] = useState('')
  const [addingAddon, setAddingAddon] = useState(false)
  const [deletingAddonId, setDeletingAddonId] = useState<string | null>(null)

  useEffect(() => {
    if (item) {
      reset({
        name: item.name,
        description: item.description,
        category: item.category,
        price: item.price,
        estimated_delivery_days: item.estimated_delivery_days,
        is_active: item.is_active,
        requires_scheduling: item.requires_scheduling,
        requires_property: item.requires_property,
      })
      setThumbnailPreview(item.thumbnail || null)
      setAddons(item.addons || [])
    } else {
      reset({
        name: '',
        description: '',
        category: 'photography',
        price: 0,
        estimated_delivery_days: 5,
        is_active: true,
        requires_scheduling: false,
        requires_property: true,
      })
      setThumbnailPreview(null)
      setAddons([])
    }
    setThumbnailFile(null)
    setNewAddonName('')
    setNewAddonPrice('')
    setNewAddonDesc('')
  }, [item, reset, open])

  const handleAddAddon = async () => {
    if (!item || !newAddonName.trim()) { toast.error('Nome do add-on é obrigatório'); return }
    setAddingAddon(true)
    try {
      const res = await fetch(`/api/marketing/catalog/${item.id}/addons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAddonName.trim(),
          description: newAddonDesc.trim() || null,
          price: parseFloat(newAddonPrice) || 0,
          is_active: true,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAddons(prev => [...prev, data])
      setNewAddonName('')
      setNewAddonPrice('')
      setNewAddonDesc('')
      toast.success('Add-on adicionado')
    } catch { toast.error('Erro ao adicionar add-on') }
    finally { setAddingAddon(false) }
  }

  const handleDeleteAddon = async (addonId: string) => {
    if (!item) return
    setDeletingAddonId(addonId)
    try {
      const res = await fetch(`/api/marketing/catalog/${item.id}/addons/${addonId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setAddons(prev => prev.filter(a => a.id !== addonId))
      toast.success('Add-on eliminado')
    } catch { toast.error('Erro ao eliminar add-on') }
    finally { setDeletingAddonId(null) }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/webp', 'image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      toast.error('Tipo de ficheiro não suportado. Use WebP, JPEG ou PNG.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ficheiro demasiado grande. Máximo 5MB.')
      return
    }

    setThumbnailFile(file)
    setThumbnailPreview(URL.createObjectURL(file))
  }

  const removeThumbnail = () => {
    setThumbnailFile(null)
    setThumbnailPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadThumbnail = async (itemId: string) => {
    if (!thumbnailFile) return
    setUploadingImage(true)
    try {
      const fd = new window.FormData()
      fd.append('file', thumbnailFile)
      const res = await fetch(`/api/marketing/catalog/${itemId}/thumbnail`, {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Erro ao enviar imagem')
      }
    } catch {
      toast.error('Erro ao enviar imagem')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleFormSubmit = async (data: FormData) => {
    await onSubmit(data)
    // Upload thumbnail for existing item
    if (thumbnailFile && item) {
      await uploadThumbnail(item.id)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Thumbnail Upload */}
          <div className="space-y-2">
            <Label>Imagem</Label>
            {thumbnailPreview ? (
              <div className="relative rounded-lg overflow-hidden border bg-muted">
                <img
                  src={thumbnailPreview}
                  alt="Preview"
                  className="w-full h-40 object-cover"
                />
                <button
                  type="button"
                  onClick={removeThumbnail}
                  className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground"
              >
                <ImageIcon className="h-8 w-8" />
                <span className="text-sm">Clique para adicionar imagem</span>
                <span className="text-xs">WebP, JPEG ou PNG — máx. 5MB</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/webp,image/jpeg,image/png"
              onChange={handleFileSelect}
              className="hidden"
            />
            {thumbnailPreview && !thumbnailFile && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="mr-2 h-3.5 w-3.5" />
                Substituir imagem
              </Button>
            )}
            {!item && thumbnailFile && (
              <p className="text-xs text-muted-foreground">A imagem será enviada quando editar o serviço após a criação.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" {...register('name')} placeholder="Ex: Sessão Fotográfica Lifestyle" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" {...register('description')} rows={3} placeholder="Descrição detalhada do serviço..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={watch('category')} onValueChange={(v) => setValue('category', v as FormData['category'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MARKETING_CATEGORIES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Preço (€)</Label>
              <Input id="price" type="number" step="0.01" min="0" {...register('price')} />
              {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="estimated_delivery_days">Prazo de Entrega (dias úteis)</Label>
            <Input id="estimated_delivery_days" type="number" min="1" {...register('estimated_delivery_days')} />
            {errors.estimated_delivery_days && <p className="text-xs text-destructive">{errors.estimated_delivery_days.message}</p>}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Ativo</Label>
              <p className="text-xs text-muted-foreground">Visível para consultores</p>
            </div>
            <Switch checked={watch('is_active')} onCheckedChange={(v) => setValue('is_active', v)} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Requer Agendamento</Label>
              <p className="text-xs text-muted-foreground">Sessão fotográfica, vídeo, etc.</p>
            </div>
            <Switch checked={watch('requires_scheduling')} onCheckedChange={(v) => setValue('requires_scheduling', v)} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Requer Imóvel</Label>
              <p className="text-xs text-muted-foreground">Associado a um imóvel específico</p>
            </div>
            <Switch checked={watch('requires_property')} onCheckedChange={(v) => setValue('requires_property', v)} />
          </div>

          {/* Add-ons section (only when editing existing service) */}
          {item && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Puzzle className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-semibold">Add-ons</Label>
                  </div>
                  <span className="text-xs text-muted-foreground">{addons.length} add-on{addons.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Existing addons */}
                {addons.length > 0 && (
                  <div className="space-y-1.5">
                    {addons.map((addon) => (
                      <div key={addon.id} className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{addon.name}</p>
                          {addon.description && <p className="text-[10px] text-muted-foreground truncate">{addon.description}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-xs font-medium">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(addon.price)}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteAddon(addon.id)}
                            disabled={deletingAddonId === addon.id}
                            className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                          >
                            {deletingAddonId === addon.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new addon */}
                <div className="rounded-lg border border-dashed p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Novo Add-on</p>
                  <div className="grid grid-cols-[1fr_80px] gap-2">
                    <Input
                      placeholder="Nome do add-on"
                      value={newAddonName}
                      onChange={(e) => setNewAddonName(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Preço"
                      value={newAddonPrice}
                      onChange={(e) => setNewAddonPrice(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <Input
                    placeholder="Descrição (opcional)"
                    value={newAddonDesc}
                    onChange={(e) => setNewAddonDesc(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 text-xs"
                    disabled={!newAddonName.trim() || addingAddon}
                    onClick={handleAddAddon}
                  >
                    {addingAddon ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Adicionar Add-on
                  </Button>
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting || uploadingImage}>
              {(isSubmitting || uploadingImage) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {item ? 'Guardar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
