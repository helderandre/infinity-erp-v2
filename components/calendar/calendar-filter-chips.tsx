'use client'

import type { CalendarCategory } from '@/types/calendar'
import {
  CALENDAR_CATEGORY_LABELS,
  CALENDAR_CATEGORY_COLORS,
} from '@/types/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  ChevronDown,
  Filter,
  ClipboardList,
  User,
  X,
  Check,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

// ── Group definitions ────────────────────────────────────────────────────

const AUTO_CATEGORIES: CalendarCategory[] = [
  'contract_expiry', 'lead_expiry', 'lead_followup',
]
const PROCESS_CATEGORIES: CalendarCategory[] = [
  'process_task', 'process_subtask',
]
const MANUAL_CATEGORIES: CalendarCategory[] = [
  'birthday', 'vacation', 'company_event',
  'marketing_event', 'meeting', 'visit', 'reminder', 'custom',
]

interface CalendarFilterChipsProps {
  categories: CalendarCategory[]
  onToggleCategory: (category: CalendarCategory) => void
  onSetCategories?: (categories: CalendarCategory[]) => void
  users: { id: string; name: string }[]
  selectedUserId?: string
  onUserChange: (userId?: string) => void
  filterSelf: boolean
  onToggleFilterSelf: () => void
  showTasks?: boolean
  onToggleShowTasks?: () => void
  taskCount?: number
  className?: string
}

export function CalendarFilterChips({
  categories,
  onToggleCategory,
  onSetCategories,
  users,
  selectedUserId,
  onUserChange,
  filterSelf,
  onToggleFilterSelf,
  showTasks = true,
  onToggleShowTasks,
  taskCount,
  className,
}: CalendarFilterChipsProps) {
  const activeIn = (group: CalendarCategory[]) =>
    group.filter((c) => categories.includes(c)).length

  const allCategories = [...AUTO_CATEGORIES, ...PROCESS_CATEGORIES, ...MANUAL_CATEGORIES]
  const anyActive =
    categories.length < allCategories.length ||
    filterSelf ||
    Boolean(selectedUserId) ||
    !showTasks

  const selectedUser = users.find((u) => u.id === selectedUserId)

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 overflow-x-auto no-scrollbar px-0.5 py-1.5',
        className
      )}
    >
      <CategoryGroupChip
        label="Automáticos"
        icon={<Filter className="h-3.5 w-3.5" />}
        group={AUTO_CATEGORIES}
        activeCount={activeIn(AUTO_CATEGORIES)}
        activeCategories={categories}
        onToggleCategory={onToggleCategory}
        onSetCategories={onSetCategories}
      />
      <CategoryGroupChip
        label="Processos"
        icon={<ClipboardList className="h-3.5 w-3.5" />}
        group={PROCESS_CATEGORIES}
        activeCount={activeIn(PROCESS_CATEGORIES)}
        activeCategories={categories}
        onToggleCategory={onToggleCategory}
        onSetCategories={onSetCategories}
      />
      <CategoryGroupChip
        label="Eventos"
        icon={null}
        group={MANUAL_CATEGORIES}
        activeCount={activeIn(MANUAL_CATEGORIES)}
        activeCategories={categories}
        onToggleCategory={onToggleCategory}
        onSetCategories={onSetCategories}
      />

      {/* Tarefas — toggles the /api/tasks layer (personal + proc + visit proposals) */}
      {onToggleShowTasks && (
        <TasksToggleChip
          active={showTasks}
          onClick={onToggleShowTasks}
          count={taskCount}
        />
      )}

      <div className="h-5 w-px bg-border mx-1 shrink-0" aria-hidden />

      <ToggleChip active={filterSelf} onClick={onToggleFilterSelf} icon={<User className="h-3.5 w-3.5" />}>
        Apenas os meus
      </ToggleChip>

      <PersonSelectChip
        users={users}
        selectedUser={selectedUser}
        onChange={onUserChange}
        disabled={filterSelf}
      />

      {anyActive && onSetCategories && (
        <>
          <div className="flex-1 min-w-0" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onSetCategories(allCategories)
              if (filterSelf) onToggleFilterSelf()
              onUserChange(undefined)
              if (!showTasks && onToggleShowTasks) onToggleShowTasks()
            }}
            className="h-8 shrink-0 rounded-full text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Limpar
          </Button>
        </>
      )}
    </div>
  )
}

// ── Sub-chips ────────────────────────────────────────────────────────────

