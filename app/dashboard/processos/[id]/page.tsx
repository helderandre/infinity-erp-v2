'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
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
import {
  ArrowLeft,
  Building2,
  MapPin,
  Users,
  LayoutGrid,
  List,
  Ban,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Pause,
  Play,
  Trash2,
  Loader2,
  XCircle,
} from 'lucide-react'
import { StatusBadge } from '@/components/shared/status-badge'
import { ProcessReviewSection } from '@/components/processes/process-review-section'
import { ProcessKanbanView } from '@/components/processes/process-kanban-view'
import { ProcessListView } from '@/components/processes/process-list-view'
import { ProcessTaskAssignDialog } from '@/components/processes/process-task-assign-dialog'
import { TaskDetailSheet } from '@/components/processes/task-detail-sheet'
import { ProcessChat } from '@/components/processes/process-chat'
import { useUser } from '@/hooks/use-user'
import { formatCurrency, formatDate } from '@/lib/utils'
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from '@/lib/constants'
import { toast } from 'sonner'
import Link from 'next/link'
import type { ProcessTask, ProcessStageWithTasks } from '@/types/process'

type ViewMode = 'kanban' | 'list'

export default function ProcessoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const [process, setProcess] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')

  // Bypass dialog
  const [bypassDialogOpen, setBypassDialogOpen] = useState(false)
  const [bypassTask, setBypassTask] = useState<ProcessTask | null>(null)
  const [bypassReason, setBypassReason] = useState('')

  // Assign dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assignTask, setAssignTask] = useState<ProcessTask | null>(null)

  // Process action dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState(false)

  // Task detail sheet
  const [selectedTask, setSelectedTask] = useState<ProcessTask | null>(null)

  // Soft-delete info
  const [deletedInfo, setDeletedInfo] = useState<{
    deleted: boolean
    deleted_at: string
    deleted_by: { id: string; commercial_name: string } | null
    external_ref: string | null
  } | null>(null)

  useEffect(() => {
    loadProcess()
  }, [params.id])

  const loadProcess = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/processes/${params.id}`)

      // Processo eliminado (soft-delete) — 410 Gone
      if (response.status === 410) {
        const data = await response.json()
        setDeletedInfo(data)
        return
      }

      if (!response.ok) {
        throw new Error('Processo não encontrado')
      }
      const data = await response.json()
      setProcess(data)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao carregar processo'
      toast.error(message)
      router.push('/dashboard/processos')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprove = async (tplProcessId: string) => {
    try {
      const response = await fetch(`/api/processes/${params.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tpl_process_id: tplProcessId }),
      })

      if (!response.ok) {
        const responseText = await response.text()
        let errorMessage = 'Erro ao aprovar processo'
        if (responseText) {
          try {
            const errorData = JSON.parse(responseText)
            errorMessage = errorData.error || errorMessage
          } catch {
            errorMessage = `Erro ${response.status}: ${responseText}`
          }
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      toast.success(
        result.template_name
          ? `Processo aprovado com template "${result.template_name}"!`
          : 'Processo aprovado com sucesso!'
      )
      loadProcess()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao aprovar processo'
      toast.error(message)
    }
  }

  const handleReturn = async (reason: string) => {
    try {
      const response = await fetch(`/api/processes/${params.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao devolver processo')
      }

      toast.success('Processo devolvido com sucesso!')
      loadProcess()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao devolver processo'
      toast.error(message)
    }
  }

  const handleReject = async (reason: string) => {
    try {
      const response = await fetch(`/api/processes/${params.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao rejeitar processo')
      }

      toast.success('Processo rejeitado com sucesso!')
      loadProcess()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao rejeitar processo'
      toast.error(message)
    }
  }

  const handleTaskAction = useCallback(async (taskId: string, action: string) => {
    setIsProcessing(true)
    try {
      const response = await fetch(`/api/processes/${params.id}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao actualizar tarefa')
      }

      toast.success('Tarefa actualizada com sucesso!')
      loadProcess()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao actualizar tarefa'
      toast.error(message)
    } finally {
      setIsProcessing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const handleBypassOpen = useCallback((task: ProcessTask) => {
    setBypassTask(task)
    setBypassReason('')
    setBypassDialogOpen(true)
  }, [])

  const handleBypassSubmit = async () => {
    if (!bypassTask || bypassReason.length < 10) return

    setIsProcessing(true)
    try {
      const response = await fetch(
        `/api/processes/${params.id}/tasks/${bypassTask.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'bypass', bypass_reason: bypassReason }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao dispensar tarefa')
      }

      toast.success('Tarefa dispensada com sucesso!')
      setBypassDialogOpen(false)
      setBypassTask(null)
      setBypassReason('')
      loadProcess()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao dispensar tarefa'
      toast.error(message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleHold = async (action: 'pause' | 'resume') => {
    setIsActionLoading(true)
    try {
      const res = await fetch(`/api/processes/${params.id}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || `Erro ao ${action === 'pause' ? 'pausar' : 'retomar'} processo`)
      }
      toast.success(action === 'pause' ? 'Processo pausado' : 'Processo retomado')
      loadProcess()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro na operação'
      toast.error(message)
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleCancelProcess = async () => {
    setIsActionLoading(true)
    try {
      const res = await fetch(`/api/processes/${params.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelado pelo utilizador' }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Erro ao cancelar processo')
      }
      toast.success('Processo cancelado')
      setCancelDialogOpen(false)
      loadProcess()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao cancelar'
      toast.error(message)
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleDeleteProcess = async () => {
    setIsActionLoading(true)
    try {
      const res = await fetch(`/api/processes/${params.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Erro ao eliminar processo')
      }
      toast.success('Processo eliminado com sucesso')
      router.push('/dashboard/processos')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao eliminar'
      toast.error(message)
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleAssignOpen = useCallback((task: ProcessTask) => {
    setAssignTask(task)
    setAssignDialogOpen(true)
  }, [])

  const handleTaskClick = useCallback((task: ProcessTask) => {
    setSelectedTask(task)
  }, [])

  // Sincronizar selectedTask com dados actualizados do processo
  useEffect(() => {
    if (selectedTask && process?.stages) {
      const allTasks: ProcessTask[] = process.stages.flatMap(
        (s: ProcessStageWithTasks) => s.tasks
      )
      const updated = allTasks.find((t: ProcessTask) => t.id === selectedTask.id)
      if (updated) {
        setSelectedTask(updated)
      } else {
        setSelectedTask(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [process?.stages])

  // Deep-link: abrir tarefa via ?task=<taskId> (apenas na primeira carga)
  const deepLinkHandled = useRef(false)
  useEffect(() => {
    const taskParam = searchParams.get('task')
    if (taskParam && process?.stages && !deepLinkHandled.current) {
      const allTasks: ProcessTask[] = process.stages.flatMap(
        (s: ProcessStageWithTasks) => s.tasks
      )
      const target = allTasks.find((t: ProcessTask) => t.id === taskParam)
      if (target) {
        setSelectedTask(target)
        deepLinkHandled.current = true
      }
    }
  }, [searchParams, process?.stages])

  // Compute stats and filtered stages
  const { filteredStages, totalTasks, completedTasks, overdueTasks, assignees } = useMemo(() => {
    if (!process?.stages) {
      return { filteredStages: [], totalTasks: 0, completedTasks: 0, overdueTasks: 0, assignees: [] as { id: string; name: string }[] }
    }

    const allTasks: ProcessTask[] = process.stages.flatMap((s: ProcessStageWithTasks) => s.tasks)

    let total = 0
    let completed = 0
    let overdue = 0
    const assigneeMap = new Map<string, string>()

    for (const t of allTasks) {
      total++
      if (t.status === 'completed' || t.status === 'skipped') completed++
      if (t.due_date && new Date(t.due_date) < new Date() && !['completed', 'skipped'].includes(t.status ?? '')) {
        overdue++
      }
      if (t.assigned_to_user) {
        assigneeMap.set(t.assigned_to_user.id, t.assigned_to_user.commercial_name)
      }
    }

    const assigneeList = Array.from(assigneeMap.entries()).map(([id, name]) => ({ id, name }))

    // Apply filters to each stage
    const filtered: ProcessStageWithTasks[] = process.stages.map((stage: ProcessStageWithTasks) => {
      const tasks = stage.tasks.filter((t: ProcessTask) => {
        if (filterStatus !== 'all' && t.status !== filterStatus) return false
        if (filterPriority !== 'all' && (t.priority ?? 'normal') !== filterPriority) return false
        if (filterAssignee !== 'all' && t.assigned_to_user?.id !== filterAssignee) return false
        return true
      })

      return {
        ...stage,
        tasks,
        tasks_total: stage.tasks_total,
        tasks_completed: stage.tasks_completed,
      }
    }).filter((s: ProcessStageWithTasks) => s.tasks.length > 0)

    return { filteredStages: filtered, totalTasks: total, completedTasks: completed, overdueTasks: overdue, assignees: assigneeList }
  }, [process?.stages, filterStatus, filterPriority, filterAssignee])

  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // Processo eliminado (soft-delete) — mostrar mensagem informativa
  if (deletedInfo) {
    const deletedDate = deletedInfo.deleted_at
      ? formatDate(deletedInfo.deleted_at)
      : 'data desconhecida'
    const deletedByName = deletedInfo.deleted_by?.commercial_name || 'utilizador desconhecido'

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/processos">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-muted-foreground">
            {deletedInfo.external_ref || 'Processo'}
          </h1>
        </div>

        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-destructive/10 p-4 mb-4">
              <Trash2 className="h-10 w-10 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Processo Eliminado</h2>
            <p className="text-muted-foreground max-w-md">
              Este processo foi eliminado em{' '}
              <strong>{deletedDate}</strong> por{' '}
              <strong>{deletedByName}</strong>.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Os dados deste processo já não estão disponíveis para consulta.
            </p>
            <Link href="/dashboard/processos" className="mt-6">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar aos Processos
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!process) {
    return null
  }

  const { instance, stages, owners, documents } = process
  const property = instance.property
  const isActive = ['active', 'on_hold', 'completed'].includes(instance.current_status)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/processos">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{instance.external_ref}</h1>
            <StatusBadge status={instance.current_status} type="process" />
          </div>
          <p className="text-muted-foreground">{property?.title}</p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {instance.current_status === 'active' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleHold('pause')}
              disabled={isActionLoading}
            >
              {isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pause className="mr-2 h-4 w-4" />}
              Pausar
            </Button>
          )}
          {instance.current_status === 'on_hold' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleHold('resume')}
              disabled={isActionLoading}
            >
              {isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Retomar
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {['active', 'on_hold'].includes(instance.current_status) && (
                <>
                  <DropdownMenuItem onClick={() => setCancelDialogOpen(true)}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancelar processo
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar processo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Review Section (pending_approval / returned) */}
      {['pending_approval', 'returned'].includes(instance.current_status) && (
        <ProcessReviewSection
          process={instance}
          property={property}
          owners={owners}
          documents={documents}
          onApprove={handleApprove}
          onReturn={handleReturn}
          onReject={handleReject}
        />
      )}

      {/* Active process: progress bar + filters + views */}
      {isActive && stages && stages.length > 0 && (
        <>
          {/* Global progress card */}
          <Card>
            <CardContent className="px-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Progresso Global</span>
                <span className="text-sm font-bold tabular-nums">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  {completedTasks} concluídas
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  {totalTasks - completedTasks} pendentes
                </span>
                {overdueTasks > 0 && (
                  <span className="flex items-center gap-1 text-red-500">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {overdueTasks} em atraso
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Filters + view toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                {Object.entries(TASK_STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as prioridades</SelectItem>
                {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {assignees.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="ml-auto">
              <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as ViewMode)} variant="outline" size="sm">
                <ToggleGroupItem value="kanban" aria-label="Vista Kanban">
                  <LayoutGrid className="h-4 w-4" />
                  Kanban
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="Vista Lista">
                  <List className="h-4 w-4" />
                  Lista
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          {/* Views */}
          {viewMode === 'kanban' ? (
            <ProcessKanbanView
              stages={filteredStages}
              isProcessing={isProcessing}
              onTaskAction={handleTaskAction}
              onTaskBypass={handleBypassOpen}
              onTaskAssign={handleAssignOpen}
              onTaskClick={handleTaskClick}
            />
          ) : (
            <ProcessListView
              stages={filteredStages}
              isProcessing={isProcessing}
              onTaskAction={handleTaskAction}
              onTaskBypass={handleBypassOpen}
              onTaskAssign={handleAssignOpen}
              onTaskClick={handleTaskClick}
            />
          )}
        </>
      )}

      {/* Info cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Imóvel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tipo</span>
              <span className="font-medium">{property?.property_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Preço</span>
              <span className="font-medium">
                {property?.listing_price ? formatCurrency(property.listing_price) : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estado</span>
              <StatusBadge status={property?.status} type="property" showDot={false} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Localização
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cidade</span>
              <span className="font-medium">{property?.city || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Criado</span>
              <span className="font-medium">{formatDate(instance.created_at)}</span>
            </div>
            {instance.approved_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aprovado</span>
                <span className="font-medium">{formatDate(instance.approved_at)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Owners */}
      {owners && owners.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Proprietários ({owners.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {owners.map((owner: { id: string; name: string; nif?: string | null; person_type: string; ownership_percentage: number; is_main_contact: boolean }) => (
                <div
                  key={owner.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium">{owner.name}</p>
                    <p className="text-xs text-muted-foreground">
                      NIF: {owner.nif || '—'} • {owner.person_type === 'singular' ? 'Pessoa Singular' : 'Pessoa Colectiva'}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <div>{owner.ownership_percentage}%</div>
                    {owner.is_main_contact && (
                      <div className="text-xs text-primary">Contacto Principal</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chat do Processo */}
      {isActive && user && (
        <Card className="overflow-hidden py-0">
          <div className="h-[500px]">
            <ProcessChat
              processId={instance.id}
              currentUser={{
                id: user.id,
                name: user.commercial_name || 'Utilizador',
              }}
            />
          </div>
        </Card>
      )}

      {/* Task Detail Sheet */}
      <TaskDetailSheet
        task={selectedTask}
        processId={instance.id}
        propertyId={instance.property_id}
        processDocuments={documents}
        owners={owners}
        open={selectedTask !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTask(null)
            // Limpar ?task= da URL para evitar reabertura
            const taskParam = searchParams.get('task')
            if (taskParam) {
              const url = new URL(window.location.href)
              url.searchParams.delete('task')
              router.replace(url.pathname + url.search, { scroll: false })
              deepLinkHandled.current = false
            }
          }
        }}
        onTaskUpdate={loadProcess}
      />

      {/* Bypass Dialog */}
      <Dialog open={bypassDialogOpen} onOpenChange={setBypassDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispensar Tarefa</DialogTitle>
            <DialogDescription>
              Indique o motivo para dispensar esta tarefa (mínimo 10 caracteres)
            </DialogDescription>
          </DialogHeader>
          {bypassTask && (
            <div className="py-2">
              <p className="text-sm font-medium">{bypassTask.title}</p>
            </div>
          )}
          <Textarea
            placeholder="Ex: Documento não aplicável a este tipo de imóvel..."
            value={bypassReason}
            onChange={(e) => setBypassReason(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBypassDialogOpen(false)
                setBypassReason('')
                setBypassTask(null)
              }}
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleBypassSubmit}
              disabled={isProcessing || bypassReason.length < 10}
            >
              <Ban className="mr-2 h-4 w-4" />
              Dispensar Tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      {assignTask && (
        <ProcessTaskAssignDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          taskId={assignTask.id}
          taskTitle={assignTask.title}
          processId={instance.id}
          currentAssignedTo={assignTask.assigned_to}
          onAssigned={loadProcess}
        />
      )}

      {/* Cancel Process Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar processo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende cancelar o processo{' '}
              <strong>{instance.external_ref}</strong>?
              O processo será marcado como cancelado e não poderá ser retomado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActionLoading}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelProcess}
              disabled={isActionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancelar Processo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Process Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar processo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar permanentemente o processo{' '}
              <strong>{instance.external_ref}</strong>?
              Esta acção é irreversível e irá remover todas as tarefas associadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProcess}
              disabled={isActionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
