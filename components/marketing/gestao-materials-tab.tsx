'use client'

import { useMemo } from 'react'
import { useEncomendaRequisitions } from '@/hooks/use-encomenda-requisitions'
import { REQUISITION_STATUS } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/constants'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { Package, CheckCircle2 } from 'lucide-react'

const PROGRESS_STEPS = [
  { key: 'pending', label: 'Pendente' },
  { key: 'approved', label: 'Aprovada' },
  { key: 'in_production', label: 'Em Producao' },
  { key: 'ready', label: 'Pronta' },
] as const

function getStepIndex(status: string): number {
  const idx = PROGRESS_STEPS.findIndex((s) => s.key === status)
  return idx >= 0 ? idx : 0
}

const PENDING_STATUSES = ['pending', 'approved', 'in_production', 'ready']

export function GestaoMaterialsTab() {
  const { requisitions, loading } = useEncomendaRequisitions(true)

  const pendingRequisitions = useMemo(
    () => requisitions.filter((r) => PENDING_STATUSES.includes(r.status)),
    [requisitions]
  )

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    )
  }

  if (pendingRequisitions.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="Sem materiais pendentes"
        description="Nao existem requisicoes de materiais em curso."
      />
    )
  }

  return (
    <div className="space-y-4">
      {pendingRequisitions.map((req) => {
        const statusConfig = REQUISITION_STATUS[req.status as keyof typeof REQUISITION_STATUS]
        const currentStepIdx = getStepIndex(req.status)
        const isReady = req.status === 'ready'

        return (
          <div
            key={req.id}
            className={`rounded-xl border bg-card p-5 transition-all duration-300 hover:shadow-lg ${
              isReady ? 'ring-2 ring-emerald-500/30' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-mono text-sm font-semibold text-muted-foreground">
                    {req.reference}
                  </span>
                  {statusConfig && (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusConfig.bg} ${statusConfig.text}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
                      {statusConfig.label}
                    </span>
                  )}
                </div>

                {/* Items list */}
                <div className="flex flex-wrap gap-1.5">
                  {req.items?.map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1 rounded-full bg-muted text-[11px] px-2.5 py-0.5 font-medium"
                    >
                      <Package className="h-3 w-3 text-muted-foreground" />
                      {item.product?.name || 'Produto'} x{item.quantity}
                    </span>
                  )) || null}
                </div>

                {/* Total + date */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatCurrency(req.total_amount)}</span>
                  <span>Criado: {formatDate(req.created_at)}</span>
                </div>
              </div>

              {/* Ready badge */}
              {isReady && (
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-600 px-3 py-1.5 text-xs font-semibold shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Disponivel para levantar
                </div>
              )}
            </div>

            {/* Progress dots */}
            <div className="flex items-center gap-1">
              {PROGRESS_STEPS.map((step, idx) => {
                const isCompleted = idx <= currentStepIdx
                const isCurrent = idx === currentStepIdx
                return (
                  <div key={step.key} className="flex items-center gap-1 flex-1">
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <div
                        className={`h-3 w-3 rounded-full transition-all duration-300 ${
                          isCompleted
                            ? isCurrent
                              ? 'bg-primary ring-4 ring-primary/20'
                              : 'bg-primary'
                            : 'bg-muted'
                        }`}
                      />
                      <span
                        className={`text-[10px] font-medium ${
                          isCompleted ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {idx < PROGRESS_STEPS.length - 1 && (
                      <div
                        className={`h-px flex-1 -mt-4 ${
                          idx < currentStepIdx ? 'bg-primary' : 'bg-muted'
                        }`}
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
