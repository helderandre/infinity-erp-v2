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
  Target,
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
  UserPlus,
  Plus,
  Handshake,
  ShoppingCart,
  Euro,
} from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { StatusBadge } from '@/components/shared/status-badge'
import { MobileFilterSheet } from '@/components/shared/mobile-filter-sheet'
import { PageSidebar } from '@/components/shared/page-sidebar'
import type { PageSidebarItem } from '@/components/shared/page-sidebar'
import { ProcessReviewSection } from '@/components/processes/process-review-section'
import { ProcessReviewBento } from '@/components/processes/process-review-bento'
import { ProcessKanbanView } from '@/components/processes/process-kanban-view'
import { ProcessFocusView } from '@/components/processes/process-focus-view'
import { StageCompleteDialog } from '@/components/processes/stage-complete-dialog'
import { ProcessListView } from '@/components/processes/process-list-view'
import { ProcessTaskAssignDialog } from '@/components/processes/process-task-assign-dialog'
import { TaskDetailSheet } from '@/components/processes/task-detail-sheet'
import { FloatingChat } from '@/components/processes/floating-chat'
import { ProcessPropertyTab } from '@/components/processes/process-property-tab'
import { ProcessOwnersTab } from '@/components/processes/process-owners-tab'
import { ProcessOwnerCard } from '@/components/processes/process-owner-card'
import { ProcessDocumentsManager } from '@/components/processes/process-documents-manager'
import { AdHocTaskSheet } from '@/components/processes/adhoc-task-sheet'
import { AddOwnerDialog } from '@/components/processes/add-owner-dialog'
import { ProcessDealTab } from '@/components/processes/process-deal-tab'
import { ProcessDealBento } from '@/components/processes/process-deal-bento'
import { ProcessFinanceiroTab } from '@/components/processes/process-financeiro-tab'
import { DealDialog } from '@/components/deals/deal-dialog'
import type { OwnerRoleType } from '@/types/owner'
import { useUser } from '@/hooks/use-user'
import { usePermissions } from '@/hooks/use-permissions'
import { cn, formatDate, formatCurrency } from '@/lib/utils'
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, getRoleBadgeColors } from '@/lib/constants'
import { ADHOC_TASK_ROLES } from '@/lib/auth/roles'
import { toast } from 'sonner'
import Link from 'next/link'
import { ProcessTimelineView } from '@/components/processes/process-timeline-view'
import { useProcessActivities } from '@/hooks/use-process-activities'
import type { ProcessTask, ProcessStageWithTasks } from '@/types/process'

type ViewMode = 'foco' | 'kanban' | 'timeline'

type SidebarSection = string // 'detalhes' | 'imovel' | 'pipeline' | 'proprietarios' | 'proprietarios:<id>' | 'documentos'

