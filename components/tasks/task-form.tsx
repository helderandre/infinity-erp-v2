'use client'

import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, CalendarIcon, RotateCcw, Search } from 'lucide-react'
import { format } from 'date-fns'
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
import { TASK_PRIORITY_MAP, RECURRENCE_PRESETS, TASK_ENTITY_LABELS } from '@/types/task'
import type { TaskEntityType } from '@/types/task'
import { useTaskMutations } from '@/hooks/use-tasks'
import { AIQuickFillBar } from '@/components/shared/ai-quick-fill-bar'
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
  }
}

interface EntityOption {
  id: string
  label: string
}

const ENTITY_ENDPOINTS: Record<string, { url: string; mapFn: (item: any) => EntityOption }> = {
  property: {
    url: '/api/properties?limit=50',
    mapFn: (p) => ({ id: p.id, label: p.title || p.slug || p.id }),
  },
  lead: {
    url: '/api/leads?limit=50',
    mapFn: (l) => ({ id: l.id, label: l.nome || l.email || l.id }),
  },
  process: {
    url: '/api/processes?limit=50',
    mapFn: (p) => ({ id: p.id, label: p.external_ref || p.id }),
  },
  owner: {
    url: '/api/proprietarios?limit=50',
    mapFn: (o) => ({ id: o.id, label: o.name || o.nome || o.id }),
  },
  negocio: {
    url: '/api/negocios?limit=50',
    mapFn: (n) => ({ id: n.id, label: n.tipo ? `${n.tipo} — ${n.localizacao || n.id}` : n.id }),
  },
}

