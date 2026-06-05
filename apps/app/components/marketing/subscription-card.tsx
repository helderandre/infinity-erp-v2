'use client'

import type { MarketingSubscription } from '@/types/marketing'
import {
  SUBSCRIPTION_STATUS,
  BILLING_CYCLE_LABELS,
  formatCurrency,
  formatDate,
} from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { RefreshCcw, XCircle } from 'lucide-react'

const BORDER_COLORS: Record<string, string> = {
  active: 'border-l-emerald-500',
  paused: 'border-l-amber-500',
  cancelled: 'border-l-slate-400',
  expired: 'border-l-slate-400',
  billing_failed: 'border-l-red-500',
}

interface SubscriptionCardProps {
  subscription: MarketingSubscription
  onCancel: (id: string) => void
  onReactivate: (id: string) => void
}

export function SubscriptionCard({ subscription, onCancel, onReactivate }: SubscriptionCardProps) {
  const sub = subscription
  const statusConfig = SUBSCRIPTION_STATUS[sub.status as keyof typeof SUBSCRIPTION_STATUS]
  const cycleLabel = BILLING_CYCLE_LABELS[sub.billing_cycle] || ''
  const borderColor = BORDER_COLORS[sub.status] || 'border-l-slate-300'
  const isCancelling = sub.cancel_at_period_end && sub.status === 'active'

  return (
    <div
      className={`rounded-xl border border-l-4 ${borderColor} bg-card p-5 transition-all duration-300 hover:shadow-lg`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: info */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-sm font-semibold">
              {sub.catalog_item?.name || 'Subscricao'}
            </span>

            {/* Status badge */}
            {statusConfig && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusConfig.bg} ${statusConfig.text}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
                {statusConfig.label}
              </span>
            )}

            {/* Cancelling badge */}
            {isCancelling && (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-amber-500/15 text-amber-600">
                Cancela em {formatDate(sub.current_period_end)}
              </span>
            )}
          </div>

          {/* Price + cycle */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold">{formatCurrency(sub.price_per_cycle)}</span>
            <span className="text-sm text-muted-foreground">{cycleLabel}</span>
          </div>

          {/* Next billing */}
          {!isCancelling && sub.status === 'active' && (
            <p className="text-xs text-muted-foreground">
              Proxima renovacao: {formatDate(sub.next_billing_date)}
            </p>
          )}

          {/* Billing failed message */}
          {sub.status === 'billing_failed' && sub.last_billing_error && (
            <p className="text-xs text-red-600">
              Erro: {sub.last_billing_error}
            </p>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isCancelling ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              onClick={() => onReactivate(sub.id)}
            >
              <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
              Reactivar
            </Button>
          ) : sub.status === 'active' ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs text-destructive hover:text-destructive"
              onClick={() => onCancel(sub.id)}
            >
              <XCircle className="mr-1.5 h-3.5 w-3.5" />
              Cancelar
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
