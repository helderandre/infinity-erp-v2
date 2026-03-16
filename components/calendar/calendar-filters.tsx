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
import { Filter, Users, User, ClipboardList } from 'lucide-react'
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

export function CalendarFilters({
  categories,
  onToggleCategory,
  users,
  selectedUserId,
  onUserChange,
  filterSelf,
  onToggleFilterSelf,
}: CalendarFiltersProps) {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 pr-3">
        {/* Processos & Leads */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Automáticos</h3>
          </div>
          <div className="space-y-0.5">
            {AUTO_CATEGORIES.map((cat) => (
              <CategoryItem
                key={cat}
                cat={cat}
                isActive={categories.includes(cat)}
                onToggle={() => onToggleCategory(cat)}
              />
            ))}
          </div>
        </div>

        <Separator />

        {/* Processos */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Processos</h3>
          </div>
          <div className="space-y-0.5">
            {PROCESS_CATEGORIES.map((cat) => (
              <CategoryItem
                key={cat}
                cat={cat}
                isActive={categories.includes(cat)}
                onToggle={() => onToggleCategory(cat)}
              />
            ))}
          </div>
        </div>

        <Separator />

        {/* Eventos Manuais */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-2">Eventos</h3>
          <div className="space-y-0.5">
            {MANUAL_CATEGORIES.map((cat) => (
              <CategoryItem
                key={cat}
                cat={cat}
                isActive={categories.includes(cat)}
                onToggle={() => onToggleCategory(cat)}
              />
            ))}
          </div>
        </div>

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