export function TaskForm({ open, onOpenChange, onSuccess, consultants, defaultValues }: TaskFormProps) {
  const isMobile = useIsMobile()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([])
  const [isLoadingEntities, setIsLoadingEntities] = useState(false)
  const { createTask } = useTaskMutations()

  const form = useForm<FormData>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: defaultValues?.title || '',
      description: defaultValues?.description || '',
      priority: defaultValues?.priority ?? 4,
      is_recurring: false,
      due_date: defaultValues?.due_date || undefined,
      reminders: [],
      entity_type: defaultValues?.entity_type || null,
      entity_id: defaultValues?.entity_id || null,
      assigned_to: defaultValues?.assigned_to || null,
      parent_task_id: defaultValues?.parent_task_id || null,
      task_list_id: defaultValues?.task_list_id || null,
      section: defaultValues?.section || null,
    },
  })

  const isRecurring = form.watch('is_recurring')
  const selectedEntityType = form.watch('entity_type')

  // Fetch entity options when type changes
  const fetchEntities = useCallback(async (type: string) => {
    const config = ENTITY_ENDPOINTS[type]
    if (!config) { setEntityOptions([]); return }

    setIsLoadingEntities(true)
    try {
      const res = await fetch(config.url)
      if (!res.ok) throw new Error()
      const json = await res.json()
      const items = json.data || json || []
      setEntityOptions(items.map(config.mapFn))
    } catch {
      setEntityOptions([])
    } finally {
      setIsLoadingEntities(false)
    }
  }, [])

  useEffect(() => {
    if (selectedEntityType) {
      fetchEntities(selectedEntityType)
    } else {
      setEntityOptions([])
    }
  }, [selectedEntityType, fetchEntities])

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      await createTask(data)
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
            ? 'data-[side=bottom]:h-[80dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[540px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}

        <div className="shrink-0 px-6 pt-8 pb-4 sm:pt-10 space-y-3">
          <SheetHeader className="p-0 gap-0">
            <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight pr-10">
              {defaultValues?.parent_task_id ? 'Nova sub-tarefa' : 'Nova tarefa'}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Preencha os detalhes da tarefa.
            </SheetDescription>
          </SheetHeader>
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
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pt-1 pb-20 space-y-5">
            {/* ─── Essencial ─── */}
            <section className="space-y-3">
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
            </section>

            {/* ─── Quando ─── */}
            <section className="space-y-3">
              <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-1">Quando</p>

              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-medium text-muted-foreground">Data limite</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal rounded-xl border-border/40 bg-background/40 backdrop-blur-sm hover:bg-background/70',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value
                              ? format(new Date(field.value), 'PPP', { locale: pt })
                              : 'Sem data limite'}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(date) => field.onChange(date?.toISOString() || null)}
                          locale={pt}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Recurring toggle + conditional frequency in one glass card */}
              <div className="rounded-2xl border border-border/40 bg-background/40 backdrop-blur-sm px-4 py-3 space-y-3">
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
                      <FormItem className="space-y-1.5 pt-1 border-t border-border/40">
                        <FormLabel className="text-xs font-medium text-muted-foreground pt-2">Frequência</FormLabel>
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

              {/* Reminders — preset pills */}
              <FormField
                control={form.control}
                name="reminders"
                render={({ field }) => {
                  const reminders = (field.value ?? []) as { minutes_before: number }[]
                  const presets = [
                    { minutes: 15, label: '15 min' },
                    { minutes: 30, label: '30 min' },
                    { minutes: 60, label: '1 hora' },
                    { minutes: 120, label: '2 horas' },
                    { minutes: 1440, label: '1 dia' },
                  ]
                  const toggle = (m: number) => {
                    const has = reminders.some((r) => r.minutes_before === m)
                    field.onChange(
                      has
                        ? reminders.filter((r) => r.minutes_before !== m)
                        : [...reminders, { minutes_before: m }],
                    )
                  }
                  return (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-medium text-muted-foreground">Lembretes</FormLabel>
                      <div className="flex flex-wrap gap-1.5">
                        {presets.map((p) => {
                          const active = reminders.some((r) => r.minutes_before === p.minutes)
                          return (
                            <button
                              key={p.minutes}
                              type="button"
                              onClick={() => toggle(p.minutes)}
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
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />
            </section>

            {/* ─── Quem & Prioridade ─── */}
            <section className="space-y-3">
              <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-1">Quem & Prioridade</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="assigned_to"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-medium text-muted-foreground">Atribuir a</FormLabel>
                      <Select
                        value={field.value || '_none'}
                        onValueChange={(v) => field.onChange(v === '_none' ? null : v)}
                      >
                        <FormControl>
                          <SelectTrigger className="rounded-xl border-border/40 bg-background/40 backdrop-blur-sm">
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="_none">Sem atribuição</SelectItem>
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

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-medium text-muted-foreground">Prioridade</FormLabel>
                      <Select
                        value={String(field.value)}
                        onValueChange={(v) => field.onChange(Number(v))}
                      >
                        <FormControl>
                          <SelectTrigger className="rounded-xl border-border/40 bg-background/40 backdrop-blur-sm">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(TASK_PRIORITY_MAP).map(([k, v]) => (
                            <SelectItem key={k} value={k}>
                              <span className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${v.dot}`} />
                                {v.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* ─── Associação ─── */}
            {!defaultValues?.entity_type && (
              <section className="space-y-3">
                <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-1">
                  Associação <span className="text-muted-foreground/60 font-normal normal-case tracking-normal">(opcional)</span>
                </p>
                <FormField
                  control={form.control}
                  name="entity_type"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-medium text-muted-foreground">Associar a</FormLabel>
                      <Select
                        value={field.value || '_none'}
                        onValueChange={(v) => {
                          field.onChange(v === '_none' ? null : v)
                          form.setValue('entity_id', null)
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="rounded-xl border-border/40 bg-background/40 backdrop-blur-sm">
                            <SelectValue placeholder="Nenhum" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="_none">Nenhum</SelectItem>
                          {Object.entries(TASK_ENTITY_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
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
                        <Select
                          value={field.value || '_none'}
                          onValueChange={(v) => field.onChange(v === '_none' ? null : v)}
                          disabled={isLoadingEntities}
                        >
                          <FormControl>
                            <SelectTrigger className="rounded-xl border-border/40 bg-background/40 backdrop-blur-sm">
                              <SelectValue placeholder={
                                isLoadingEntities ? 'A carregar...' : 'Seleccionar...'
                              } />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="_none">Nenhum</SelectItem>
                            {entityOptions.map((opt) => (
                              <SelectItem key={opt.id} value={opt.id}>
                                {opt.label}
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
            )}

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
