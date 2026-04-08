'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, CheckSquare, AlertTriangle, Clock, Zap, Workflow, ListChecks } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TaskFilters } from '@/components/tasks/task-filters'
import { TaskListItem } from '@/components/tasks/task-list-item'
import { TaskForm } from '@/components/tasks/task-form'
import { TaskDetailSheet } from '@/components/tasks/task-detail-sheet'
import { useTasks, useTaskStats, useTaskMutations } from '@/hooks/use-tasks'
import { useUser } from '@/hooks/use-user'
import type { TaskWithRelations } from '@/types/task'

type TasksTab = 'personal' | 'process'

export default function TarefasPage() {
  const router = useRouter()
  const { user } = useUser()
  const [consultants, setConsultants] = useState<Array<{ id: string; commercial_name: string }>>([])
  const [showForm, setShowForm] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [formDefaults, setFormDefaults] = useState<{ parent_task_id?: string } | undefined>()
  const [activeTab, setActiveTab] = useState<TasksTab>('personal')

  // Dois fetches independentes — um por tab. Cada tab mantém os seus próprios
  // filtros e isLoading. O `useTasks` é leve o suficiente para ser duplicado.
  const personalTab = useTasks({ is_completed: 'false', source_filter: 'personal' })
  const processTab = useTasks({ is_completed: 'false', source_filter: 'process' })

  // refetch do tab activo, usado pelos handlers (toggle, create, etc.)
  const refetch = activeTab === 'personal' ? personalTab.refetch : processTab.refetch
  const { stats, isLoading: statsLoading, refetch: refetchStats } = useTaskStats()
  const { toggleComplete } = useTaskMutations()

  // Fetch consultants for filters/form
  useEffect(() => {
    fetch('/api/users/consultants')
      .then((res) => res.json())
      .then((data) => setConsultants(data.data || data || []))
      .catch(() => {})
  }, [])

  // Check URL for ?task= param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const taskId = params.get('task')
    if (taskId) {
      setSelectedTaskId(taskId)
      setShowDetail(true)
    }
  }, [])

  const handleToggleComplete = async (id: string, isCompleted: boolean) => {
    // Process-sourced tasks (proc_task:xxx, proc_subtask:xxx) cannot be toggled here.
    if (id.startsWith('proc_task:') || id.startsWith('proc_subtask:')) {
      toast.info('Conclui esta tarefa no detalhe do processo.')
      return
    }
    try {
      await toggleComplete(id, isCompleted)
      toast.success(isCompleted ? 'Tarefa reaberta' : 'Tarefa concluída')
      refetch()
      refetchStats()
    } catch {
      toast.error('Erro ao actualizar tarefa')
    }
  }

  const handleSelectTask = (task: TaskWithRelations) => {
    // Process tasks/subtasks live in the proc_tasks table — open the process page instead.
    if ((task.source === 'proc_task' || task.source === 'proc_subtask') && task.process_id) {
      router.push(`/dashboard/processos/${task.process_id}`)
      return
    }
    setSelectedTaskId(task.id)
    setShowDetail(true)
  }

  const handleCreateSubTask = (parentId: string) => {
    setFormDefaults({ parent_task_id: parentId })
    setShowForm(true)
  }

  const handleFormSuccess = () => {
    refetch()
    refetchStats()
    setFormDefaults(undefined)
  }

  const handleRefresh = () => {
    refetch()
    refetchStats()
  }

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatsCard
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Pendentes"
          value={stats?.pending}
          isLoading={statsLoading}
          color="neutral"
        />
        <StatsCard
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="Em atraso"
          value={stats?.overdue}
          isLoading={statsLoading}
          color="red"
        />
        <StatsCard
          icon={<CheckSquare className="h-3.5 w-3.5" />}
          label="Hoje"
          value={stats?.completed_today}
          isLoading={statsLoading}
          color="emerald"
        />
        <StatsCard
          icon={<Zap className="h-3.5 w-3.5" />}
          label="Urgentes"
          value={stats?.urgent}
          isLoading={statsLoading}
          color="orange"
        />
      </div>

      {/* Tabs: Tarefas (pessoais + visit proposals + outras operacionais)
          vs Processos (proc_task + proc_subtask) */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TasksTab)}>
        <TabsList>
          <TabsTrigger value="personal" className="gap-1.5">
            <ListChecks className="h-3.5 w-3.5" />
            Tarefas
            {personalTab.total > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] font-semibold">
                {personalTab.total}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="process" className="gap-1.5">
            <Workflow className="h-3.5 w-3.5" />
            Processos
            {processTab.total > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] font-semibold">
                {processTab.total}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-4 mt-4">
          <TaskFilters
            filters={personalTab.filters}
            onFiltersChange={personalTab.setFilters}
            onNewTask={() => { setFormDefaults(undefined); setShowForm(true) }}
            consultants={consultants}
            currentUserId={user?.id}
          />
          <TaskList
            tasks={personalTab.tasks}
            isLoading={personalTab.isLoading}
            isCompletedFilter={personalTab.filters.is_completed}
            onToggleComplete={handleToggleComplete}
            onSelect={handleSelectTask}
            onRefresh={() => { personalTab.refetch(); refetchStats() }}
            onCreate={() => { setFormDefaults(undefined); setShowForm(true) }}
            emptyMessage="Todas as tarefas estão em dia!"
          />
          {personalTab.total > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              A mostrar {personalTab.tasks.length} de {personalTab.total} tarefa{personalTab.total !== 1 ? 's' : ''}
            </p>
          )}
        </TabsContent>

        <TabsContent value="process" className="space-y-4 mt-4">
          <TaskFilters
            filters={processTab.filters}
            onFiltersChange={processTab.setFilters}
            onNewTask={() => { setFormDefaults(undefined); setShowForm(true) }}
            consultants={consultants}
            currentUserId={user?.id}
          />
          <TaskList
            tasks={processTab.tasks}
            isLoading={processTab.isLoading}
            isCompletedFilter={processTab.filters.is_completed}
            onToggleComplete={handleToggleComplete}
            onSelect={handleSelectTask}
            onRefresh={() => { processTab.refetch(); refetchStats() }}
            onCreate={() => { setFormDefaults(undefined); setShowForm(true) }}
            emptyMessage="Sem tarefas de processos pendentes."
          />
          {processTab.total > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              A mostrar {processTab.tasks.length} de {processTab.total} tarefa{processTab.total !== 1 ? 's' : ''}
            </p>
          )}
        </TabsContent>
      </Tabs>

      {/* Form dialog */}
      <TaskForm
        open={showForm}
        onOpenChange={(open) => { setShowForm(open); if (!open) setFormDefaults(undefined) }}
        onSuccess={handleFormSuccess}
        consultants={consultants}
        defaultValues={formDefaults}
      />

      {/* Detail sheet */}
      <TaskDetailSheet
        taskId={selectedTaskId}
        open={showDetail}
        onOpenChange={setShowDetail}
        onRefresh={handleRefresh}
        onCreateSubTask={handleCreateSubTask}
      />
    </div>
  )
}

