'use client'

import { useState } from 'react'
import { useMarketingOrders } from '@/hooks/use-marketing-orders'
import { MARKETING_ORDER_STATUS, MARKETING_TIME_SLOTS, formatCurrency, formatDate } from '@/lib/constants'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  ShoppingBag, CheckCircle2, XCircle, Calendar, Play, Truck, Star, Ban, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function OrdersTab() {
  const { orders, loading, filters, setFilters, updateOrder } = useMarketingOrders()
  const [actionDialog, setActionDialog] = useState<{ orderId: string; action: string } | null>(null)
  const [reason, setReason] = useState('')
  const [confirmedDate, setConfirmedDate] = useState('')
  const [confirmedTime, setConfirmedTime] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleAction = async () => {
    if (!actionDialog) return
    setSubmitting(true)
    try {
      const extra: Record<string, unknown> = {}
      if (actionDialog.action === 'reject' || actionDialog.action === 'cancel') extra.reason = reason
      if (actionDialog.action === 'schedule') {
        extra.confirmed_date = confirmedDate
        extra.confirmed_time = confirmedTime
      }
      await updateOrder(actionDialog.orderId, actionDialog.action, extra)
      toast.success('Encomenda actualizada')
      setActionDialog(null)
      setReason('')
      setConfirmedDate('')
      setConfirmedTime('')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao actualizar')
    } finally {
      setSubmitting(false)
    }
  }

  const getActions = (status: string) => {
    switch (status) {
      case 'pending': return [
        { action: 'accept', label: 'Aceitar', icon: CheckCircle2, variant: 'default' as const },
        { action: 'reject', label: 'Rejeitar', icon: XCircle, variant: 'destructive' as const, needsReason: true },
      ]
      case 'accepted': return [
        { action: 'schedule', label: 'Agendar', icon: Calendar, variant: 'default' as const, needsSchedule: true },
      ]
      case 'scheduled': return [
        { action: 'start_production', label: 'Iniciar Produção', icon: Play, variant: 'default' as const },
      ]
      case 'in_production': return [
        { action: 'deliver', label: 'Entregar', icon: Truck, variant: 'default' as const },
      ]
      case 'delivered': return [
        { action: 'complete', label: 'Concluir', icon: Star, variant: 'default' as const },
      ]
      default: return []
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2">
        <Select
          value={filters.status || 'all'}
          onValueChange={(v) => setFilters({ ...filters, status: v === 'all' ? undefined : v })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            {Object.entries(MARKETING_ORDER_STATUS).map(([value, config]) => (
              <SelectItem key={value} value={value}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Nenhuma encomenda"
          description="As encomendas feitas pelos consultores aparecerão aqui."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultor</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Data Preferida</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[200px]">Acções</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map(order => {
                const statusConfig = MARKETING_ORDER_STATUS[order.status as keyof typeof MARKETING_ORDER_STATUS]
                const actions = getActions(order.status)
                return (
                  <TableRow key={order.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{order.agent?.commercial_name || '—'}</p>
                      {order.property && (
                        <p className="text-xs text-muted-foreground">{order.property.title}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(order.items || []).map(item => (
                          <Badge key={item.id} variant="outline" className="text-[10px]">{item.name}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(order.total_amount)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {order.confirmed_date
                        ? formatDate(order.confirmed_date)
                        : order.preferred_date
                          ? formatDate(order.preferred_date)
                          : '—'}
                    </TableCell>
                    <TableCell>
                      {statusConfig && (
                        <span className={cn(
                          'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
                          statusConfig.bg, statusConfig.text
                        )}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', statusConfig.dot)} />
                          {statusConfig.label}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {actions.map(a => (
                          <Button
                            key={a.action}
                            variant={a.variant === 'destructive' ? 'ghost' : 'outline'}
                            size="sm"
                            className={cn('h-7 text-xs', a.variant === 'destructive' && 'text-destructive')}
                            onClick={() => {
                              if ((a as any).needsReason || (a as any).needsSchedule) {
                                setActionDialog({ orderId: order.id, action: a.action })
                              } else {
                                updateOrder(order.id, a.action)
                                  .then(() => toast.success('Encomenda actualizada'))
                                  .catch((e: any) => toast.error(e.message))
                              }
                            }}
                          >
                            <a.icon className="mr-1 h-3 w-3" />
                            {a.label}
                          </Button>
                        ))}
                        {['pending', 'accepted', 'scheduled'].includes(order.status) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-destructive"
                            onClick={() => setActionDialog({ orderId: order.id, action: 'cancel' })}
                          >
                            <Ban className="mr-1 h-3 w-3" />
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action === 'reject' && 'Rejeitar Encomenda'}
              {actionDialog?.action === 'cancel' && 'Cancelar Encomenda'}
              {actionDialog?.action === 'schedule' && 'Agendar Encomenda'}
            </DialogTitle>
          </DialogHeader>

          {(actionDialog?.action === 'reject' || actionDialog?.action === 'cancel') && (
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Indique o motivo..." />
            </div>
          )}

          {actionDialog?.action === 'schedule' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Data Confirmada</Label>
                <Input type="date" value={confirmedDate} onChange={(e) => setConfirmedDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Hora</Label>
                <Select value={confirmedTime} onValueChange={setConfirmedTime}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(MARKETING_TIME_SLOTS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancelar</Button>
            <Button onClick={handleAction} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
