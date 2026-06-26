'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronRight, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { TaskActivityTimeline } from '@/components/processes/task-activity-timeline'
import type { TaskActivity } from '@/types/process'
import { ProcessTimeline, type StepStatus } from '../angariacao-timeline/process-timeline'
import { AngariacaoViewToggle } from '../angariacao-timeline/angariacao-process-panel'
import { NEGOCIO_PHASES, NEGOCIO_STEPS, type NegocioStep } from './negocio-steps'
import { NegocioStepDetailSheet } from './negocio-step-detail-sheet'
import { FechoRequestSheet } from './fecho-request-sheet'
import { FloatingChat } from '@/components/processes/floating-chat'
import { useUser } from '@/hooks/use-user'

type ProcessView = 'passos' | 'atividade'

const PILL: Record<StepStatus, { label: string; cls: string }> = {
  done: {
    label: 'Concluído',
    cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  current: {
    label: 'Em curso',
    cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
  },
  pending: {
    label: 'Pendente',
    cls: 'bg-muted text-muted-foreground border-border',
  },
}

interface NegocioProcessPanelProps {
  processId: string
  className?: string
  view?: ProcessView
  onViewChange?: (v: ProcessView) => void
  /**
   * Quando fornecido, a barra de acções (botão "Pedido de fecho" + toggle
   * Passos/Atividade) é renderizada via portal neste elemento em vez de inline
   * — permite alinhar as acções na mesma linha que os sub-tabs (ex.: página de
   * imóvel). Sem isto, a barra fica inline no topo do painel.
   */
  actionsSlot?: HTMLElement | null
}

interface StepRow {
  step: NegocioStep
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasks: any[]
  done: number
  total: number
  status: StepStatus
}

/**
 * Painel "Novo" do fecho de negócio. As 6 FASES são apenas agrupamento
 * (overview stepper + headers de secção). Os PASSOS individuais (um por
 * `proc_task`) são os cards clicáveis, agrupados por fase. Clicar abre uma
 * sheet (design da angariação) com as subtarefas reais do passo.
 */
export function NegocioProcessPanel({
  processId,
  className,
  view: viewProp,
  onViewChange,
  actionsSlot,
}: NegocioProcessPanelProps) {
  const { user } = useUser()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [process, setProcess] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [internalView, setInternalView] = useState<ProcessView>('passos')
  const controlled = viewProp !== undefined && onViewChange !== undefined
  const view = viewProp ?? internalView
  const setView = onViewChange ?? setInternalView
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [requestOpen, setRequestOpen] = useState(false)
  const [activities, setActivities] = useState<TaskActivity[] | null>(null)
  const [activitiesLoading, setActivitiesLoading] = useState(true)

  const loadProcess = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const res = await fetch(`/api/processes/${processId}`)
        if (res.ok) setProcess(await res.json())
      } catch {
        /* noop */
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [processId]
  )

  useEffect(() => {
    loadProcess()
  }, [loadProcess])

  useEffect(() => {
    let active = true
    fetch(`/api/processes/${processId}/activities`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        if (active) setActivities((Array.isArray(d) ? d : []) as TaskActivity[])
      })
      .catch(() => {
        if (active) setActivities([])
      })
      .finally(() => {
        if (active) setActivitiesLoading(false)
      })
    return () => {
      active = false
    }
  }, [processId])

  const { rows, phaseProgressOrder } = useMemo(() => {
    // O GET /api/processes/[id] devolve as tasks aninhadas em
    // `process.stages[].tasks` (não num `process.tasks` plano).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stages = (process?.stages ?? []) as any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allTasks = stages.flatMap((s) => (s.tasks ?? []) as any[])

    // Index das tasks por título (ignorando bypassadas).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byTitle = new Map<string, any>()
    for (const t of allTasks) {
      if (t.is_bypassed) continue
      if (!byTitle.has(t.title)) byTitle.set(t.title, t)
    }

    // Constrói os passos que EXISTEM (têm ao menos uma task não-bypassada).
    // Um passo pode abranger várias tasks (ex.: "Guardar e verificar
    // documentação" agrega todas as tasks de documentos).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing: { step: NegocioStep; tasks: any[]; done: number; total: number; complete: boolean }[] = []
    for (const step of NEGOCIO_STEPS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tasks = step.taskTitles
        .map((title) => byTitle.get(title))
        .filter(Boolean) as any[]
      if (tasks.length === 0) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subs = tasks.flatMap((t) => (t.subtasks ?? []) as any[])
      const done = subs.filter((s) => s.is_completed).length
      const complete =
        subs.length > 0
          ? done === subs.length
          : tasks.every((t) => t.status === 'completed')
      existing.push({ step, tasks, done, total: subs.length, complete })
    }

    // current = primeiro passo (por ordem) não concluído.
    const firstIncomplete = existing.find((e) => !e.complete)?.step.order ?? Infinity
    const rows: StepRow[] = existing.map((e) => ({
      step: e.step,
      tasks: e.tasks,
      done: e.done,
      total: e.total,
      status: e.complete
        ? 'done'
        : e.step.order === firstIncomplete
          ? 'current'
          : 'pending',
    }))

    // Progresso por fase (para o stepper de overview). Sem passos → nada
    // concluído (evita o stepper todo verde quando ainda não há tasks).
    let phasePO = 1
    if (rows.length > 0) {
      phasePO = NEGOCIO_PHASES.length + 1
      for (const phase of NEGOCIO_PHASES) {
        const phaseRows = rows.filter((r) => r.step.phaseKey === phase.key)
        const complete =
          phaseRows.length === 0 || phaseRows.every((r) => r.status === 'done')
        if (!complete) {
          phasePO = phase.order
          break
        }
      }
    }
    return { rows, phaseProgressOrder: phasePO }
  }, [process])

  const selectedRow = rows.find((r) => r.step.key === selectedKey) ?? null
  const hasDeal = Boolean(process?.deal)

  const openStep = (key: string) => {
    setSelectedKey(key)
    setSheetOpen(true)
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Barra de acções: botão "Pedido de fecho" (quando há deal) + toggle
          Passos/Atividade (só em modo não-controlado). Renderizada via portal
          em `actionsSlot` quando fornecido (mesma linha que os sub-tabs),
          senão inline no topo do painel. */}
      {(hasDeal || !controlled) &&
        (() => {
          const content = (
            <>
              {hasDeal && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-full"
                  onClick={() => setRequestOpen(true)}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Pedido de fecho</span>
                  <span className="sm:hidden">Pedido</span>
                </Button>
              )}
              {!controlled && <AngariacaoViewToggle view={view} onViewChange={setView} />}
            </>
          )
          return actionsSlot
            ? createPortal(<div className="flex items-center gap-2">{content}</div>, actionsSlot)
            : <div className="flex items-center justify-end gap-2">{content}</div>
        })()}

      {/* OVERVIEW — stepper das 6 fases (agrupamento, não são passos). */}
      <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-8">
        {loading ? (
          <Skeleton className="h-14 w-full" />
        ) : (
          <ProcessTimeline
            steps={NEGOCIO_PHASES}
            progressOrder={phaseProgressOrder}
            view="responsive"
          />
        )}
      </div>

      {view === 'atividade' ? (
        <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
          <TaskActivityTimeline
            activities={activities ?? []}
            isLoading={activitiesLoading}
          />
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {NEGOCIO_STEPS.slice(0, 6).map((s) => (
            <Skeleton key={s.key} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Sem passos para este processo.
        </p>
      ) : (
        <div className="space-y-6">
          {NEGOCIO_PHASES.map((phase) => {
            const phaseRows = rows.filter((r) => r.step.phaseKey === phase.key)
            if (phaseRows.length === 0) return null
            const phaseDone = phaseRows.filter((r) => r.status === 'done').length
            return (
              <div key={phase.key} className="space-y-2">
                {/* Header de fase — título de agrupamento, não um passo. */}
                <div className="flex items-center gap-2 px-1">
                  <phase.icon
                    className="h-4 w-4 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {phase.label}
                  </h3>
                  <span className="text-[11px] font-medium text-muted-foreground/70">
                    {phaseDone}/{phaseRows.length}
                  </span>
                  <div className="ml-2 h-px flex-1 bg-border" />
                </div>

                <div className="space-y-2">
                  {phaseRows.map((r) => (
                    <StepRowCard
                      key={r.step.key}
                      row={r}
                      onOpen={() => openStep(r.step.key)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <NegocioStepDetailSheet
        step={selectedRow?.step ?? null}
        tasks={selectedRow?.tasks ?? []}
        status={selectedRow?.status ?? 'pending'}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        processId={processId}
        deal={process?.deal ?? null}
        process={process}
        onTaskUpdate={() => loadProcess(true)}
      />

      <FechoRequestSheet
        deal={process?.deal ?? null}
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        onSaved={() => loadProcess(true)}
      />

      {user && (
        <FloatingChat
          processId={processId}
          currentUser={{ id: user.id, name: user.commercial_name || 'Utilizador' }}
        />
      )}
    </div>
  )
}

function StepRowCard({ row, onOpen }: { row: StepRow; onOpen: () => void }) {
  const { step, status, done, total } = row
  const Icon = step.icon
  const pill = PILL[status]
  const isCurrent = status === 'current'
  const isDone = status === 'done'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-all hover:border-foreground/20 hover:shadow-md',
        isCurrent && 'border-emerald-500/40 ring-1 ring-emerald-500/20'
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
          isDone
            ? 'bg-emerald-500 text-white'
            : isCurrent
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-muted text-muted-foreground'
        )}
      >
        {isDone ? (
          <Check className="h-4 w-4" />
        ) : (
          <Icon className="h-4 w-4" strokeWidth={1.5} />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="truncate text-sm font-semibold">{step.label}</h4>
          <span
            className={cn(
              'shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider',
              pill.cls
            )}
          >
            {pill.label}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {step.description}
        </p>
      </div>

      {total > 0 && (
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {done}/{total}
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
    </div>
  )
}
