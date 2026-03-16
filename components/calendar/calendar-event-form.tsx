'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { calendarEventSchema, type CalendarEventFormData } from '@/lib/validations/calendar'
import {
  CALENDAR_CATEGORY_OPTIONS,
  CALENDAR_RECURRENCE_OPTIONS,
  CALENDAR_VISIBILITY_OPTIONS,
} from '@/lib/constants'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { CalendarDays, Clock } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface CalendarEventFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: CalendarEventFormData) => Promise<void>
  initialData?: Partial<CalendarEventFormData>
  users?: { id: string; name: string }[]
}

export function CalendarEventForm({
  open,
  onClose,
  onSubmit,
  initialData,
  users,
}: CalendarEventFormProps) {
  const form = useForm<CalendarEventFormData>({
    resolver: zodResolver(calendarEventSchema) as any,
    defaultValues: {
      title: '',
      description: '',
      category: 'meeting',
      start_date: '',
      end_date: '',
      all_day: false,
      is_recurring: false,
      recurrence_rule: null,
      user_id: null,
      visibility: 'all',
      color: null,
      ...initialData,
    },
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = form

  const category = watch('category')
  const allDay = watch('all_day')
  const isRecurring = watch('is_recurring')
  const startDate = watch('start_date')
  const endDate = watch('end_date')

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (open) {
      reset({
        title: '',
        description: '',
        category: 'meeting',
        start_date: '',
        end_date: '',
        all_day: false,
        is_recurring: false,
        recurrence_rule: null,
        user_id: null,
        visibility: 'all',
        color: null,
        ...initialData,
      })
    }
  }, [open, initialData, reset])

  // Auto-configure for birthday
  useEffect(() => {
    if (category === 'birthday') {
      setValue('all_day', true)
      setValue('is_recurring', true)
      setValue('recurrence_rule', 'yearly')
    }
  }, [category, setValue])

  // Auto-configure for vacation
  useEffect(() => {
    if (category === 'vacation') {
      setValue('all_day', true)
    }
  }, [category, setValue])

  const handleFormSubmit = async (data: CalendarEventFormData) => {
    try {
      await onSubmit(data)
      onClose()
      toast.success('Evento guardado com sucesso')
    } catch {
      toast.error('Erro ao guardar evento. Tente novamente.')
    }
  }

  const parseDateValue = (value: string | null | undefined): Date | undefined => {
    if (!value) return undefined
    try {
      return parseISO(value)
    } catch {
      return undefined
    }
  }

  const isEditing = !!initialData?.title

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Altere os detalhes do evento.'
              : 'Preencha os dados para criar um novo evento no calendário.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit as any)} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              placeholder="Ex: Reunião de equipa"
              {...register('title')}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Categoria *</Label>
            <Select
              value={category}
              onValueChange={(v) => setValue('category', v as CalendarEventFormData['category'])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar categoria" />
              </SelectTrigger>
              <SelectContent>
                {CALENDAR_CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-xs text-destructive">{errors.category.message}</p>
            )}
          </div>

          {/* Start date */}
          <div className="space-y-1.5">
            <Label>Data de início *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !startDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {startDate
                    ? format(parseISO(startDate), 'PPP', { locale: ptBR })
                    : 'Seleccionar data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parseDateValue(startDate)}
                  onSelect={(date) => {
                    if (date) {
                      setValue('start_date', format(date, "yyyy-MM-dd'T'HH:mm:ss"), {
                        shouldValidate: true,
                      })
                    }
                  }}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            {errors.start_date && (
              <p className="text-xs text-destructive">{errors.start_date.message}</p>
            )}
          </div>

          {/* Start time (if not all day) */}
          {!allDay && (
            <div className="space-y-1.5">
              <Label htmlFor="start_time">Hora de início</Label>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="start_time"
                  type="time"
                  className="w-[140px]"
                  value={
                    startDate
                      ? format(parseISO(startDate), 'HH:mm')
                      : ''
                  }
                  onChange={(e) => {
                    const dateBase = startDate
                      ? startDate.split('T')[0]
                      : format(new Date(), 'yyyy-MM-dd')
                    setValue(
                      'start_date',
                      `${dateBase}T${e.target.value}:00`,
                      { shouldValidate: true }
                    )
                  }}
                />
              </div>
            </div>
          )}

          {/* End date */}
          <div className="space-y-1.5">
            <Label>
              Data de fim
              {category === 'vacation' && ' *'}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !endDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {endDate
                    ? format(parseISO(endDate), 'PPP', { locale: ptBR })
                    : 'Seleccionar data (opcional)'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parseDateValue(endDate)}
                  onSelect={(date) => {
                    if (date) {
                      setValue('end_date', format(date, "yyyy-MM-dd'T'23:59:59"), {
                        shouldValidate: true,
                      })
                    }
                  }}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            {errors.end_date && (
              <p className="text-xs text-destructive">{errors.end_date.message}</p>
            )}
          </div>

          <Separator />

          {/* All day */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <Checkbox
              checked={allDay}
              onCheckedChange={(v) => setValue('all_day', !!v)}
              disabled={category === 'birthday' || category === 'vacation'}
            />
            <span className="text-sm">Todo o dia</span>
          </label>

          {/* Recurring */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <Checkbox
              checked={isRecurring}
              onCheckedChange={(v) => {
                setValue('is_recurring', !!v)
                if (!v) setValue('recurrence_rule', null)
              }}
              disabled={category === 'birthday'}
            />
            <span className="text-sm">Evento recorrente</span>
          </label>

          {/* Recurrence rule */}
          {isRecurring && (
            <div className="space-y-1.5 pl-7">
              <Label>Frequência</Label>
              <Select
                value={watch('recurrence_rule') ?? ''}
                onValueChange={(v) =>
                  setValue('recurrence_rule', v as 'yearly' | 'monthly' | 'weekly')
                }
                disabled={category === 'birthday'}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {CALENDAR_RECURRENCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Separator />

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="Detalhes adicionais..."
              {...register('description')}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          {/* User */}
          {users && users.length > 0 && (
            <div className="space-y-1.5">
              <Label>Pessoa associada</Label>
              <Select
                value={watch('user_id') ?? 'none'}
                onValueChange={(v) => setValue('user_id', v === 'none' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Visibility */}
          <div className="space-y-1.5">
            <Label>Visibilidade</Label>
            <Select
              value={watch('visibility')}
              onValueChange={(v) =>
                setValue('visibility', v as 'all' | 'team' | 'private')
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CALENDAR_VISIBILITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'A guardar...' : isEditing ? 'Guardar Alterações' : 'Criar Evento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
