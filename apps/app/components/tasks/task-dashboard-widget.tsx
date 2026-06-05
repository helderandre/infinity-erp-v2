'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format, isPast, isToday } from 'date-fns'
import { pt } from 'date-fns/locale'
import { CheckSquare, AlertTriangle, ChevronRight, Clock } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { TASK_PRIORITY_MAP } from '@/types/task'

interface TaskStatsData {
  pending: number
  overdue: number
  completed_today: number
  urgent: number
  upcoming: Array<{
    id: string
    title: string
    priority: number
    due_date: string
    entity_type: string | null
    entity_id: string | null
  }>
}

export function TaskDashboardWidget() {
  const [stats, setStats] = useState<TaskStatsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/tasks/stats')
      .then((res) => res.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CheckSquare className="h-4 w-4" />
          Tarefas
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" asChild>
          <Link href="/dashboard/tarefas">
            Ver todas
            <ChevronRight className="h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : stats ? (
          <>
            {/* Summary row */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{stats.pending}</span>
                <span className="text-muted-foreground">pendentes</span>
              </div>
              {stats.overdue > 0 && (
                <div className="flex items-center gap-1.5 text-red-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="font-medium">{stats.overdue}</span>
                  <span>em atraso</span>
                </div>
              )}
            </div>

            {/* Upcoming tasks */}
            {stats.upcoming.length > 0 && (
              <div className="space-y-1">
                {stats.upcoming.map((task) => {
                  const priority = TASK_PRIORITY_MAP[task.priority as keyof typeof TASK_PRIORITY_MAP]
                  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date))

                  return (
                    <Link
                      key={task.id}
                      href={`/dashboard/tarefas?task=${task.id}`}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                    >
                      <span className={cn('h-2 w-2 rounded-full shrink-0', priority.dot)} />
                      <span className="flex-1 truncate">{task.title}</span>
                      {task.due_date && (
                        <span className={cn(
                          'text-xs text-muted-foreground shrink-0',
                          isOverdue && 'text-red-600 font-medium',
                        )}>
                          {format(new Date(task.due_date), 'd MMM', { locale: pt })}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}

            {stats.pending === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Todas as tarefas em dia!
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Erro ao carregar tarefas</p>
        )}
      </CardContent>
    </Card>
  )
}
