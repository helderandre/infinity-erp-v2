'use client'

/**
 * BulkPipelineActionDialog — single shell dialog used by every "pipeline
 * mutation" multi-select action in the kanban:
 *
 *   • mode = "temperatura"  → 3-button picker (Frio / Morno / Quente)
 *   • mode = "consultor"    → consultant select
 *   • mode = "stage"        → stage select scoped to the current pipeline
 *
 * The four "marcar perdido" flow is handled outside this dialog: the
 * kanban opens the existing LostReasonDialog directly and then calls the
 * same /api/crm/negocios/bulk-update endpoint with the resolved
 * terminal-lost stage + reason.
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import {
  Loader2, Thermometer, UserCheck, Move, Check, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type BulkPipelineMode = 'temperatura' | 'consultor' | 'stage'

interface StageOption {
  id: string
  name: string
  color: string | null
  is_terminal: boolean
  terminal_type: 'won' | 'lost' | null
}

interface ConsultorOption {
  id: string
  commercial_name: string
  profile_photo_url?: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: BulkPipelineMode
  /** All selected negocio ids — passed straight to the bulk endpoint. */
  negocioIds: string[]
  /** All stages for the current pipeline (used by mode='stage'). */
  stages?: StageOption[]
  /** Refreshes the kanban once the bulk update returns ok. */
  onDone?: () => void
}

const TEMPERATURAS = [
  { value: 'Frio',   label: 'Frio',   color: '#3b82f6' },
  { value: 'Morno',  label: 'Morno',  color: '#f59e0b' },
  { value: 'Quente', label: 'Quente', color: '#ef4444' },
] as const

