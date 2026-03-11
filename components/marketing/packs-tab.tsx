'use client'

import { useState } from 'react'
import { useMarketingPacks } from '@/hooks/use-marketing-packs'
import { useMarketingCatalog } from '@/hooks/use-marketing-catalog'
import { MARKETING_CATEGORIES, formatCurrency } from '@/lib/constants'
import type { MarketingPack } from '@/types/marketing'
import { PackFormDialog } from './pack-form-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2, PackageOpen } from 'lucide-react'
import { toast } from 'sonner'

export function PacksTab() {
  const { packs, loading, createPack, updatePack, deletePack } = useMarketingPacks()
  const { items: catalogItems } = useMarketingCatalog()
  const [formOpen, setFormOpen] = useState(false)
  const [editPack, setEditPack] = useState<MarketingPack | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const handleCreate = async (data: any) => {
    try {
      await createPack(data)
      toast.success('Pack criado com sucesso')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar pack')
    }
  }

  const handleUpdate = async (data: any) => {
    if (!editPack) return
    try {
      await updatePack(editPack.id, data)
      toast.success('Pack actualizado')
      setEditPack(null)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao actualizar pack')
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deletePack(deleteId)
      toast.success('Pack desactivado')
      setDeleteId(null)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao eliminar pack')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Pacotes combinados de serviços com preço reduzido.</p>
        <Button onClick={() => { setEditPack(null); setFormOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Pack
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : packs.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="Nenhum pack encontrado"
          description="Crie o primeiro pack de serviços."
          action={{ label: 'Novo Pack', onClick: () => { setEditPack(null); setFormOpen(true) } }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {packs.map(pack => {
            const itemsTotal = (pack.items || []).reduce((s, i) => s + i.price, 0)
            const savings = itemsTotal - pack.price
            return (
              <div key={pack.id} className="rounded-lg border bg-card p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">{pack.name}</h3>
                    {pack.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{pack.description}</p>
                    )}
                  </div>
                  <Badge variant={pack.is_active ? 'default' : 'secondary'} className="text-xs shrink-0">
                    {pack.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{formatCurrency(pack.price)}</span>
                  {savings > 0 && (
                    <span className="text-xs text-emerald-600 font-medium">
                      Poupa {formatCurrency(savings)}
                    </span>
                  )}
                </div>

                {/* Included services */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{(pack.items || []).length} serviço(s) incluído(s):</p>
                  <div className="flex flex-wrap gap-1">
                    {(pack.items || []).map(item => (
                      <Badge key={item.id} variant="outline" className="text-[10px]">
                        {item.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1 pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => { setEditPack(pack); setFormOpen(true) }}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDeleteId(pack.id)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Eliminar
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <PackFormDialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditPack(null) }}
        pack={editPack}
        catalogItems={catalogItems}
        onSubmit={editPack ? handleUpdate : handleCreate}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desactivar pack</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende desactivar este pack?
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
