'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
  LayoutGrid,
  List,
  Ban,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  XCircle,
  Building2,
  Users,
  Activity,
  ClipboardList,
  FileText,
  Kanban,
} from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageSidebar } from '@/components/shared/page-sidebar'
import type { PageSidebarItem } from '@/components/shared/page-sidebar'
import { ProcessReviewSection } from '@/components/processes/process-review-section'
import { ProcessReviewBento } from '@/components/processes/process-review-bento'
import { ProcessKanbanView } from '@/components/processes/process-kanban-view'
import { ProcessListView } from '@/components/processes/process-list-view'
import { ProcessTaskAssignDialog } from '@/components/processes/process-task-assign-dialog'
import { TaskDetailSheet } from '@/components/processes/task-detail-sheet'
import { FloatingChat } from '@/components/processes/floating-chat'
import { ProcessPropertyTab } from '@/components/processes/process-property-tab'
import { ProcessOwnersTab } from '@/components/processes/process-owners-tab'
import { ProcessDocumentsManager } from '@/components/processes/process-documents-manager'
import { useUser } from '@/hooks/use-user'
import { cn, formatDate } from '@/lib/utils'
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from '@/lib/constants'
import { toast } from 'sonner'
import Link from 'next/link'
import { ProcessTimelineView } from '@/components/processes/process-timeline-view'
import { useProcessActivities } from '@/hooks/use-process-activities'
import type { ProcessTask, ProcessStageWithTasks } from '@/types/process'

type ViewMode = 'kanban' | 'list' | 'timeline'

type SidebarSection = string // 'detalhes' | 'imovel' | 'pipeline' | 'proprietarios' | 'proprietarios:<id>' | 'documentos'

