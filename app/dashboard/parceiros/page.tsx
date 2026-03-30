// @ts-nocheck
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePartners } from '@/hooks/use-partners'
import { PartnerCard } from '@/components/partners/partner-card'
import { PartnerForm } from '@/components/partners/partner-form'
import { PartnerDetailSheet } from '@/components/partners/partner-detail-sheet'
import { EmptyState } from '@/components/shared/empty-state'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  PARTNER_CATEGORY_OPTIONS,
  PARTNER_CATEGORY_LABELS,
  PARTNER_CATEGORY_COLORS,
} from '@/lib/constants'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
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
import {
  Search, Plus, Handshake, Users, Star, Award, Filter,
} from 'lucide-react'
import type { Partner, PartnerCategory } from '@/types/partner'

export default function ParceirosPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<PartnerCategory | undefined>()
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [editPartner, setEditPartner] = useState<Partner | null>(null)
  const [deletePartnerId, setDeletePartnerId] = useState<string | null>(null)
  const [detailPartner, setDetailPartner] = useState<Partner | null>(null)

  const {
    partners, isLoading, total, canSeePrivate,
    createPartner, updatePartner, deletePartner, ratePartner,
  } = usePartners({
    filters: {
      search: search || undefined,
      category: categoryFilter,
    },
  })

  const activeCount = partners.filter(p => p.is_active).length
  const ratedCount = partners.filter(p => p.rating_count > 0).length
  const recommendedCount = partners.filter(p => p.is_recommended).length

  const handleFormSubmit = async (data: any) => {
    if (editPartner) {
      const ok = await updatePartner(editPartner.id, data)
      if (ok) { setShowFormDialog(false); setEditPartner(null) }
    } else {
      const created = await createPartner(data)
      if (created) { setShowFormDialog(false) }
    }
  }

  const handleDelete = async () => {
    if (!deletePartnerId) return
    await deletePartner(deletePartnerId)
    setDeletePartnerId(null)
  }

  // Category counts for filter badges
  const categoryCounts = partners.reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-8 py-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Parceiros & Fornecedores</h1>
              <p className="text-neutral-400 mt-1 text-sm">Rede de parceiros comerciais, prestadores de servicos e fornecedores</p>
            </div>
            <Button
              size="sm"
              className="rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25 gap-1.5 text-xs"
              onClick={() => { setEditPartner(null); setShowFormDialog(true) }}
            >
              <Plus className="h-3.5 w-3.5" />Novo Parceiro
            </Button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[
              { label: 'Total', value: total, icon: Handshake },
              { label: 'Activos', value: activeCount, icon: Users },
              { label: 'Com Rating', value: ratedCount, icon: Star },
              { label: 'Recomendados', value: recommendedCount, icon: Award },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-neutral-400 uppercase tracking-wider">{kpi.label}</p>
                  <kpi.icon className="h-3.5 w-3.5 text-neutral-500" />
                </div>
                <p className="text-xl font-bold text-white mt-1">{kpi.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Search + Category Filters */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar parceiros..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>

        {/* Category pill filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setCategoryFilter(undefined)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              !categoryFilter
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            Todos ({total})
          </button>
          {PARTNER_CATEGORY_OPTIONS.filter(cat => categoryCounts[cat.value]).map((cat) => {
            const color = PARTNER_CATEGORY_COLORS[cat.value]
            const isActive = categoryFilter === cat.value
            return (
              <button
                key={cat.value}
                onClick={() => setCategoryFilter(isActive ? undefined : cat.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5',
                  isActive
                    ? `${color.bg} ${color.text}`
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', isActive ? color.dot : 'bg-muted-foreground/40')} />
                {cat.label} ({categoryCounts[cat.value]})
              </button>
            )
          })}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
        </div>
      ) : partners.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="Nenhum parceiro encontrado"
          description={search || categoryFilter ? 'Tente ajustar os filtros de pesquisa' : 'Comece por adicionar o primeiro parceiro'}
          action={!search && !categoryFilter ? { label: 'Novo Parceiro', onClick: () => { setEditPartner(null); setShowFormDialog(true) } } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {partners.map((partner) => (
            <PartnerCard
              key={partner.id}
              partner={partner}
              canEdit={canSeePrivate}
              onView={(p) => router.push(`/dashboard/parceiros/${p.id}`)}
              onEdit={(p) => { setEditPartner(p); setShowFormDialog(true) }}
              onDelete={(p) => setDeletePartnerId(p.id)}
            />
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showFormDialog} onOpenChange={(open) => { setShowFormDialog(open); if (!open) setEditPartner(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editPartner ? 'Editar Parceiro' : 'Novo Parceiro'}</DialogTitle>
          </DialogHeader>
          <PartnerForm
            partner={editPartner}
            canSeePrivate={canSeePrivate}
            onSubmit={handleFormSubmit}
            onCancel={() => { setShowFormDialog(false); setEditPartner(null) }}
          />
        </DialogContent>
      </Dialog>

      {/* Detail Sheet (quick view) */}
      <PartnerDetailSheet
        partner={detailPartner}
        open={!!detailPartner}
        onOpenChange={(open) => { if (!open) setDetailPartner(null) }}
        canEdit={canSeePrivate}
        canSeePrivate={canSeePrivate}
        onEdit={(p) => { setDetailPartner(null); setEditPartner(p); setShowFormDialog(true) }}
        onRate={ratePartner}
      />

      {/* Delete Dialog */}
      <AlertDialog open={!!deletePartnerId} onOpenChange={() => setDeletePartnerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar parceiro</AlertDialogTitle>
            <AlertDialogDescription>Tem a certeza de que pretende eliminar este parceiro? Esta accao e irreversivel.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
