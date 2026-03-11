'use client'

import { useState } from 'react'
import { useMarketingCatalog } from '@/hooks/use-marketing-catalog'
import { MARKETING_CATEGORIES } from '@/lib/constants'
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'
import {
  Plus, Search, Pencil, Trash2, Camera, Video, Palette,
  Package, Megaphone, MoreHorizontal, Calendar, Building2, Share2, Puzzle
} from 'lucide-react'
import { toast } from 'sonner'

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
      toast.success('Serviço desactivado')
      setDeleteId(null)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao eliminar serviço')
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters + Actions */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar serviços..."
              className="pl-9"
              value={filters.search || ''}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <Select
            value={filters.category || 'all'}
            onValueChange={(v) => setFilters({ ...filters, category: v === 'all' ? '' : v as MarketingCategory })}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(MARKETING_CATEGORIES).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setEditItem(null); setFormOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Serviço
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum serviço encontrado"
          description="Crie o primeiro serviço do catálogo de marketing."
          action={{ label: 'Novo Serviço', onClick: () => { setEditItem(null); setFormOpen(true) } }}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serviço</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-center">Prazo</TableHead>
                <TableHead className="text-center">Add-ons</TableHead>
                <TableHead className="text-center">Flags</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const Icon = CATEGORY_ICONS[item.category] || Package
                const addonCount = (item.addons || []).length
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{item.name}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 max-w-[300px]">{item.description}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {MARKETING_CATEGORIES[item.category]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.price)}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {item.estimated_delivery_days}d
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => setAddonsItem(item)}
                      >
                        <Puzzle className="h-3.5 w-3.5" />
                        {addonCount > 0 ? addonCount : 'Gerir'}
                      </Button>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {item.requires_scheduling && (
                          <span title="Requer Agendamento" className="inline-flex h-6 w-6 items-center justify-center rounded bg-blue-500/10">
                            <Calendar className="h-3.5 w-3.5 text-blue-500" />
                          </span>
                        )}
                        {item.requires_property && (
                          <span title="Requer Imóvel" className="inline-flex h-6 w-6 items-center justify-center rounded bg-amber-500/10">
                            <Building2 className="h-3.5 w-3.5 text-amber-500" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={item.is_active ? 'default' : 'secondary'} className="text-xs">
                        {item.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => { setEditItem(item); setFormOpen(true) }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteId(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desactivar serviço</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende desactivar este serviço? Ficará oculto para os consultores mas será mantido para encomendas existentes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
