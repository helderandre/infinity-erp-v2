'use client'

import { Package, Truck, MapPin, Calendar, User, Check, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from './status-badge'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  DELIVERY_TYPE_LABELS,
} from '@/lib/constants'
import type { Requisition } from '@/types/encomenda'

interface RequisitionDetailProps {
  requisition: Requisition
}

export function RequisitionDetail({ requisition }: RequisitionDetailProps) {
  const deliveryLabel =
    DELIVERY_TYPE_LABELS[requisition.delivery_type as keyof typeof DELIVERY_TYPE_LABELS] ??
    requisition.delivery_type

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold font-mono">{requisition.reference}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Criada em {formatDateTime(requisition.created_at)}
          </p>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={requisition.priority} type="priority" />
          <StatusBadge status={requisition.status} type="requisition" />
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>Consultor</span>
            </div>
            <p className="font-medium">
              {requisition.agent?.commercial_name ?? '—'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Truck className="h-4 w-4" />
              <span>Entrega</span>
            </div>
            <p className="font-medium">{deliveryLabel}</p>
            {requisition.delivery_address && (
              <p className="text-sm text-muted-foreground flex items-start gap-1">
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {requisition.delivery_address}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Datas</span>
            </div>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pretendida:</span>
                <span>{formatDate(requisition.requested_delivery_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entregue:</span>
                <span>{formatDate(requisition.actual_delivery_date)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Property */}
      {requisition.property && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Imovel:</span>
              <span className="font-medium">{requisition.property.title}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Itens da Requisicao
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Variante</TableHead>
                <TableHead className="text-center">Qtd</TableHead>
                <TableHead className="text-right">Preco un.</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requisition.items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium text-sm">
                        {item.product?.name ?? '—'}
                      </span>
                      {item.personalization_data &&
                        Object.keys(item.personalization_data).length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {Object.entries(item.personalization_data).map(
                              ([key, value]) => (
                                <p
                                  key={key}
                                  className="text-xs text-muted-foreground"
                                >
                                  <span className="font-medium">{key}:</span>{' '}
                                  {String(value)}
                                </p>
                              )
                            )}
                          </div>
                        )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.variant?.name ?? '—'}
                  </TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-right text-sm">
                    {formatCurrency(item.unit_price)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.subtotal)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {item.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {/* Total row */}
              <TableRow>
                <TableCell colSpan={4} className="text-right font-medium">
                  Total
                </TableCell>
                <TableCell className="text-right text-lg font-bold">
                  {formatCurrency(requisition.total_amount)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Rejection / Cancellation reasons */}
      {requisition.rejection_reason && (
        <Card className="border-red-200">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <X className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-600">
                  Motivo da rejeicao
                </p>
                <p className="text-sm mt-1">{requisition.rejection_reason}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {requisition.cancellation_reason && (
        <Card className="border-slate-200">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <X className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-600">
                  Motivo do cancelamento
                </p>
                <p className="text-sm mt-1">{requisition.cancellation_reason}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Internal notes */}
      {requisition.internal_notes && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Notas internas
            </p>
            <p className="text-sm">{requisition.internal_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historico</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <TimelineItem
              icon={<Package className="h-3.5 w-3.5" />}
              label="Requisicao criada"
              date={requisition.created_at}
            />
            {requisition.approved_at && (
              <TimelineItem
                icon={<Check className="h-3.5 w-3.5 text-emerald-500" />}
                label={`Aprovada por ${requisition.approved_by_user?.commercial_name ?? '—'}`}
                date={requisition.approved_at}
              />
            )}
            {requisition.rejection_reason && (
              <TimelineItem
                icon={<X className="h-3.5 w-3.5 text-red-500" />}
                label="Rejeitada"
                date={requisition.updated_at}
              />
            )}
            {requisition.actual_delivery_date && (
              <TimelineItem
                icon={<Truck className="h-3.5 w-3.5 text-blue-500" />}
                label="Entregue"
                date={requisition.actual_delivery_date}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function TimelineItem({
  icon,
  label,
  date,
}: {
  icon: React.ReactNode
  label: string
  date: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm">{label}</p>
      </div>
      <span className="text-xs text-muted-foreground">{formatDateTime(date)}</span>
    </div>
  )
}
