'use client'

import { MoreHorizontal, ArrowUpDown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from './status-badge'
import { formatCurrency, formatDate } from '@/lib/constants'
import type { Requisition, RequisitionStatus } from '@/types/encomenda'

interface RequisitionsTableProps {
  requisitions: Requisition[]
  loading: boolean
  onAction: (id: string, action: string, extra?: any) => void
}

const ACTIONS_BY_STATUS: Record<RequisitionStatus, { key: string; label: string }[]> = {
  pending: [
    { key: 'approve', label: 'Aprovar' },
    { key: 'reject', label: 'Rejeitar' },
    { key: 'cancel', label: 'Cancelar' },
  ],
  approved: [
    { key: 'in_production', label: 'Iniciar Producao' },
    { key: 'cancel', label: 'Cancelar' },
  ],
  in_production: [
    { key: 'ready', label: 'Marcar Pronta' },
    { key: 'cancel', label: 'Cancelar' },
  ],
  ready: [
    { key: 'deliver', label: 'Entregar' },
  ],
  rejected: [],
  delivered: [],
  cancelled: [],
  partially_delivered: [
    { key: 'deliver', label: 'Entregar Restante' },
  ],
}

export function RequisitionsTable({ requisitions, loading, onAction }: RequisitionsTableProps) {
  if (loading) {
    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referencia</TableHead>
              <TableHead>Consultor</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 8 }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (requisitions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border rounded-lg">
        <p className="font-medium">Nenhuma requisicao encontrada</p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <div className="flex items-center gap-1">
                Referencia
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </TableHead>
            <TableHead>Consultor</TableHead>
            <TableHead>Itens</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {requisitions.map((req) => {
            const actions = ACTIONS_BY_STATUS[req.status] ?? []
            const itemsSummary = req.items
              ? req.items.length === 1
                ? req.items[0].product?.name ?? '1 item'
                : `${req.items.length} itens`
              : '—'

            return (
              <TableRow key={req.id}>
                <TableCell className="font-mono text-sm font-medium">
                  {req.reference}
                </TableCell>
                <TableCell>{req.agent?.commercial_name ?? '—'}</TableCell>
                <TableCell className="text-sm">{itemsSummary}</TableCell>
                <TableCell className="font-medium">
                  {formatCurrency(req.total_amount)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={req.priority} type="priority" />
                </TableCell>
                <TableCell>
                  <StatusBadge status={req.status} type="requisition" />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(req.created_at)}
                </TableCell>
                <TableCell>
                  {actions.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {actions.map((action) => (
                          <DropdownMenuItem
                            key={action.key}
                            onClick={() => onAction(req.id, action.key)}
                            className={
                              action.key === 'reject' || action.key === 'cancel'
                                ? 'text-destructive'
                                : ''
                            }
                          >
                            {action.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