export function BulkPipelineActionDialog({
  open, onOpenChange, mode, negocioIds, stages = [], onDone,
}: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<
    { negocio_id: string; ok: boolean; error?: string }[] | null
  >(null)

  // Per-mode state
  const [temperatura, setTemperatura] = useState<string>('')
  const [consultorId, setConsultorId] = useState<string>('')
  const [stageId, setStageId] = useState<string>('')

  // Lazy-load consultors only when needed
  const [consultors, setConsultors] = useState<ConsultorOption[] | null>(null)
  useEffect(() => {
    if (!open || mode !== 'consultor' || consultors !== null) return
    let cancelled = false
    fetch('/api/users/consultants')
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => {
        if (cancelled) return
        const arr = Array.isArray(json) ? json : json.data ?? []
        setConsultors(
          arr.map((u: any) => ({
            id: u.id,
            commercial_name: u.commercial_name ?? u.email ?? '—',
            profile_photo_url:
              u.dev_consultant_profiles?.profile_photo_url ??
              u.profile_photo_url ?? null,
          })),
        )
      })
      .catch(() => { if (!cancelled) setConsultors([]) })
    return () => { cancelled = true }
  }, [open, mode, consultors])

  // Reset when sheet closes
  useEffect(() => {
    if (!open) {
      setResults(null)
      setSubmitting(false)
      setTemperatura('')
      setConsultorId('')
      setStageId('')
    }
  }, [open])

  // Stage list — exclude terminals from "Mover de fase" (lost has its own
  // flow; won is reachable but rare via bulk so we leave it).
  const moveStageOptions = useMemo(
    () => stages.filter((s) => !(s.is_terminal && s.terminal_type === 'lost')),
    [stages],
  )

  const meta = META[mode]
  const canSubmit = !submitting && (
    (mode === 'temperatura' && !!temperatura) ||
    (mode === 'consultor'  && !!consultorId) ||
    (mode === 'stage'      && !!stageId)
  )

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    setResults(null)
    try {
      const patch: Record<string, unknown> = {}
      if (mode === 'temperatura') patch.temperatura = temperatura
      if (mode === 'consultor')   patch.assigned_consultant_id = consultorId
      if (mode === 'stage')       patch.pipeline_stage_id = stageId

      const res = await fetch('/api/crm/negocios/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ negocio_ids: negocioIds, patch }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json?.error ?? 'Falha na operação')
        return
      }
      setResults(json.results ?? [])
      const okCount = (json.results ?? []).filter((r: any) => r.ok).length
      const failCount = (json.results ?? []).length - okCount
      if (failCount === 0) {
        toast.success(`${okCount} ${okCount === 1 ? 'negócio actualizado' : 'negócios actualizados'}`)
      } else {
        toast.warning(`${okCount} actualizado(s), ${failCount} falhou`)
      }
      onDone?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado')
    } finally {
      setSubmitting(false)
    }
  }, [mode, temperatura, consultorId, stageId, negocioIds, onDone])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <meta.icon className="h-5 w-5" />
            {meta.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {negocioIds.length} {negocioIds.length === 1 ? 'negócio' : 'negócios'} · {meta.subtitle}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-3 space-y-4">
          {/* ── Picker per mode ── */}
          {mode === 'temperatura' && (
            <div className="grid grid-cols-3 gap-2">
              {TEMPERATURAS.map((t) => {
                const active = temperatura === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTemperatura(t.value)}
                    className={cn(
                      'rounded-xl border p-3 text-sm font-medium transition-all',
                      active
                        ? 'shadow-sm'
                        : 'border-border/40 hover:border-border/70 hover:bg-muted/40',
                    )}
                    style={
                      active
                        ? {
                            backgroundColor: `${t.color}1f`,
                            borderColor: t.color,
                            color: t.color,
                            boxShadow: `inset 0 0 0 1px ${t.color}40`,
                          }
                        : undefined
                    }
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full mr-2 align-middle"
                      style={{ backgroundColor: t.color }}
                    />
                    {t.label}
                  </button>
                )
              })}
            </div>
          )}

          {mode === 'consultor' && (
            <div className="space-y-2">
              {consultors === null ? (
                <p className="text-xs text-muted-foreground py-3 text-center">
                  A carregar consultores…
                </p>
              ) : consultors.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">
                  Sem consultores disponíveis.
                </p>
              ) : (
                <Select value={consultorId} onValueChange={setConsultorId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Escolha um consultor" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[260px]">
                    {consultors.map((c) => {
                      const initials = c.commercial_name
                        .split(' ')
                        .map((p) => p[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()
                      return (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="inline-flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              {c.profile_photo_url && (
                                <AvatarImage src={c.profile_photo_url} alt={c.commercial_name} />
                              )}
                              <AvatarFallback className="text-[9px]">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            {c.commercial_name}
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {mode === 'stage' && (
            <div className="space-y-2">
              {moveStageOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">
                  Sem fases disponíveis neste pipeline.
                </p>
              ) : (
                <Select value={stageId} onValueChange={setStageId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Escolha a fase de destino" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[260px]">
                    {moveStageOptions.map((s) => {
                      const c = s.color || '#64748b'
                      return (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: c }}
                            />
                            {s.name}
                            {s.is_terminal && s.terminal_type === 'won' && (
                              <span className="text-[10px] font-medium text-emerald-600 ml-1">
                                (Ganho)
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* ── Results after submit ── */}
          {results && (
            <div className="space-y-1.5 pt-1">
              {results.map((r) => (
                <div
                  key={r.negocio_id}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px]',
                    r.ok
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'bg-red-500/10 text-red-700 dark:text-red-400',
                  )}
                >
                  {r.ok ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <AlertCircle className="h-3 w-3" />
                  )}
                  <span className="font-mono text-[10px] opacity-80">
                    {r.negocio_id.slice(0, 8)}
                  </span>
                  <span className="truncate">
                    {r.ok ? 'actualizado' : r.error}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/40 bg-muted/20">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {results ? 'Fechar' : 'Cancelar'}
          </Button>
          {!results && (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {meta.cta}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const META = {
  temperatura: {
    title: 'Mudar temperatura',
    subtitle: 'Aplica a temperatura escolhida a cada negócio.',
    cta: 'Aplicar',
    icon: Thermometer,
  },
  consultor: {
    title: 'Reatribuir consultor',
    subtitle: 'O consultor escolhido fica responsável por todos.',
    cta: 'Reatribuir',
    icon: UserCheck,
  },
  stage: {
    title: 'Mover de fase',
    subtitle: 'Move todos os negócios para a fase escolhida.',
    cta: 'Mover',
    icon: Move,
  },
} as const