export default function ProcessoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const [process, setProcess] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [activeSection, setActiveSection] = useState<SidebarSection>('detalhes')

  // Process-level activities (for timeline view)
  const { activities: processActivities, isLoading: isLoadingActivities } = useProcessActivities(
    viewMode === 'timeline' && activeSection === 'pipeline' ? (params.id as string) : null
  )

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
  const [reTemplateDialogOpen, setReTemplateDialogOpen] = useState(false)
  const [reTemplateList, setReTemplateList] = useState<{ id: string; name: string; stages_count: number; tasks_count: number }[]>([])
  const [selectedNewTemplateId, setSelectedNewTemplateId] = useState('')
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
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

  const loadTemplates = async () => {
    setIsLoadingTemplates(true)
    try {
      const res = await fetch('/api/templates')
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      const active = list
        .filter((t: { is_active?: boolean }) => t.is_active)
        .map((t: { id: string; name: string; tpl_stages?: { tpl_tasks?: unknown[] }[] }) => ({
          id: t.id,
          name: t.name,
          stages_count: t.tpl_stages?.length || 0,
          tasks_count: t.tpl_stages?.reduce((acc: number, s) => acc + (s.tpl_tasks?.length || 0), 0) || 0,
        }))
      setReTemplateList(active)
    } catch {
      setReTemplateList([])
    } finally {
      setIsLoadingTemplates(false)
    }
  }

  const handleReTemplate = async () => {
    if (!selectedNewTemplateId) return
    setIsActionLoading(true)
    try {
      const res = await fetch(`/api/processes/${params.id}/re-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tpl_process_id: selectedNewTemplateId }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Erro ao alterar template')
      }

      const result = await res.json()
      toast.success(
        result.template_name
          ? `Template alterado para "${result.template_name}"!`
          : 'Template alterado com sucesso!'
      )
      setReTemplateDialogOpen(false)
      setSelectedNewTemplateId('')
      loadProcess()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao alterar template'
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

  const handleEntityClick = useCallback((entityType: string, entityId: string) => {
    if (!process?.stages) return
    const allTasks: ProcessTask[] = process.stages.flatMap(
      (s: ProcessStageWithTasks) => s.tasks
    )
    if (entityType === 'task') {
      const task = allTasks.find((t: ProcessTask) => t.id === entityId)
      if (task) setSelectedTask(task)
    } else if (entityType === 'subtask') {
      const parentTask = allTasks.find((t: ProcessTask) =>
        t.subtasks?.some((st: { id: string }) => st.id === entityId)
      )
      if (parentTask) setSelectedTask(parentTask)
    } else if (entityType === 'doc') {
      const linkedTask = allTasks.find((t: ProcessTask) => {
        const result = t.task_result as Record<string, unknown> | null
        return result?.doc_registry_id === entityId
      })
      if (linkedTask) setSelectedTask(linkedTask)
    }
  }, [process?.stages])

  // Sync selectedTask with updated process data
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

  // Deep-link: open task via ?task=<taskId>
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
        setActiveSection('pipeline')
        deepLinkHandled.current = true
      }
    }
  }, [searchParams, process?.stages])

  // Compute stats and filtered stages
  const { filteredStages, totalTasks, completedTasks, completedWeight, overdueTasks, assignees } = useMemo(() => {
    if (!process?.stages) {
      return { filteredStages: [], totalTasks: 0, completedTasks: 0, completedWeight: 0, overdueTasks: 0, assignees: [] as { id: string; name: string }[] }
    }

    const allTasks: ProcessTask[] = process.stages.flatMap((s: ProcessStageWithTasks) => s.tasks)

    let total = 0
    let completedWeight = 0
    let completedFull = 0
    let overdue = 0
    const assigneeMap = new Map<string, string>()

    for (const t of allTasks) {
      total++
      const isComplete = t.status === 'completed' || t.status === 'skipped'
      if (isComplete) {
        completedWeight++
        completedFull++
      } else if (t.subtasks && t.subtasks.length > 0) {
        // Contribuição proporcional das subtarefas
        const done = t.subtasks.filter((s) => s.is_completed).length
        completedWeight += done / t.subtasks.length
      }
      if (t.due_date && new Date(t.due_date) < new Date() && !isComplete) {
        overdue++
      }
      if (t.assigned_to_user) {
        assigneeMap.set(t.assigned_to_user.id, t.assigned_to_user.commercial_name)
      }
    }
    const completed = completedFull

    const assigneeList = Array.from(assigneeMap.entries()).map(([id, name]) => ({ id, name }))

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

    return { filteredStages: filtered, totalTasks: total, completedTasks: completed, completedWeight: completedWeight, overdueTasks: overdue, assignees: assigneeList }
  }, [process?.stages, filterStatus, filterPriority, filterAssignee])

  const progressPercent = totalTasks > 0 ? Math.round((completedWeight / totalTasks) * 100) : 0

  // Determine if process is pending (locks sidebar to 'detalhes' only)
  const isPending = process?.instance
    ? ['pending_approval', 'returned'].includes(process.instance.current_status)
    : false
  const isActive = process?.instance
    ? ['active', 'on_hold', 'completed'].includes(process.instance.current_status)
    : false

  // Force detalhes section when pending
  useEffect(() => {
    if (isPending && activeSection !== 'detalhes') {
      setActiveSection('detalhes')
    }
  }, [isPending, activeSection])

  // Build owner sub-items for the sidebar (use process?.owners since destructuring happens after guards)
  const ownerSubItems = (process?.owners || []).map((owner: { id: string; name?: string; is_main_contact?: boolean }) => ({
    key: `proprietarios:${owner.id}`,
    label: owner.name || 'Sem nome',
    badge: owner.is_main_contact ? 'Principal' : undefined,
  }))

  // Sidebar items
  const sidebarItems: PageSidebarItem[] = [
    { key: 'detalhes', label: 'Detalhes', icon: ClipboardList },
    { key: 'pipeline', label: 'Pipeline', icon: Kanban },
    { key: 'imovel', label: 'Imóvel', icon: Building2 },
    {
      key: 'proprietarios',
      label: 'Proprietários',
      icon: Users,
      subItems: ownerSubItems.length > 0 ? ownerSubItems : undefined,
    },
    { key: 'documentos', label: 'Documentos', icon: FileText },
  ]

  const handleSidebarSelect = (key: string) => {
    if (isPending && key !== 'detalhes') return
    setActiveSection(key)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-4 px-4 md:px-6 py-4 border-b">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="w-52 shrink-0 border-r p-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
          <div className="flex-1 p-6 space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    )
  }

  // Deleted process
  if (deletedInfo) {
    const deletedDate = deletedInfo.deleted_at ? formatDate(deletedInfo.deleted_at) : 'data desconhecida'
    const deletedByName = deletedInfo.deleted_by?.commercial_name || 'utilizador desconhecido'

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-4 px-4 md:px-6 py-4 border-b">
          <Link href="/dashboard/processos">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-muted-foreground">
            {deletedInfo.external_ref || 'Processo'}
          </h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="border-destructive/30 bg-destructive/5 max-w-md w-full">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-destructive/10 p-4 mb-4">
                <Trash2 className="h-10 w-10 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Processo Eliminado</h2>
              <p className="text-muted-foreground">
                Eliminado em <strong>{deletedDate}</strong> por <strong>{deletedByName}</strong>.
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
      </div>
    )
  }

  if (!process) return null

  const { instance, stages, owners, documents } = process
  const property = instance.property

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard/processos">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold truncate">{instance.external_ref}</h1>
              <StatusBadge status={instance.current_status} type="process" />
            </div>
            <p className="text-sm text-muted-foreground truncate">{property?.title}</p>
          </div>
        </div>

        {/* Progress bar + Action buttons */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Inline progress */}
          {isActive && totalTasks > 0 && (
            <div className="flex items-center gap-2 w-36">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-500',
                    progressPercent === 100 ? 'bg-emerald-500' : 'bg-primary'
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                {progressPercent}%
              </span>
            </div>
          )}
          {instance.current_status === 'active' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleHold('pause')}
              disabled={isActionLoading}
            >
              {isActionLoading ? <Spinner variant="infinite" size={16} className="mr-2" /> : <Pause className="mr-2 h-4 w-4" />}
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
              {isActionLoading ? <Spinner variant="infinite" size={16} className="mr-2" /> : <Play className="mr-2 h-4 w-4" />}
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
                  <DropdownMenuItem onClick={() => { loadTemplates(); setSelectedNewTemplateId(''); setReTemplateDialogOpen(true) }}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Alterar template
                  </DropdownMenuItem>
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

      {/* Sidebar + Content */}
      <div className="flex flex-1 min-h-0">
        <PageSidebar
          items={sidebarItems.map((item) => ({
            ...item,
            disabled: isPending && item.key !== 'detalhes',
          }))}
          activeKey={activeSection}
          onSelect={handleSidebarSelect}
        />

        {/* Main content */}
        <div className="flex-1 min-w-0 overflow-y-auto p-4 md:p-6">
          {/* ── DETALHES section ── */}
          {activeSection === 'detalhes' && (
            <div className="space-y-6">
              {/* Review section (pending / returned) */}
              {isPending && (
                <>
                  <ProcessReviewSection
                    process={instance}
                    property={property}
                    owners={owners}
                    documents={documents}
                    onApprove={handleApprove}
                    onReturn={handleReturn}
                    onReject={handleReject}
                  />
                  {property && (
                    <ProcessReviewBento
                      process={instance}
                      property={property}
                      owners={owners}
                      documents={documents}
                    />
                  )}
                </>
              )}

              {/* Active process summary (bento only, progress is in Pipeline) */}
              {isActive && property && (
                <ProcessReviewBento
                  process={instance}
                  property={property}
                  owners={owners}
                  documents={documents}
                />
              )}
            </div>
          )}

          {/* ── IMÓVEL section ── */}
          {activeSection === 'imovel' && (
            <ProcessPropertyTab property={property} documents={documents} onDocumentUploaded={loadProcess} />
          )}

          {/* ── PIPELINE section ── */}
          {activeSection === 'pipeline' && (
            <div className="space-y-4">
              {isActive && stages && stages.length > 0 ? (
                <>
                  {/* Progress bar */}
                  <Card>
                    <CardContent className="px-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold shrink-0">Progresso</span>
                        <Progress value={progressPercent} className="h-2 flex-1" />
                        <span className="text-sm font-bold tabular-nums shrink-0">{progressPercent}%</span>
                      </div>
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
                        <ToggleGroupItem value="timeline" aria-label="Vista Timeline">
                          <Activity className="h-4 w-4" />
                          Timeline
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
                  ) : viewMode === 'list' ? (
                    <ProcessListView
                      stages={filteredStages}
                      isProcessing={isProcessing}
                      onTaskAction={handleTaskAction}
                      onTaskBypass={handleBypassOpen}
                      onTaskAssign={handleAssignOpen}
                      onTaskClick={handleTaskClick}
                    />
                  ) : (
                    <ProcessTimelineView
                      activities={processActivities}
                      isLoading={isLoadingActivities}
                    />
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Kanban className="h-8 w-8 mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-medium">Pipeline não disponível</p>
                    <p className="text-xs mt-1">O processo precisa de ser aprovado antes de ter tarefas.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ── PROPRIETÁRIOS section — all owners (cards overview) ── */}
          {activeSection === 'proprietarios' && (
            <ProcessOwnersTab owners={owners} documents={documents} onDocumentUploaded={loadProcess} />
          )}

          {/* ── PROPRIETÁRIO individual ── */}
          {activeSection.startsWith('proprietarios:') && (() => {
            const ownerId = activeSection.split(':')[1]
            const singleOwner = (owners || []).find((o: { id: string }) => o.id === ownerId)
            if (!singleOwner) return null
            return (
              <ProcessOwnersTab owners={[singleOwner]} documents={documents} onDocumentUploaded={loadProcess} />
            )
          })()}

          {/* ── DOCUMENTOS section ── */}
          {activeSection === 'documentos' && (
            <ProcessDocumentsManager processId={instance.id} />
          )}
        </div>
      </div>

      {/* Floating Chat */}
      {user && (
        <FloatingChat
          processId={instance.id}
          currentUser={{
            id: user.id,
            name: user.commercial_name || 'Utilizador',
          }}
          onEntityClick={handleEntityClick}
        />
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
              {isActionLoading && <Spinner variant="infinite" size={16} className="mr-2" />}
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
              {isActionLoading && <Spinner variant="infinite" size={16} className="mr-2" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Re-Template Dialog */}
      <Dialog open={reTemplateDialogOpen} onOpenChange={setReTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Template do Processo</DialogTitle>
            <DialogDescription>
              As tarefas existentes serão eliminadas e recriadas com base no novo template.
              Documentos já carregados não serão afectados.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {isLoadingTemplates ? (
              <div className="flex items-center justify-center py-6">
                <Spinner variant="infinite" size={20} className="text-muted-foreground" />
              </div>
            ) : reTemplateList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum template activo encontrado.
              </p>
            ) : (
              <Select value={selectedNewTemplateId} onValueChange={setSelectedNewTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar template..." />
                </SelectTrigger>
                <SelectContent>
                  {reTemplateList.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.stages_count} fases, {t.tasks_count} tarefas)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReTemplateDialogOpen(false)}
              disabled={isActionLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleReTemplate}
              disabled={isActionLoading || !selectedNewTemplateId}
            >
              {isActionLoading ? (
                <Spinner variant="infinite" size={16} className="mr-2" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Aplicar Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
