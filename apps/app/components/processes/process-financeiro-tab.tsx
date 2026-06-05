'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Euro, ExternalLink, Handshake, Percent, CreditCard } from 'lucide-react'
import { PaymentTimeline } from '@/components/financial/payment-timeline'
import { DEAL_SCENARIOS, DEAL_STATUSES } from '@/types/deal'
import type { DealScenario, DealStatus } from '@/types/deal'
import type { MapaGestaoPayment } from '@/types/financial'
import Link from 'next/link'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)

interface ProcessFinanceiroTabProps {
  deal: any
  dealId: string
}

export function ProcessFinanceiroTab({ deal, dealId }: ProcessFinanceiroTabProps) {
  const [payments, setPayments] = useState<MapaGestaoPayment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!dealId) return
    setIsLoading(true)
    fetch(`/api/deals/${dealId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.payments) setPayments(data.payments)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [dealId])

  const scenarioLabel = DEAL_SCENARIOS[deal?.deal_type as DealScenario]?.label ?? deal?.deal_type
  const statusInfo = DEAL_STATUSES[deal?.status as DealStatus]

  return (
    <div className="space-y-4">
      {/* Deal summary card */}
      <Card className="overflow-hidden py-0 gap-0">
        <div className="bg-neutral-900 px-5 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 text-neutral-400" />
              <span className="text-sm font-semibold text-white">Resumo Financeiro</span>
            </div>
            {statusInfo && (
              <Badge className={`text-[10px] ${statusInfo.color}`}>{statusInfo.label}</Badge>
            )}
          </div>
        </div>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-muted/50 p-1.5">
                <Euro className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground leading-none">Valor</p>
                <p className="text-sm font-semibold">{deal?.deal_value ? fmtCurrency(Number(deal.deal_value)) : '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-muted/50 p-1.5">
                <Percent className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground leading-none">Comissao</p>
                <p className="text-sm font-semibold">{deal?.commission_pct}% — {deal?.commission_total ? fmtCurrency(Number(deal.commission_total)) : '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-muted/50 p-1.5">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground leading-none">Margem</p>
                <p className="text-sm font-semibold">{deal?.agency_net ? fmtCurrency(Number(deal.agency_net)) : deal?.agency_margin ? fmtCurrency(Number(deal.agency_margin)) : '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-muted/50 p-1.5">
                <Handshake className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground leading-none">Cenario</p>
                <p className="text-sm font-semibold">{scenarioLabel}</p>
              </div>
            </div>
          </div>

          {deal?.has_share && (
            <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
              Partilha: {deal.share_pct}% — Parceiro: {deal.partner_agency_name || 'N/A'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Momentos de Pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : (
            <PaymentTimeline payments={payments} />
          )}
        </CardContent>
      </Card>

      {/* Link to full deal detail */}
      <Link href={`/dashboard/financeiro/deals/${dealId}`}>
        <Button variant="outline" className="w-full rounded-full">
          <ExternalLink className="mr-2 h-4 w-4" />
          Ver detalhe completo do negocio
        </Button>
      </Link>
    </div>
  )
}
