'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { PropertyFilters } from '@/components/properties/property-filters'
import { PropertyCard } from '@/components/properties/property-card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  RotateCcw,
} from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'
import { formatCurrency, formatDate, PROPERTY_TYPES, PROPERTY_STATUS } from '@/lib/constants'
import { toast } from 'sonner'
import type { PropertyWithRelations } from '@/types/property'

const PAGE_SIZE = 20
const ALL_STATUS_KEYS = Object.keys(PROPERTY_STATUS)
const DEFAULT_STATUSES = ALL_STATUS_KEYS.filter(
  (k) => k !== 'pending_approval' && k !== 'in_process'
)

export default function ImoveisPage() {
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
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: 8 }).map((_, i) => (
                <TableHead key={i}><Skeleton className="h-4 w-16" /></TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4, 5].map((i) => (
              <TableRow key={i}>
                {Array.from({ length: 8 }).map((_, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function ImoveisPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [properties, setProperties] = useState<PropertyWithRelations[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [consultants, setConsultants] = useState<{ id: string; commercial_name: string }[]>([])
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [sortBy, setSortBy] = useState<string>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Filtros
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(DEFAULT_STATUSES)
  const [propertyType, setPropertyType] = useState(searchParams.get('property_type') || 'all')
  const [businessType, setBusinessType] = useState(searchParams.get('business_type') || 'all')
  const [condition, setCondition] = useState(searchParams.get('property_condition') || 'all')
  const [consultantId, setConsultantId] = useState(searchParams.get('consultant_id') || 'all')
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

  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, selectedStatuses, propertyType, businessType, condition, consultantId])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/properties/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao eliminar imóvel')
      toast.success('Imóvel eliminado com sucesso')
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

  const getCoverUrl = (property: PropertyWithRelations) => {
    const cover = property.dev_property_media?.find((m) => m.is_cover)
      || property.dev_property_media?.[0]
    return cover?.url
  }

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Imóveis</h1>
          <p className="text-muted-foreground">Gestão de imóveis</p>
        </div>
        <Button onClick={() => router.push('/dashboard/imoveis/novo')}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Imóvel
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1">
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
          />
        </div>
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-r-none"
            onClick={() => setViewMode('table')}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-l-none"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        viewMode === 'table' ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]" />
                  <TableHead><SortableColumnHeader column="title" label="Título" /></TableHead>
                  <TableHead><SortableColumnHeader column="external_ref" label="Ref. Externa" /></TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead><SortableColumnHeader column="listing_price" label="Preço" /></TableHead>
                  <TableHead><SortableColumnHeader column="status" label="Estado" /></TableHead>
                  <TableHead>Consultor</TableHead>
                  <TableHead><SortableColumnHeader column="created_at" label="Data" /></TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]" />
                  <TableHead><SortableColumnHeader column="title" label="Título" /></TableHead>
                  <TableHead><SortableColumnHeader column="external_ref" label="Ref. Externa" /></TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead><SortableColumnHeader column="listing_price" label="Preço" /></TableHead>
                  <TableHead><SortableColumnHeader column="status" label="Estado" /></TableHead>
                  <TableHead>Consultor</TableHead>
                  <TableHead><SortableColumnHeader column="created_at" label="Data" /></TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.map((property) => (
                  <TableRow
                    key={property.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/dashboard/imoveis/${property.id}`)}
                  >
                    <TableCell>
                      {getCoverUrl(property) ? (
                        <div className="relative h-10 w-10 rounded overflow-hidden bg-muted shrink-0">
                          <Image
                            src={getCoverUrl(property)!}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {property.title}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">
                      {property.external_ref || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {PROPERTY_TYPES[property.property_type as keyof typeof PROPERTY_TYPES] || property.property_type || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {property.city || '—'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(property.listing_price)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={property.status || 'pending_approval'} type="property" />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {property.consultant?.commercial_name || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(property.created_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/dashboard/imoveis/${property.id}/editar`)
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteId(property.id)
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {total} imóve{total !== 1 ? 'is' : 'l'} encontrado{total !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {page + 1} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
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
                onClick={() => router.push(`/dashboard/imoveis/${property.id}`)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {total} imóve{total !== 1 ? 'is' : 'l'} encontrado{total !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {page + 1} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar imóvel</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar este imóvel? O imóvel será marcado como cancelado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
