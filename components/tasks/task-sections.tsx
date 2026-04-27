'use client'

import { useState } from 'react'
import { addDays, isAfter, isBefore, isToday, isTomorrow, startOfDay } from 'date-fns'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TaskListItem } from '@/components/tasks/task-list-item'
import type { TaskWithRelations } from '@/types/task'

type SectionKey = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'nodate'

interface Section {
  key: SectionKey
  label: string
  accent?: string
  tasks: TaskWithRelations[]
}

function bucketize(tasks: TaskWithRelations[]): Section[] {
  const now = new Date()
  const todayStart = startOfDay(now)
  const weekEnd = addDays(todayStart, 7)

  const overdue: TaskWithRelations[] = []
  const today: TaskWithRelations[] = []
  const tomorrow: TaskWithRelations[] = []
  const week: TaskWithRelations[] = []
  const later: TaskWithRelations[] = []
  const nodate: TaskWithRelations[] = []

  for (const t of tasks) {
    if (!t.due_date) {
      nodate.push(t)
      continue
    }
    const d = new Date(t.due_date)
    if (isBefore(d, todayStart)) overdue.push(t)
    else if (isToday(d)) today.push(t)
    else if (isTomorrow(d)) tomorrow.push(t)
    else if (isBefore(d, weekEnd)) week.push(t)
    else if (isAfter(d, weekEnd) || +d === +weekEnd) later.push(t)
    else later.push(t)
  }

  // ordenar por data asc dentro de cada bucket (nodate mantém order_index)
  const byDate = (a: TaskWithRelations, b: TaskWithRelations) =>
    new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime()
  overdue.sort(byDate)
  today.sort(byDate)
  tomorrow.sort(byDate)
  week.sort(byDate)
  later.sort(byDate)

  const all: Section[] = [
    { key: 'overdue', label: 'Em atraso', accent: 'text-red-600', tasks: overdue },
    { key: 'today', label: 'Hoje', tasks: today },
    { key: 'tomorrow', label: 'Amanhã', tasks: tomorrow },
    { key: 'week', label: 'Esta semana', tasks: week },
    { key: 'later', label: 'Mais tarde', tasks: later },
    { key: 'nodate', label: 'Sem data', tasks: nodate },
  ]
  return all.filter((s) => s.tasks.length > 0)
}

interface TaskSectionsProps {
  tasks: TaskWithRelations[]
  onToggleComplete: (id: string, isCompleted: boolean) => void
  onSelect: (task: TaskWithRelations) => void
  onRefresh?: () => void
  isSelected: (task: TaskWithRelations) => boolean
  /**
   * Tasks completed today, rendered as a final "Concluídas hoje" section
   * with strikethrough styling. Clicking the check uncompletes them.
   */
  completedToday?: TaskWithRelations[]
}

export function TaskSections({
  tasks,
  onToggleComplete,
  onSelect,
  onRefresh,
  isSelected,
  completedToday = [],
}: TaskSectionsProps) {
  const sections = bucketize(tasks)
  const [collapsed, setCollapsed] = useState<Record<SectionKey | 'completed_today', boolean>>({
    overdue: false,
    today: false,
    tomorrow: false,
    week: false,
    later: true,
    nodate: true,
    completed_today: false,
  })

  const toggle = (key: SectionKey | 'completed_today') =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <div key={section.key}>
          <button
            type="button"
            onClick={() => toggle(section.key)}
            className="w-full flex items-center gap-1.5 py-1.5 px-2.5 text-[13px] font-semibold tracking-tight hover:bg-muted/40 rounded-md transition-colors group"
          >
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0',
                collapsed[section.key] && '-rotate-90',
              )}
              strokeWidth={2.5}
            />
            <span className={cn(section.accent || 'text-foreground')}>{section.label}</span>
            <span className="text-muted-foreground font-normal text-xs">
              {section.tasks.length}
            </span>
            <div className="flex-1 ml-2 h-px bg-border/60" />
          </button>

          {!collapsed[section.key] && (
            <div className="mt-1">
              {section.tasks.map((task) => (
                <TaskListItem
                  key={task.id}
                  task={task}
                  onToggleComplete={onToggleComplete}
                  onSelect={onSelect}
                  onRefresh={onRefresh}
                  isSelected={isSelected(task)}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {completedToday.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => toggle('completed_today')}
            className="w-full flex items-center gap-1.5 py-1.5 px-2.5 text-[13px] font-semibold tracking-tight hover:bg-muted/40 rounded-md transition-colors"
          >
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0',
                collapsed.completed_today && '-rotate-90',
              )}
              strokeWidth={2.5}
            />
            <span className="text-emerald-600">Concluídas hoje</span>
            <span className="text-muted-foreground font-normal text-xs">
              {completedToday.length}
            </span>
            <div className="flex-1 ml-2 h-px bg-border/60" />
          </button>

          {!collapsed.completed_today && (
            <div className="mt-1">
              {completedToday.map((task) => (
                <TaskListItem
                  key={task.id}
                  task={task}
                  onToggleComplete={onToggleComplete}
                  onSelect={onSelect}
                  onRefresh={onRefresh}
                  isSelected={isSelected(task)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