// ─── Task List (shared between tabs) ─────────────────────────

function TaskList({
  tasks,
  isLoading,
  isCompletedFilter,
  onToggleComplete,
  onSelect,
  onRefresh,
  onCreate,
  emptyMessage,
}: {
  tasks: TaskWithRelations[]
  isLoading: boolean
  isCompletedFilter?: 'true' | 'false'
  onToggleComplete: (id: string, isCompleted: boolean) => void
  onSelect: (task: TaskWithRelations) => void
  onRefresh: () => void
  onCreate: () => void
  emptyMessage: string
}) {
  if (isLoading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
            <Skeleton className="h-4 w-4 rounded" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium">Sem tarefas</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {isCompletedFilter === 'true'
            ? 'Nenhuma tarefa concluída encontrada.'
            : emptyMessage}
        </p>
        <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={onCreate}>
          <Plus className="h-3.5 w-3.5" />
          Criar tarefa
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {tasks.map((task) => (
        <TaskListItem
          key={task.id}
          task={task}
          onToggleComplete={onToggleComplete}
          onSelect={onSelect}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  )
}

// ─── Stats Card ──────────────────────────────────────────────

const STAT_COLORS = {
  neutral: { bg: 'bg-neutral-100 dark:bg-neutral-800/50', icon: 'text-neutral-600 dark:text-neutral-400', value: '' },
  red: { bg: 'bg-red-50 dark:bg-red-950/30', icon: 'text-red-500', value: 'text-red-600 dark:text-red-400' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', icon: 'text-emerald-500', value: 'text-emerald-600 dark:text-emerald-400' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-950/30', icon: 'text-orange-500', value: 'text-orange-600 dark:text-orange-400' },
} as const

function StatsCard({
  icon,
  label,
  value,
  isLoading,
  color = 'neutral',
}: {
  icon: React.ReactNode
  label: string
  value?: number
  isLoading: boolean
  color?: keyof typeof STAT_COLORS
}) {
  const c = STAT_COLORS[color]
  const hasValue = (value ?? 0) > 0

  return (
    <div className={`rounded-xl ${c.bg} px-3 py-2.5 flex items-center gap-2.5 transition-colors`}>
      <div className={c.icon}>{icon}</div>
      {isLoading ? (
        <Skeleton className="h-5 w-6" />
      ) : (
        <span className={`text-lg font-bold tabular-nums ${hasValue ? c.value : 'text-muted-foreground/50'}`}>{value ?? 0}</span>
      )}
      <span className="text-[0.65rem] text-muted-foreground">{label}</span>
    </div>
  )
}