export default function ProcessoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const { isBroker } = usePermissions()
  const canManageTemplates = isBroker()
  const [process, setProcess] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('foco')
  const [activeSection, setActiveSection] = useState<SidebarSection>('detalhes')

  // Process-level activities (for timeline view)
  const { activities: processActivities, isLoading: isLoadingActivities } = useProcessActivities(
    viewMode === 'timeline' && activeSection === 'pipeline' ? (params.id as string) : null
  )

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')
  const [filterRole, setFilterRole] = useState<string>('all')

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

  // Ad-hoc task sheet
  const [adhocTaskSheetOpen, setAdhocTaskSheetOpen] = useState(false)
  const [adhocPreselectedStage, setAdhocPreselectedStage] = useState<{ name: string; order_index: number } | undefined>()

  // Ad-hoc task delete
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<ProcessTask | null>(null)
  const [isDeletingTask, setIsDeletingTask] = useState(false)

  // Add owner dialog (for the cards overview)
  const [addOwnerDialogOpen, setAddOwnerDialogOpen] = useState(false)
  const [ownerRoleTypes, setOwnerRoleTypes] = useState<OwnerRoleType[]>([])

  // Stage complete dialog
  const [stageCompleteTarget, setStageCompleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [isCompletingStage, setIsCompletingStage] = useState(false)

  // Fecho de Negócio dialog (for angariação processes)
  const [showFechoDialog, setShowFechoDialog] = useState(false)

  // Soft-delete info
  const [deletedInfo, setDeletedInfo] = useState<{
    deleted: boolean
    deleted_at: string
    deleted_by: { id: string; commercial_name: string } | null
    external_ref: string | null
  } | null>(null)

  // Silent refresh — refetches data without showing skeleton
  const silentRefresh = useCallback(() => loadProcess(true), [params.id])

  useEffect(() => {
    loadProcess()
  }, [params.id])

  // Fetch owner role types (for add owner dialog)
  useEffect(() => {
    fetch('/api/owner-role-types')
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setOwnerRoleTypes(data) })
      .catch(() => {})
  }, [])

  const loadProcess = async (silent = false) => {
    if (!silent) setIsLoading(true)
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
      if (!silent) setIsLoading(false)
    }
  }

  const handleApprove = async (tplProcessId?: string) => {
    try {
      const response = await fetch(`/api/processes/${params.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tplProcessId ? { tpl_process_id: tplProcessId } : {}),
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
      loadProcess(true)
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
      loadProcess(true)
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
      loadProcess(true)
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
      loadProcess(true)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao actualizar tarefa'
      toast.error(message)
    } finally {
      setIsProcessing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const handleDeleteAdhocTask = useCallback(async () => {
    if (!deleteTaskTarget) return
    setIsDeletingTask(true)
    try {
      const res = await fetch(`/api/processes/${params.id}/tasks/${deleteTaskTarget.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao remover tarefa')
      }
      toast.success('Tarefa removida com sucesso!')
      setDeleteTaskTarget(null)
      loadProcess(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover tarefa')
    } finally {
      setIsDeletingTask(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteTaskTarget, params.id])

  const canDeleteAdhoc = !!user?.role?.name && ADHOC_TASK_ROLES.includes(user.role.name as any)

  const handleStageCompleteOpen = useCallback((stageId: string) => {
    const stage = process?.stages?.find((s: any) => s.id === stageId)
    if (stage) {
      setStageCompleteTarget({ id: stageId, name: stage.name })
    }
  }, [process])

  const handleStageComplete = useCallback(async () => {
    if (!stageCompleteTarget) return
    setIsCompletingStage(true)
    try {
      const res = await fetch(
        `/api/processes/${params.id}/stages/${stageCompleteTarget.id}/complete`,
        { method: 'POST' }
      )
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao concluir estágio')
      }
      toast.success('Estágio concluído com sucesso!')
      setStageCompleteTarget(null)
      loadProcess(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao concluir estágio')
    } finally {
      setIsCompletingStage(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageCompleteTarget, params.id])

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
      loadProcess(true)
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
      loadProcess(true)
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
      loadProcess(true)
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
      loadProcess(true)
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
  const { filteredStages, totalTasks, completedTasks, completedWeight, overdueTasks, assignees, roles } = useMemo(() => {
    if (!process?.stages) {
      return { filteredStages: [], totalTasks: 0, completedTasks: 0, completedWeight: 0, overdueTasks: 0, assignees: [] as { id: string; name: string }[], roles: [] as string[] }
    }

    const allTasks: ProcessTask[] = process.stages.flatMap((s: ProcessStageWithTasks) => s.tasks)

    let total = 0
    let completedWeight = 0
    let completedFull = 0
    let overdue = 0
    const assigneeMap = new Map<string, string>()
    const roleSet = new Set<string>()

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
      if (t.assigned_role) {
        roleSet.add(t.assigned_role)
      }
    }
    const completed = completedFull

    const assigneeList = Array.from(assigneeMap.entries()).map(([id, name]) => ({ id, name }))
    const roleList = Array.from(roleSet).sort()

    const filtered: ProcessStageWithTasks[] = process.stages.map((stage: ProcessStageWithTasks) => {
      const tasks = stage.tasks.filter((t: ProcessTask) => {
        if (filterStatus !== 'all' && t.status !== filterStatus) return false
        if (filterPriority !== 'all' && (t.priority ?? 'normal') !== filterPriority) return false
        if (filterAssignee !== 'all' && t.assigned_to_user?.id !== filterAssignee) return false
        if (filterRole !== 'all' && t.assigned_role !== filterRole) return false
        return true
      })

      return {
        ...stage,
        tasks,
        tasks_total: stage.tasks_total,
        tasks_completed: stage.tasks_completed,
      }
    }).filter((s: ProcessStageWithTasks) => s.tasks.length > 0)

    return { filteredStages: filtered, totalTasks: total, completedTasks: completed, completedWeight: completedWeight, overdueTasks: overdue, assignees: assigneeList, roles: roleList }
  }, [process?.stages, filterStatus, filterPriority, filterAssignee, filterRole])

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

  // Build ownerHasTasksMap: which owners already have tasks or subtasks in the process
  // Also build ownerExistingSubtaskIds: owner_id → Set<tpl_subtask_id>
  const { ownerHasTasksMap, ownerExistingSubtaskIds } = useMemo(() => {
    const hasMap: Record<string, boolean> = {}
    const subMap: Record<string, Set<string>> = {}
    if (process?.stages) {
      for (const stage of process.stages) {
        for (const task of stage.tasks || []) {
          if (task.owner_id) {
            hasMap[task.owner_id] = true
          }
          for (const subtask of task.subtasks || []) {
            if (subtask.owner_id) {
              hasMap[subtask.owner_id] = true
              if (subtask.tpl_subtask_id) {
                if (!subMap[subtask.owner_id]) subMap[subtask.owner_id] = new Set()
                subMap[subtask.owner_id].add(subtask.tpl_subtask_id)
              }
            }
          }
        }
      }
    }
    return { ownerHasTasksMap: hasMap, ownerExistingSubtaskIds: subMap }
  }, [process?.stages])

  // Determine if process is negocio type (for sidebar / content decisions)
  const isNegocio = process?.instance?.process_type === 'negocio'

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
    ...(isNegocio ? [
      { key: 'negocio', label: 'Negócio', icon: Handshake },
      {
        key: 'compradores',
        label: 'Compradores',
        icon: ShoppingCart,
        subItems: [
          { key: 'compradores:dados', label: 'Dados' },
          { key: 'compradores:documentos', label: 'Documentos' },
        ],
      },
      { key: 'financeiro', label: 'Financeiro', icon: Euro },
    ] : []),
    {
      key: 'imovel',
      label: 'Imóvel',
      icon: Building2,
      ...(isNegocio ? {} : {
        subItems: [
          { key: 'imovel:dados', label: 'Dados' },
          { key: 'imovel:documentos', label: 'Documentos' },
        ],
      }),
    },
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
    // Clicking parent items defaults to first sub-item
    if (key === 'imovel') {
      setActiveSection(isNegocio ? 'imovel' : 'imovel:dados')
      return
    }
    if (key === 'compradores') {
      setActiveSection('compradores:dados')
      return
    }
    setActiveSection(key)
  }

  if (isLoading && !process) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-4 px-4 md:px-6 py-4 border-b">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          <div className="hidden md:block w-52 shrink-0 border-r p-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
          <div className="flex-1 p-4 md:p-6 space-y-4">
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
          <Link href="/dashboard/processos" className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
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
              <Link href="/dashboard/processos" className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar aos Processos
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!process) return null

  const { instance, stages, owners, documents, deal, deal_clients: dealClients } = process
  const property = instance.property

  return (
    <div className="flex flex-col h-full">
      {/* Dark hero header */}
      <div className="relative overflow-hidden bg-neutral-900 rounded-b-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900 via-neutral-800/80 to-neutral-900" />
        <div className="relative z-10 px-5 md:px-6 py-4">
          {/* Top row: back + actions */}
          <div className="flex items-center justify-between">
            <Link href="/dashboard/processos" className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-medium hover:bg-white/25 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </Link>
            <div className="flex items-center gap-2">
              {instance.current_status === 'active' && (
                <button
                  onClick={() => handleHold('pause')}
                  disabled={isActionLoading}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-white text-xs font-medium hover:bg-white/20 transition-all disabled:opacity-50"
                >
                  {isActionLoading ? <Spinner variant="infinite" size={14} /> : <Pause className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">Pausar</span>
                </button>
              )}
              {instance.current_status === 'on_hold' && (
                <button
                  onClick={() => handleHold('resume')}
                  disabled={isActionLoading}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-white text-xs font-medium hover:bg-white/20 transition-all disabled:opacity-50"
                >
                  {isActionLoading ? <Spinner variant="infinite" size={14} /> : <Play className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">Retomar</span>
                </button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-white hover:bg-white/20 transition-all">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {['active', 'on_hold'].includes(instance.current_status) && (
                    <>
                      {canManageTemplates && (
                        <DropdownMenuItem onClick={() => { loadTemplates(); setSelectedNewTemplateId(''); setReTemplateDialogOpen(true) }}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Alterar template
                        </DropdownMenuItem>
                      )}
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

          {/* Process info */}
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <StatusBadge status={instance.current_status} type="process" />
              {isNegocio && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-violet-500/30 text-violet-200 border border-violet-400/30">Negócio</span>
              )}
              {!isNegocio && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30">Angariação</span>
              )}
            </div>
            <h1 className="text-xl font-bold text-white truncate">{instance.external_ref}</h1>
            <p className="text-sm text-white/60 truncate mt-0.5">
              {isNegocio && deal
                ? `${deal.deal_value ? formatCurrency(Number(deal.deal_value)) : 'Sem valor'}`
                : property?.title || 'Sem imóvel'}
            </p>

            {/* Progress bar */}
            {isActive && totalTasks > 0 && (
              <div className="flex items-center gap-3 mt-3">
                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-500 rounded-full',
                      progressPercent === 100 ? 'bg-emerald-400' : 'bg-white/70'
                    )}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-xs font-semibold tabular-nums text-white/60">
                  {progressPercent}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar + Content */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        <PageSidebar
          items={sidebarItems.map((item) => ({
            ...item,
            disabled: isPending && item.key !== 'detalhes',
          }))}
          activeKey={activeSection}
          onSelect={handleSidebarSelect}
          {...(!isNegocio && isActive ? {
            actionsLabel: 'Acções',
            actions: [
              {
                key: 'novo-fecho',
                label: 'Novo Fecho',
                icon: Handshake,
                onClick: () => setShowFechoDialog(true),
              },
            ],
          } : {})}
        />

        {/* Main content */}
        <div className="flex-1 min-w-0 overflow-y-auto p-4 md:p-6">
          {/* ── DETALHES section ── */}
          {activeSection === 'detalhes' && (
            <div className="space-y-4">
              {/* Review section (pending / returned) */}
              {isPending && (
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

              {isNegocio && deal && (
                <ProcessDealBento
                  deal={deal}
                  dealClients={dealClients || []}
                  documents={documents}
                />
              )}
              {!isNegocio && property && (
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
          {(activeSection === 'imovel' || activeSection === 'imovel:dados') && (
            <ProcessPropertyTab property={property} documents={documents} onDocumentUploaded={silentRefresh} view="dados" />
          )}

          {activeSection === 'imovel:documentos' && !isNegocio && (
            <ProcessPropertyTab property={property} documents={documents} onDocumentUploaded={silentRefresh} view="documentos" />
          )}

          {/* ── NEGÓCIO section (deal-type processes) ── */}
          {activeSection === 'negocio' && deal && (
            <ProcessDealTab deal={deal} dealClients={dealClients || []} />
          )}

          {/* ── COMPRADORES section (deal-type processes) ── */}
          {(activeSection === 'compradores' || activeSection === 'compradores:dados') && (
            <div className="space-y-4">
              {(dealClients || []).length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nenhum comprador associado</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {(dealClients || []).map((client: any, idx: number) => (
                    <Card key={client.id || idx}>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                            {client.name?.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{client.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {client.person_type === 'singular' ? 'Pessoa Singular' : 'Pessoa Colectiva'}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {client.email && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <span className="font-medium text-foreground">{client.email}</span>
                            </div>
                          )}
                          {client.phone && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <span className="font-medium text-foreground">{client.phone}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSection === 'compradores:documentos' && (
            <div className="space-y-4">
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Documentos dos compradores</p>
                  <p className="text-xs mt-1">Em breve — upload e gestão de documentos dos compradores</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── FINANCEIRO section (deal-type processes) ── */}
          {activeSection === 'financeiro' && deal && (
            <ProcessFinanceiroTab deal={deal} dealId={deal.id} />
          )}

          {/* ── PIPELINE section ── */}
          {activeSection === 'pipeline' && (
            <div className="space-y-4">
              {isActive && stages && stages.length > 0 ? (
                <>
                  {/* Filters + view toggle */}
                  <div className="flex items-center gap-2">
                    <MobileFilterSheet activeCount={
                      (filterStatus !== 'all' ? 1 : 0) +
                      (filterPriority !== 'all' ? 1 : 0) +
                      (filterAssignee !== 'all' ? 1 : 0) +
                      (filterRole !== 'all' ? 1 : 0)
                    }>
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-[150px] h-8 rounded-full text-xs">
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
                        <SelectTrigger className="w-[150px] h-8 rounded-full text-xs">
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
                        <SelectTrigger className="w-[170px] h-8 rounded-full text-xs">
                          <SelectValue placeholder="Responsável" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {assignees.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {roles.length > 0 && (
                        <Select value={filterRole} onValueChange={setFilterRole}>
                          <SelectTrigger className="w-[180px] h-8 rounded-full text-xs">
                            <SelectValue placeholder="Papel" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os papéis</SelectItem>
                            {roles.map((role) => {
                              const rc = getRoleBadgeColors(role)
                              return (
                                <SelectItem key={role} value={role}>
                                  <span className="flex items-center gap-2">
                                    <span className={cn('h-2 w-2 rounded-full shrink-0', rc.bg, rc.border, 'border')} />
                                    {role}
                                  </span>
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                      )}
                    </MobileFilterSheet>

                    <div className="ml-auto flex items-center gap-2">
                      {user?.role?.name && ADHOC_TASK_ROLES.includes(user.role.name as any) && ['active', 'on_hold'].includes(instance.current_status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setAdhocPreselectedStage(undefined)
                            setAdhocTaskSheetOpen(true)
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Nova Tarefa
                        </Button>
                      )}
                      <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as ViewMode)} variant="outline" size="sm">
                        <ToggleGroupItem value="foco" aria-label="Vista Foco">
                          <Target className="h-4 w-4" />
                          Foco
                        </ToggleGroupItem>
                        <ToggleGroupItem value="kanban" aria-label="Vista Kanban">
                          <LayoutGrid className="h-4 w-4" />
                          Kanban
                        </ToggleGroupItem>
                        <ToggleGroupItem value="timeline" aria-label="Vista Timeline">
                          <Activity className="h-4 w-4" />
                          Timeline
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                  </div>

                  {/* Views */}
                  {viewMode === 'foco' ? (
                    <ProcessFocusView stages={filteredStages} onOpenTask={handleTaskClick} />
                  ) : viewMode === 'kanban' ? (
                    <ProcessKanbanView
                      stages={filteredStages}
                      isProcessing={isProcessing}
                      canDeleteAdhoc={canDeleteAdhoc}
                      onTaskAction={handleTaskAction}
                      onTaskBypass={handleBypassOpen}
                      onTaskAssign={handleAssignOpen}
                      onTaskClick={handleTaskClick}
                      onTaskDelete={(task) => setDeleteTaskTarget(task)}
                      onStageComplete={handleStageCompleteOpen}
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

          {/* ── PROPRIETÁRIOS section — cards overview ── */}
          {activeSection === 'proprietarios' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {owners.length === 0 ? (
                  <Card className="col-span-full">
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Nenhum proprietário associado</p>
                    </CardContent>
                  </Card>
                ) : (
                  owners.map((owner: any) => (
                    <ProcessOwnerCard
                      key={owner.id}
                      owner={owner}
                      hasTasks={ownerHasTasksMap[owner.id]}
                      processId={instance.id}
                      existingSubtaskIds={ownerExistingSubtaskIds[owner.id] || new Set()}
                      allPopulated={false}
                      onTasksPopulated={silentRefresh}
                      onClick={() => setActiveSection(`proprietarios:${owner.id}`)}
                    />
                  ))
                )}

                {/* Card para adicionar novo proprietário */}
                <Card
                  className="cursor-pointer transition-all py-0 hover:shadow-md hover:border-primary/30 border-dashed"
                  onClick={() => setAddOwnerDialogOpen(true)}
                >
                  <CardContent className="flex flex-col items-center justify-center text-center pt-6 pb-5 px-5 min-h-[200px]">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
                      <Plus className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Adicionar Proprietário</p>
                  </CardContent>
                </Card>
              </div>

              {/* Add Owner Dialog */}
              <AddOwnerDialog
                open={addOwnerDialogOpen}
                onOpenChange={setAddOwnerDialogOpen}
                propertyId={instance.property_id}
                processId={instance.id}
                roleTypes={ownerRoleTypes}
                existingOwnerIds={owners.map((o: any) => o.id)}
                onAdded={silentRefresh}
              />
            </div>
          )}

          {/* ── PROPRIETÁRIO individual ── */}
          {activeSection.startsWith('proprietarios:') && (() => {
            const ownerId = activeSection.split(':')[1]
            const singleOwner = (owners || []).find((o: { id: string }) => o.id === ownerId)
            if (!singleOwner) return null
            return (
              <ProcessOwnersTab
                owners={[singleOwner]}
                documents={documents}
                propertyId={instance.property_id}
                processId={instance.id}
                ownerHasTasksMap={ownerHasTasksMap}
                ownerExistingSubtaskIds={ownerExistingSubtaskIds}
                totalOwners={owners.length}
                hideHeader
                onDocumentUploaded={silentRefresh}
                onOwnersChanged={silentRefresh}
              />
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

      {/* Ad-hoc Task Sheet */}
      {stages && (
        <AdHocTaskSheet
          open={adhocTaskSheetOpen}
          onOpenChange={setAdhocTaskSheetOpen}
          processId={instance.id}
          stages={stages}
          owners={owners || []}
          existingTasks={stages.flatMap((s: ProcessStageWithTasks) => s.tasks)}
          preselectedStage={adhocPreselectedStage}
          onTaskCreated={silentRefresh}
        />
      )}

      {/* Task Detail Sheet */}
      <TaskDetailSheet
        task={selectedTask}
        processId={instance.id}
        propertyId={instance.property_id}
        consultantId={instance.requested_by ?? undefined}
        property={instance.property}
        processInstance={instance}
        processDocuments={documents}
        owners={owners}
        deal={deal}
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
        onTaskUpdate={silentRefresh}
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
          onAssigned={silentRefresh}
        />
      )}

      {/* Stage Complete Dialog */}
      <StageCompleteDialog
        open={!!stageCompleteTarget}
        onOpenChange={(open) => !open && setStageCompleteTarget(null)}
        stageName={stageCompleteTarget?.name || ''}
        onConfirm={handleStageComplete}
        isLoading={isCompletingStage}
      />

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

      {/* Delete Ad-hoc Task Dialog */}
      <AlertDialog open={!!deleteTaskTarget} onOpenChange={(open) => { if (!open) setDeleteTaskTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover tarefa ad-hoc</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende remover a tarefa &ldquo;{deleteTaskTarget?.title}&rdquo;?
              Todas as subtarefas associadas serão também eliminadas. Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingTask}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDeleteAdhocTask}
              disabled={isDeletingTask}
            >
              {isDeletingTask ? 'A remover...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fecho de Negócio dialog (angariação processes) */}
      {!isNegocio && property && (
        <DealDialog
          open={showFechoDialog}
          onOpenChange={setShowFechoDialog}
          propertyContext={{
            id: property.id,
            title: property.title,
            external_ref: property.external_ref,
            business_type: property.business_type,
            listing_price: property.listing_price ? Number(property.listing_price) : null,
            city: property.city,
            commission_agreed: property.dev_property_internal?.commission_agreed
              ? Number(property.dev_property_internal.commission_agreed)
              : null,
          }}
          onComplete={() => {
            silentRefresh()
          }}
        />
      )}
    </div>
  )
}
