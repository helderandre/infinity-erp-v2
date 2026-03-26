// @ts-nocheck
'use client'

import { useState, useMemo } from 'react'
import {
  Plus,
  Handshake,
  Users,
  Award,
  CheckCircle2,
  Search,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePartners } from '@/hooks/use-partners'
import { useUser } from '@/hooks/use-user'
import {
  PARTNER_CATEGORY_OPTIONS,
  PARTNER_CATEGORY_LABELS,
  PARTNER_CATEGORY_COLORS,
} from '@/lib/constants'
import type { Partner, PartnerFilters } from '@/types/partner'
import type { CreatePartnerInput } from '@/lib/validations/partner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

import { PartnerForm } from '@/components/partners/partner-form'
import { PartnerCard } from '@/components/partners/partner-card'
import { PartnerDetailSheet } from '@/components/partners/partner-detail-sheet'

export default function ParceirosPage() {
  const { user } = useUser()
  const [filters, setFilters] = useState<PartnerFilters>({})
  const [searchInput, setSearchInput] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null)
  const [viewPartner, setViewPartner] = useState<Partner | null>(null)
  const [deletePartner, setDeletePartner] = useState<Partner | null>(null)

  const activeFilters: PartnerFilters = {
    ...filters,
    category: selectedCategory as any || undefined,
    search: searchInput || undefined,
  }

  const {
    partners,
    isLoading,
    total,
    canSeePrivate,
    refetch,
    createPartner,
    updatePartner,
    deletePartner: doDeletePartner,
    ratePartner,
  } = usePartners({ filters: activeFilters })

  // KPI calculations
  const kpis = useMemo(() => {
    const active = partners.filter((p) => p.is_active).length
    const recommended = partners.filter((p) => p.is_recommended).length
    const categories = new Set(partners.map((p) => p.category)).size
    return { total: partners.length, active, recommended, categories }
  }, [partners])

  // Category counts for pills
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    partners.forEach((p) => {
      counts[p.category] = (counts[p.category] || 0) + 1
    })
    return counts
  }, [partners])

  // Handlers
  const handleCreate = async (data: CreatePartnerInput) => {
    const result = await createPartner(data)
    if (result) setShowCreateDialog(false)
  }

  const handleEdit = async (data: any) => {
    if (!editingPartner) return
    const success = await updatePartner(editingPartner.id, data)
    if (success) setEditingPartner(null)
  }

  const handleDeleteConfirm = async () => {
    if (!deletePartner) return
    await doDeletePartner(deletePartner.id)
    setDeletePartner(null)
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-neutral-900 rounded-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/80 to-neutral-900/60" />
        <div className="relative z-10 px-8 py-10 sm:px-10 sm:py-12">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Handshake className="h-5 w-5 text-neutral-400" />
                <p className="text-neutral-400 text-xs font-medium tracking-widest uppercase">
                  Rede de Parceiros
                </p>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Parceiros
              </h2>
              <p className="text-neutral-400 mt-1.5 text-sm max-w-lg">
                Gestão de parceiros de negócio — advogados, notários, bancos, fotógrafos e mais.
              </p>
            </div>
            {canSeePrivate && (
              <Button
                className="rounded-full px-6 bg-white text-neutral-900 hover:bg-neutral-100"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo Parceiro
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Parceiros', value: kpis.total, icon: Handshake, iconBg: 'bg-blue-500/10', iconColor: 'text-blue-500' },
          { label: 'Ativos', value: kpis.active, icon: CheckCircle2, iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500' },
          { label: 'Recomendados', value: kpis.recommended, icon: Award, iconBg: 'bg-amber-500/10', iconColor: 'text-amber-500' },
          { label: 'Categorias', value: kpis.categories, icon: Users, iconBg: 'bg-violet-500/10', iconColor: 'text-violet-500' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4 transition-all duration-300 hover:shadow-md hover:bg-card/80"
          >
            <div className="flex items-center gap-3">
              <div className={cn('rounded-xl p-2.5', kpi.iconBg)}>
                <kpi.icon className={cn('h-4 w-4', kpi.iconColor)} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                  {kpi.label}
                </p>
                <p className="text-xl font-bold tracking-tight">{kpi.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Category pills */}
      <div className="space-y-3">
        {/* Search bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 rounded-full"
            placeholder="Pesquisar por nome, NIF, cidade..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchInput('')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              'px-4 py-1.5 rounded-full text-xs font-medium transition-colors duration-300 whitespace-nowrap',
              !selectedCategory
                ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            Todos ({total})
          </button>
          {PARTNER_CATEGORY_OPTIONS.filter((c) => categoryCounts[c.value]).map((cat) => {
            const catColor = PARTNER_CATEGORY_COLORS[cat.value]
            return (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(selectedCategory === cat.value ? null : cat.value)}
                className={cn(
                  'px-4 py-1.5 rounded-full text-xs font-medium transition-colors duration-300 whitespace-nowrap',
                  selectedCategory === cat.value
                    ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {cat.label} ({categoryCounts[cat.value] || 0})
              </button>
            )
          })}
        </div>
      </div>

      {/* Partners grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : partners.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Handshake className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-medium">Nenhum parceiro encontrado</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            {searchInput || selectedCategory
              ? 'Tente ajustar os filtros de pesquisa.'
              : 'Adicione o primeiro parceiro para começar.'}
          </p>
          {canSeePrivate && !searchInput && !selectedCategory && (
            <Button
              className="mt-4 rounded-full"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo Parceiro
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {partners.map((partner, idx) => (
            <div
              key={partner.id}
              className="animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${idx * 30}ms`, animationFillMode: 'backwards' }}
            >
              <PartnerCard
                partner={partner}
                canEdit={canSeePrivate}
                onView={setViewPartner}
                onEdit={setEditingPartner}
                onDelete={setDeletePartner}
              />
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto rounded-2xl">
          <div className="-mx-6 -mt-6 mb-4 bg-neutral-900 rounded-t-2xl px-6 py-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5 text-white">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/15 backdrop-blur-sm">
                  <Handshake className="h-4 w-4" />
                </div>
                Novo Parceiro
              </DialogTitle>
              <DialogDescription className="text-neutral-400 mt-1">
                Preencha os dados do parceiro de negócio.
              </DialogDescription>
            </DialogHeader>
          </div>
          <PartnerForm
            onSubmit={handleCreate}
            onCancel={() => setShowCreateDialog(false)}
            canSeePrivate={canSeePrivate}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingPartner} onOpenChange={(open) => !open && setEditingPartner(null)}>
        <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto rounded-2xl">
          <div className="-mx-6 -mt-6 mb-4 bg-neutral-900 rounded-t-2xl px-6 py-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5 text-white">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/15 backdrop-blur-sm">
                  <Handshake className="h-4 w-4" />
                </div>
                Editar Parceiro
              </DialogTitle>
              <DialogDescription className="text-neutral-400 mt-1">
                {editingPartner?.name}
              </DialogDescription>
            </DialogHeader>
          </div>
          {editingPartner && (
            <PartnerForm
              partner={editingPartner}
              onSubmit={handleEdit}
              onCancel={() => setEditingPartner(null)}
              canSeePrivate={canSeePrivate}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Sheet */}
      <PartnerDetailSheet
        partner={viewPartner}
        open={!!viewPartner}
        onOpenChange={(open) => !open && setViewPartner(null)}
        onEdit={(p) => { setViewPartner(null); setEditingPartner(p) }}
        onRate={ratePartner}
        canEdit={canSeePrivate}
        canSeePrivate={canSeePrivate}
      />

      {/* Delete Confirm */}
      <AlertDialog
        open={!!deletePartner}
        onOpenChange={(open) => !open && setDeletePartner(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Parceiro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar <strong>{deletePartner?.name}</strong>? Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
