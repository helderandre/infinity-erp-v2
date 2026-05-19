'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { FileText, FileEdit, Plus, Search, Building2, MapPin, MoreVertical, Trash2, X, CheckSquare, FileSearch, Handshake, LayoutList, LayoutGrid, List, Download, Activity } from 'lucide-react'
import { CsvExportDialog } from '@/components/shared/csv-export-dialog'
import { PriceSearchHint } from '@/components/shared/price-search-hint'
import { Spinner } from '@/components/kibo-ui/spinner'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { peekPrefill, clearPrefill } from '@/lib/voice/prefill'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { BUSINESS_TYPES, PROPERTY_TYPES, PROCESS_STATUS } from '@/lib/constants'
import { useDebounce } from '@/hooks/use-debounce'
import { useUser } from '@/hooks/use-user'
import { isManagementRole } from '@/lib/auth/roles'
import { toast } from 'sonner'
import { AcquisitionDialog } from '@/components/acquisitions/acquisition-dialog'
import { DealDialog } from '@/components/deals/deal-dialog'

function ProcessDropdownMenu({ isDraft, canDelete, selectionMode, onResumeDraft, onViewDetails, onSelectMultiple, onDelete }: {
  isDraft: boolean
  /** Política: consultor só pode eliminar os seus rascunhos; management pode
   *  eliminar tudo. Resolvido pelo caller; aqui apenas escondemos o item. */
  canDelete: boolean
  selectionMode: boolean
  onResumeDraft: () => void
  onViewDetails: () => void
  onSelectMultiple: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          onClick={(e) => e.preventDefault()}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isDraft ? (
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault()
              onResumeDraft()
            }}
          >
            <FileEdit className="mr-2 h-4 w-4" />
            Retomar rascunho
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault()
              onViewDetails()
            }}
          >
            Ver detalhes
          </DropdownMenuItem>
        )}
        {!selectionMode && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                onSelectMultiple()
              }}
            >
              <CheckSquare className="mr-2 h-4 w-4" />
              Seleccionar múltiplos
            </DropdownMenuItem>
          </>
        )}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => {
                e.preventDefault()
                onDelete()
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isDraft ? 'Eliminar rascunho' : 'Eliminar processo'}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Estados considerados "a decorrer" — tudo o que está vivo, excluindo
 *  terminais (concluído, rejeitado, cancelado) e pausados. */
const ACTIVE_SET = 'draft,pending_approval,returned,active'

const STATUS_TABS = [
  { value: ACTIVE_SET, label: 'A decorrer' },
  { value: '', label: 'Todos' },
  { value: 'draft', label: 'Rascunhos' },
  { value: 'pending_approval', label: 'Pendentes' },
  { value: 'returned', label: 'Devolvidos' },
  { value: 'active', label: 'Em Andamento' },
  { value: 'on_hold', label: 'Pausados' },
  { value: 'completed', label: 'Concluídos' },
  { value: 'rejected', label: 'Rejeitados' },
  { value: 'cancelled', label: 'Cancelados' },
] as const

