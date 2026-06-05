'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Phone, MapPin, UserCheck, MessageCircle, Plus } from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface DeclareActivitiesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  goalId: string
  onSuccess?: () => void
}

type ActivityType = 'call' | 'visit' | 'follow_up' | 'lead_contact'
type Period = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'custom'
type Direction = 'outbound' | 'inbound' | 'both'

const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: React.ElementType }[] = [
  { value: 'call', label: 'Chamadas', icon: Phone },
  { value: 'visit', label: 'Visitas', icon: MapPin },
  { value: 'follow_up', label: 'Acompanhamentos', icon: UserCheck },
  { value: 'lead_contact', label: 'Contactos', icon: MessageCircle },
]

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'this_week', label: 'Esta semana' },
  { value: 'last_week', label: 'Semana passada' },
  { value: 'custom', label: 'Data específica' },
]

export function DeclareActivitiesDialog({
  open,
  onOpenChange,
  goalId,
  onSuccess,
}: DeclareActivitiesDialogProps) {
  const [activityType, setActivityType] = useState<ActivityType>('call')
  const [quantity, setQuantity] = useState(1)
  const [period, setPeriod] = useState<Period>('this_week')
  const [customDate, setCustomDate] = useState('')
  const [direction, setDirection] = useState<Direction>('outbound')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (quantity < 1) return toast.error('Quantidade mínima: 1')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/goals/${goalId}/declare-activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_type: activityType,
          quantity,
          period,
          custom_date: period === 'custom' ? customDate : undefined,
          direction: direction === 'both' ? null : direction,
          notes: notes.trim() || undefined,
        }),
      })

      if (!res.ok) throw new Error()

      toast.success(`${quantity} ${ACTIVITY_TYPES.find(t => t.value === activityType)?.label?.toLowerCase() || 'actividades'} registadas`)
      setQuantity(1)
      setNotes('')
      onOpenChange(false)
      onSuccess?.()
    } catch {
      toast.error('Erro ao registar actividades')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
        {/* Dark header */}
        <div className="bg-neutral-900 px-6 py-5">
          <DialogHeader className="p-0">
            <DialogTitle className="text-white text-base font-semibold">
              Registar Actividades Adicionais
            </DialogTitle>
            <DialogDescription className="text-neutral-400 text-xs mt-1">
              Actividades realizadas fora do sistema
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5">
          {/* Activity type */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
              Tipo de actividade
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ACTIVITY_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setActivityType(t.value)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all',
                    activityType === t.value
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'border-border/50 text-muted-foreground hover:bg-muted/50'
                  )}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
              Quantidade
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="h-9 w-9 rounded-full border border-border/50 flex items-center justify-center text-lg font-medium hover:bg-muted/50 transition-colors"
              >
                −
              </button>
              <Input
                type="number"
                min={1}
                max={100}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 text-center rounded-xl h-9"
              />
              <button
                onClick={() => setQuantity(Math.min(100, quantity + 1))}
                className="h-9 w-9 rounded-full border border-border/50 flex items-center justify-center text-lg font-medium hover:bg-muted/50 transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Period */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
              Período
            </label>
            <div className="flex flex-wrap gap-1 p-0.5 rounded-full bg-muted/40 border border-border/30 w-fit">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium transition-all',
                    period === p.value
                      ? 'bg-neutral-900 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {period === 'custom' && (
              <Input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="mt-2 rounded-xl w-48"
              />
            )}
          </div>

          {/* Direction */}
          {(activityType === 'call' || activityType === 'lead_contact') && (
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Direcção
              </label>
              <div className="flex gap-1 p-0.5 rounded-full bg-muted/40 border border-border/30 w-fit">
                {[
                  { value: 'outbound' as Direction, label: '↗ Enviadas' },
                  { value: 'inbound' as Direction, label: '↙ Recebidas' },
                  { value: 'both' as Direction, label: 'Ambas' },
                ].map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDirection(d.value)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium transition-all',
                      direction === d.value
                        ? 'bg-neutral-900 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full text-sm bg-muted/30 rounded-xl border border-border/50 p-3 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none leading-relaxed placeholder:text-muted-foreground/50"
            placeholder="Notas (opcional)..."
          />

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full gap-2 bg-neutral-900 hover:bg-neutral-800 text-white"
          >
            {submitting ? (
              <><Spinner className="h-4 w-4" /> A registar...</>
            ) : (
              <><Plus className="h-4 w-4" /> Registar {quantity} {ACTIVITY_TYPES.find(t => t.value === activityType)?.label?.toLowerCase()}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
