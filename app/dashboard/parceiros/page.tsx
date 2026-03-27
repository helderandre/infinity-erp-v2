// @ts-nocheck
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { SupplierFormDialog } from '@/components/encomendas/supplier-form-dialog'
import { useEncomendaSuppliers } from '@/hooks/use-encomenda-suppliers'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Badge } from '@/components/ui/badge'
import {
  Search, Plus, Truck, MoreHorizontal, Pencil, Ban, Star,
  Package, Phone, Mail, ArrowRight,
} from 'lucide-react'
import type { Supplier } from '@/types/encomenda'

export default function ParceirosPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
  const [deactivateId, setDeactivateId] = useState<string | null>(null)

  const { suppliers, loading, setFilters, createSupplier, updateSupplier, deleteSupplier } =
    useEncomendaSuppliers()

  const handleFormSubmit = async (data: Partial<Supplier>) => {
    try {
      if (editSupplier) {
        await updateSupplier(editSupplier.id, data)
        toast.success('Fornecedor actualizado')
      } else {
        await createSupplier(data)
        toast.success('Fornecedor criado')
      }
      setShowFormDialog(false)
      setEditSupplier(null)
    } catch {
      toast.error('Erro ao guardar fornecedor')
    }
  }

  const handleDeactivate = async () => {
    if (!deactivateId) return
    try {
      await deleteSupplier(deactivateId)
      toast.success('Fornecedor desativado')
    } catch {
      toast.error('Erro ao desativar')
    } finally {
      setDeactivateId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-8 py-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Parceiros & Fornecedores</h1>
              <p className="text-neutral-400 mt-1 text-sm">Gestão de fornecedores de materiais e parceiros comerciais</p>
            </div>
            <Button
              size="sm"
              className="rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25 gap-1.5 text-xs"
              onClick={() => { setEditSupplier(null); setShowFormDialog(true) }}
            >
              <Plus className="h-3.5 w-3.5" />Novo Fornecedor
            </Button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 px-4 py-3">
              <p className="text-[10px] text-neutral-400 uppercase tracking-wider">Total</p>
              <p className="text-xl font-bold text-white">{suppliers.length}</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 px-4 py-3">
              <p className="text-[10px] text-neutral-400 uppercase tracking-wider">Activos</p>
              <p className="text-xl font-bold text-white">{suppliers.filter(s => s.is_active).length}</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 px-4 py-3">
              <p className="text-[10px] text-neutral-400 uppercase tracking-wider">Com Rating</p>
              <p className="text-xl font-bold text-white">{suppliers.filter(s => s.rating_count > 0).length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar fornecedores..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setFilters((prev) => ({ ...prev, search: e.target.value || undefined }))
          }}
          className="pl-9 rounded-xl"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
      ) : suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Nenhum fornecedor encontrado"
          description={search ? 'Tente ajustar a pesquisa' : 'Comece por adicionar o primeiro fornecedor'}
          action={!search ? { label: 'Novo Fornecedor', onClick: () => { setEditSupplier(null); setShowFormDialog(true) } } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((supplier) => (
            <div
              key={supplier.id}
              onClick={() => router.push(`/dashboard/parceiros/${supplier.id}`)}
              className="group rounded-2xl border bg-card/50 backdrop-blur-sm p-5 cursor-pointer hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{supplier.name}</h3>
                  {supplier.contact_name && (
                    <p className="text-xs text-muted-foreground mt-0.5">{supplier.contact_name}</p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full shrink-0">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => { setEditSupplier(supplier); setShowFormDialog(true) }} className="text-xs gap-2">
                      <Pencil className="h-3 w-3" />Editar
                    </DropdownMenuItem>
                    {supplier.is_active && (
                      <DropdownMenuItem className="text-xs gap-2 text-destructive" onClick={() => setDeactivateId(supplier.id)}>
                        <Ban className="h-3 w-3" />Desativar
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Contact chips */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {supplier.phone && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 dark:bg-white/10 px-2 py-0.5 text-[10px] text-muted-foreground">
                    <Phone className="h-2.5 w-2.5" />{supplier.phone}
                  </span>
                )}
                {supplier.email && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 dark:bg-white/10 px-2 py-0.5 text-[10px] text-muted-foreground truncate max-w-[180px]">
                    <Mail className="h-2.5 w-2.5" />{supplier.email}
                  </span>
                )}
                {!supplier.is_active && (
                  <Badge variant="secondary" className="text-[9px] rounded-full">Inativo</Badge>
                )}
              </div>

              {/* Footer: rating + delivery */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {supplier.rating_count > 0 ? (
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs font-bold">{supplier.rating_avg}</span>
                      <span className="text-[10px] text-muted-foreground">({supplier.rating_count})</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Sem avaliações</span>
                  )}
                  {supplier.average_delivery_days && (
                    <span className="text-[10px] text-muted-foreground">· {supplier.average_delivery_days}d entrega</span>
                  )}
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <SupplierFormDialog
        open={showFormDialog}
        onOpenChange={(open) => { setShowFormDialog(open); if (!open) setEditSupplier(null) }}
        supplier={editSupplier}
        onSubmit={handleFormSubmit}
      />

      {/* Deactivate Dialog */}
      <AlertDialog open={!!deactivateId} onOpenChange={() => setDeactivateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar fornecedor</AlertDialogTitle>
            <AlertDialogDescription>Tem a certeza? Poderá reactivá-lo posteriormente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
