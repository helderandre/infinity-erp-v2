'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { PageSidebar, type PageSidebarAction } from '@/components/shared/page-sidebar'
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
import { FileText, FileEdit, Plus, Search, Building2, MapPin, MoreVertical, Trash2, X, CheckSquare, FileSearch, Handshake, LayoutList, LayoutGrid, List } from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { BUSINESS_TYPES, PROPERTY_TYPES, PROCESS_STATUS, PROCESS_TYPES } from '@/lib/constants'
import { useDebounce } from '@/hooks/use-debounce'
import { toast } from 'sonner'
import { AcquisitionDialog } from '@/components/acquisitions/acquisition-dialog'
import { DealDialog } from '@/components/deals/deal-dialog'

function ProcessDropdownMenu({ isDraft, selectionMode, onResumeDraft, onViewDetails, onSelectMultiple, onDelete }: {
  isDraft: boolean
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
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={(e) => {
            e.preventDefault()
            onDelete()
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar processo
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const STATUS_TABS = [
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
  const [processes, setProcesses] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [activeType, setActiveType] = useState<string>('all')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [processToDelete, setProcessToDelete] = useState<any>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [draftDialogOpen, setDraftDialogOpen] = useState(false)
  const [resumeDraftId, setResumeDraftId] = useState<string | undefined>()
  const [showFechoDialog, setShowFechoDialog] = useState(false)
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
      if (statusFilter) params.set('status', statusFilter)
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
  }, [debouncedSearch, statusFilter, activeType])

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
    if (selectedIds.size === processes.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(processes.map((p) => p.id)))
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

  // Count processes by status (from unfiltered data when no status filter, otherwise show current)
  const statusCounts = processes.reduce((acc: Record<string, number>, proc: any) => {
    acc[proc.current_status] = (acc[proc.current_status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const TYPE_SIDEBAR_ITEMS = [
    { key: 'all', bg: 'bg-foreground', text: 'text-background', dot: '', label: 'Todos', icon: LayoutList },
    { ...PROCESS_TYPES.angariacao, key: 'angariacao', label: 'Angariações', icon: FileSearch },
    { ...PROCESS_TYPES.negocio, key: 'negocio', label: 'Negócios', icon: Handshake },
  ]

  const sidebarActions: PageSidebarAction[] = [
    { key: 'templates', label: 'Gerir Templates', icon: FileText, onClick: () => router.push('/dashboard/processos/templates') },
    { key: 'nova', label: 'Nova Angariação', icon: Plus, onClick: () => { setResumeDraftId(undefined); setDraftDialogOpen(true) } },
    { key: 'novo-fecho', label: 'Novo Fecho', icon: Handshake, onClick: () => setShowFechoDialog(true) },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Page header — full width, border bottom */}
      <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Processos</h1>
          <p className="text-sm text-muted-foreground hidden sm:block">
            Gestão de processos documentais
          </p>
        </div>
        {/* Mobile actions */}
        <div className="flex sm:hidden items-center gap-2">
          <Button size="sm" variant="outline" className="rounded-full gap-1.5" onClick={() => { setResumeDraftId(undefined); setDraftDialogOpen(true) }}>
            <Plus className="h-3.5 w-3.5" />
            Angariação
          </Button>
          <Button size="sm" variant="outline" className="rounded-full gap-1.5" onClick={() => setShowFechoDialog(true)}>
            <Handshake className="h-3.5 w-3.5" />
            Fecho
          </Button>
        </div>
      </div>

      {/* Sidebar + Content */}
      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <div className="hidden sm:block">
          <PageSidebar
            items={TYPE_SIDEBAR_ITEMS}
            activeKey={activeType}
            onSelect={setActiveType}
            actions={sidebarActions}
          />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-4 p-4 md:p-6 overflow-y-auto">

        {/* Mobile type filter */}
        <div className="flex sm:hidden items-center gap-1.5 overflow-x-auto pb-1">
          {TYPE_SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = activeType === item.key
            return (
              <button
                key={item.key}
                onClick={() => setActiveType(item.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors shrink-0',
                  isActive
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            )
          })}
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {STATUS_TABS.map((tab) => {
          const isActive = statusFilter === tab.value
          const count = tab.value === ''
            ? processes.length
            : statusCounts[tab.value] || 0
          const statusConfig = tab.value ? (PROCESS_STATUS as Record<string, { bg: string; text: string }>)[tab.value] : null

          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
                isActive
                  ? statusConfig
                    ? `${statusConfig.bg} ${statusConfig.text}`
                    : 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {tab.label}
              {count > 0 && (
                <span className={cn(
                  'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                  isActive
                    ? statusConfig
                      ? 'bg-background/30'
                      : 'bg-background/20 text-background'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-r-none"
            onClick={() => setViewMode('list')}
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

      {/* Bulk action bar */}
      {selectionMode && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2.5">
          <Checkbox
            checked={selectedIds.size === processes.length}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm font-medium">
            {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <Button
            variant="destructive"
            size="sm"
            className="ml-auto"
            disabled={selectedIds.size === 0}
            onClick={() => setBulkDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Eliminar ({selectedIds.size})
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={exitSelectionMode}
          >
            <X className="h-4 w-4" />
          </Button>
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
      ) : processes.length === 0 ? (
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
                      checked={selectedIds.size === processes.length}
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
              {processes.map((proc) => {
                const isDraft = proc.current_status === 'draft'
                const isSelected = selectedIds.has(proc.id)

                const handleRowClick = () => {
                  if (Date.now() < suppressClickUntilRef.current) return
                  if (selectionMode) {
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
                          onCheckedChange={() => toggleSelect(proc.id)}
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
          {processes.map((proc) => {
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
            loadProcesses()
          }
        }}
        draftId={resumeDraftId}
        onComplete={(procInstanceId) => {
          setDraftDialogOpen(false)
          setResumeDraftId(undefined)
          router.push(`/dashboard/processos/${procInstanceId}`)
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
      </div>
      </div>
    </div>
  )
}
