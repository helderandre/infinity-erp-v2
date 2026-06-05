'use client'

import { useState } from 'react'
import { Clock, Loader2, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface ScheduleMessageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chatId: string
  instanceId: string
  text: string
  onScheduled: () => void
}

export function ScheduleMessageDialog({
  open,
  onOpenChange,
  chatId,
  instanceId,
  text,
  onScheduled,
}: ScheduleMessageDialogProps) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Set defaults when dialog opens
  function handleOpenChange(newOpen: boolean) {
    if (newOpen) {
      // Default to tomorrow at 9:00
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      setDate(format(tomorrow, 'yyyy-MM-dd'))
      setTime('09:00')
    }
    onOpenChange(newOpen)
  }

  async function handleSchedule() {
    if (!date || !time) {
      toast.error('Seleccione data e hora')
      return
    }

    const scheduledAt = new Date(`${date}T${time}:00`)
    if (scheduledAt <= new Date()) {
      toast.error('A data deve ser no futuro')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch('/api/whatsapp/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          instance_id: instanceId,
          message_type: 'text',
          text,
          scheduled_at: scheduledAt.toISOString(),
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao agendar')
      }

      toast.success(`Mensagem agendada para ${format(scheduledAt, "dd/MM/yyyy 'às' HH:mm")}`)
      onScheduled()
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao agendar mensagem'
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Agendar mensagem
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview */}
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">Mensagem</p>
            <p className="text-sm line-clamp-3">{text || '(sem texto)'}</p>
          </div>

          {/* Date picker */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="schedule-date" className="text-sm">Data</Label>
              <Input
                id="schedule-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="schedule-time" className="text-sm">Hora</Label>
              <Input
                id="schedule-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          {/* Quick options */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Atalhos</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Amanhã 9h', days: 1, hour: 9 },
                { label: 'Amanhã 14h', days: 1, hour: 14 },
                {
                  label: 'Segunda 9h',
                  days: (() => {
                    const d = new Date()
                    const diff = (8 - d.getDay()) % 7 || 7
                    return diff
                  })(),
                  hour: 9,
                },
              ].map(({ label, days, hour }) => {
                const d = new Date()
                d.setDate(d.getDate() + days)
                d.setHours(hour, 0, 0, 0)
                return (
                  <Button
                    key={label}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => {
                      setDate(format(d, 'yyyy-MM-dd'))
                      setTime(format(d, 'HH:mm'))
                    }}
                  >
                    <CalendarDays className="h-3 w-3 mr-1" />
                    {label}
                  </Button>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSchedule} disabled={isSaving || !text.trim()}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Clock className="h-4 w-4 mr-1.5" />}
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
