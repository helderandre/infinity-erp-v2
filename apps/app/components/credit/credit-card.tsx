'use client'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { CreditStatusBadge } from './credit-status-badge'
import { FileText, TrendingDown, User } from 'lucide-react'
import type { CreditRequestListItem } from '@/types/credit'

interface CreditCardProps {
  request: CreditRequestListItem
  onClick?: () => void
}

export function CreditCard({ request, onClick }: CreditCardProps) {
  const docsProgress = request.docs_total > 0
    ? Math.round((1 - request.docs_pendentes / request.docs_total) * 100)
    : 0

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md hover:scale-[1.01]',
        onClick && 'hover:border-primary/40'
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2.5">
        {/* Header: reference + status */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-mono font-medium text-muted-foreground">
            {request.reference ?? '—'}
          </span>
          <CreditStatusBadge status={request.status} size="sm" />
        </div>

        {/* Client name */}
        <div className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">
            {request.lead_nome}
          </span>
        </div>

        {/* Montante */}
        {request.montante_solicitado != null && (
          <p className="text-base font-semibold">
            {formatCurrency(request.montante_solicitado)}
          </p>
        )}

        {/* Docs progress + propostas */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            <span>
              {request.docs_total - request.docs_pendentes}/{request.docs_total} docs
            </span>
          </div>
          <span>{request.propostas_count} proposta{request.propostas_count !== 1 ? 's' : ''}</span>
        </div>

        {/* Docs progress bar */}
        <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              docsProgress === 100 ? 'bg-emerald-500' : 'bg-primary'
            )}
            style={{ width: `${docsProgress}%` }}
          />
        </div>

        {/* Melhor spread */}
        {request.melhor_spread != null && (
          <div className="flex items-center gap-1 text-xs text-emerald-600">
            <TrendingDown className="h-3 w-3" />
            <span>Melhor spread: {request.melhor_spread.toFixed(2)}%</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
