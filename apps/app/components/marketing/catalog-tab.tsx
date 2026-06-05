'use client'

import { useState } from 'react'
import { useMarketingCatalog } from '@/hooks/use-marketing-catalog'
import { MARKETING_CATEGORIES, BILLING_CYCLE_LABELS } from '@/lib/constants'
import { formatCurrency } from '@/lib/constants'
import type { MarketingCatalogItem, MarketingCategory } from '@/types/marketing'
import { CatalogFormDialog } from './catalog-form-dialog'
import { AddonManagementDialog } from './addon-management-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from '@/components/ui/sheet'
import {
  Plus, Search, Pencil, Trash2, Camera, Video, Palette,
  Package, Megaphone, MoreHorizontal, Calendar, Building2, Share2, Puzzle, Clock, Repeat
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  photography: Camera,
  video: Video,
  design: Palette,
  physical_materials: Package,
  ads: Megaphone,
  social_media: Share2,
  other: MoreHorizontal,
}

export function CatalogTab() {
  const { items, loading, filters, setFilters, createItem, updateItem, deleteItem, refetch } = useMarketingCatalog()
  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<MarketingCatalogItem | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [addonsItem, setAddonsItem] = useState<MarketingCatalogItem | null>(null)
  const [sheetItem, setSheetItem] = useState<MarketingCatalogItem | null>(null)

  const handleCreate = async (data: any) => {
    try {
      await createItem(data)
      toast.success('Serviço criado com sucesso')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar serviço')
    }
  }

  const handleUpdate = async (data: any) => {
    if (!editItem) return
    try {
      await updateItem(editItem.id, data)
      toast.success('Serviço actualizado com sucesso')
      setEditItem(null)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao actualizar serviço')
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteItem(deleteId)
      toast.success('Serviço desativado')
      setDeleteId(null)
      if (sheetItem?.id === deleteId) setSheetItem(null)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao eliminar serviço')
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters + Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Pesquisar serviços..."
            className="pl-9 h-9 text-sm rounded-full bg-muted/50 border-0"
            value={filters.search || ''}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <Select
          value={filters.category || 'all'}
          onValueChange={(v) => setFilters({ ...filters, category: v === 'all' ? '' : v as MarketingCategory })}
        >
          <SelectTrigger className="h-9 w-[160px] text-sm rounded-full bg-muted/50 border-0">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {Object.entries(MARKETING_CATEGORIES).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" className="rounded-full ml-auto" onClick={() => { setEditItem(null); setFormOpen(true) }}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Novo Serviço
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum serviço encontrado"
          description="Crie o primeiro serviço do catálogo de marketing."
          action={{ label: 'Novo Serviço', onClick: () => { setEditItem(null); setFormOpen(true) } }}
        />
      ) : (
        <div className="rounded-2xl border overflow-hidden bg-card/30 backdrop-blur-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Serviço</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Categoria</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Preço</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-center">Prazo</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-center">Add-ons</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Estado</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Acções</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const Icon = CATEGORY_ICONS[item.category] || Package
                const addonCount = (item.addons || []).length
                return (
                  <TableRow
                    key={item.id}
                    className="transition-colors duration-200 hover:bg-muted/30 cursor-pointer"
                    onClick={() => setSheetItem(item)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt="" className="h-8 w-8 rounded-lg object-cover" />
                        ) : (
                          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        )}
                        <p className="text-sm font-medium truncate max-w-[220px]">{item.name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0.5 bg-muted/50">
                        {MARKETING_CATEGORIES[item.category]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold">{formatCurrency(item.price)}</TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {item.estimated_delivery_days > 0 ? `${item.estimated_delivery_days}d` : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      {addonCount > 0 ? (
                        <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0.5">
                          {addonCount}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.is_active ? (
                        <Badge className="rounded-full text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0.5 text-muted-foreground">
                          Inativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setAddonsItem(item)}
                          className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Add-ons"
                        >
                          <Puzzle className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => { setEditItem(item); setFormOpen(true) }}
                          className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(item.id)}
                          className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ─── Detail Sheet ─── */}
      <Sheet open={!!sheetItem} onOpenChange={(open) => !open && setSheetItem(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {sheetItem && (() => {
            const Icon = CATEGORY_ICONS[sheetItem.category] || Package
            return (
              <>
                <SheetHeader className="space-y-3">
                  {sheetItem.thumbnail && (
                    <div className="relative aspect-video rounded-xl overflow-hidden -mx-2">
                      <img src={sheetItem.thumbnail} alt={sheetItem.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <SheetTitle className="text-lg">{sheetItem.name}</SheetTitle>
                </SheetHeader>

                <div className="mt-4 space-y-5">
                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="rounded-full text-[11px] gap-1">
                      <Icon className="h-3 w-3" />{MARKETING_CATEGORIES[sheetItem.category]}
                    </Badge>
                    {sheetItem.is_subscription && (
                      <Badge className="rounded-full text-[11px] gap-1 bg-blue-100 text-blue-700 hover:bg-blue-100">
                        <Repeat className="h-3 w-3" />Subscrição
                      </Badge>
                    )}
                    {sheetItem.requires_scheduling && (
                      <Badge variant="secondary" className="rounded-full text-[11px] gap-1">
                        <Calendar className="h-3 w-3" />Agendamento
                      </Badge>
                    )}
                    {sheetItem.requires_property && (
                      <Badge variant="secondary" className="rounded-full text-[11px] gap-1">
                        <Building2 className="h-3 w-3" />Imóvel
                      </Badge>
                    )}
                    {sheetItem.estimated_delivery_days > 0 && (
                      <Badge variant="secondary" className="rounded-full text-[11px] gap-1">
                        <Clock className="h-3 w-3" />{sheetItem.estimated_delivery_days} dias
                      </Badge>
                    )}
                    {!sheetItem.is_active && (
                      <Badge variant="outline" className="rounded-full text-[11px] text-muted-foreground">Inativo</Badge>
                    )}
                  </div>

                  {/* Description */}
                  {sheetItem.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{sheetItem.description}</p>
                  )}

                  <Separator />

                  {/* Price */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Preço</span>
                    <span className="text-lg font-bold">
                      {formatCurrency(sheetItem.price)}
                      {sheetItem.is_subscription && (
                        <span className="text-xs text-muted-foreground font-normal ml-1">
                          {BILLING_CYCLE_LABELS[sheetItem.billing_cycle || 'monthly'] || '/mês'}
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Addons */}
                  {(sheetItem.addons || []).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add-ons ({sheetItem.addons!.length})</p>
                      <div className="rounded-xl border bg-muted/20 divide-y">
                        {sheetItem.addons!.map((addon) => (
                          <div key={addon.id} className="flex items-center justify-between px-3.5 py-2.5">
                            <span className="text-sm">{addon.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {addon.price === 0 ? 'Grátis' : `+${formatCurrency(addon.price)}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-full"
                      onClick={() => { setEditItem(sheetItem); setFormOpen(true); setSheetItem(null) }}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 rounded-full"
                      onClick={() => { setAddonsItem(sheetItem); setSheetItem(null) }}
                    >
                      <Puzzle className="mr-1.5 h-3.5 w-3.5" />
                      Add-ons
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      onClick={() => { setDeleteId(sheetItem.id); setSheetItem(null) }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>

      {/* Form Dialog */}
      <CatalogFormDialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditItem(null) }}
        item={editItem}
        onSubmit={editItem ? handleUpdate : handleCreate}
      />

      {/* Addon Management Dialog */}
      {addonsItem && (
        <AddonManagementDialog
          open={!!addonsItem}
          onOpenChange={(open) => { if (!open) setAddonsItem(null) }}
          item={addonsItem}
          onAddonsChanged={refetch}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar serviço</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende desativar este serviço? Ficará oculto para os consultores mas será mantido para encomendas existentes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-full bg-red-600 hover:bg-red-700">
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
