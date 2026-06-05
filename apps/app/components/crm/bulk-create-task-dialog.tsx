'use client'

/**
 * BulkCreateTaskDialog — creates the same task on every selected negócio
 * in one shot. Each task is attached to its negócio via
 * (entity_type='negocio', entity_id=negocio_id) so it surfaces in that
 * deal's task list and on the consultant's calendar.
 *
 * Fans out client-side (one POST per task to /api/tasks) — the existing
 * task endpoint is already idempotent enough that a per-id loop is fine.
 * If volumes ever climb high enough to warrant a real bulk endpoint we
 * can swap the body of `handleSubmit`.
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import {
  CalendarPlus, Loader2, Check, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'

export interface BulkTaskTarget {
  negocio_id: string
  contact_name: string
}

interface ConsultorOption {
  id: string
  commercial_name: string
  profile_photo_url?: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  targets: BulkTaskTarget[]
  onDone?: () => void
}

const PRIORITIES: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Urgente' },
  { value: 2, label: 'Alta' },
  { value: 3, label: 'Média' },
  { value: 4, label: 'Baixa' },
]

const DEFAULT_ASSIGNEE = '__creator__' as const

export function BulkCreateTaskDialog({
  open, onOpenChange, targets, onDone,
}: Props) {
  const isMobile = useIsMobile()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<number>(4)
  const [assigneeId, setAssigneeId] = useState<string>(DEFAULT_ASSIGNEE)

  const [consultors, setConsultors] = useState<ConsultorOption[] | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<
    { negocio_id: string; ok: boolean; error?: string }[] | null
  >(null)

  // Default the due date to today @ 18:00 so the picker isn't blank;
  // user can change it freely. Reset when sheet closes.
  useEffect(() => {
    if (open && !dueDate) {
      const d = new Date()
      d.setHours(18, 0, 0, 0)
      setDueDate(d.toISOString().slice(0, 16))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (open) return
    setTitle('')
    setDescription('')
    setDueDate('')
    setPriority(4)
    setAssigneeId(DEFAULT_ASSIGNEE)
    setResults(null)
    setSubmitting(false)
  }, [open])

  // Lazy-load consultors once on open.
  useEffect(() => {
    if (!open || consultors !== null) return
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
  }, [open, consultors])

  const canSubmit = !submitting && title.trim().length > 0 && targets.length > 0

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    setResults(null)
    try {
      const baseBody: Record<string, unknown> = {
        title: title.trim(),
        priority,
        entity_type: 'negocio',
      }
      if (description.trim()) baseBody.description = description.trim()
      if (dueDate) baseBody.due_date = new Date(dueDate).toISOString()
      if (assigneeId !== DEFAULT_ASSIGNEE) baseBody.assigned_to = assigneeId

      const out: { negocio_id: string; ok: boolean; error?: string }[] = []
      for (const t of targets) {
        try {
          const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...baseBody, entity_id: t.negocio_id }),
          })
          if (!res.ok) {
            const j = await res.json().catch(() => ({}))
            out.push({
              negocio_id: t.negocio_id,
              ok: false,
              error: j?.error?.message ?? j?.error ?? `HTTP ${res.status}`,
            })
            continue
          }
          out.push({ negocio_id: t.negocio_id, ok: true })
        } catch (e) {
          out.push({
            negocio_id: t.negocio_id,
            ok: false,
            error: e instanceof Error ? e.message : 'Erro',
          })
        }
      }
      setResults(out)
      const okCount = out.filter((r) => r.ok).length
      const failCount = out.length - okCount
      if (failCount === 0) {
        toast.success(
          `${okCount} ${okCount === 1 ? 'tarefa criada' : 'tarefas criadas'}`,
        )
      } else {
        toast.warning(`${okCount} criada(s), ${failCount} falhou`)
      }
      onDone?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado')
    } finally {
      setSubmitting(false)
    }
  }, [title, description, dueDate, priority, assigneeId, targets, onDone])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[85dvh] data-[side=bottom]:max-h-[85dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[560px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        <SheetHeader className={cn('shrink-0 px-6 gap-0', isMobile ? 'pt-8 pb-3' : 'pt-6 pb-3')}>
          <SheetTitle className="text-lg font-semibold tracking-tight inline-flex items-center gap-2">
            <CalendarPlus className="h-5 w-5" />
            Criar tarefa
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Será criada uma tarefa por cada um dos {targets.length}{' '}
            {targets.length === 1 ? 'negócio' : 'negócios'} selecionados.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-3 space-y-4">
          <Field label="Título" required>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Ligar para acompanhar"
              className="h-9"
            />
          </Field>

          <Field
            label="Vence a"
            hint="Local — sem timezone."
          >
            <Input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-9"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prioridade">
              <Select
                value={String(priority)}
                onValueChange={(v) => setPriority(Number(v))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={String(p.value)}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Atribuir a">
              {consultors === null ? (
                <Skeleton className="h-9 rounded-md" />
              ) : (
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[260px]">
                    <SelectItem value={DEFAULT_ASSIGNEE}>
                      Eu (criador)
                    </SelectItem>
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
                              <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
                            </Avatar>
                            {c.commercial_name}
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>

          <Field label="Descrição (opcional)">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Notas, contexto…"
              className="resize-none text-sm"
            />
          </Field>

          {/* Summary chip — keeps it visible that this fans out to N negocios. */}
          <div className="rounded-xl ring-1 ring-border/40 bg-background/40 px-3 py-2 text-[11px] text-muted-foreground">
            Será atribuída a{' '}
            <span className="font-semibold text-foreground">{targets.length}</span>{' '}
            {targets.length === 1 ? 'negócio' : 'negócios'}.
          </div>

          {results && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Resultados
              </p>
              {results.map((r) => {
                const target = targets.find((t) => t.negocio_id === r.negocio_id)
                return (
                  <div
                    key={r.negocio_id}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px]',
                      r.ok
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'bg-red-500/10 text-red-700 dark:text-red-400',
                    )}
                  >
                    {r.ok ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                    <span className="font-medium truncate flex-1">
                      {target?.contact_name ?? r.negocio_id.slice(0, 8)}
                    </span>
                    <span className="text-[10px] opacity-80">
                      {r.ok ? 'criada' : r.error}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-border/40 bg-muted/20">
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
              Criar {targets.length} {targets.length === 1 ? 'tarefa' : 'tarefas'}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Field({
  label, hint, required, children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
