'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, CalendarIcon, RotateCcw } from 'lucide-react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { createTaskSchema } from '@/lib/validations/task'
import { TASK_PRIORITY_MAP, RECURRENCE_PRESETS, TASK_ENTITY_LABELS } from '@/types/task'
import type { TaskEntityType } from '@/types/task'
import { useTaskMutations } from '@/hooks/use-tasks'
import type { z } from 'zod'

type FormData = z.infer<typeof createTaskSchema>

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
  }
}

export function TaskForm({ open, onOpenChange, onSuccess, consultants, defaultValues }: TaskFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { createTask } = useTaskMutations()

  const form = useForm<FormData>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 4,
      is_recurring: false,
      entity_type: defaultValues?.entity_type || null,
      entity_id: defaultValues?.entity_id || null,
      assigned_to: defaultValues?.assigned_to || null,
      parent_task_id: defaultValues?.parent_task_id || null,
    },
  })

  const isRecurring = form.watch('is_recurring')

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {defaultValues?.parent_task_id ? 'Nova Sub-tarefa' : 'Nova Tarefa'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Ligar ao proprietário" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detalhes adicionais..."
                      rows={3}
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* Assignee */}
              <FormField
                control={form.control}
                name="assigned_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Atribuir a</FormLabel>
                    <Select
                      value={field.value || '_none'}
                      onValueChange={(v) => field.onChange(v === '_none' ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger>
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

              {/* Priority */}
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridade</FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <FormControl>
                        <SelectTrigger>
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

            {/* Due date */}
            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data limite</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
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

            {/* Recurring */}
            <div className="flex items-center justify-between rounded-lg border p-3">
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
                  <FormItem>
                    <FormLabel>Frequência</FormLabel>
                    <Select
                      value={field.value || ''}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
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

            {/* Entity link (if not pre-set) */}
            {!defaultValues?.entity_type && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="entity_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Associar a</FormLabel>
                      <Select
                        value={field.value || '_none'}
                        onValueChange={(v) => {
                          field.onChange(v === '_none' ? null : v)
                          if (v === '_none') form.setValue('entity_id', null)
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
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

                {form.watch('entity_type') && (
                  <FormField
                    control={form.control}
                    name="entity_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID da entidade</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="UUID da entidade"
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Tarefa
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
