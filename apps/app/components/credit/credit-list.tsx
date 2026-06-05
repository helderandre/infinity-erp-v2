'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { CreditStatusBadge } from './credit-status-badge'
import { ChevronLeft, ChevronRight, FileText, Handshake } from 'lucide-react'
import type { CreditRequestListItem } from '@/types/credit'

interface CreditListProps {
  requests: CreditRequestListItem[]
  total: number
  page: number
  perPage: number
  onPageChange: (page: number) => void
  onRequestClick: (id: string) => void
}

function formatTaxaEsforco(value: number | null) {
  if (value == null) return '—'
  return `${value.toFixed(1)}%`
}

function getTaxaEsforcoColor(value: number | null) {
  if (value == null) return ''
  if (value <= 30) return 'text-emerald-600'
  if (value <= 40) return 'text-amber-600'
  return 'text-red-600'
}

export function CreditList({
  requests,
  total,
  page,
  perPage,
  onPageChange,
  onRequestClick,
}: CreditListProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const startItem = (page - 1) * perPage + 1
  const endItem = Math.min(page * perPage, total)

  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Ref.</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Montante</TableHead>
              <TableHead className="text-center">Prazo</TableHead>
              <TableHead className="text-center">Taxa Esforço</TableHead>
              <TableHead className="text-center">Melhor Spread</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Docs</TableHead>
              <TableHead className="text-center">Propostas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  Nenhum pedido de crédito encontrado.
                </TableCell>
              </TableRow>
            ) : (
              requests.map((req) => (
                <TableRow
                  key={req.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onRequestClick(req.id)}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {req.reference ?? '—'}
                  </TableCell>
                  <TableCell className="font-medium">
                    {req.lead_nome}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {req.montante_solicitado != null
                      ? formatCurrency(req.montante_solicitado)
                      : '—'}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {req.prazo_anos != null ? `${req.prazo_anos} anos` : '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        getTaxaEsforcoColor(req.taxa_esforco)
                      )}
                    >
                      {formatTaxaEsforco(req.taxa_esforco)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {req.melhor_spread != null
                      ? `${req.melhor_spread.toFixed(2)}%`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <CreditStatusBadge status={req.status} size="sm" />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      <span>
                        {req.docs_total - req.docs_pendentes}/{req.docs_total}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                      <Handshake className="h-3 w-3" />
                      <span>{req.propostas_count}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">
            {startItem}–{endItem} de {total} pedido{total !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Página anterior</span>
            </Button>
            <span className="px-2 text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Página seguinte</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
