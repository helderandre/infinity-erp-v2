'use client'


import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { PropertyFilters } from '@/components/properties/property-filters'
import { PropertyCard } from '@/components/properties/property-card'
import { PropertyDetailSheet } from '@/components/properties/property-detail-sheet'
import { PropertyListItem, type PropertyListItemData } from '@/components/properties/property-list-item'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import {
  Building2,
  Plus,
  MoreHorizontal,
  Trash2,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  RotateCcw,
  Download,
} from 'lucide-react'
import { CsvExportDialog } from '@/components/shared/csv-export-dialog'
import { useDebounce } from '@/hooks/use-debounce'
import { usePersistentState } from '@/hooks/use-persistent-filters'
import { PROPERTY_STATUS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { PropertyWithRelations } from '@/types/property'

const PAGE_SIZE = 20
const ALL_STATUS_KEYS = Object.keys(PROPERTY_STATUS)
const DEFAULT_STATUSES = ALL_STATUS_KEYS.filter((k) => k !== 'cancelled')

function ImoveisPageInner() {
  return (
    <Suspense fallback={<ImoveisPageSkeleton />}>
      <ImoveisPageContent />
    </Suspense>
  )
}

function ImoveisPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-[104px] w-full rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

function ImoveisPageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [properties, setProperties] = useState<PropertyWithRelations[]>([])
  const [detailPropertyId, setDetailPropertyId] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [consultants, setConsultants] = useState<{ id: string; commercial_name: string }[]>([])
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [viewMode, setViewMode] = usePersistentState<'table' | 'grid'>('imoveis-view-mode', 'table')
  const [sortBy, setSortBy] = useState<string>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Filtros (persistidos em localStorage por utilizador)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [selectedStatuses, setSelectedStatuses] = usePersistentState<string[]>('imoveis-filter-statuses', DEFAULT_STATUSES)
  const [propertyType, setPropertyType] = usePersistentState('imoveis-filter-type', searchParams.get('property_type') || 'all')
  const [businessType, setBusinessType] = usePersistentState('imoveis-filter-business', searchParams.get('business_type') || 'all')
  const [condition, setCondition] = usePersistentState('imoveis-filter-condition', searchParams.get('property_condition') || 'all')
  const [consultantId, setConsultantId] = usePersistentState('imoveis-filter-consultant', searchParams.get('consultant_id') || 'all')
  const [page, setPage] = useState(Number(searchParams.get('page')) || 0)

  const debouncedSearch = useDebounce(search, 300)

  const hasStatusFilter = selectedStatuses.length > 0 && selectedStatuses.length < ALL_STATUS_KEYS.length

  const hasActiveFilters =
    debouncedSearch !== '' ||
    hasStatusFilter ||
    propertyType !== 'all' ||
    businessType !== 'all' ||
    condition !== 'all' ||
    consultantId !== 'all'

  const loadProperties = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (selectedStatuses.length > 0 && selectedStatuses.length < ALL_STATUS_KEYS.length) {
        params.set('status', selectedStatuses.join(','))
      }
      if (propertyType !== 'all') params.set('property_type', propertyType)
      if (businessType !== 'all') params.set('business_type', businessType)
      if (condition !== 'all') params.set('property_condition', condition)
      if (consultantId !== 'all') params.set('consultant_id', consultantId)
      params.set('sort_by', sortBy)
      params.set('sort_dir', sortDir)
      params.set('per_page', String(PAGE_SIZE))
      params.set('page', String(page + 1))

      const res = await fetch(`/api/properties?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar imóveis')

      const data = await res.json()
      setProperties(data.data || [])
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Erro ao carregar imóveis:', error)
      setProperties([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, selectedStatuses, propertyType, businessType, condition, consultantId, page, sortBy, sortDir])

  const loadConsultants = useCallback(async () => {
    try {
      const res = await fetch('/api/users/consultants')
      if (res.ok) {
        const data = await res.json()
        setConsultants(
          (data || []).map((c: Record<string, unknown>) => ({
            id: c.id as string,
            commercial_name: c.commercial_name as string,
          }))
        )
      }
    } catch {
      // silently fail
    }
  }, [])

  useEffect(() => {
    loadProperties()
  }, [loadProperties])

  useEffect(() => {
    loadConsultants()
  }, [loadConsultants])

  // Sync ?property=<slug|id> with the detail sheet so deep links open directly.
  const propertyParam = searchParams.get('property')
  useEffect(() => {
    if (propertyParam && propertyParam !== detailPropertyId) {
      setDetailPropertyId(propertyParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyParam])

  const openPropertySheet = (p: PropertyWithRelations) => {
    const key = p.slug || p.id
    setDetailPropertyId(key)
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('property', key)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleSheetOpenChange = (open: boolean) => {
    if (open) return
    setDetailPropertyId(null)
    if (propertyParam) {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      params.delete('property')
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }
  }

  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, selectedStatuses, propertyType, businessType, condition, consultantId])

  const handleCancel = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/properties/${deleteId}?mode=cancel`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao cancelar imóvel')
      toast.success('Imóvel cancelado')
      loadProperties()
    } catch {
      toast.error('Erro ao cancelar imóvel')
    } finally {
      setDeleteId(null)
    }
  }

  const handleDeletePermanent = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/properties/${deleteId}?mode=permanent`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao eliminar imóvel')
      toast.success('Imóvel eliminado permanentemente')
      loadProperties()
    } catch {
      toast.error('Erro ao eliminar imóvel')
    } finally {
      setDeleteId(null)
    }
  }

  const clearFilters = () => {
    setSearch('')
    setSelectedStatuses(DEFAULT_STATUSES)
    setPropertyType('all')
    setBusinessType('all')
    setCondition('all')
    setConsultantId('all')
    setPage(0)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const handleSort = (column: string) => (dir: 'asc' | 'desc') => {
    setSortBy(column)
    setSortDir(dir)
    setPage(0)
  }

  const resetSort = () => {
    setSortBy('created_at')
    setSortDir('desc')
    setPage(0)
  }

  const SortableColumnHeader = ({ column, label }: { column: string; label: string }) => {
    const isActive = sortBy === column
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="-ml-3 h-8 data-[state=open]:bg-accent">
            <span>{label}</span>
            {isActive && sortDir === 'asc' ? (
              <ArrowUp className="ml-1 h-3.5 w-3.5" />
            ) : isActive && sortDir === 'desc' ? (
              <ArrowDown className="ml-1 h-3.5 w-3.5" />
            ) : (
              <ChevronsUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground/50" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => handleSort(column)('asc')}>
            <ArrowUp className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            Crescente
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSort(column)('desc')}>
            <ArrowDown className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            Decrescente
          </DropdownMenuItem>
          {isActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={resetSort}>
                <RotateCcw className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                Resetar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="space-y-5">
      {/* ═══ Hero header ═══ */}
      <div className="relative overflow-hidden rounded-2xl bg-neutral-900 px-6 sm:px-8 py-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Imóveis</h1>
            <p className="text-neutral-400 text-sm">{total} imóve{total !== 1 ? 'is' : 'l'}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle — desktop only (inside card) */}
            <div className="hidden sm:flex items-center gap-0.5 p-0.5 rounded-full bg-white/10 border border-white/15">
              <button onClick={() => setViewMode('table')} className={cn('inline-flex items-center justify-center h-7 w-7 rounded-full transition-all', viewMode === 'table' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400 hover:text-white')}>
                <List className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setViewMode('grid')} className={cn('inline-flex items-center justify-center h-7 w-7 rounded-full transition-all', viewMode === 'grid' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400 hover:text-white')}>
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>
            <button onClick={() => setExportOpen(true)} className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white border border-white/20 px-3 py-2 rounded-full text-xs font-medium hover:bg-white/25 transition-colors">
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
            <button onClick={() => router.push('/dashboard/imoveis/novo')} className="inline-flex items-center gap-1.5 bg-white text-neutral-900 px-4 py-2 rounded-full text-xs font-semibold hover:bg-neutral-100 transition-colors shadow-sm">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Novo Imóvel</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Filters ═══ */}
      <PropertyFilters
        search={search}
        onSearchChange={setSearch}
        selectedStatuses={selectedStatuses}
        onStatusesChange={setSelectedStatuses}
        propertyType={propertyType}
        onPropertyTypeChange={setPropertyType}
        businessType={businessType}
        onBusinessTypeChange={setBusinessType}
        condition={condition}
        onConditionChange={setCondition}
        consultants={consultants}
        consultantId={consultantId}
        onConsultantChange={setConsultantId}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
        mobilePrefix={
          <div className="sm:hidden flex items-center gap-0.5 p-0.5 rounded-full bg-muted border border-border/30">
            <button onClick={() => setViewMode('table')} className={cn('inline-flex items-center justify-center h-7 w-7 rounded-full transition-all', viewMode === 'table' ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900' : 'text-muted-foreground')}>
              <List className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setViewMode('grid')} className={cn('inline-flex items-center justify-center h-7 w-7 rounded-full transition-all', viewMode === 'grid' ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900' : 'text-muted-foreground')}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
        }
      />

      {isLoading ? (
        viewMode === 'table' ? (
          <div className="rounded-3xl border border-border/40 shadow-sm p-3 sm:p-4 space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-[104px] w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-lg border overflow-hidden">
                <Skeleton className="aspect-[16/10]" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )
      ) : properties.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhum imóvel encontrado"
          description={
            hasActiveFilters
              ? 'Tente ajustar os critérios de pesquisa'
              : 'Comece por criar o seu primeiro imóvel'
          }
          action={
            !hasActiveFilters
              ? {
                  label: 'Novo Imóvel',
                  onClick: () => router.push('/dashboard/imoveis/novo'),
                }
              : undefined
          }
        />
      ) : viewMode === 'table' ? (
        <>
          <div className="rounded-3xl border border-border/40 shadow-sm p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap px-1">
              <div className="text-[11px] font-medium text-muted-foreground">
                {total} imóve{total !== 1 ? 'is' : 'l'}
              </div>
              <div className="flex items-center gap-0.5">
                <span className="text-[11px] text-muted-foreground mr-1">Ordenar:</span>
                <SortableColumnHeader column="created_at" label="Data" />
                <SortableColumnHeader column="external_ref" label="Ref." />
                <SortableColumnHeader column="listing_price" label="Preço" />
                <SortableColumnHeader column="title" label="Título" />
                <SortableColumnHeader column="status" label="Estado" />
              </div>
            </div>

            <div className="space-y-2">
              {properties.map((property) => (
                <PropertyListItem
                  key={property.id}
                  property={property as unknown as PropertyListItemData}
                  onSelect={() => openPropertySheet(property)}
                  showStatus
                  actions={
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem className="rounded-lg" onClick={(e) => { e.stopPropagation(); openPropertySheet(property) }}>
                          <Building2 className="mr-2 h-3.5 w-3.5" />
                          Ver Detalhe
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive rounded-lg" onClick={(e) => { e.stopPropagation(); setDeleteId(property.id) }}>
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  }
                />
              ))}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="inline-flex items-center justify-center h-8 w-8 rounded-full border bg-card shadow-sm disabled:opacity-40 hover:bg-muted transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-muted-foreground">Página {page + 1} de {totalPages}</span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="inline-flex items-center justify-center h-8 w-8 rounded-full border bg-card shadow-sm disabled:opacity-40 hover:bg-muted transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {properties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                onClick={() => openPropertySheet(property)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="inline-flex items-center justify-center h-8 w-8 rounded-full border bg-card shadow-sm disabled:opacity-40 hover:bg-muted transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-muted-foreground">Página {page + 1} de {totalPages}</span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="inline-flex items-center justify-center h-8 w-8 rounded-full border bg-card shadow-sm disabled:opacity-40 hover:bg-muted transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-destructive" />Eliminar imóvel</AlertDialogTitle>
            <AlertDialogDescription>
              Escolha uma opção. Cancelar marca o imóvel como cancelado mas mantém os dados. Eliminar permanentemente remove todos os dados associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="rounded-full">Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="rounded-full bg-amber-600 text-white hover:bg-amber-700">
              Cancelar Imóvel
            </AlertDialogAction>
            <AlertDialogAction onClick={handleDeletePermanent} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CsvExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        endpoint="/api/export/properties"
        title="Imóveis"
      />

      <PropertyDetailSheet
        propertyId={detailPropertyId}
        open={!!detailPropertyId}
        onOpenChange={handleSheetOpenChange}
      />
    </div>
  )
}

export default function ImoveisPage() {
  return (
    <Suspense fallback={null}>
      <ImoveisPageInner />
    </Suspense>
  )
}

