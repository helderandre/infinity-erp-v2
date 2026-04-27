'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { DatePicker } from '@/components/ui/date-picker'
import { Separator } from '@/components/ui/separator'
import {
  CalendarPlus,
  Clock,
  Loader2,
  Users,
  User,
  X,
  MapPin,
  ChevronDown,
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────

interface Owner {
  id: string
  name: string
  person_type?: string
}

interface Consultant {
  id: string
  commercial_name: string
}

interface EventData {
  title: string
  description: string
  start_date: string
  end_date: string
  all_day: boolean
  start_time: string
  end_time: string
  owner_ids: string[]
  attendee_user_ids: string[]
  // PROC-NEG opcionais — só usados quando o backend deteta hook schedule_*
  location_label: string
  location_address: string
  notary_name: string
  notary_phone: string
  notary_email: string
}

interface ScheduleEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  processId: string
  taskId: string
  subtaskId: string
  subtaskTitle: string
  // Data pre-populada (para edição)
  existingEvent?: {
    id: string
    title: string
    description?: string
    start_date: string
    end_date?: string
    all_day: boolean
    owner_ids?: string[]
    attendee_user_ids?: string[]
  } | null
  // Owners do processo
  owners: Owner[]
  // Consultores disponíveis
  consultants: Consultant[]
  onSuccess?: () => void
}

// ─── Helpers ──────────────────────────────────────────

function extractDate(isoString: string): string {
  if (!isoString) return ''
  return isoString.slice(0, 10) // YYYY-MM-DD
}

function extractTime(isoString: string): string {
  if (!isoString) return '09:00'
  const match = isoString.match(/T(\d{2}:\d{2})/)
  return match ? match[1] : '09:00'
}

function combineDateAndTime(date: string, time: string): string {
  if (!date) return ''
  return `${date}T${time}:00.000Z`
}

// ─── Component ────────────────────────────────────────

