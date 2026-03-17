'use client'

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  MARKETING_ORDER_STATUS, REQUISITION_STATUS,
  formatCurrency, formatDate,
} from '@/lib/constants'
import {
  Camera, Package, Calendar, Building2, Clock, User, FileText, MapPin,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MarketingOrder } from '@/types/marketing'
import type { Requisition } from '@/types/encomenda'

type OrderDetailData =
  | { kind: 'service'; data: MarketingOrder }
  | { kind: 'material'; data: Requisition }

interface OrderDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: OrderDetailData | null
}

export function OrderDetailDialog({ open, onOpenChange, order }: OrderDetailDialogProps) {
  if (!order) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {order.kind === 'service' ? (
              <>
                <Camera className="h-5 w-5" />
                Encomenda de Serviço
              </>
            ) : (
              <>
                <Package className="h-5 w-5" />
                Requisição de Material
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {order.kind === 'service' ? (
          <ServiceDetail order={order.data} />
        ) : (
          <MaterialDetail requisition={order.data} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ServiceDetail({ order }: { order: MarketingOrder }) {
  const statusCfg = MARKETING_ORDER_STATUS[order.status as keyof typeof MARKETING_ORDER_STATUS]

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="flex items-center justify-between">
        {statusCfg && (
          <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium', statusCfg.bg, statusCfg.text)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', statusCfg.dot)} />
            {statusCfg.label}
          </span>
        )}
        <span className="text-sm text-muted-foreground">{formatDate(order.created_at)}</span>
      </div>

      {/* Agent */}
      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{order.agent?.commercial_name || '—'}</span>
        </div>
        {order.property && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span>{order.property.title}</span>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="rounded-lg border p-4 space-y-3">
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
          Itens ({(order.items || []).length})
        </h4>
        {(order.items || []).map((item, idx) => (
          <div key={item.id}>
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{item.name}</span>
                {item.pack_id && (
                  <Badge variant="outline" className="text-[10px]">Pack</Badge>
                )}
              </div>
              <span className="font-medium">{formatCurrency(item.price)}</span>
            </div>
            <div className="flex gap-2 mt-1">
              <Badge variant="secondary" className="text-[10px]">
                {item.status === 'available' ? 'Disponível' : item.status === 'used' ? 'Utilizado' : 'Expirado'}
              </Badge>
              {item.quantity > 1 && (
                <span className="text-xs text-muted-foreground">
                  {item.used_count}/{item.quantity} utilizados
                </span>
              )}
            </div>
            {idx < (order.items || []).length - 1 && <Separator className="my-3" />}
          </div>
        ))}
        <Separator />
        <div className="flex justify-between font-bold text-sm">
          <span>Total</span>
          <span>{formatCurrency(order.total_amount)}</span>
        </div>
      </div>

      {/* Rejection / cancellation reason */}
      {order.rejection_reason && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
          <p className="text-xs font-medium text-red-800 uppercase">Motivo de Rejeição</p>
          <p className="text-sm text-red-700">{order.rejection_reason}</p>
        </div>
      )}
      {order.cancellation_reason && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
          <p className="text-xs font-medium text-amber-800 uppercase">Motivo de Cancelamento</p>
          <p className="text-sm text-amber-700">{order.cancellation_reason}</p>
        </div>
      )}

      {/* Internal notes */}
      {order.internal_notes && (
        <div className="rounded-lg border p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />Notas Internas
          </p>
          <p className="text-sm">{order.internal_notes}</p>
        </div>
      )}

      {/* Timestamps */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span>Criado: {formatDate(order.created_at)}</span>
        {order.updated_at !== order.created_at && (
          <span>· Actualizado: {formatDate(order.updated_at)}</span>
        )}
      </div>
    </div>
  )
}

function MaterialDetail({ requisition }: { requisition: Requisition }) {
  const statusCfg = REQUISITION_STATUS[requisition.status as keyof typeof REQUISITION_STATUS]

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {statusCfg && (
            <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium', statusCfg.bg, statusCfg.text)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', statusCfg.dot)} />
              {statusCfg.label}
            </span>
          )}
          {requisition.reference && (
            <span className="text-xs font-mono text-muted-foreground">{requisition.reference}</span>
          )}
        </div>
        <span className="text-sm text-muted-foreground">{formatDate(requisition.created_at)}</span>
      </div>

      {/* Agent */}
      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{requisition.agent?.commercial_name || '—'}</span>
        </div>
        {requisition.property && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span>{requisition.property.title}</span>
          </div>
        )}
        {requisition.delivery_type && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{requisition.delivery_type === 'pickup' ? 'Levantamento' : 'Entrega'}</span>
            {requisition.delivery_address && (
              <span className="text-xs">— {requisition.delivery_address}</span>
            )}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="rounded-lg border p-4 space-y-3">
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
          Produtos ({(requisition.items || []).length})
        </h4>
        {(requisition.items || []).map((item, idx) => (
          <div key={item.id}>
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{item.product?.name || 'Produto'}</span>
                {item.variant && (
                  <Badge variant="outline" className="text-[10px]">{item.variant.name}</Badge>
                )}
              </div>
              <span className="font-medium">{formatCurrency(item.subtotal)}</span>
            </div>
            <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
              <span>{item.quantity} × {formatCurrency(item.unit_price)}</span>
            </div>
            {item.personalization_data && Object.keys(item.personalization_data).length > 0 && (
              <div className="mt-2 p-2 bg-muted/50 rounded text-xs space-y-1">
                <p className="font-medium text-muted-foreground">Personalização:</p>
                {Object.entries(item.personalization_data).map(([key, val]) => (
                  <div key={key} className="flex gap-2">
                    <span className="text-muted-foreground">{key}:</span>
                    <span>{String(val)}</span>
                  </div>
                ))}
              </div>
            )}
            {item.notes && (
              <p className="text-xs text-muted-foreground mt-1">Nota: {item.notes}</p>
            )}
            {idx < (requisition.items || []).length - 1 && <Separator className="my-3" />}
          </div>
        ))}
        <Separator />
        <div className="flex justify-between font-bold text-sm">
          <span>Total</span>
          <span>{formatCurrency(requisition.total_amount)}</span>
        </div>
      </div>

      {/* Priority */}
      {requisition.priority && requisition.priority !== 'normal' && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Prioridade:</span>
          <Badge variant={requisition.priority === 'urgent' ? 'destructive' : 'secondary'} className="text-xs">
            {requisition.priority === 'low' ? 'Baixa' : requisition.priority === 'high' ? 'Alta' : requisition.priority === 'urgent' ? 'Urgente' : 'Normal'}
          </Badge>
        </div>
      )}

      {/* Delivery info */}
      {(requisition.requested_delivery_date || requisition.actual_delivery_date) && (
        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase">Entrega</p>
          {requisition.requested_delivery_date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Pedida:</span>
              <span>{formatDate(requisition.requested_delivery_date)}</span>
            </div>
          )}
          {requisition.actual_delivery_date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-muted-foreground">Efectuada:</span>
              <span>{formatDate(requisition.actual_delivery_date)}</span>
            </div>
          )}
        </div>
      )}

      {/* Rejection / cancellation */}
      {requisition.rejection_reason && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
          <p className="text-xs font-medium text-red-800 uppercase">Motivo de Rejeição</p>
          <p className="text-sm text-red-700">{requisition.rejection_reason}</p>
        </div>
      )}
      {requisition.cancellation_reason && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
          <p className="text-xs font-medium text-amber-800 uppercase">Motivo de Cancelamento</p>
          <p className="text-sm text-amber-700">{requisition.cancellation_reason}</p>
        </div>
      )}

      {/* Internal notes */}
      {requisition.internal_notes && (
        <div className="rounded-lg border p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />Notas Internas
          </p>
          <p className="text-sm">{requisition.internal_notes}</p>
        </div>
      )}

      {/* Approval info */}
      {requisition.approved_by_user && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Aprovado por: {requisition.approved_by_user.commercial_name}</span>
          {requisition.approved_at && <span>em {formatDate(requisition.approved_at)}</span>}
        </div>
      )}

      {/* Timestamps */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span>Criado: {formatDate(requisition.created_at)}</span>
        {requisition.updated_at !== requisition.created_at && (
          <span>· Actualizado: {formatDate(requisition.updated_at)}</span>
        )}
      </div>
    </div>
  )
}
