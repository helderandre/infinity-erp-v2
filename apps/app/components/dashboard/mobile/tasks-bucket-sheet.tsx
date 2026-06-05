'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { isPast, isToday, parseISO } from 'date-fns'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  CheckCircle2,
  Hourglass,
  AlertCircle,
  ListTodo,
  Workflow,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { CalendarTaskRow } from '@/components/calendar/calendar-task-row'
import { TaskDetailSheet } from '@/components/tasks/task-detail-sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { TaskWithRelations } from '@/types/task'
import { toast } from 'sonner'

export type TaskBucket = 'today' | 'soon' | 'overdue'

interface TasksBucketSheetProps {
  userId: string
  bucket: TaskBucket | null
  onOpenChange: (open: boolean) => void
}

const SOON_DAYS = 7

const BUCKET_META: Record<
  TaskBucket,
  { title: string; icon: React.ElementType; tone: string }
> = {
  today: {
    title: 'Por fazer hoje',
    icon: CheckCircle2,
    tone: 'text-sky-700 dark:text-sky-300',
  },
  soon: {
    title: 'Em breve',
    icon: Hourglass,
    tone: 'text-amber-700 dark:text-amber-300',
  },
  overdue: {
    title: 'Em atraso',
    icon: AlertCircle,
    tone: 'text-red-700 dark:text-red-300',
  },
}