export function ScheduleEventDialog({
  open,
  onOpenChange,
  processId,
  taskId,
  subtaskId,
  subtaskTitle,
  existingEvent,
  owners,
  consultants,
  onSuccess,
}: ScheduleEventDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<EventData>({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    all_day: true,
    start_time: '09:00',
    end_time: '10:00',
    owner_ids: [],
    attendee_user_ids: [],
  })

  // Inicializar com dados existentes ou subtask title
  useEffect(() => {
    if (!open) return

    if (existingEvent) {
      setForm({
        title: existingEvent.title,
        description: existingEvent.description || '',
        start_date: extractDate(existingEvent.start_date),
        end_date: existingEvent.end_date ? extractDate(existingEvent.end_date) : '',
        all_day: existingEvent.all_day,
        start_time: existingEvent.all_day ? '09:00' : extractTime(existingEvent.start_date),
        end_time: existingEvent.end_date && !existingEvent.all_day
          ? extractTime(existingEvent.end_date)
          : '10:00',
        owner_ids: existingEvent.owner_ids || [],
        attendee_user_ids: existingEvent.attendee_user_ids || [],
        location_label: '',
        location_address: '',
        notary_name: '',
        notary_phone: '',
        notary_email: '',
      })
    } else {
      setForm({
        title: subtaskTitle,
        description: '',
        start_date: '',
        end_date: '',
        all_day: true,
        start_time: '09:00',
        end_time: '10:00',
        owner_ids: [],
        attendee_user_ids: [],
        location_label: '',
        location_address: '',
        notary_name: '',
        notary_phone: '',
        notary_email: '',
      })
    }
  }, [open, existingEvent, subtaskTitle])

  const update = (data: Partial<EventData>) => {
    setForm((prev) => ({ ...prev, ...data }))
  }

  const toggleOwner = (ownerId: string) => {
    setForm((prev) => ({
      ...prev,
      owner_ids: prev.owner_ids.includes(ownerId)
        ? prev.owner_ids.filter((id) => id !== ownerId)
        : [...prev.owner_ids, ownerId],
    }))
  }

  const toggleAttendee = (userId: string) => {
    setForm((prev) => ({
      ...prev,
      attendee_user_ids: prev.attendee_user_ids.includes(userId)
        ? prev.attendee_user_ids.filter((id) => id !== userId)
        : [...prev.attendee_user_ids, userId],
    }))
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error('Título é obrigatório.')
      return
    }
    if (!form.start_date) {
      toast.error('Data de início é obrigatória.')
      return
    }

    setIsSubmitting(true)

    try {
      const startDate = form.all_day
        ? `${form.start_date}T00:00:00.000Z`
        : combineDateAndTime(form.start_date, form.start_time)

      let endDate: string | null = null
      if (!form.all_day && form.end_time) {
        endDate = combineDateAndTime(form.end_date || form.start_date, form.end_time)
      } else if (form.all_day && form.end_date) {
        endDate = `${form.end_date}T23:59:59.000Z`
      }

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        start_date: startDate,
        end_date: endDate,
        all_day: form.all_day,
        owner_ids: form.owner_ids,
        attendee_user_ids: form.attendee_user_ids,
        // PROC-NEG: o endpoint só usa estes campos quando o parent task tem
        // config.hook ∈ {schedule_cpcv, schedule_escritura}. Para outros
        // processos são silenciosamente ignorados.
        location_label: form.location_label.trim() || null,
        location_address: form.location_address.trim() || null,
        notary_name: form.notary_name.trim() || null,
        notary_phone: form.notary_phone.trim() || null,
        notary_email: form.notary_email.trim() || null,
      }

      const res = await fetch(
        `/api/processes/${processId}/tasks/${taskId}/subtasks/${subtaskId}/schedule-event`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(err.error || 'Erro ao agendar evento')
      }

      toast.success(existingEvent ? 'Evento actualizado!' : 'Evento agendado com sucesso!')
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao agendar evento.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isEditing = !!existingEvent

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-indigo-500/10 flex items-center justify-center">
              <CalendarPlus className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <DialogTitle>{isEditing ? 'Editar Evento' : 'Agendar Evento'}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isEditing ? 'Actualizar detalhes do evento' : 'Definir data, horário e participantes'}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Título */}
          <div className="space-y-1.5">
            <Label className="text-xs">Título do evento</Label>
            <Input
              value={form.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Ex: Escritura do imóvel"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição (opcional)</Label>
            <Textarea
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="Detalhes adicionais..."
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          <Separator />

          {/* Toggle dia todo */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm">Dia todo</Label>
            </div>
            <Switch
              checked={form.all_day}
              onCheckedChange={(v) => update({ all_day: v })}
            />
          </div>

          {/* Data e hora */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Data início</Label>
              <DatePicker
                value={form.start_date}
                onChange={(v) => update({ start_date: v })}
                placeholder="Seleccionar..."
              />
            </div>
            {form.all_day ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Data fim (opcional)</Label>
                <DatePicker
                  value={form.end_date}
                  onChange={(v) => update({ end_date: v })}
                  placeholder="Mesmo dia"
                />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Hora início</Label>
                  <Input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => update({ start_time: e.target.value })}
                    className="h-9"
                  />
                </div>
              </>
            )}
          </div>

          {/* Hora fim (quando não é dia todo) */}
          {!form.all_day && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data fim (opcional)</Label>
                <DatePicker
                  value={form.end_date}
                  onChange={(v) => update({ end_date: v })}
                  placeholder="Mesmo dia"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hora fim</Label>
                <Input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => update({ end_time: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>
          )}

          {/* Local & Notário (opcional, PROC-NEG) */}
          <Separator />
          <Collapsible className="space-y-2">
            <CollapsibleTrigger className="flex items-center gap-2 text-sm w-full text-left hover:text-foreground text-muted-foreground transition-colors group">
              <MapPin className="h-4 w-4" />
              <span>Local & Notário (opcional)</span>
              <ChevronDown className="h-3.5 w-3.5 ml-auto transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs">Local</Label>
                <Input
                  value={form.location_label}
                  onChange={(e) => update({ location_label: e.target.value })}
                  placeholder="Ex: Cartório Notarial Maria Silva"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Morada</Label>
                <Input
                  value={form.location_address}
                  onChange={(e) => update({ location_address: e.target.value })}
                  placeholder="Morada completa (para abrir no Maps)"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs">Notário</Label>
                  <Input
                    value={form.notary_name}
                    onChange={(e) => update({ notary_name: e.target.value })}
                    placeholder="Nome"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Telefone</Label>
                  <Input
                    value={form.notary_phone}
                    onChange={(e) => update({ notary_phone: e.target.value })}
                    placeholder="+351 ..."
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email do notário</Label>
                <Input
                  type="email"
                  value={form.notary_email}
                  onChange={(e) => update({ notary_email: e.target.value })}
                  placeholder="notario@exemplo.pt"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Proprietários */}
          {owners.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm">Proprietários participantes</Label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {owners.map((owner) => {
                    const isSelected = form.owner_ids.includes(owner.id)
                    return (
                      <Badge
                        key={owner.id}
                        variant={isSelected ? 'default' : 'outline'}
                        className={cn(
                          'cursor-pointer transition-colors',
                          isSelected
                            ? 'bg-indigo-600 hover:bg-indigo-700'
                            : 'hover:bg-muted'
                        )}
                        onClick={() => toggleOwner(owner.id)}
                      >
                        {isSelected && <X className="h-3 w-3 mr-1" />}
                        {owner.name}
                        {owner.person_type === 'coletiva' && (
                          <span className="ml-1 text-[10px] opacity-70">(empresa)</span>
                        )}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* Participantes (consultores) */}
          {consultants.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm">Participantes (consultores)</Label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {consultants.map((consultant) => {
                    const isSelected = form.attendee_user_ids.includes(consultant.id)
                    return (
                      <Badge
                        key={consultant.id}
                        variant={isSelected ? 'default' : 'outline'}
                        className={cn(
                          'cursor-pointer transition-colors',
                          isSelected
                            ? 'bg-violet-600 hover:bg-violet-700'
                            : 'hover:bg-muted'
                        )}
                        onClick={() => toggleAttendee(consultant.id)}
                      >
                        {isSelected && <X className="h-3 w-3 mr-1" />}
                        {consultant.commercial_name}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !form.title.trim() || !form.start_date}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Actualizar' : 'Agendar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
