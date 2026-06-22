'use client'

import { useEffect, useState } from 'react'
import { TaskActivityTimeline } from '@/components/processes/task-activity-timeline'
import type { TaskActivity } from '@/types/process'
import { cn } from '@/lib/utils'
import {
  Check,
  CheckCircle2,
  ChevronRight,
  GitCommitHorizontal,
  Activity,
} from 'lucide-react'
import {
  ProcessTimeline,
  getStepStatus,
  type StepStatus,
} from './process-timeline'
import { StepDetailSheet } from './step-detail-sheet'
import { ProcessActivityTimeline } from './process-activity-timeline'
import { ANGARIACAO_STEPS, type AngariacaoStep } from './steps'

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

type ProcessView = 'passos' | 'atividade'

interface AngariacaoProcessPanelProps {
  /** quão longe o processo avançou (1..N+1). Default 3 para preview. */
  initialProgress?: number
  className?: string
  /** id real do imóvel — activa o CMI real (PDF + prefill) no passo de geração */
  propertyId?: string | null
  /** id do proc_instance real — activa progresso + atividade reais */
  processId?: string | null
  /**
   * Vista controlada (Passos/Atividade). Quando fornecida em conjunto com
   * `onViewChange`, o toggle é gerido pelo parent (renderizado fora do card,
   * ex.: ao lado do selector Novo/Antigo) e o card deixa de ter header próprio.
   * Sem isto, o card gere a vista internamente e mostra o seu próprio toggle.
   */
  view?: ProcessView
  onViewChange?: (v: ProcessView) => void
}

/**
 * Painel completo do processo de angariação — UM card com:
 *   • header (título + progresso + toggle Passos/Atividade + Dados do imóvel)
 *   • vista "Passos": a linha de passos + o detalhe do passo seleccionado
 *     (no mesmo card)
 *   • vista "Atividade": o feed de actividade (quem viu/concluiu/fez o quê)
 *
 * Auto-contido (gere o seu estado) → reutilizável no preview e dentro da
 * página de imóvel (secção Processos). Estado simulado por agora.
 */
export function AngariacaoProcessPanel({
  initialProgress = 3,
  className,
  propertyId,
  processId,
  view: viewProp,
  onViewChange,
}: AngariacaoProcessPanelProps) {
  const total = ANGARIACAO_STEPS.length
  const [progress, setProgress] = useState(initialProgress)
  const [selected, setSelected] = useState(Math.min(initialProgress, total))
  const [internalView, setInternalView] = useState<ProcessView>('passos')
  // Vista controlada pelo parent quando ambos os props são fornecidos.
  const controlled = viewProp !== undefined && onViewChange !== undefined
  const view = viewProp ?? internalView
  const setView = onViewChange ?? setInternalView
  const [sheetOpen, setSheetOpen] = useState(false)
  const [activities, setActivities] = useState<TaskActivity[] | null>(null)
  const [activitiesLoading, setActivitiesLoading] = useState(Boolean(processId))
  // IDs reais para o pré-preenchimento do CMI (vêm do angariacao-overview).
  const [cmiOwnerId, setCmiOwnerId] = useState<string | null>(null)
  const [cmiConsultantId, setCmiConsultantId] = useState<string | null>(null)

  // Dados reais: progresso (mapeado dos subtask_key) + feed de atividade.
  useEffect(() => {
    if (!processId) return
    let active = true
    fetch(`/api/processes/${processId}/angariacao-overview`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || !d) return
        if (d.progressOrder) {
          setProgress(d.progressOrder)
          setSelected(Math.min(d.progressOrder, total))
        }
        setCmiOwnerId(d.mainContactOwnerId ?? null)
        setCmiConsultantId(d.consultantId ?? null)
      })
      .catch(() => {})
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
  }, [processId, total])

  const selectedStep = ANGARIACAO_STEPS.find((s) => s.order === selected)!
  const selectedStatus = getStepStatus(selectedStep, progress)

  const openStep = (order: number) => {
    setSelected(order)
    setSheetOpen(true)
  }

  const completeCurrent = () => {
    if (selectedStatus !== 'current') return
    setProgress((p) => Math.min(total + 1, p + 1))
    setSelected((s) => Math.min(total, s + 1))
    setSheetOpen(false)
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toggle Passos/Atividade — só em modo não-controlado (ex.: preview).
          Em modo controlado vive ao lado do selector Novo/Antigo. */}
      {!controlled && (
        <div className="flex justify-end">
          <AngariacaoViewToggle view={view} onViewChange={setView} />
        </div>
      )}

      {/* STEPPER — círculos no topo, fora dos cards dos passos (overview).
          Clicar num passo abre o seu detalhe (qualquer passo, sempre). */}
      <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-8">
        <ProcessTimeline
          progressOrder={progress}
          selectedOrder={selected}
          view="responsive"
          onStepClick={(s) => openStep(s.order)}
        />
      </div>

      {view === 'atividade' ? (
        <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
          {processId ? (
            <TaskActivityTimeline
              activities={activities ?? []}
              isLoading={activitiesLoading}
            />
          ) : (
            <ProcessActivityTimeline />
          )}
        </div>
      ) : (
        /* Um card por passo — info simplificada + acção que abre a sheet */
        <div className="space-y-3">
          {ANGARIACAO_STEPS.map((s) => {
            const st = getStepStatus(s, progress)
            return (
              <StepCard
                key={s.key}
                step={s}
                status={st}
                total={total}
                doneBy={st === 'done' ? 'Ana Silva' : null}
                doneAt={st === 'done' ? '12/01 14:32' : null}
                onOpen={() => openStep(s.order)}
              />
            )
          })}
        </div>
      )}

      <StepDetailSheet
        step={selectedStep}
        status={selectedStatus}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        doneBy="Ana Silva"
        doneAt="12/01 14:32"
        onComplete={completeCurrent}
        propertyId={propertyId}
        ownerId={cmiOwnerId}
        consultantId={cmiConsultantId}
        processId={processId}
      />
    </div>
  )
}