export function TasksBucketSheet({
  userId,
  bucket,
  onOpenChange,
}: TasksBucketSheetProps) {
  const isMobile = useIsMobile()
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [loading, setLoading] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        is_completed: 'false',
        limit: '500',
      })
      const res = await fetch(`/api/tasks?${params.toString()}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      const all: TaskWithRelations[] = (json.data ?? []).filter(
        (t: TaskWithRelations) =>
          t.assigned_to === userId || t.created_by === userId,
      )
      setTasks(all)
    } catch {
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (bucket) load()
  }, [bucket, load])

  const filtered = useMemo(() => {
    if (!bucket) return []
    const now = new Date()
    const soonEnd = new Date(now)
    soonEnd.setDate(soonEnd.getDate() + SOON_DAYS)
    const result: TaskWithRelations[] = []
    for (const t of tasks) {
      if (!t.due_date) continue
      let d: Date
      try {
        d = parseISO(t.due_date)
      } catch {
        continue
      }
      const matchToday = isToday(d)
      const matchPast = !matchToday && isPast(d)
      const matchSoon = !matchToday && !matchPast && d <= soonEnd
      if (bucket === 'today' && matchToday) result.push(t)
      else if (bucket === 'soon' && matchSoon) result.push(t)
      else if (bucket === 'overdue' && matchPast) result.push(t)
    }
    return result.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      const at = a.due_date ? parseISO(a.due_date).getTime() : 0
      const bt = b.due_date ? parseISO(b.due_date).getTime() : 0
      return at - bt
    })
  }, [tasks, bucket])

  const { normalTasks, processTasks } = useMemo(() => {
    const normal: TaskWithRelations[] = []
    const proc: TaskWithRelations[] = []
    for (const t of filtered) {
      if (t.source === 'proc_task' || t.source === 'proc_subtask') {
        proc.push(t)
      } else {
        normal.push(t)
      }
    }
    return { normalTasks: normal, processTasks: proc }
  }, [filtered])

  const toggleTaskComplete = useCallback(
    async (taskId: string, isCompleted: boolean) => {
      // Optimistic flip
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, is_completed: !isCompleted } : t,
        ),
      )
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_completed: !isCompleted }),
        })
        if (!res.ok) throw new Error()
      } catch {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, is_completed: isCompleted } : t,
          ),
        )
        toast.error('Não foi possível actualizar a tarefa')
      }
    },
    [],
  )

  const meta = bucket ? BUCKET_META[bucket] : null
  const Icon = meta?.icon ?? CheckCircle2

  return (
    <>
      <Sheet
        open={bucket !== null}
        onOpenChange={(o) => !o && onOpenChange(false)}
      >
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={cn(
            'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
            'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
            isMobile
              ? 'data-[side=bottom]:h-[80dvh] rounded-t-3xl'
              : 'w-full data-[side=right]:sm:max-w-[480px] sm:rounded-l-3xl',
          )}
        >
          {isMobile && (
            <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
          )}

          <SheetHeader className="shrink-0 px-6 pt-8 pb-3 gap-0 flex-row items-start justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Icon className={cn('h-4 w-4 shrink-0', meta?.tone)} />
                <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight truncate">
                  {meta?.title ?? 'Tarefas'}
                </SheetTitle>
              </div>
              <SheetDescription className="sr-only">
                Tarefas nesta categoria
              </SheetDescription>
              {!loading && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {filtered.length}{' '}
                  {filtered.length === 1 ? 'tarefa' : 'tarefas'}
                </p>
              )}
            </div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-full gap-1.5 shrink-0"
            >
              <Link
                href="/dashboard/tarefas"
                onClick={() => onOpenChange(false)}
              >
                Ver todas
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </SheetHeader>

          <div className="flex-1 min-h-0 flex flex-col px-3 pb-5 pt-2">
            {loading ? (
              <div className="space-y-2 px-1">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Sem tarefas nesta categoria</p>
              </div>
            ) : (
              <Tabs
                defaultValue="normal"
                className="flex flex-col flex-1 min-h-0 gap-2 px-1"
              >
                <TabsList className="bg-transparent p-0 h-auto justify-start gap-1.5 rounded-none">
                  <TabsTrigger
                    value="normal"
                    className={cn(
                      'gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      'bg-background/60 text-foreground/80 border-border/40 hover:bg-muted/60',
                      'data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground data-[state=active]:shadow-none',
                      '[&[data-state=active]_.count]:bg-white/20 [&[data-state=active]_.count]:text-white',
                    )}
                  >
                    <ListTodo className="h-3.5 w-3.5" />
                    Tarefas
                    {normalTasks.length > 0 && (
                      <span className="count ml-1 tabular-nums text-[10px] rounded-full px-1.5 py-0.5 bg-muted/60 text-muted-foreground">
                        {normalTasks.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="process"
                    className={cn(
                      'gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      'bg-background/60 text-foreground/80 border-border/40 hover:bg-muted/60',
                      'data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground data-[state=active]:shadow-none',
                      '[&[data-state=active]_.count]:bg-white/20 [&[data-state=active]_.count]:text-white',
                    )}
                  >
                    <Workflow className="h-3.5 w-3.5" />
                    Processos
                    {processTasks.length > 0 && (
                      <span className="count ml-1 tabular-nums text-[10px] rounded-full px-1.5 py-0.5 bg-muted/60 text-muted-foreground">
                        {processTasks.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent
                  value="normal"
                  className="flex-1 min-h-0 overflow-y-auto mt-0"
                >
                  {normalTasks.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-muted-foreground">
                      <ListTodo className="h-7 w-7 mb-2 opacity-40" />
                      <p className="text-sm">Sem tarefas normais</p>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {normalTasks.map((task) => (
                        <CalendarTaskRow
                          key={task.id}
                          task={task}
                          onSelect={(t) => setDetailId(t.id)}
                          onToggleComplete={toggleTaskComplete}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent
                  value="process"
                  className="flex-1 min-h-0 overflow-y-auto mt-0"
                >
                  {processTasks.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-muted-foreground">
                      <Workflow className="h-7 w-7 mb-2 opacity-40" />
                      <p className="text-sm">Sem tarefas de processos</p>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {processTasks.map((task) => (
                        <CalendarTaskRow
                          key={task.id}
                          task={task}
                          onSelect={(t) => setDetailId(t.id)}
                          onToggleComplete={toggleTaskComplete}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <TaskDetailSheet
        taskId={detailId}
        open={detailId !== null}
        onOpenChange={(o) => !o && setDetailId(null)}
        onRefresh={load}
        onCreateSubTask={() => {}}
      />
    </>
  )
}