export default function ProcessosPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const priceMin = searchParams.get('price_min')
  const priceMax = searchParams.get('price_max')
  const priceMinNum = priceMin ? Number(priceMin) : null
  const priceMaxNum = priceMax ? Number(priceMax) : null
  const hasPriceFilter = (priceMinNum !== null && Number.isFinite(priceMinNum)) || (priceMaxNum !== null && Number.isFinite(priceMaxNum))
  // Página índice acessível a todos com permissão `processes`. A API filtra
  // server-side para mostrar apenas os processos do próprio consultor
  // (gestão vê todos).
  const { user } = useUser()
  // Política: consultor só pode eliminar os SEUS PRÓPRIOS rascunhos.
  // Management (broker/CEO/Gestor Processual/Office Manager/Team Leader)
  // pode eliminar qualquer processo. Resolvido aqui e propagado aos cards.
  const isManagement = isManagementRole(user?.role_names ?? [])
  const [processes, setProcesses] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>(ACTIVE_SET)
  const [activeType, setActiveType] = useState<string>('all')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [processToDelete, setProcessToDelete] = useState<any>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [draftDialogOpen, setDraftDialogOpen] = useState(false)
  const [resumeDraftId, setResumeDraftId] = useState<string | undefined>()
  const [showFechoDialog, setShowFechoDialog] = useState(false)
  // Voice-seeded prefill: populated once on mount from the `?new=...` query
  // param + the voice module-level cache. Consumed by the respective dialog.
  const [voiceAcquisitionPrefill, setVoiceAcquisitionPrefill] = useState<Record<string, unknown> | undefined>(() =>
    peekPrefill('acquisition') ?? undefined
  )
  const [exportOpen, setExportOpen] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const suppressClickUntilRef = useRef(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const debouncedSearch = useDebounce(search, 300)

  const loadProcesses = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      // Status filter is applied client-side so the per-tab counts (Todos /
      // Rascunhos / Em Andamento / etc.) reflect the actual numbers instead
      // of being bounded by the active filter. Search + type are still
      // server-side because they reduce the dataset.
      if (activeType !== 'all') params.set('process_type', activeType)

      const res = await fetch(`/api/processes?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar processos')

      const data = await res.json()
      setProcesses(data)
    } catch (error) {
      console.error('Erro ao carregar processos:', error)
      setProcesses([])
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, activeType])

  const handleDeleteProcess = async () => {
    if (!processToDelete) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/processes/${processToDelete.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Erro ao eliminar processo')
      }
      toast.success('Processo eliminado com sucesso')
      setDeleteDialogOpen(false)
      setProcessToDelete(null)
      loadProcesses()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao eliminar processo'
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    // Só seleccionamos linhas visíveis (após status filter) que o utilizador
    // pode efectivamente eliminar. Para gestão isto inclui tudo; para
    // consultor, só os seus rascunhos.
    const deletableIds = filteredProcesses
      .filter(
        (p) =>
          isManagement || (p.current_status === 'draft' && p.requested_by === user?.id)
      )
      .map((p) => p.id)
    if (selectedIds.size === deletableIds.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(deletableIds))
    }
  }

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true)
    try {
      const ids = Array.from(selectedIds)
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(`/api/processes/${id}`, { method: 'DELETE' }).then((res) => {
            if (!res.ok) throw new Error(`Falha ao eliminar ${id}`)
            return id
          })
        )
      )
      const succeeded = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length
      if (failed > 0) {
        toast.warning(`${succeeded} eliminado(s), ${failed} falharam`)
      } else {
        toast.success(`${succeeded} processo(s) eliminado(s) com sucesso`)
      }
      exitSelectionMode()
      setBulkDeleteDialogOpen(false)
      loadProcesses()
    } catch {
      toast.error('Erro ao eliminar processos')
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const exitSelectionMode = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  const enterSelectionMode = (initialId?: string) => {
    setSelectionMode(true)
    if (initialId) {
      setSelectedIds(new Set([initialId]))
    }
  }

  // Clear selection when filters change
  useEffect(() => {
    exitSelectionMode()
  }, [debouncedSearch, statusFilter, activeType])

  useEffect(() => {
    loadProcesses()
  }, [loadProcesses])

  // Open the angariação/fecho dialog on mount if the voice assistant
  // routed us here via `?new=angariacao`, `?new=fecho`, or `?resume=<procId>`.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const mode = params.get('new')
    const resumeId = params.get('resume')

    if (resumeId) {
      setResumeDraftId(resumeId)
      setDraftDialogOpen(true)
    } else if (mode === 'angariacao') {
      setResumeDraftId(undefined)
      setDraftDialogOpen(true)
    } else if (mode === 'fecho') {
      setShowFechoDialog(true)
    }

    clearPrefill('acquisition')
    clearPrefill('fecho')

    if (mode || resumeId) {
      const url = new URL(window.location.href)
      url.searchParams.delete('new')
      url.searchParams.delete('resume')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  // Counts come from the FULL fetched set so per-tab numbers (Todos /
  // Rascunhos / Em Andamento / ...) stay accurate even when a filter is
  // narrowing the visible list.
  const statusCounts = processes.reduce((acc: Record<string, number>, proc: any) => {
    acc[proc.current_status] = (acc[proc.current_status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Client-side status + price filter applied on top of the fetched set. A
  // CSV status value (e.g. ACTIVE_SET) matches any of its members. Price
  // filter compares against the related property's listing_price.
  const filteredProcesses = useMemo(() => {
    let rows = processes
    if (statusFilter) {
      const allowed = new Set(statusFilter.split(',').map((s) => s.trim()).filter(Boolean))
      rows = rows.filter((p: any) => allowed.has(p.current_status))
    }
    if (priceMinNum !== null && Number.isFinite(priceMinNum)) {
      rows = rows.filter((p: any) => {
        const price = Number(p.dev_properties?.listing_price)
        return Number.isFinite(price) && price >= priceMinNum
      })
    }
    if (priceMaxNum !== null && Number.isFinite(priceMaxNum)) {
      rows = rows.filter((p: any) => {
        const price = Number(p.dev_properties?.listing_price)
        return Number.isFinite(price) && price <= priceMaxNum
      })
    }
    return rows
  }, [processes, statusFilter, priceMinNum, priceMaxNum])

  const clearPriceFilter = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('price_min')
    next.delete('price_max')
    const q = next.toString()
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
  }, [router, pathname, searchParams])

  const applyPriceFilter = useCallback((key: 'price_min' | 'price_max', value: number) => {
    const next = new URLSearchParams(searchParams.toString())
    next.set(key, String(value))
    // Apply only one bound at a time — clearing the other so a user that
    // types a new price gets a fresh single-bound filter, not an AND of two.
    next.delete(key === 'price_min' ? 'price_max' : 'price_min')
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    setSearch('')
  }, [router, pathname, searchParams])

  const TYPE_PILLS = [
    { key: 'all', label: 'Todos', icon: LayoutList },
    { key: 'angariacao', label: 'Angariações', icon: FileSearch },
    { key: 'negocio', label: 'Negócios', icon: Handshake },
  ] as const

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* ═══ Hero header ═══ */}
      <div className="relative overflow-hidden rounded-2xl bg-neutral-900 px-6 sm:px-8 py-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Processos</h1>
            <p className="text-neutral-400 text-sm">
              {filteredProcesses.length} processo{filteredProcesses.length !== 1 ? 's' : ''}
            </p>
            {hasPriceFilter && (
              <button
                type="button"
                onClick={clearPriceFilter}
                className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 transition-colors px-2.5 py-1 text-[11px] text-white/90 border border-white/15"
                aria-label="Limpar filtro de preço"
              >
                <span>
                  Preço{' '}
                  {priceMinNum !== null && Number.isFinite(priceMinNum)
                    ? `desde ${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(priceMinNum)}`
                    : null}
                  {priceMinNum !== null && priceMaxNum !== null ? ' ' : null}
                  {priceMaxNum !== null && Number.isFinite(priceMaxNum)
                    ? `até ${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(priceMaxNum)}`
                    : null}
                </span>
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle — desktop only */}
            <div className="hidden sm:flex items-center gap-0.5 p-0.5 rounded-full bg-white/10 border border-white/15">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'inline-flex items-center justify-center h-7 w-7 rounded-full transition-all',
                  viewMode === 'list' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400 hover:text-white',
                )}
                title="Vista de lista"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'inline-flex items-center justify-center h-7 w-7 rounded-full transition-all',
                  viewMode === 'grid' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400 hover:text-white',
                )}
                title="Vista de grelha"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              onClick={() => { if (selectionMode) exitSelectionMode(); else setSelectionMode(true) }}
              className={cn(
                'inline-flex items-center gap-1.5 backdrop-blur-sm border px-3 py-2 rounded-full text-xs font-medium transition-colors',
                selectionMode
                  ? 'bg-white text-neutral-900 border-white shadow-sm'
                  : 'bg-white/15 text-white border-white/20 hover:bg-white/25',
              )}
              title={selectionMode ? 'Sair da selecção' : 'Seleccionar processos'}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{selectionMode ? 'Sair' : 'Seleccionar'}</span>
            </button>
            <button
              onClick={() => setExportOpen(true)}
              className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white border border-white/20 px-3 py-2 rounded-full text-xs font-medium hover:bg-white/25 transition-colors"
              title="Exportar para CSV"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
            <button
              onClick={() => setShowFechoDialog(true)}
              className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white border border-white/20 px-3 py-2 rounded-full text-xs font-medium hover:bg-white/25 transition-colors"
              title="Novo fecho de negócio"
            >
              <Handshake className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Novo Fecho</span>
            </button>
            <button
              onClick={() => { setResumeDraftId(undefined); setDraftDialogOpen(true) }}
              className="inline-flex items-center gap-1.5 bg-white text-neutral-900 px-4 py-2 rounded-full text-xs font-semibold hover:bg-neutral-100 transition-colors shadow-sm"
              title="Nova angariação"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nova Angariação</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Quick toolbar — search + type pills ═══ */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por referência, imóvel ou preço..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-full"
          />
          <div className="absolute left-3 top-full mt-1.5 z-10">
            <PriceSearchHint
              query={search}
              onApplyMax={(p) => applyPriceFilter('price_max', p)}
              onApplyMin={(p) => applyPriceFilter('price_min', p)}
            />
          </div>
        </div>
        {TYPE_PILLS.map((pill) => {
          const Icon = pill.icon
          const isActive = activeType === pill.key
          return (
            <Button
              key={pill.key}
              size="sm"
              variant={isActive ? 'default' : 'outline'}
              onClick={() => setActiveType(pill.key)}
              className={cn(
                'h-9 rounded-full text-xs gap-1.5 shrink-0',
                isActive && 'bg-foreground text-background',
              )}
              aria-pressed={isActive}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{pill.label}</span>
            </Button>
          )
        })}
      </div>

      {/* ═══ Status filter pills (horizontal scroll) ═══ */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {STATUS_TABS.map((tab) => {
          const isActive = statusFilter === tab.value
          // For comma-bundled values (e.g. "A decorrer"), count is the sum of
          // member statuses. For single values, count is statusCounts[value].
          const isBundle = tab.value.includes(',')
          const count = !tab.value
            ? processes.length
            : isBundle
              ? tab.value.split(',').reduce((acc, s) => acc + (statusCounts[s] || 0), 0)
              : statusCounts[tab.value] || 0
          // Bundles and "Todos" share the neutral foreground styling; specific
          // statuses use their own colour from PROCESS_STATUS.
          const statusConfig = tab.value && !isBundle
            ? (PROCESS_STATUS as Record<string, { bg: string; text: string }>)[tab.value]
            : null
          const Icon = isBundle ? Activity : null

          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0',
                isActive
                  ? statusConfig
                    ? `${statusConfig.bg} ${statusConfig.text}`
                    : 'bg-foreground text-background'
                  : 'border border-border text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {tab.label}
              {count > 0 && (
                <span
                  className={cn(
                    'ml-0.5 inline-flex items-center justify-center rounded-full px-1.5 min-w-[20px] h-5 text-[10px] font-semibold tabular-nums',
                    isActive
                      ? statusConfig
                        ? 'bg-background/30'
                        : 'bg-background/20 text-background'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ═══ Selection bar ═══ */}
      {selectionMode && (
        <div className="flex items-center gap-2 flex-wrap rounded-2xl border border-border/60 bg-card/50 supports-[backdrop-filter]:bg-card/40 backdrop-blur-sm shadow-sm px-3 py-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2 mr-auto">
            <span className="inline-flex items-center justify-center h-6 min-w-[1.5rem] rounded-full bg-primary/10 text-primary text-[11px] font-semibold px-2 tabular-nums">
              {selectedIds.size}
            </span>
            <span className="text-sm font-medium">
              seleccionado{selectedIds.size !== 1 ? 's' : ''}
            </span>
            <span className="h-4 w-px bg-border/60 mx-0.5" />
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {selectedIds.size === filteredProcesses.length
                ? 'Desmarcar tudo'
                : `Seleccionar tudo (${filteredProcesses.length})`}
            </button>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={selectedIds.size === 0}
              onClick={() => setBulkDeleteDialogOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </Button>
            <span className="h-5 w-px bg-border/60 mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={exitSelectionMode}
              title="Sair da selecção"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        viewMode === 'list' ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Referência</TableHead>
                  <TableHead>Imóvel</TableHead>
                  <TableHead className="w-[140px]">Estado</TableHead>
                  <TableHead className="w-[100px] hidden md:table-cell">Progresso</TableHead>
                  <TableHead className="w-[120px] hidden lg:table-cell">Consultor</TableHead>
                  <TableHead className="w-[120px] text-right hidden md:table-cell">Preço</TableHead>
                  <TableHead className="w-[100px] hidden lg:table-cell">Data</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-2 w-full" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-6" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : filteredProcesses.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum processo encontrado"
          description={
            search || statusFilter
              ? 'Tente ajustar os critérios de pesquisa ou filtro'
              : 'Crie a sua primeira angariação para começar'
          }
          action={
            !search && !statusFilter
              ? {
                  label: 'Nova Angariação',
                  onClick: () => { setResumeDraftId(undefined); setDraftDialogOpen(true) },
                }
              : statusFilter
                ? {
                    label: 'Ver todos',
                    onClick: () => setStatusFilter(''),
                  }
                : undefined
          }
        />
      ) : viewMode === 'list' ? (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {selectionMode && (
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedIds.size === filteredProcesses.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead className="w-[180px]">Referência</TableHead>
                <TableHead>Imóvel</TableHead>
                <TableHead className="w-[140px]">Estado</TableHead>
                <TableHead className="w-[100px] hidden md:table-cell">Progresso</TableHead>
                <TableHead className="w-[120px] hidden lg:table-cell">Consultor</TableHead>
                <TableHead className="w-[120px] text-right hidden md:table-cell">Preço</TableHead>
                <TableHead className="w-[100px] hidden lg:table-cell">Data</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProcesses.map((proc) => {
                const isDraft = proc.current_status === 'draft'
                const isSelected = selectedIds.has(proc.id)
                const canDeleteRow =
                  isManagement || (isDraft && proc.requested_by === user?.id)

                const handleRowClick = () => {
                  if (Date.now() < suppressClickUntilRef.current) return
                  if (selectionMode) {
                    if (!canDeleteRow) return
                    toggleSelect(proc.id)
                    return
                  }
                  if (isDraft) {
                    setResumeDraftId(proc.id)
                    setDraftDialogOpen(true)
                  } else {
                    router.push(`/dashboard/processos/${proc.id}`)
                  }
                }

                const progressPercent = isDraft
                  ? ((proc.last_completed_step || 0) / 5) * 100
                  : proc.percent_complete

                return (
                  <TableRow
                    key={proc.id}
                    className={cn(
                      'cursor-pointer transition-colors',
                      isSelected && 'bg-primary/5'
                    )}
                    onClick={handleRowClick}
                  >
                    {selectionMode && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          disabled={!canDeleteRow}
                          onCheckedChange={() => {
                            if (canDeleteRow) toggleSelect(proc.id)
                          }}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <span className="font-mono text-sm font-medium">
                        {proc.external_ref || 'Sem ref.'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {proc.dev_properties?.title || 'Imóvel sem título'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {proc.dev_properties?.property_type && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {(PROPERTY_TYPES as Record<string, string>)[proc.dev_properties.property_type] || proc.dev_properties.property_type}
                            </span>
                          )}
                          {proc.dev_properties?.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {proc.dev_properties.city}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={proc.current_status} type="process" showDot={false} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              'h-full transition-all',
                              isDraft
                                ? 'bg-violet-500'
                                : proc.percent_complete === 100
                                  ? 'bg-emerald-500'
                                  : 'bg-foreground'
                            )}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">
                          {isDraft
                            ? `${proc.last_completed_step || 0}/5`
                            : `${proc.percent_complete}%`}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {proc.requested_by_user?.commercial_name && (
                        <span className="flex items-center gap-1.5 text-sm">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={proc.requested_by_user?.avatar_url} />
                            <AvatarFallback className="text-[9px]">
                              {proc.requested_by_user.commercial_name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate max-w-[90px]">
                            {proc.requested_by_user.commercial_name}
                          </span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell">
                      {proc.dev_properties?.listing_price ? (
                        <span className="font-semibold text-sm">
                          {formatCurrency(Number(proc.dev_properties.listing_price))}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                      {proc.started_at
                        ? formatDate(proc.started_at)
                        : proc.updated_at
                          ? formatDate(proc.updated_at)
                          : '—'}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <ProcessDropdownMenu
                        isDraft={isDraft}
                        canDelete={isManagement || (isDraft && proc.requested_by === user?.id)}
                        selectionMode={selectionMode}
                        onResumeDraft={() => { setResumeDraftId(proc.id); setDraftDialogOpen(true) }}
                        onViewDetails={() => router.push(`/dashboard/processos/${proc.id}`)}
                        onSelectMultiple={() => { suppressClickUntilRef.current = Date.now() + 500; setTimeout(() => enterSelectionMode(proc.id), 0) }}
                        onDelete={() => { setProcessToDelete(proc); setDeleteDialogOpen(true) }}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredProcesses.map((proc) => {
            const isDraft = proc.current_status === 'draft'

            const handleCardClick = (e: React.MouseEvent) => {
              if (Date.now() < suppressClickUntilRef.current) {
                e.preventDefault()
                return
              }
              if (selectionMode) {
                e.preventDefault()
                toggleSelect(proc.id)
                return
              }
              if (isDraft) {
                e.preventDefault()
                setResumeDraftId(proc.id)
                setDraftDialogOpen(true)
              }
            }

            const isSelected = selectedIds.has(proc.id)

            const cardContent = (
              <>
                {/* Selection checkbox — only in selection mode */}
                {selectionMode && (
                  <div className="absolute top-3 left-3 z-10">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(proc.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-background"
                    />
                  </div>
                )}

                {/* Dropdown menu */}
                <div className="absolute top-3 right-3 z-10">
                  <ProcessDropdownMenu
                    isDraft={isDraft}
                    canDelete={isManagement || (isDraft && proc.requested_by === user?.id)}
                    selectionMode={selectionMode}
                    onResumeDraft={() => { setResumeDraftId(proc.id); setDraftDialogOpen(true) }}
                    onViewDetails={() => router.push(`/dashboard/processos/${proc.id}`)}
                    onSelectMultiple={() => { suppressClickUntilRef.current = Date.now() + 500; setTimeout(() => enterSelectionMode(proc.id), 0) }}
                    onDelete={() => { setProcessToDelete(proc); setDeleteDialogOpen(true) }}
                  />
                </div>

                <CardHeader className={cn('pb-3', selectionMode && 'pl-10')}>
                  <div className="flex items-start justify-between gap-2 pr-8">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-semibold text-foreground">
                        {proc.external_ref || 'Sem referência'}
                      </p>
                      <h3 className="text-base font-bold text-foreground tracking-tight line-clamp-1">
                        {proc.dev_properties?.title || 'Imóvel sem título'}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {proc.dev_properties?.business_type
                          ? (BUSINESS_TYPES as Record<string, string>)[proc.dev_properties.business_type] || proc.dev_properties.business_type
                          : proc.tpl_processes?.name || 'Sem template'}
                      </p>
                    </div>
                    <StatusBadge status={proc.current_status} type="process" showDot={false} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Linha de metadados */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {proc.dev_properties?.property_type && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {(PROPERTY_TYPES as Record<string, string>)[proc.dev_properties.property_type] || proc.dev_properties.property_type}
                      </span>
                    )}
                    {proc.dev_properties?.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {proc.dev_properties.city}
                      </span>
                    )}
                    {proc.requested_by_user?.commercial_name && (
                      <span className="ml-auto flex items-center gap-1.5">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={proc.requested_by_user?.avatar_url} />
                          <AvatarFallback className="text-[9px]">
                            {proc.requested_by_user.commercial_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate max-w-[120px]">
                          {proc.requested_by_user.commercial_name}
                        </span>
                      </span>
                    )}
                  </div>

                  <Separator />

                  {/* Barra de progresso */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">Progresso</span>
                      {isDraft ? (
                        <span className="text-muted-foreground">
                          Passo {proc.last_completed_step || 0} de 5
                        </span>
                      ) : proc.percent_complete === 0 ? (
                        <span className="text-muted-foreground">Não iniciado</span>
                      ) : (
                        <span className="text-foreground font-semibold">{proc.percent_complete}%</span>
                      )}
                    </div>
                    <div className="h-[3px] rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          isDraft
                            ? 'bg-violet-500'
                            : proc.percent_complete === 100
                              ? 'bg-emerald-500'
                              : 'bg-foreground'
                        }`}
                        style={{
                          width: isDraft
                            ? `${((proc.last_completed_step || 0) / 5) * 100}%`
                            : `${proc.percent_complete}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {proc.started_at
                        ? formatDate(proc.started_at)
                        : proc.updated_at
                          ? formatDate(proc.updated_at)
                          : '—'}
                    </span>
                    {proc.dev_properties?.listing_price ? (
                      <span className="text-sm font-bold text-foreground tracking-tight">
                        {formatCurrency(Number(proc.dev_properties.listing_price))}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Preço não definido</span>
                    )}
                  </div>
                </CardContent>
              </>
            )

            return (
              <Card key={proc.id} className={cn(
                'group relative h-full transition-colors hover:bg-accent/50 hover:border-border',
                isSelected && 'ring-2 ring-primary border-primary'
              )}>
                {selectionMode ? (
                  <div role="button" tabIndex={0} onClick={handleCardClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(e as unknown as React.MouseEvent) } }} className="block h-full w-full text-left cursor-pointer">
                    {cardContent}
                  </div>
                ) : isDraft ? (
                  <div role="button" tabIndex={0} onClick={handleCardClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(e as unknown as React.MouseEvent) } }} className="block h-full w-full text-left cursor-pointer">
                    {cardContent}
                  </div>
                ) : (
                  <Link href={`/dashboard/processos/${proc.id}`} className="block h-full">
                    {cardContent}
                  </Link>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Draft resume dialog */}
      <AcquisitionDialog
        open={draftDialogOpen}
        onOpenChange={(open) => {
          setDraftDialogOpen(open)
          if (!open) {
            setResumeDraftId(undefined)
            setVoiceAcquisitionPrefill(undefined)
            loadProcesses()
          }
        }}
        draftId={resumeDraftId}
        prefillData={voiceAcquisitionPrefill as any}
        onComplete={() => {
          // Não redireccionar — a confirmação é tratada dentro do
          // <AcquisitionDialog> e a gestão é notificada com link para a
          // página do processo. Aqui basta fechar e refrescar a lista.
          setDraftDialogOpen(false)
          setResumeDraftId(undefined)
          setVoiceAcquisitionPrefill(undefined)
          loadProcesses()
        }}
      />

      {/* Fecho de Negócio dialog */}
      <DealDialog
        open={showFechoDialog}
        onOpenChange={setShowFechoDialog}
        onComplete={() => {
          loadProcesses()
        }}
      />

      {/* Delete confirmation dialog (single) */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar processo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar o processo{' '}
              <strong>{processToDelete?.external_ref || ''}</strong>?
              {processToDelete?.dev_properties?.title && (
                <> ({processToDelete.dev_properties.title})</>
              )}
              <br />
              Esta acção é irreversível e irá remover todas as tarefas associadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProcess}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Spinner variant="infinite" size={16} className="mr-2" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirmation dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar {selectedIds.size} processo{selectedIds.size !== 1 ? 's' : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar {selectedIds.size} processo{selectedIds.size !== 1 ? 's' : ''}?
              <br />
              Esta acção é irreversível e irá remover todas as tarefas associadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting && <Spinner variant="infinite" size={16} className="mr-2" />}
              Eliminar {selectedIds.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <CsvExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        endpoint="/api/export/processes"
        title="Processos"
      />
    </div>
  )
}
