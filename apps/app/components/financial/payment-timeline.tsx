'use client'

import { Check, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MapaGestaoPayment } from '@/types/financial'
import { PAYMENT_MOMENTS } from '@/types/deal'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })

interface PaymentTimelineProps {
  payments: MapaGestaoPayment[]
}

const STEPS = [
  { field: 'is_signed', dateField: 'signed_date', label: 'Assinado' },
  { field: 'is_received', dateField: 'received_date', label: 'Recebido' },
  { field: 'is_reported', dateField: 'reported_date', label: 'Reportado' },
  { field: 'consultant_paid', dateField: 'consultant_paid_date', label: 'Consultor Pago' },
] as const

export function PaymentTimeline({ payments }: PaymentTimelineProps) {
  if (!payments || payments.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-4">
        <Clock className="h-5 w-5 mx-auto mb-2 opacity-40" />
        Sem momentos de pagamento
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {payments.map((payment) => {
        const momentLabel = PAYMENT_MOMENTS[payment.payment_moment as keyof typeof PAYMENT_MOMENTS] ?? payment.payment_moment

        return (
          <div key={payment.id} className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{momentLabel}</span>
                <span className="text-xs text-muted-foreground">({payment.payment_pct}%)</span>
              </div>
              <span className="text-sm font-bold tabular-nums">{fmtCurrency(payment.amount)}</span>
            </div>

            {/* Steps */}
            <div className="flex items-center gap-0">
              {STEPS.map((step, idx) => {
                const done = !!(payment as any)[step.field]
                const date = (payment as any)[step.dateField]

                return (
                  <div key={step.field} className="flex items-center flex-1">
                    {/* Dot */}
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className={cn(
                          'h-6 w-6 rounded-full flex items-center justify-center transition-all duration-300 shrink-0',
                          done
                            ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30'
                            : 'border-2 border-muted-foreground/30'
                        )}
                      >
                        {done && <Check className="h-3.5 w-3.5 text-white" />}
                      </div>
                      <span className="text-[9px] text-muted-foreground text-center leading-tight max-w-[60px]">
                        {step.label}
                      </span>
                      {done && date && (
                        <span className="text-[8px] text-muted-foreground/60">{fmtDate(date)}</span>
                      )}
                    </div>

                    {/* Connector line */}
                    {idx < STEPS.length - 1 && (
                      <div
                        className={cn(
                          'h-0.5 flex-1 mx-1 rounded-full transition-all duration-300',
                          done ? 'bg-emerald-500/50' : 'bg-muted-foreground/15'
                        )}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
