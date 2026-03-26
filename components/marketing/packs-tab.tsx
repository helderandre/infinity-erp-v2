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
import { Plus, Pencil, Trash2, PackageOpen, Package } from 'lucide-react'
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
      toast.success('Pack desativado')
      setDeleteId(null)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao eliminar pack')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Pacotes combinados de serviços com preço reduzido.</p>
        <Button className="rounded-full" onClick={() => { setEditPack(null); setFormOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Pack
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="aspect-[4/5] rounded-xl" />)}
        </div>
      ) : packs.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="Nenhum pack encontrado"
          description="Crie o primeiro pack de serviços."
          action={{ label: 'Novo Pack', onClick: () => { setEditPack(null); setFormOpen(true) } }}
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {packs.map(pack => {
            const itemsTotal = (pack.items || []).reduce((s, i) => s + i.price, 0)
            const savings = itemsTotal - pack.price
            const savingsPercent = itemsTotal > 0 ? Math.round((savings / itemsTotal) * 100) : 0
            return (
              <div key={pack.id} className="group relative flex flex-col bg-background rounded-xl border hover:shadow-lg transition-all duration-300 overflow-hidden">
                {/* Thumbnail */}
                <div className="relative aspect-video bg-neutral-50 overflow-hidden">
                  {pack.thumbnail ? (
                    <img
                      src={pack.thumbnail}
                      alt={pack.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100">
                      <Package className="h-12 w-12 text-neutral-200" />
                    </div>
                  )}
                  {/* Status badge */}
                  <div className="absolute top-3 left-3">
                    {pack.is_active ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-emerald-500/10 backdrop-blur-sm text-emerald-700 px-2.5 py-1 rounded-full">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-slate-500/10 backdrop-blur-sm text-slate-600 px-2.5 py-1 rounded-full">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        Inativo
                      </span>
                    )}
                  </div>
                  {/* Savings badge */}
                  {savingsPercent > 0 && (
                    <div className="absolute top-3 right-3 bg-emerald-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
                      -{savingsPercent}%
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-semibold text-sm leading-snug">{pack.name}</h3>
                  {pack.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{pack.description}</p>
                  )}

                  {/* Price */}
                  <div className="flex items-baseline gap-2 mt-3">
                    <span className="text-lg font-bold">{formatCurrency(pack.price)}</span>
                    {itemsTotal > 0 && itemsTotal !== pack.price && (
                      <span className="text-sm text-muted-foreground line-through">{formatCurrency(itemsTotal)}</span>
                    )}
                  </div>
                  {savings > 0 && (
                    <span className="text-xs text-emerald-600 font-medium mt-0.5">
                      Poupa {formatCurrency(savings)}
                    </span>
                  )}

                  {/* Included services */}
                  {(pack.items || []).length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        {(pack.items || []).length} serviço(s) incluído(s)
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {(pack.items || []).map(item => (
                          <span key={item.id} className="inline-flex items-center text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {item.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-auto pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 rounded-full h-8 text-xs"
                      onClick={() => { setEditPack(pack); setFormOpen(true) }}
                    >
                      <Pencil className="mr-1.5 h-3 w-3" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteId(pack.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
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
            <AlertDialogTitle>Desativar pack</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende desativar este pack?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
