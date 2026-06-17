'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { PropertyEditSheet } from '@/components/properties/property-edit-sheet'
import { TaskActivityTimeline } from '@/components/processes/task-activity-timeline'
import type { TaskActivity } from '@/types/process'
import { cn } from '@/lib/utils'
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Pencil,
  Maximize2,
  GitCommitHorizontal,
  Activity,
} from 'lucide-react'
import {
  ProcessTimeline,
  getStepStatus,
  type StepStatus,
} from './process-timeline'
import { StepDetailContent } from './step-detail-content'
import { StepDetailSheet } from './step-detail-sheet'
import { ProcessActivityTimeline } from './process-activity-timeline'
import { ANGARIACAO_STEPS } from './steps'

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

interface AngariacaoProcessPanelProps {
  /** quão longe o processo avançou (1..N+1). Default 3 para preview. */
  initialProgress?: number
  /** mostra o título no topo do card */
  title?: string
  className?: string
  /**
   * Abre a ficha do imóvel (o mesmo sheet do botão Editar). Quando fornecido,
   * o botão "Dados do imóvel" delega no parent (reusa o sheet da página). Sem
   * isto, abre o `<PropertyEditSheet>` em modo create (preview).
   */
  onEditProperty?: () => void
  /** id real do imóvel — activa o CMI real (PDF + prefill) no passo de geração */
  propertyId?: string | null
  /** id do proc_instance real — activa progresso + atividade reais */
  processId?: string | null
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
  title = 'Processo de Angariação',
  className,
  onEditProperty,
  propertyId,
  processId,
}: AngariacaoProcessPanelProps) {
  const total = ANGARIACAO_STEPS.length
  const [progress, setProgress] = useState(initialProgress)
  const [selected, setSelected] = useState(Math.min(initialProgress, total))
  const [view, setView] = useState<'passos' | 'atividade'>('passos')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [activities, setActivities] = useState<TaskActivity[] | null>(null)
  const [activitiesLoading, setActivitiesLoading] = useState(Boolean(processId))

  // Dados reais: progresso (mapeado dos subtask_key) + feed de atividade.
  useEffect(() => {
    if (!processId) return
    let active = true
    fetch(`/api/processes/${processId}/angariacao-overview`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.progressOrder) {
          setProgress(d.progressOrder)
          setSelected(Math.min(d.progressOrder, total))
        }
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

  const doneCount = ANGARIACAO_STEPS.filter((s) => s.order < progress).length
  const pct = Math.round((doneCount / total) * 100)

  const selectedStep = ANGARIACAO_STEPS.find((s) => s.order === selected)!
  const selectedStatus = getStepStatus(selectedStep, progress)
  const pill = PILL[selectedStatus]

  const completeCurrent = () => {
    if (selectedStatus !== 'current') return
    setProgress((p) => Math.min(total + 1, p + 1))
    setSelected((s) => Math.min(total, s + 1))
    setSheetOpen(false)
  }

  return (
    <div className={cn('rounded-3xl border bg-card shadow-sm', className)}>
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5 sm:px-6">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">
            {progress > total
              ? 'Processo concluído'
              : `${doneCount}/${total} passos · ${pct}%`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-muted p-0.5">
            <Toggle
              active={view === 'passos'}
              onClick={() => setView('passos')}
              icon={GitCommitHorizontal}
              label="Passos"
            />
            <Toggle
              active={view === 'atividade'}
              onClick={() => setView('atividade')}
              icon={Activity}
              label="Atividade"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => (onEditProperty ? onEditProperty() : setInfoOpen(true))}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Dados do imóvel
          </Button>
        </div>
      </div>

      {view === 'atividade' ? (
        <div className="p-5 sm:p-6">
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
        <>
          {/* linha de passos */}
          <div className="border-b p-5 sm:p-8">
            <ProcessTimeline
              progressOrder={progress}
              selectedOrder={selected}
              view="responsive"
              onStepClick={(s) => setSelected(s.order)}
            />
          </div>

          {/* detalhe do passo seleccionado — MESMO card */}
          <div>
            <div className="flex items-center gap-3 border-b p-5 sm:px-6">
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                  selectedStatus === 'done'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                )}
              >
                {selectedStatus === 'done' ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <selectedStep.icon className="h-5 w-5" strokeWidth={1.5} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Passo {selectedStep.order} de {total}
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
                <h3 className="truncate text-base font-bold">
                  {selectedStep.label}
                </h3>
              </div>

              {/* setas modernas — navegam a SELECÇÃO (não o progresso) */}
              <div className="flex items-center gap-1.5">
                <NavButton
                  onClick={() => setSelected((s) => Math.max(1, s - 1))}
                  disabled={selected <= 1}
                  aria="Passo anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </NavButton>
                <NavButton
                  onClick={() => setSelected((s) => Math.min(total, s + 1))}
                  disabled={selected >= total}
                  aria="Passo seguinte"
                >
                  <ChevronRight className="h-4 w-4" />
                </NavButton>
                <NavButton onClick={() => setSheetOpen(true)} aria="Abrir em detalhe">
                  <Maximize2 className="h-4 w-4" />
                </NavButton>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <StepDetailContent
                step={selectedStep}
                status={selectedStatus}
                doneBy="Ana Silva"
                doneAt="12/01 14:32"
                onComplete={completeCurrent}
                propertyId={propertyId}
              />
              {selectedStatus === 'current' &&
                selectedStep.action !== 'generate_doc' && (
                  <Button className="mt-6 w-full sm:w-auto" onClick={completeCurrent}>
                    {selectedStep.cta}
                  </Button>
                )}
              {selectedStatus === 'pending' && (
                <p className="mt-6 text-sm text-muted-foreground">
                  Disponível depois de concluir os passos anteriores.
                </p>
              )}
            </div>
          </div>
        </>
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
      />

      {/* Sem onEditProperty (ex.: rota de preview) abre a ficha em modo create
          — o mesmo sheet "Novo imóvel". Na página de imóvel, o parent passa
          onEditProperty e reusa o sheet de edição da própria página. */}
      {!onEditProperty && (
        <PropertyEditSheet open={infoOpen} onOpenChange={setInfoOpen} mode="create" />
      )}
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

function NavButton({
  onClick,
  disabled,
  aria,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  aria: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={aria}
      className="flex h-9 w-9 items-center justify-center rounded-full border bg-background transition-colors hover:bg-muted disabled:opacity-30"
    >
      {children}
    </button>
  )
}
