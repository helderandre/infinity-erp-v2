'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, CalendarIcon, RotateCcw, X, Plus, Clock } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { createTaskSchema } from '@/lib/validations/task'
import { RECURRENCE_PRESETS, TASK_ENTITY_LABELS } from '@/types/task'
import type { TaskEntityType } from '@/types/task'
import { useTaskMutations } from '@/hooks/use-tasks'
import { AIQuickFillBar } from '@/components/shared/ai-quick-fill-bar'
import { EntityPicker, type EntityKind } from '@/components/tasks/entity-picker'
import { toast as sonnerToast } from 'sonner'
import type { z } from 'zod'

type FormData = z.input<typeof createTaskSchema>

interface TaskFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  consultants: Array<{ id: string; commercial_name: string }>
  defaultValues?: {
    entity_type?: TaskEntityType
    entity_id?: string
    assigned_to?: string
    parent_task_id?: string
    title?: string
    description?: string
    priority?: number
    due_date?: string
    task_list_id?: string
    section?: string
    is_private?: boolean
  }
  /** ID do utilizador autenticado — usado como atribuição obrigatória quando
   *  `requireAssignment` é true. */
  currentUserId?: string
  /** Quando true (consultor a criar tarefa fora duma lista partilhada), o
   *  selector "Atribuir a" não permite "Sem atribuição" e é pré-preenchido
   *  com o próprio utilizador. */
  requireAssignment?: boolean
  /** Apenas leadership pode atribuir tarefas a outros utilizadores. Quando
   *  false, a secção "Atribuir a" não é renderizada e o submit força o
   *  próprio utilizador como assignee. Default true para preservar
   *  compatibilidade com callers existentes. */
  canAssignToOthers?: boolean
}

const PRIORITY_OPTIONS = [
  { value: 4, label: 'Baixa', emoji: '🟢' },
  { value: 3, label: 'Média', emoji: '🟡' },
  { value: 2, label: 'Alta', emoji: '🟠' },
  { value: 1, label: 'Urgente', emoji: '🔴' },
] as const

const REMINDER_PRESETS = [
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hora' },
  { minutes: 120, label: '2 horas' },
  { minutes: 1440, label: '1 dia' },
] as const

function formatReminderMinutes(m: number): string {
  if (m % 1440 === 0) return `${m / 1440} dia${m === 1440 ? '' : 's'}`
  if (m % 60 === 0) return `${m / 60} hora${m === 60 ? '' : 's'}`
  return `${m} min`
}

/** Combine a date-only or full ISO string with a HH:mm time string into an ISO. */
function toIsoWithTime(dateIso: string | null | undefined, hhmm: string): string | null {
  if (!dateIso) return null
  try {
    const base = new Date(dateIso)
    if (Number.isNaN(base.getTime())) return null
    const [h, m] = hhmm.split(':').map((s) => parseInt(s, 10))
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    base.setHours(h, m, 0, 0)
    return base.toISOString()
  } catch {
    return null
  }
}