function CategoryGroupChip({
  label,
  icon,
  group,
  activeCount,
  activeCategories,
  onToggleCategory,
  onSetCategories,
}: {
  label: string
  icon?: React.ReactNode
  group: CalendarCategory[]
  activeCount: number
  activeCategories: CalendarCategory[]
  onToggleCategory: (c: CalendarCategory) => void
  onSetCategories?: (cats: CalendarCategory[]) => void
}) {
  const total = group.length
  const allActive = activeCount === total
  const dim = activeCount === 0

  const toggleGroup = () => {
    if (!onSetCategories) return
    if (allActive) {
      onSetCategories(activeCategories.filter((c) => !group.includes(c)))
    } else {
      const toAdd = group.filter((c) => !activeCategories.includes(c))
      onSetCategories([...activeCategories, ...toAdd])
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors',
            dim
              ? 'bg-background text-muted-foreground ring-border hover:bg-muted'
              : 'bg-foreground text-background ring-foreground',
          )}
        >
          {icon}
          <span>{label}</span>
          <span
            className={cn(
              'inline-flex items-center justify-center rounded-full text-[10px] min-w-[1rem] px-1',
              dim ? 'bg-muted text-muted-foreground' : 'bg-background/20 text-background',
            )}
          >
            {activeCount}/{total}
          </span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2" align="start">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b mb-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          {onSetCategories && (
            <button
              type="button"
              onClick={toggleGroup}
              className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              {allActive ? 'Nenhum' : 'Todos'}
            </button>
          )}
        </div>
        <div className="space-y-0.5">
          {group.map((cat) => {
            const isActive = activeCategories.includes(cat)
            const colors = CALENDAR_CATEGORY_COLORS[cat]
            const catLabel = CALENDAR_CATEGORY_LABELS[cat]
            return (
              <label
                key={cat}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer hover:bg-muted"
              >
                <Checkbox
                  checked={isActive}
                  onCheckedChange={() => onToggleCategory(cat)}
                  className="h-3.5 w-3.5"
                />
                <span className={cn('h-2 w-2 rounded-full shrink-0', colors.dot)} />
                <span className="truncate">{catLabel}</span>
              </label>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function TasksToggleChip({
  active,
  onClick,
  count,
}: {
  active: boolean
  onClick: () => void
  count?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors',
        active
          ? 'bg-foreground text-background ring-foreground'
          : 'bg-background text-muted-foreground ring-border hover:bg-muted',
      )}
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      <span>Tarefas</span>
      {typeof count === 'number' && (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full text-[10px] min-w-[1rem] px-1 tabular-nums',
            active ? 'bg-background/20 text-background' : 'bg-muted text-muted-foreground',
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function ToggleChip({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors',
        active
          ? 'bg-foreground text-background ring-foreground'
          : 'bg-background text-muted-foreground ring-border hover:bg-muted',
      )}
    >
      {icon}
      {children}
    </button>
  )
}

function PersonSelectChip({
  users,
  selectedUser,
  onChange,
  disabled,
}: {
  users: { id: string; name: string }[]
  selectedUser?: { id: string; name: string }
  onChange: (id?: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const active = Boolean(selectedUser)

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(query.trim().toLowerCase())
  )

  return (
    <Popover
      open={disabled ? false : open}
      onOpenChange={(v) => (!disabled ? setOpen(v) : undefined)}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors max-w-[180px]',
            disabled && 'opacity-50 cursor-not-allowed',
            active
              ? 'bg-foreground text-background ring-foreground'
              : 'bg-background text-muted-foreground ring-border hover:bg-muted',
          )}
        >
          <User className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span className="truncate">
            {selectedUser ? selectedUser.name : 'Pessoa'}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Procurar pessoa…"
          className="w-full rounded-md border px-2 py-1.5 text-xs mb-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
          autoFocus
        />
        <button
          type="button"
          onClick={() => {
            onChange(undefined)
            setOpen(false)
            setQuery('')
          }}
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted',
            !selectedUser && 'font-semibold',
          )}
        >
          <span>Todas as pessoas</span>
          {!selectedUser && <Check className="h-3.5 w-3.5" />}
        </button>
        <div className="max-h-[260px] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">Sem resultados.</p>
          ) : (
            filtered.map((u) => {
              const isSelected = u.id === selectedUser?.id
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    onChange(u.id)
                    setOpen(false)
                    setQuery('')
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted',
                    isSelected && 'font-semibold',
                  )}
                >
                  <span className="truncate">{u.name}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
