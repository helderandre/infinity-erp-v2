'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, MoreHorizontal, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { TaskListItem } from '@/components/tasks/task-list-item'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useTaskMutations } from '@/hooks/use-tasks'
import type { TaskWithRelations } from '@/types/task'

const DEFAULT_SECTION_LABEL = 'Sem secção'

interface TaskSectionsByFieldProps {
  tasks: TaskWithRelations[]
  taskListId: string
  onToggleComplete: (id: string, isCompleted: boolean) => void
  onSelect: (task: TaskWithRelations) => void
  onRefresh: () => void
  onCreateInSection: (section: string | null) => void
  isSelected: (task: TaskWithRelations) => boolean
}

export function TaskSectionsByField({
  tasks,
  taskListId,
  onToggleComplete,
  onSelect,
  onRefresh,
  onCreateInSection,
  isSelected,
}: TaskSectionsByFieldProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, TaskWithRelations[]>()
    for (const t of tasks) {
      const key = t.section?.trim() || ''
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }
    const entries = Array.from(map.entries())
    // Sort: section name A-Z, with "" (no section) first
    entries.sort(([a], [b]) => {
      if (a === '' && b !== '') return -1
      if (b === '' && a !== '') return 1
      return a.localeCompare(b, 'pt')
    })
    return entries
  }, [tasks])

  return (
    <div className="space-y-4">
      {grouped.map(([section, items]) => (
        <SectionGroup
          key={section || '__none__'}
          section={section}
          tasks={items}
          taskListId={taskListId}
          onToggleComplete={onToggleComplete}
          onSelect={onSelect}
          onRefresh={onRefresh}
          onCreateInSection={onCreateInSection}
          isSelected={isSelected}
        />
      ))}

      {/* Always offer a way to add a new section at the bottom */}
      <NewSectionInline onAdded={() => onRefresh()} />
    </div>
  )
}

// ─── Single section ────────────────────────────────────────────────────────

function SectionGroup({
  section,
  tasks,
  taskListId,
  onToggleComplete,
  onSelect,
  onRefresh,
  onCreateInSection,
  isSelected,
}: {
  section: string
  tasks: TaskWithRelations[]
  taskListId: string
  onToggleComplete: (id: string, isCompleted: boolean) => void
  onSelect: (task: TaskWithRelations) => void
  onRefresh: () => void
  onCreateInSection: (section: string | null) => void
  isSelected: (task: TaskWithRelations) => boolean
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(section)
  const { updateTask } = useTaskMutations()

  const label = section || DEFAULT_SECTION_LABEL
  const canEdit = !!section

  const renameSection = async () => {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === section) {
      setIsRenaming(false)
      setNewName(section)
      return
    }
    try {
      // Update every task in this section (in the current page)
      await Promise.all(tasks.map((t) => updateTask(t.id, { section: trimmed })))
      toast.success('Secção renomeada')
      onRefresh()
    } catch {
      toast.error('Erro ao renomear secção')
    } finally {
      setIsRenaming(false)
    }
  }

  const deleteSection = async () => {
    try {
      await Promise.all(tasks.map((t) => updateTask(t.id, { section: null })))
      toast.success('Secção eliminada; tarefas mantidas')
      onRefresh()
    } catch {
      toast.error('Erro ao eliminar secção')
    }
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 py-1.5 px-2.5 text-[13px] font-semibold tracking-tight group/header">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-1.5 hover:bg-muted/40 rounded-md -ml-1 pl-1 py-0.5 transition-colors flex-1 min-w-0"
        >
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0',
              collapsed && '-rotate-90',
            )}
            strokeWidth={2.5}
          />
          {isRenaming ? (
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={renameSection}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); renameSection() }
                if (e.key === 'Escape') { setIsRenaming(false); setNewName(section) }
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-6 text-[13px] font-semibold"
              autoFocus
            />
          ) : (
            <span className={cn(!section && 'text-muted-foreground/70 italic font-medium')}>{label}</span>
          )}
          <span className="text-muted-foreground/70 font-normal text-xs">{tasks.length}</span>
        </button>

        <div className="flex items-center gap-0.5 opacity-0 group-hover/header:opacity-100 transition-opacity">
          <button
            type="button"
            title="Adicionar tarefa nesta secção"
            onClick={() => onCreateInSection(section || null)}
            className="size-5 rounded hover:bg-muted text-muted-foreground/60 hover:text-foreground flex items-center justify-center"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="size-5 rounded hover:bg-muted text-muted-foreground/60 hover:text-foreground flex items-center justify-center"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => { setNewName(section); setIsRenaming(true) }}>
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  Renomear
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={deleteSection}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Eliminar secção
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex-1 ml-2 h-px bg-border/60" />
      </div>

      {!collapsed && (
        <div className="mt-0.5">
          {tasks.map((t) => (
            <TaskListItem
              key={t.id}
              task={t}
              onToggleComplete={onToggleComplete}
              onSelect={onSelect}
              onRefresh={onRefresh}
              isSelected={isSelected(t)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Inline "Nova secção" ──────────────────────────────────────────────────

function NewSectionInline({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  // Creating a section is done by creating a task with that section;
  // but empty sections can't exist. So this is deferred: once the user
  // adds the first task via + on the section header (or creates here
  // directly) the section appears. For now we expose a helper that simply
  // opens a prompt — the main create-in-section flow is the "+ row" inside
  // each section.
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12.5px] text-muted-foreground/70 hover:text-foreground hover:bg-muted/40 rounded-md transition-colors"
      >
        <Plus className="h-3 w-3" />
        Nova secção
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5 py-1 px-2.5">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome da secção..."
        className="h-7 text-[13px]"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setOpen(false); setName('') }
        }}
      />
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs"
        onClick={() => { setOpen(false); setName('') }}
      >
        Cancelar
      </Button>
    </div>
  )
}
