'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, CheckSquare, AlertTriangle, Clock, Zap } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TaskFilters } from '@/components/tasks/task-filters'
import { TaskListItem } from '@/components/tasks/task-list-item'
import { TaskForm } from '@/components/tasks/task-form'
import { TaskDetailSheet } from '@/components/tasks/task-detail-sheet'
import { useTasks, useTaskStats, useTaskMutations } from '@/hooks/use-tasks'
import { useUser } from '@/hooks/use-user'
import type { TaskWithRelations } from '@/types/task'

export default function TarefasPage() {
  const { user } = useUser()
  const [consultants, setConsultants] = useState<Array<{ id: string; commercial_name: string }>>([])
  const [showForm, setShowForm] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [formDefaults, setFormDefaults] = useState<{ parent_task_id?: string } | undefined>()

  const { tasks, total, isLoading, filters, setFilters, refetch } = useTasks(
    { is_completed: 'false' },
  )
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tarefas</h1>
          <p className="text-sm text-muted-foreground">
            Gerir e acompanhar tarefas da equipa
          </p>
        </div>
        <Button onClick={() => { setFormDefaults(undefined); setShowForm(true) }} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Tarefa
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          icon={<Clock className="h-4 w-4" />}
          label="Pendentes"
          value={stats?.pending}
          isLoading={statsLoading}
        />
        <StatsCard
          icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
          label="Em atraso"
          value={stats?.overdue}
          isLoading={statsLoading}
          valueClassName="text-red-600"
        />
        <StatsCard
          icon={<CheckSquare className="h-4 w-4 text-emerald-500" />}
          label="Concluídas hoje"
          value={stats?.completed_today}
          isLoading={statsLoading}
        />
        <StatsCard
          icon={<Zap className="h-4 w-4 text-orange-500" />}
          label="Urgentes"
          value={stats?.urgent}
          isLoading={statsLoading}
          valueClassName={stats?.urgent ? 'text-orange-600' : undefined}
        />
      </div>

      {/* Filters */}
      <TaskFilters
        filters={filters}
        onFiltersChange={setFilters}
        consultants={consultants}
        currentUserId={user?.id}
      />

      {/* Task list */}
      <div className="space-y-1.5">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
              <Skeleton className="h-4 w-4 rounded" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium">Sem tarefas</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {filters.is_completed === 'true'
                ? 'Nenhuma tarefa concluída encontrada.'
                : 'Todas as tarefas estão em dia!'}
            </p>
            <Button
              variant="outline"
              className="mt-4 gap-2"
              onClick={() => { setFormDefaults(undefined); setShowForm(true) }}
            >
              <Plus className="h-4 w-4" />
              Criar tarefa
            </Button>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskListItem
              key={task.id}
              task={task}
              onToggleComplete={handleToggleComplete}
              onSelect={handleSelectTask}
            />
          ))
        )}
      </div>

      {/* Pagination info */}
      {total > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          A mostrar {tasks.length} de {total} tarefa{total !== 1 ? 's' : ''}
        </p>
      )}

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

// ─── Stats Card ──────────────────────────────────────────────

function StatsCard({
  icon,
  label,
  value,
  isLoading,
  valueClassName,
}: {
  icon: React.ReactNode
  label: string
  value?: number
  isLoading: boolean
  valueClassName?: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
          {icon}
        </div>
        <div>
          {isLoading ? (
            <Skeleton className="h-6 w-8" />
          ) : (
            <p className={`text-xl font-bold ${valueClassName || ''}`}>{value ?? 0}</p>
          )}
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
