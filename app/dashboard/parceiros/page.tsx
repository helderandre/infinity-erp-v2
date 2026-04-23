// @ts-nocheck
'use client'

import { useState } from 'react'
import { usePartners } from '@/hooks/use-partners'
import { useUser } from '@/hooks/use-user'
import { PartnerCard } from '@/components/partners/partner-card'
import { PartnerForm } from '@/components/partners/partner-form'
import { PartnerDetailSheet } from '@/components/partners/partner-detail-sheet'
import { PartnerComparisonSheet } from '@/components/partners/partner-comparison-sheet'
import { PartnerCategoriesDialog } from '@/components/partners/partner-categories-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { cn } from '@/lib/utils'
import {
  usePartnerCategories,
  resolvePartnerCategoryColor,
} from '@/hooks/use-partner-categories'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Search, Plus, Handshake, Clock, CheckCircle2, GitCompareArrows, X as XIcon,
  Filter, ChevronDown, Tags,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Partner, PartnerCategory, PartnerStatus } from '@/types/partner'

type TabKey = 'approved' | 'proposals'

export default function ParceirosPage() {
  const isMobile = useIsMobile()
  const { user } = useUser()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<PartnerCategory | undefined>()
  const [activeTab, setActiveTab] = useState<TabKey>('approved')
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [editPartner, setEditPartner] = useState<Partner | null>(null)
  const [deletePartnerId, setDeletePartnerId] = useState<string | null>(null)
  const [detailPartnerId, setDetailPartnerId] = useState<string | null>(null)
  const [rejectPartner, setRejectPartnerState] = useState<Partner | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isRejecting, setIsRejecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [compareOpen, setCompareOpen] = useState(false)
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false)

  const { categories } = usePartnerCategories()
  const categoryMap = Object.fromEntries(categories.map((c) => [c.slug, c]))

  const statusFilter: PartnerStatus = activeTab === 'approved' ? 'approved' : 'pending'

  const {
    partners, isLoading, total, canSeePrivate, isStaff, pendingCount,
    createPartner, updatePartner, deletePartner, ratePartner,
    approvePartner, rejectPartner: rejectPartnerMutate,
  } = usePartners({
    filters: {
      search: search || undefined,
      category: categoryFilter,
      status: statusFilter,
    },
  })

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

  const handleApprove = async (partner: Partner) => {
    await approvePartner(partner.id)
  }

  const openRejectDialog = (partner: Partner) => {
    setRejectPartnerState(partner)
    setRejectReason('')
  }

  const handleReject = async () => {
    if (!rejectPartner || !rejectReason.trim()) return
    setIsRejecting(true)
    const ok = await rejectPartnerMutate(rejectPartner.id, rejectReason.trim())
    setIsRejecting(false)
    if (ok) {
      setRejectPartnerState(null)
      setRejectReason('')
    }
  }

  const categoryCounts = partners.reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1
    return acc
  }, {})

  const selectedPartners = partners.filter((p) => selectedIds.has(p.id))

  const toggleSelect = (partner: Partner) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(partner.id)) next.delete(partner.id)
      else next.add(partner.id)
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const newPartnerLabel = isStaff ? 'Novo Parceiro' : 'Propor Parceiro'
  const formTitle = editPartner
    ? 'Editar parceiro'
    : (isStaff ? 'Novo parceiro' : 'Propor parceiro')

  const proposalsTabLabel = 'Propostas'

  return (
    <div className="space-y-5">
      {/* Tabs + action */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-muted border border-border/40">
          <button
            onClick={() => setActiveTab('approved')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
              activeTab === 'approved'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>Aprovados</span>
          </button>
          <button
            onClick={() => setActiveTab('proposals')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
              activeTab === 'proposals'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>{proposalsTabLabel}</span>
            {pendingCount > 0 && (
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold tabular-nums',
                  activeTab === 'proposals'
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    : 'bg-foreground/10 text-foreground/70',
                )}
              >
                {pendingCount}
              </span>
            )}
          </button>
        </div>
        <Button
          size="sm"
          className="rounded-full shrink-0 gap-0 md:gap-1.5 px-0 md:px-3 aspect-square md:aspect-auto"
          aria-label={newPartnerLabel}
          title={newPartnerLabel}
          onClick={() => { setEditPartner(null); setShowFormDialog(true) }}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden md:inline">{newPartnerLabel}</span>
        </Button>
      </div>

      {/* Search + Category dropdown */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar parceiros..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-full h-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="rounded-full h-9 gap-1.5 shrink-0" size="sm">
              {(() => {
                if (!categoryFilter) return <><Filter className="h-3.5 w-3.5" />Categoria</>
                const cat = categoryMap[categoryFilter]
                const color = resolvePartnerCategoryColor(cat?.color || 'slate')
                return <><span className={cn('h-1.5 w-1.5 rounded-full', color.dot)} />{cat?.label || categoryFilter}</>
              })()}
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 max-h-[60vh] overflow-y-auto">
            <DropdownMenuItem onClick={() => setCategoryFilter(undefined)} className="gap-2">
              <span className="inline-flex h-4 w-4 items-center justify-center">
                {!categoryFilter && <CheckCircle2 className="h-3.5 w-3.5 text-foreground" />}
              </span>
              <span className="flex-1">Todas</span>
              <span className="text-xs text-muted-foreground tabular-nums">{total}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {categories
              .filter((cat) => typeof categoryCounts[cat.slug] === 'number' && categoryCounts[cat.slug] > 0)
              .map((cat) => {
                const color = resolvePartnerCategoryColor(cat.color)
                const isActive = categoryFilter === cat.slug
                const count = categoryCounts[cat.slug] || 0
                return (
                  <DropdownMenuItem
                    key={cat.id}
                    onClick={() => setCategoryFilter(isActive ? undefined : cat.slug)}
                    className="gap-2"
                  >
                    <span className="inline-flex h-4 w-4 items-center justify-center">
                      {isActive
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-foreground" />
                        : <span className={cn('h-1.5 w-1.5 rounded-full', color.dot)} />}
                    </span>
                    <span className="flex-1">{cat.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                  </DropdownMenuItem>
                )
              })}
            {isStaff && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setManageCategoriesOpen(true)} className="gap-2">
                  <Tags className="h-3.5 w-3.5" />
                  <span>Gerir categorias…</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Grid grouped by category */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[16/9] rounded-2xl" />)}
        </div>
      ) : partners.length === 0 ? (
        <EmptyState
          icon={activeTab === 'proposals' ? Clock : Handshake}
          title={
            activeTab === 'proposals'
              ? (isStaff ? 'Nenhuma proposta pendente' : 'Ainda não tens propostas pendentes')
              : 'Nenhum parceiro encontrado'
          }
          description={
            activeTab === 'proposals'
              ? (isStaff
                  ? 'Propostas submetidas pelos consultores aparecem aqui.'
                  : 'Propõe um parceiro para a staff rever.')
              : (search || categoryFilter ? 'Tente ajustar os filtros de pesquisa' : 'Comece por adicionar o primeiro parceiro')
          }
          action={
            (!search && !categoryFilter && activeTab === 'approved')
              ? { label: newPartnerLabel, onClick: () => { setEditPartner(null); setShowFormDialog(true) } }
              : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          {(() => {
            // Group partners by category, preserve DB sort_order
            const byCategory = new Map<string, Partner[]>()
            for (const p of partners) {
              const key = p.category || 'other'
              if (!byCategory.has(key)) byCategory.set(key, [])
              byCategory.get(key)!.push(p)
            }
            const orderedKeys = [
              ...categories.map((c) => c.slug).filter((k) => byCategory.has(k)),
              ...Array.from(byCategory.keys()).filter((k) => !categories.some((c) => c.slug === k)),
            ]
            return orderedKeys.map((key) => {
              const list = byCategory.get(key) || []
              const cat = categoryMap[key]
              const color = resolvePartnerCategoryColor(cat?.color || 'slate')
              const label = cat?.label || key || 'Outro'
              return (
                <section key={key} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full', color.dot)} />
                    <h2 className="text-sm font-semibold tracking-tight">{label}</h2>
                    <span className="text-xs text-muted-foreground">{list.length}</span>
                  </div>
                  {/* Mobile: horizontal snap carousel · Desktop: grid */}
                  <div className={cn(
                    'flex md:grid overflow-x-auto md:overflow-visible snap-x snap-mandatory gap-3',
                    'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
                    'pb-2 md:pb-0',
                    'scrollbar-none',
                  )}>
                    {list.map((partner) => (
                      <div
                        key={partner.id}
                        // mx-auto centres a single card; with multi cards it's a no-op because overflow consumes all auto margin.
                        className="shrink-0 w-[88%] sm:w-[48%] md:w-auto snap-center mx-auto md:mx-0"
                      >
                        <PartnerCard
                          partner={partner}
                          canEdit={canSeePrivate}
                          isStaff={isStaff}
                          currentUserId={user?.id}
                          isSelected={selectedIds.has(partner.id)}
                          selectionMode={selectedIds.size > 0}
                          categoryMap={categoryMap}
                          onToggleSelect={toggleSelect}
                          onView={(p) => setDetailPartnerId(p.id)}
                          onEdit={(p) => { setEditPartner(p); setShowFormDialog(true) }}
                          onDelete={(p) => setDeletePartnerId(p.id)}
                          onApprove={handleApprove}
                          onReject={openRejectDialog}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )
            })
          })()}
        </div>
      )}

      {/* Floating compare bar — lifted above mobile bottom-nav */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full bg-background border border-border/60 shadow-lg px-2 py-1.5 animate-in fade-in slide-in-from-bottom-2 max-w-[calc(100vw-2rem)]">
          <span className="text-xs font-medium px-2 truncate">
            {selectedIds.size === 1
              ? 'Selecciona mais parceiros'
              : `${selectedIds.size} seleccionados`}
          </span>
          <Button
            size="sm"
            className="rounded-full h-8 text-xs gap-1.5 shrink-0"
            disabled={selectedIds.size < 2}
            onClick={() => setCompareOpen(true)}
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
            Comparar
          </Button>
          <button
            type="button"
            onClick={clearSelection}
            className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            aria-label="Limpar selecção"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Comparison sheet */}
      <PartnerComparisonSheet
        partners={selectedPartners}
        open={compareOpen && selectedPartners.length >= 2}
        onOpenChange={(open) => {
          setCompareOpen(open)
          if (!open) { /* keep selection */ }
        }}
        onRemove={(p) => toggleSelect(p)}
      />

      {/* Manage categories dialog (staff only) */}
      <PartnerCategoriesDialog
        open={manageCategoriesOpen}
        onOpenChange={setManageCategoriesOpen}
      />

      {/* Form Sheet */}
      <Sheet open={showFormDialog} onOpenChange={(open) => { setShowFormDialog(open); if (!open) setEditPartner(null) }}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={cn(
            'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
            'bg-background',
            isMobile
              ? 'data-[side=bottom]:h-[75dvh] rounded-t-3xl'
              : 'w-full data-[side=right]:sm:max-w-[760px] sm:rounded-l-3xl',
          )}
        >
          {isMobile && (
            <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
          )}
          <div className="shrink-0 px-6 pt-8 pb-4 sm:pt-10">
            <SheetHeader className="p-0 gap-0">
              <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight pr-10">
                {formTitle}
              </SheetTitle>
              <SheetDescription className="sr-only">
                {editPartner
                  ? 'Edita os detalhes do parceiro.'
                  : (isStaff ? 'Adiciona um novo parceiro.' : 'Propõe um novo parceiro para aprovação da staff.')}
              </SheetDescription>
            </SheetHeader>
            {!editPartner && !isStaff && (
              <p className="mt-2 text-xs text-muted-foreground">
                A tua proposta será revista pela staff antes de ficar visível para todos.
              </p>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pb-6">
            <PartnerForm
              partner={editPartner}
              canSeePrivate={canSeePrivate}
              isProposal={!isStaff && !editPartner}
              onSubmit={handleFormSubmit}
              onCancel={() => { setShowFormDialog(false); setEditPartner(null) }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Detail Sheet */}
      <PartnerDetailSheet
        partnerId={detailPartnerId}
        open={!!detailPartnerId}
        onOpenChange={(open) => { if (!open) setDetailPartnerId(null) }}
        onRate={ratePartner}
        onApprove={approvePartner}
        onReject={rejectPartnerMutate}
        onUpdated={() => { /* refetch handled inside the hook */ }}
      />

      {/* Delete / Withdraw Dialog */}
      <AlertDialog open={!!deletePartnerId} onOpenChange={() => setDeletePartnerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isStaff ? 'Eliminar parceiro' : 'Retirar proposta'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isStaff
                ? 'Tem a certeza de que pretende eliminar este parceiro? Esta accao e irreversivel.'
                : 'Tem a certeza de que pretende retirar esta proposta?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isStaff ? 'Eliminar' : 'Retirar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectPartner} onOpenChange={(open) => { if (!open) { setRejectPartnerState(null); setRejectReason('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar proposta</DialogTitle>
            <DialogDescription>
              Indica o motivo da rejeição — será visível para o consultor que submeteu a proposta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason" className="text-xs">Motivo</Label>
            <Textarea
              id="reject-reason"
              rows={4}
              className="rounded-xl"
              placeholder="Ex: parceiro duplicado, dados incompletos..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => { setRejectPartnerState(null); setRejectReason('') }}>
              Cancelar
            </Button>
            <Button
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleReject}
              disabled={!rejectReason.trim() || isRejecting}
            >
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
