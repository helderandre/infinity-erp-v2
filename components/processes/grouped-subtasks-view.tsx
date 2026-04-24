'use client'

import { useMemo, useState } from 'react'
import { Building2, ChevronDown, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { ProcessOwner } from '@/types/process'
import type { ProcSubtask } from '@/types/subtask'

/**
 * Vista agrupada de subtarefas — usada nas tasks hardcoded onde faz
 * sentido agrupar por entidade ("Documentos do Imóvel", "Documentos
 * Pessoa Colectiva", "Documentos Pessoa Singular").
 *
 * Agrupamento derivado de `subtask.owner_id`:
 *   - `null` → grupo "Imóvel" (fixo, um só)
 *   - qualquer UUID → grupo por owner (nome + person_type)
 *
 * Cada grupo é um `<Collapsible>` aberto por defeito, com:
 *   - header (ícone + nome + badge singular/coletiva + progresso N/M + %)
 *   - body: lista de cards renderizados pelo `renderCard` do caller
 *
 * O `renderCard` delega no switch de `subtask-card-list.tsx`, portanto
 * a rendering engine (hardcoded Component ou legacy type switch) não
 * muda — só a apresentação visual.
 */

interface SubtaskGroup {
  key: string
  label: string
  icon: 'property' | 'coletiva' | 'singular'
  personTypeLabel: string | null
  subtasks: ProcSubtask[]
  total: number
  done: number
}

interface GroupedSubtasksViewProps {
  subtasks: ProcSubtask[]
  owners: ProcessOwner[]
  renderCard: (subtask: ProcSubtask) => React.ReactNode
}

export function GroupedSubtasksView({
  subtasks,
  owners,
  renderCard,
}: GroupedSubtasksViewProps) {
  const groups = useMemo(() => buildGroups(subtasks, owners), [subtasks, owners])

  if (groups.length === 0) return null

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <SubtaskGroupSection key={group.key} group={group} renderCard={renderCard} />
      ))}
    </div>
  )
}

function buildGroups(
  subtasks: ProcSubtask[],
  owners: ProcessOwner[]
): SubtaskGroup[] {
  const propertySubtasks: ProcSubtask[] = []
  const byOwnerId = new Map<string, ProcSubtask[]>()

  for (const s of subtasks) {
    if (!s.owner_id) {
      propertySubtasks.push(s)
      continue
    }
    const existing = byOwnerId.get(s.owner_id) ?? []
    existing.push(s)
    byOwnerId.set(s.owner_id, existing)
  }

  const result: SubtaskGroup[] = []

  if (propertySubtasks.length > 0) {
    result.push({
      key: 'property',
      label: 'Imóvel',
      icon: 'property',
      personTypeLabel: null,
      subtasks: propertySubtasks,
      total: propertySubtasks.length,
      done: propertySubtasks.filter((s) => s.is_completed).length,
    })
  }

  // Ordem dos owners preservada pela ordem em `owners` (normalmente main
  // contact primeiro, depois percentagem).
  for (const owner of owners) {
    const ownerSubtasks = byOwnerId.get(owner.id)
    if (!ownerSubtasks || ownerSubtasks.length === 0) continue
    const personType = owner.person_type
    result.push({
      key: `owner:${owner.id}`,
      label: owner.name,
      icon: personType === 'coletiva' ? 'coletiva' : 'singular',
      personTypeLabel: personType === 'coletiva' ? 'Pessoa colectiva' : 'Pessoa singular',
      subtasks: ownerSubtasks,
      total: ownerSubtasks.length,
      done: ownerSubtasks.filter((s) => s.is_completed).length,
    })
  }

  // Owners "órfãos" — owner_id presente em proc_subtasks mas não em owners[]
  // (defensivo; não deve acontecer em produção mas evita perder rows).
  for (const [ownerId, ownerSubtasks] of byOwnerId.entries()) {
    if (result.some((g) => g.key === `owner:${ownerId}`)) continue
    result.push({
      key: `owner:${ownerId}`,
      label: 'Proprietário',
      icon: 'singular',
      personTypeLabel: null,
      subtasks: ownerSubtasks,
      total: ownerSubtasks.length,
      done: ownerSubtasks.filter((s) => s.is_completed).length,
    })
  }

  return result
}

interface SubtaskGroupSectionProps {
  group: SubtaskGroup
  renderCard: (subtask: ProcSubtask) => React.ReactNode
}

function SubtaskGroupSection({ group, renderCard }: SubtaskGroupSectionProps) {
  const [open, setOpen] = useState(true)
  const pct = group.total > 0 ? Math.round((group.done / group.total) * 100) : 0
  const Icon = group.icon === 'coletiva' || group.icon === 'property' ? Building2 : User

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-xl border bg-muted/30 overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold truncate">{group.label}</span>
                {group.personTypeLabel && (
                  <span className="text-[11px] text-muted-foreground">
                    · {group.personTypeLabel}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Progress value={pct} className="h-1 flex-1 max-w-[180px]" />
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {group.done}/{group.total}
                </span>
              </div>
            </div>

            <Badge variant="outline" className="text-[11px] font-medium tabular-nums">
              {pct}%
            </Badge>

            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                open && 'rotate-180'
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="divide-y border-t">
            {group.subtasks.map((s) => (
              <div key={s.id} className="px-3 py-2">
                {renderCard(s)}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