export function TaskForm({
  open,
  onOpenChange,
  onSuccess,
  consultants,
  defaultValues,
  currentUserId,
  requireAssignment = false,
  canAssignToOthers = true,
}: TaskFormProps) {
  const isMobile = useIsMobile()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { createTask } = useTaskMutations()
  const customReminderRef = useRef<HTMLInputElement>(null)

  const buildDefaults = (dv?: TaskFormProps['defaultValues']): FormData => ({
    title: dv?.title || '',
    description: dv?.description || '',
    priority: dv?.priority ?? 4,
    is_recurring: false,
    due_date: dv?.due_date || undefined,
    reminders: [],
    entity_type: dv?.entity_type || null,
    entity_id: dv?.entity_id || null,
    assigned_to:
      dv?.assigned_to ||
      (!canAssignToOthers ? currentUserId ?? null : null) ||
      (requireAssignment ? currentUserId ?? null : null),
    parent_task_id: dv?.parent_task_id || null,
    task_list_id: dv?.task_list_id || null,
    section: dv?.section || null,
    is_private: dv?.is_private ?? false,
  })

  const form = useForm<FormData>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: buildDefaults(defaultValues),
  })

  // Re-seed each time the sheet opens — the parent often reuses the same
  // <TaskForm> instance with different `defaultValues` (entity_id, parent_task_id,
  // section…) and useForm only reads them on first mount.
  useEffect(() => {
    if (open) {
      form.reset(buildDefaults(defaultValues))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    defaultValues?.entity_id,
    defaultValues?.parent_task_id,
    defaultValues?.section,
    defaultValues?.task_list_id,
  ])

  const isRecurring = form.watch('is_recurring')
  const isPrivate = form.watch('is_private') ?? false
  const dueDate = form.watch('due_date')
  const selectedEntityType = form.watch('entity_type')

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      const payload = {
        ...data,
        // Consultor (sem permissão de atribuir a outros) é forçado a si próprio.
        assigned_to: !canAssignToOthers ? currentUserId ?? data.assigned_to : data.assigned_to,
      }
      await createTask(payload)
      toast.success('Tarefa criada com sucesso')
      form.reset()
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar tarefa')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[85dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[540px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}

        <div className="shrink-0 px-6 pt-8 pb-3 sm:pt-10 space-y-3">
          <SheetHeader className="p-0 gap-0">
            {/* Header inline: título + Pessoal/Profissional pill mini */}
            <div className="flex items-center justify-between gap-3 pr-10">
              <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight">
                {defaultValues?.parent_task_id ? 'Nova sub-tarefa' : 'Nova tarefa'}
              </SheetTitle>
              <FormField
                control={form.control}
                name="is_private"
                render={({ field }) => (
                  <div className="flex items-center rounded-full border border-border/40 bg-background/40 backdrop-blur-sm p-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => field.onChange(false)}
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                        !field.value
                          ? 'bg-foreground text-background'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      Profissional
                    </button>
                    <button
                      type="button"
                      onClick={() => field.onChange(true)}
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                        field.value
                          ? 'bg-yellow-200 text-yellow-900'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      Pessoal
                    </button>
                  </div>
                )}
              />
            </div>
            <SheetDescription className="sr-only">
              Preencha os detalhes da tarefa.
            </SheetDescription>
          </SheetHeader>

          {/* Mini priority tab picker — centered, emoji-only when unselected,
              emoji + label when selected. */}
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <div className="flex justify-center">
                <div className="flex items-center gap-0.5 rounded-full border border-border/40 bg-background/40 backdrop-blur-sm p-0.5">
                  {PRIORITY_OPTIONS.map((opt) => {
                    const active = field.value === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => field.onChange(opt.value)}
                        aria-label={opt.label}
                        className={cn(
                          'flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-all',
                          active
                            ? 'bg-foreground text-background'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <span className="text-[13px] leading-none">{opt.emoji}</span>
                        {active && <span>{opt.label}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          />

          <AIQuickFillBar
            placeholder="Descreve a tarefa por texto ou voz..."
            onFill={async (text) => {
              try {
                const res = await fetch('/api/tasks/fill-from-text', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    text,
                    users: consultants.map((c) => ({ id: c.id, name: c.commercial_name })),
                  }),
                })
                if (!res.ok) {
                  sonnerToast.error('Erro ao interpretar texto')
                  return
                }
                const { data } = await res.json()
                for (const key of [
                  'title', 'description', 'priority', 'due_date',
                  'assigned_to', 'is_recurring', 'reminders',
                ]) {
                  if (data[key] !== undefined && data[key] !== null) {
                    form.setValue(key as any, data[key], { shouldValidate: true })
                  }
                }
                sonnerToast.success('Dados preenchidos com IA')
              } catch {
                sonnerToast.error('Erro ao interpretar texto')
              }
            }}
          />
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col flex-1 min-h-0 overflow-hidden"
          >
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pt-1 pb-20 space-y-4">

              {/* ─── Card "Detalhes": Título + Descrição + Data + Recorrente ─── */}
              <section className="rounded-2xl border border-border/40 bg-background/40 backdrop-blur-sm p-4 space-y-3">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-medium text-muted-foreground">Título</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Ligar ao proprietário"
                          {...field}
                          className="rounded-xl border-border/40 bg-background/40 backdrop-blur-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-medium text-muted-foreground">
                        Descrição <span className="text-muted-foreground/60 font-normal">(opcional)</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Detalhes adicionais..."
                          rows={3}
                          {...field}
                          value={field.value || ''}
                          className="rounded-xl border-border/40 bg-background/40 backdrop-blur-sm resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Data com Hora — popover de calendário + input HH:mm */}
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => {
                    const currentTime = field.value
                      ? format(parseISO(field.value), 'HH:mm')
                      : ''
                    return (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs font-medium text-muted-foreground">Data</FormLabel>
                        <div className="flex gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    'flex-1 justify-start text-left font-normal rounded-xl border-border/40 bg-background/40 backdrop-blur-sm hover:bg-background/70',
                                    !field.value && 'text-muted-foreground',
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {field.value
                                    ? format(parseISO(field.value), 'PPP', { locale: pt })
                                    : 'Sem data'}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value ? parseISO(field.value) : undefined}
                                onSelect={(date) => {
                                  if (!date) {
                                    field.onChange(null)
                                    return
                                  }
                                  // Preserva a hora se já estava definida; senão default 09:00.
                                  const time = currentTime || '09:00'
                                  date.setHours(
                                    parseInt(time.split(':')[0], 10) || 0,
                                    parseInt(time.split(':')[1], 10) || 0,
                                    0, 0,
                                  )
                                  field.onChange(date.toISOString())
                                }}
                                locale={pt}
                              />
                            </PopoverContent>
                          </Popover>
                          {field.value && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                              <Input
                                type="time"
                                className="w-[110px] rounded-xl border-border/40 bg-background/40 backdrop-blur-sm"
                                value={currentTime}
                                onChange={(e) => {
                                  const next = toIsoWithTime(field.value, e.target.value)
                                  if (next) field.onChange(next)
                                }}
                              />
                            </div>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />

                {/* Recurring toggle + conditional frequency */}
                <div className="rounded-xl border border-border/40 bg-background/30 px-3 py-2.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RotateCcw className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Tarefa recorrente</span>
                    </div>
                    <FormField
                      control={form.control}
                      name="is_recurring"
                      render={({ field }) => (
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                  </div>

                  {isRecurring && (
                    <FormField
                      control={form.control}
                      name="recurrence_rule"
                      render={({ field }) => (
                        <FormItem className="space-y-1 pt-1 border-t border-border/40">
                          <FormLabel className="text-xs font-medium text-muted-foreground pt-1.5">Frequência</FormLabel>
                          <Select
                            value={field.value || ''}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger className="rounded-xl border-border/40 bg-background/60">
                                <SelectValue placeholder="Seleccionar frequência..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {RECURRENCE_PRESETS.map((p) => (
                                <SelectItem key={p.rule} value={p.rule}>
                                  {p.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </section>

              {/* ─── Card "Extras": Lembretes + Associar a + (Atribuir a se leadership) ─── */}
              <section className="rounded-2xl border border-border/40 bg-background/40 backdrop-blur-sm p-4 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Extras
                </p>

                {/* Reminders — preset pills + custom add */}
                <FormField
                  control={form.control}
                  name="reminders"
                  render={({ field }) => {
                    const reminders = (field.value ?? []) as { minutes_before: number }[]
                    const presetMinutes = new Set(REMINDER_PRESETS.map((p) => p.minutes))
                    const customReminders = reminders.filter(
                      (r) => !presetMinutes.has(r.minutes_before as 15 | 30 | 60 | 120 | 1440),
                    )

                    const togglePreset = (m: number) => {
                      const has = reminders.some((r) => r.minutes_before === m)
                      field.onChange(
                        has
                          ? reminders.filter((r) => r.minutes_before !== m)
                          : [...reminders, { minutes_before: m }],
                      )
                    }

                    const addCustom = () => {
                      const input = customReminderRef.current
                      if (!input) return
                      const raw = input.value.trim()
                      if (!raw) return
                      const val = Number(raw)
                      if (!Number.isFinite(val) || val < 0 || !Number.isInteger(val)) {
                        toast.error('Indica um número de minutos válido.')
                        return
                      }
                      if (reminders.some((r) => r.minutes_before === val)) {
                        toast.error('Lembrete já existe.')
                        return
                      }
                      field.onChange([...reminders, { minutes_before: val }])
                      input.value = ''
                    }

                    const removeCustom = (m: number) => {
                      field.onChange(reminders.filter((r) => r.minutes_before !== m))
                    }

                    return (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs font-medium text-muted-foreground">Lembretes</FormLabel>
                        <div className="flex flex-wrap gap-1.5">
                          {REMINDER_PRESETS.map((p) => {
                            const active = reminders.some((r) => r.minutes_before === p.minutes)
                            return (
                              <button
                                key={p.minutes}
                                type="button"
                                onClick={() => togglePreset(p.minutes)}
                                className={cn(
                                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                                  active
                                    ? 'bg-foreground text-background border-foreground'
                                    : 'bg-background/40 backdrop-blur-sm text-muted-foreground border-border/40 hover:border-border/70 hover:text-foreground',
                                )}
                              >
                                {p.label}
                              </button>
                            )
                          })}
                        </div>

                        {customReminders.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {customReminders.map((r) => (
                              <button
                                key={r.minutes_before}
                                type="button"
                                onClick={() => removeCustom(r.minutes_before)}
                                className="group flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border border-foreground bg-foreground text-background"
                              >
                                {formatReminderMinutes(r.minutes_before)}
                                <X className="h-3 w-3 opacity-70 group-hover:opacity-100" />
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <Input
                            ref={customReminderRef}
                            id="task-custom-reminder-input"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            placeholder="Outro (minutos)"
                            className="h-9 w-40 rounded-xl border-border/40 bg-background/40 backdrop-blur-sm text-xs"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addCustom()
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addCustom}
                            className="h-9 rounded-full text-xs"
                          >
                            <Plus className="mr-1 h-3 w-3" /> Adicionar
                          </Button>
                        </div>

                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />

                {/* Associar a — pill picker single-select com "Nenhum" no início.
                    Ordem: Imóvel · Lead · Contacto · Processo · Negócio.
                    "Proprietário" foi removido do picker (a opção fica
                    disponível em código para back-compat com tarefas antigas
                    mas não é apresentada na criação). */}
                {!defaultValues?.entity_type && (
                  <>
                    <FormField
                      control={form.control}
                      name="entity_type"
                      render={({ field }) => {
                        const options: Array<{ value: TaskEntityType | '_none'; label: string }> = [
                          { value: '_none', label: 'Nenhum' },
                          { value: 'property', label: TASK_ENTITY_LABELS.property },
                          { value: 'lead_entry', label: TASK_ENTITY_LABELS.lead_entry },
                          { value: 'lead', label: TASK_ENTITY_LABELS.lead },
                          { value: 'process', label: TASK_ENTITY_LABELS.process },
                          { value: 'negocio', label: TASK_ENTITY_LABELS.negocio },
                        ]
                        const selected = field.value ?? '_none'
                        return (
                          <FormItem className="space-y-1.5">
                            <FormLabel className="text-xs font-medium text-muted-foreground">Associar a</FormLabel>
                            <div className="flex flex-wrap gap-1.5">
                              {options.map((opt) => {
                                const active = selected === opt.value
                                return (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                      const next = opt.value === '_none' ? null : opt.value
                                      field.onChange(next)
                                      form.setValue('entity_id', null)
                                    }}
                                    className={cn(
                                      'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                                      active
                                        ? 'bg-foreground text-background border-foreground'
                                        : 'bg-background/40 backdrop-blur-sm text-muted-foreground border-border/40 hover:border-border/70 hover:text-foreground',
                                    )}
                                  >
                                    {opt.label}
                                  </button>
                                )
                              })}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )
                      }}
                    />

                    {selectedEntityType && (
                      <FormField
                        control={form.control}
                        name="entity_id"
                        render={({ field }) => (
                          <FormItem className="space-y-1.5">
                            <FormLabel className="text-xs font-medium text-muted-foreground">
                              {TASK_ENTITY_LABELS[selectedEntityType as TaskEntityType]}
                            </FormLabel>
                            <FormControl>
                              <EntityPicker
                                type={selectedEntityType as EntityKind}
                                value={field.value || null}
                                onChange={(v) => field.onChange(v)}
                                placeholder="Pesquisar e seleccionar..."
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </>
                )}

                {/* Atribuir a — apenas leadership */}
                {canAssignToOthers && (
                  <FormField
                    control={form.control}
                    name="assigned_to"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs font-medium text-muted-foreground">Atribuir a</FormLabel>
                        <Select
                          value={field.value || (requireAssignment ? currentUserId ?? '' : '_none')}
                          onValueChange={(v) => field.onChange(v === '_none' ? null : v)}
                        >
                          <FormControl>
                            <SelectTrigger className="rounded-xl border-border/40 bg-background/40 backdrop-blur-sm">
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {!requireAssignment && (
                              <SelectItem value="_none">Sem atribuição</SelectItem>
                            )}
                            {consultants.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.commercial_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </section>

            </div>

            <SheetFooter className="px-6 py-4 flex-row gap-2 shrink-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl border-t border-border/40">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="rounded-full flex-1"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Tarefa
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
