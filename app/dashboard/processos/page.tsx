'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
import { FileText, FileEdit, Plus, Search, Building2, MapPin, MoreVertical, Trash2, Loader2, X, CheckSquare } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { BUSINESS_TYPES, PROPERTY_TYPES, PROCESS_STATUS } from '@/lib/constants'
import { useDebounce } from '@/hooks/use-debounce'
import { toast } from 'sonner'
import { AcquisitionDialog } from '@/components/acquisitions/acquisition-dialog'

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [processToDelete, setProcessToDelete] = useState<any>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [draftDialogOpen, setDraftDialogOpen] = useState(false)
  const [resumeDraftId, setResumeDraftId] = useState<string | undefined>()
  const [selectionMode, setSelectionMode] = useState(false)
  const suppressClickUntilRef = useRef(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const debouncedSearch = useDebounce(search, 300)

  const loadProcesses = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (statusFilter) params.set('status', statusFilter)

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
  }, [debouncedSearch, statusFilter])

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
  }, [debouncedSearch, statusFilter])

  useEffect(() => {
    loadProcesses()
  }, [loadProcesses])

  // Count processes by status (from unfiltered data when no status filter, otherwise show current)
  const statusCounts = processes.reduce((acc: Record<string, number>, proc: any) => {
    acc[proc.current_status] = (acc[proc.current_status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Processos</h1>
          <p className="text-muted-foreground">
            Gestão de processos de angariação
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push('/dashboard/processos/templates')}>
            <FileText className="mr-2 h-4 w-4" />
            Gerir Templates
          </Button>
          <Button onClick={() => router.push('/dashboard/angariacao')}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Angariação
          </Button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
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
            placeholder="Pesquisar por referência, imóvel ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                  onClick: () => router.push('/dashboard/angariacao'),
                }
              : statusFilter
                ? {
                    label: 'Ver todos',
                    onClick: () => setStatusFilter(''),
                  }
                : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                            setResumeDraftId(proc.id)
                            setDraftDialogOpen(true)
                          }}
                        >
                          <FileEdit className="mr-2 h-4 w-4" />
                          Retomar rascunho
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.preventDefault()
                            router.push(`/dashboard/processos/${proc.id}`)
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
                              suppressClickUntilRef.current = Date.now() + 500
                              setTimeout(() => enterSelectionMode(proc.id), 0)
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
                          setProcessToDelete(proc)
                          setDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar processo
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                  <button type="button" onClick={handleCardClick} className="block h-full w-full text-left cursor-pointer">
                    {cardContent}
                  </button>
                ) : isDraft ? (
                  <button type="button" onClick={handleCardClick} className="block h-full w-full text-left">
                    {cardContent}
                  </button>
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
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
              {isBulkDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar {selectedIds.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
