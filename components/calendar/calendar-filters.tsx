'use client'

import type { CalendarCategory } from '@/types/calendar'
import {
  CALENDAR_CATEGORY_LABELS,
  CALENDAR_CATEGORY_COLORS,
} from '@/types/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Filter, Users, User, ClipboardList, CheckCheck, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// Group categories for a cleaner UI
const AUTO_CATEGORIES: CalendarCategory[] = [
  'contract_expiry', 'lead_expiry', 'lead_followup',
]
const PROCESS_CATEGORIES: CalendarCategory[] = [
  'process_task', 'process_subtask',
]
const MANUAL_CATEGORIES: CalendarCategory[] = [
  'birthday', 'vacation', 'company_event',
  'marketing_event', 'meeting', 'reminder', 'custom',
]

interface CalendarFiltersProps {
  categories: CalendarCategory[]
  onToggleCategory: (category: CalendarCategory) => void
  onSetCategories?: (categories: CalendarCategory[]) => void
  users: { id: string; name: string }[]
  selectedUserId?: string
  onUserChange: (userId?: string) => void
  filterSelf: boolean
  onToggleFilterSelf: () => void
}

function CategoryItem({
  cat,
  isActive,
  onToggle,
}: {
  cat: CalendarCategory
  isActive: boolean
  onToggle: () => void
}) {
  const colors = CALENDAR_CATEGORY_COLORS[cat]
  const label = CALENDAR_CATEGORY_LABELS[cat]

  return (
    <label
      className={cn(
        'flex items-center gap-2 rounded px-2 py-1 text-sm cursor-pointer transition-colors hover:bg-muted/50',
      )}
    >
      <Checkbox
        checked={isActive}
        onCheckedChange={onToggle}
        className="h-3.5 w-3.5"
      />
      <span className={cn('h-2 w-2 rounded-full shrink-0', colors.dot)} />
      <span className="truncate text-xs">{label}</span>
    </label>
  )
}

function CategoryGroup({
  label,
  icon,
  groupCategories,
  activeCategories,
  onToggleCategory,
  onSetCategories,
  allCategories,
}: {
  label: string
  icon: React.ReactNode
  groupCategories: CalendarCategory[]
  activeCategories: CalendarCategory[]
  onToggleCategory: (cat: CalendarCategory) => void
  onSetCategories?: (cats: CalendarCategory[]) => void
  allCategories: CalendarCategory[]
}) {
  const allActive = groupCategories.every((c) => activeCategories.includes(c))
  const someActive = groupCategories.some((c) => activeCategories.includes(c))

  const handleToggleGroup = () => {
    if (!onSetCategories) return
    if (allActive) {
      // Remove all group categories
      onSetCategories(activeCategories.filter((c) => !groupCategories.includes(c)))
    } else {
      // Add all group categories
      const toAdd = groupCategories.filter((c) => !activeCategories.includes(c))
      onSetCategories([...activeCategories, ...toAdd])
    }
  }

  return (
    <div>
      <label
        className="flex items-center gap-2 mb-2 cursor-pointer group"
        onClick={(e) => { e.preventDefault(); handleToggleGroup() }}
      >
        <Checkbox
          checked={allActive ? true : someActive ? 'indeterminate' : false}
          onCheckedChange={handleToggleGroup}
          className="h-3.5 w-3.5"
        />
        {icon}
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide group-hover:text-foreground transition-colors">
          {label}
        </h3>
      </label>
      <div className="space-y-0.5 pl-1">
        {groupCategories.map((cat) => (
          <CategoryItem
            key={cat}
            cat={cat}
            isActive={activeCategories.includes(cat)}
            onToggle={() => onToggleCategory(cat)}
          />
        ))}
      </div>
    </div>
  )
}

export function CalendarFilters({
  categories,
  onToggleCategory,
  onSetCategories,
  users,
  selectedUserId,
  onUserChange,
  filterSelf,
  onToggleFilterSelf,
}: CalendarFiltersProps) {
  const allCategories = [...AUTO_CATEGORIES, ...PROCESS_CATEGORIES, ...MANUAL_CATEGORIES]
  const allSelected = allCategories.every(c => categories.includes(c))

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 pr-3">
        {/* Select All / Deselect All */}
        {onSetCategories && (
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 rounded-full text-[10px] px-2 flex-1"
              onClick={() => onSetCategories(allCategories)}
              disabled={allSelected}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Seleccionar todos
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 rounded-full text-[10px] px-2 flex-1"
              onClick={() => onSetCategories([allCategories[0]])}
              disabled={categories.length <= 1}
            >
              <XCircle className="mr-1 h-3 w-3" />
              Limpar
            </Button>
          </div>
        )}

        {/* Automáticos */}
        <CategoryGroup
          label="Automáticos"
          icon={<Filter className="h-3.5 w-3.5 text-muted-foreground" />}
          groupCategories={AUTO_CATEGORIES}
          activeCategories={categories}
          onToggleCategory={onToggleCategory}
          onSetCategories={onSetCategories}
          allCategories={allCategories}
        />

        <Separator />

        {/* Processos */}
        <CategoryGroup
          label="Processos"
          icon={<ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />}
          groupCategories={PROCESS_CATEGORIES}
          activeCategories={categories}
          onToggleCategory={onToggleCategory}
          onSetCategories={onSetCategories}
          allCategories={allCategories}
        />

        <Separator />

        {/* Eventos Manuais */}
        <CategoryGroup
          label="Eventos"
          icon={null}
          groupCategories={MANUAL_CATEGORIES}
          activeCategories={categories}
          onToggleCategory={onToggleCategory}
          onSetCategories={onSetCategories}
          allCategories={allCategories}
        />

        <Separator />

        {/* Pessoas */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pessoas</h3>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 rounded px-2 py-1 text-sm cursor-pointer transition-colors hover:bg-muted/50">
              <Checkbox
                checked={filterSelf}
                onCheckedChange={onToggleFilterSelf}
                className="h-3.5 w-3.5"
              />
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs">Apenas os meus</span>
            </label>

            <div className="px-2">
              <Label className="text-xs text-muted-foreground mb-1 block">
                Filtrar por pessoa
              </Label>
              <Select
                value={selectedUserId ?? 'all'}
                onValueChange={(v) => onUserChange(v === 'all' ? undefined : v)}
                disabled={filterSelf}
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}
