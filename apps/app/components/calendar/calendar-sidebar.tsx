'use client'

import { useMemo, useState } from 'react'
import type { CalendarCategory, CalendarEvent } from '@/types/calendar'
import {
  CALENDAR_CATEGORY_COLORS,
  CALENDAR_CATEGORY_LABELS,
} from '@/types/calendar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CalendarSidebarUser {
  id: string
  name: string
  photo?: string | null
}

interface CalendarSidebarProps {
  /** Eventos do período visível — usados para as bolhas de contagem. */
  events: CalendarEvent[]
  /** Categorias actualmente activas (estado partilhado com os filtros). */
  categories: CalendarCategory[]
  /** Preset por defeito do role — usado para listar e para "Limpar". */
  defaultCategories: CalendarCategory[]
  onSetCategories: (categories: CalendarCategory[]) => void
  /** Lista de consultores — só relevante quando `isManager`. */
  users: CalendarSidebarUser[]
  selectedUserId?: string
  onSelectUser: (userId: string | undefined) => void
  /** Tab "Consultores" é exclusiva de gestão. */
  isManager: boolean
}

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x) => b.includes(x))

/**
 * Barra lateral esquerda do calendário (desktop only — o caller esconde em
 * mobile). Estilo mube-crm: legenda de categorias clicável que filtra a
 * vista para "só aquelas", e — para gestão — uma segunda tab com a lista de
 * consultores cujo card filtra o calendário para essa pessoa.
 */
export function CalendarSidebar({
  events,
  categories,
  defaultCategories,
  onSetCategories,
  users,
  selectedUserId,
  onSelectUser,
  isManager,
}: CalendarSidebarProps) {
  const [tab, setTab] = useState<'categorias' | 'consultores'>('categorias')
  const [userSearch, setUserSearch] = useState('')

  // Há uma selecção explícita quando o set activo difere do preset do role.
  const hasSelection = !sameSet(categories, defaultCategories)

  // Contagens do período visível. NOTA: `events` chega já filtrado pela API
  // (categorias/consultor activos), portanto as bolhas só são mostradas em
  // linhas não-dimmed — para as restantes a contagem seria 0 enganador.
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of events) map.set(e.category, (map.get(e.category) ?? 0) + 1)
    return map
  }, [events])

  const userCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of events) {
      if (e.user_id) map.set(e.user_id, (map.get(e.user_id) ?? 0) + 1)
    }
    return map
  }, [events])

  const handleCategoryClick = (cat: CalendarCategory) => {
    if (!hasSelection) {
      onSetCategories([cat])
      return
    }
    if (categories.includes(cat)) {
      const next = categories.filter((c) => c !== cat)
      onSetCategories(next.length ? next : defaultCategories)
    } else {
      onSetCategories([...categories, cat])
    }
  }

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => u.name.toLowerCase().includes(q))
  }, [users, userSearch])

  return (
    <div className="flex h-full flex-col gap-3 p-3 overflow-hidden">
      {/* Tab picker — só gestão tem a segunda tab */}
      {isManager ? (
        <div className="grid grid-cols-2 rounded-full bg-muted/50 p-1 text-xs font-medium shrink-0">
          {(
            [
              ['categorias', 'Categorias'],
              ['consultores', 'Consultores'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                'rounded-full px-3 py-1.5 transition-colors',
                tab === value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
          Legenda
        </h3>
      )}

      {/* ─── Categorias ─────────────────────────────────────────────── */}
      {tab === 'categorias' && (
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          {isManager && (
            <div className="flex items-center justify-between px-1 shrink-0">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Legenda
              </h3>
              {hasSelection && (
                <button
                  type="button"
                  onClick={() => onSetCategories(defaultCategories)}
                  className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Limpar
                </button>
              )}
            </div>
          )}
          {!isManager && hasSelection && (
            <button
              type="button"
              onClick={() => onSetCategories(defaultCategories)}
              className="self-end px-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              Limpar
            </button>
          )}
          <ul className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
            {defaultCategories.map((cat) => {
              const colors = CALENDAR_CATEGORY_COLORS[cat]
              const isActive = hasSelection && categories.includes(cat)
              const isDimmed = hasSelection && !isActive
              const count = categoryCounts.get(cat) ?? 0
              return (
                <li key={cat}>
                  <button
                    type="button"
                    onClick={() => handleCategoryClick(cat)}
                    aria-pressed={isActive}
                    className={cn(
                      'w-full flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-all cursor-pointer',
                      isActive
                        ? 'border-border bg-muted/70 ring-1 ring-foreground/10 shadow-sm'
                        : 'border-border/50 bg-background/60 hover:bg-muted/40',
                      isDimmed && 'opacity-50',
                    )}
                  >
                    <span
                      className={cn(
                        'h-3.5 w-3.5 rounded-full shrink-0 ring-1 ring-black/5',
                        colors?.dot || 'bg-primary',
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {CALENDAR_CATEGORY_LABELS[cat]}
                    </span>
                    {!isDimmed && (
                      <span
                        className={cn(
                          'shrink-0 min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-semibold inline-flex items-center justify-center tabular-nums',
                          isActive
                            ? 'bg-foreground text-background'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* ─── Consultores (gestão) ───────────────────────────────────── */}
      {tab === 'consultores' && isManager && (
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          <div className="flex items-center justify-between px-1 shrink-0">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Equipa
            </h3>
            {selectedUserId && (
              <button
                type="button"
                onClick={() => onSelectUser(undefined)}
                className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Limpar
              </button>
            )}
          </div>
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Pesquisar..."
              className="h-8 pl-8 text-xs rounded-lg"
            />
          </div>
          <ul className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5">
            {filteredUsers.length === 0 && (
              <li className="px-2 py-3 text-xs text-muted-foreground text-center">
                Nenhum resultado encontrado
              </li>
            )}
            {filteredUsers.map((u) => {
              const isActive = selectedUserId === u.id
              const isDimmed = !!selectedUserId && !isActive
              const count = userCounts.get(u.id) ?? 0
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => onSelectUser(isActive ? undefined : u.id)}
                    aria-pressed={isActive}
                    className={cn(
                      'w-full flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-all cursor-pointer',
                      isActive
                        ? 'border-border bg-muted/70 ring-1 ring-foreground/10 shadow-sm'
                        : 'border-border/50 bg-background/60 hover:bg-muted/40',
                      isDimmed && 'opacity-50',
                    )}
                  >
                    <Avatar className="h-7 w-7 shrink-0">
                      {u.photo && <AvatarImage src={u.photo} alt={u.name} />}
                      <AvatarFallback className="text-[10px] font-medium">
                        {u.name
                          .split(' ')
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((p) => p[0]?.toUpperCase())
                          .join('')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {u.name}
                    </span>
                    {!isDimmed && (
                      <span
                        className={cn(
                          'shrink-0 min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-semibold inline-flex items-center justify-center tabular-nums',
                          isActive
                            ? 'bg-foreground text-background'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