/**
 * Toggle Passos/Atividade — exportado para o parent o poder renderizar fora do
 * card (ao lado do selector Novo/Antigo). O card usa-o internamente em modo
 * não-controlado (preview).
 */
export function AngariacaoViewToggle({
  view,
  onViewChange,
}: {
  view: ProcessView
  onViewChange: (v: ProcessView) => void
}) {
  return (
    <div className="flex rounded-full bg-muted p-0.5">
      <Toggle
        active={view === 'passos'}
        onClick={() => onViewChange('passos')}
        icon={GitCommitHorizontal}
        label="Passos"
      />
      <Toggle
        active={view === 'atividade'}
        onClick={() => onViewChange('atividade')}
        icon={Activity}
        label="Atividade"
      />
    </div>
  )
}

function Toggle({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Activity
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

/**
 * Card de um passo — info simplificada (o quê + estado) + acção. O detalhe
 * (compositor de email, gerador de CMI, uploader…) só aparece na sheet, ao
 * abrir. NÃO mostra o conteúdo rico inline.
 */
function StepCard({
  step,
  status,
  total,
  doneBy,
  doneAt,
  onOpen,
}: {
  step: AngariacaoStep
  status: StepStatus
  total: number
  doneBy?: string | null
  doneAt?: string | null
  onOpen: () => void
}) {
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
        'cursor-pointer rounded-2xl border bg-card p-5 shadow-sm transition-all hover:border-foreground/20 hover:shadow-md',
        isCurrent && 'border-emerald-500/40 ring-1 ring-emerald-500/20'
      )}
    >
      <div className="flex items-start gap-4">
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
            isDone
              ? 'bg-emerald-500 text-white'
              : isCurrent
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-muted text-muted-foreground'
          )}
        >
          {isDone ? (
            <Check className="h-5 w-5" />
          ) : (
            <Icon className="h-5 w-5" strokeWidth={1.5} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Passo {step.order} de {total}
            </p>
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                pill.cls
              )}
            >
              {pill.label}
            </span>
          </div>
          <h3 className="mt-0.5 text-base font-bold">{step.label}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {step.description}
          </p>

          {isDone && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Concluído{doneBy ? ` por ${doneBy}` : ''}
              {doneAt ? ` · ${doneAt}` : ''}
            </p>
          )}
        </div>

        <ChevronRight className="h-5 w-5 shrink-0 self-center text-muted-foreground/40" />
      </div>
    </div>
  )
}
