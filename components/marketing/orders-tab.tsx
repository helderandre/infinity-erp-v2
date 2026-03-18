'use client'

import { useState, useMemo } from 'react'
import { useMarketingOrders } from '@/hooks/use-marketing-orders'
import { useEncomendaRequisitions } from '@/hooks/use-encomenda-requisitions'
import {
  MARKETING_ORDER_STATUS, MARKETING_TIME_SLOTS, REQUISITION_STATUS,
  formatCurrency, formatDate,
} from '@/lib/constants'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  ShoppingBag, CheckCircle2, XCircle, Calendar, Play, Truck, Star, Ban,
  Loader2, Package, Camera, User, Clock, MapPin,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { MarketingOrder } from '@/types/marketing'
import type { Requisition } from '@/types/encomenda'

// A grouped purchase
interface GroupedPurchase {
  groupId: string
  serviceOrder: MarketingOrder | null
  materialRequisition: Requisition | null
  totalAmount: number
  createdAt: string
  agentName: string
}

const ALL_STATUSES = {
  pending: 'Pendente',
  accepted: 'Aceite',
  approved: 'Aprovada',
  scheduled: 'Agendado',
  in_production: 'Em Produção',
  ready: 'Pronta',
  delivered: 'Entregue',
  completed: 'Concluído',
  rejected: 'Rejeitado',
  cancelled: 'Cancelado',
  partially_delivered: 'Entrega Parcial',
} as const

export function OrdersTab() {
  const { orders, loading: ordersLoading, updateOrder } = useMarketingOrders()
  const { requisitions, loading: reqLoading } = useEncomendaRequisitions()

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [selectedPurchase, setSelectedPurchase] = useState<GroupedPurchase | null>(null)

  const [actionDialog, setActionDialog] = useState<{ orderId: string; action: string } | null>(null)
  const [reason, setReason] = useState('')
  const [confirmedDate, setConfirmedDate] = useState('')
  const [confirmedTime, setConfirmedTime] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loading = ordersLoading || reqLoading

  // Group by checkout_group_id
  const grouped = useMemo(() => {
    const map = new Map<string, GroupedPurchase>()

    for (const order of orders) {
      const gid = order.checkout_group_id || `svc-${order.id}`
      const existing = map.get(gid)
      if (existing) {
        existing.serviceOrder = order
        existing.totalAmount += order.total_amount
        if (new Date(order.created_at) < new Date(existing.createdAt)) existing.createdAt = order.created_at
      } else {
        map.set(gid, {
          groupId: gid, serviceOrder: order, materialRequisition: null,
          totalAmount: order.total_amount, createdAt: order.created_at,
          agentName: order.agent?.commercial_name || '—',
        })
      }
    }

    for (const req of requisitions) {
      const gid = req.checkout_group_id || `mat-${req.id}`
      const existing = map.get(gid)
      if (existing) {
        existing.materialRequisition = req
        existing.totalAmount += req.total_amount
        if (new Date(req.created_at) < new Date(existing.createdAt)) existing.createdAt = req.created_at
      } else {
        map.set(gid, {
          groupId: gid, serviceOrder: null, materialRequisition: req,
          totalAmount: req.total_amount, createdAt: req.created_at,
          agentName: req.agent?.commercial_name || '—',
        })
      }
    }

    let result = Array.from(map.values())
    if (typeFilter === 'service') result = result.filter(g => g.serviceOrder && !g.materialRequisition)
    if (typeFilter === 'material') result = result.filter(g => g.materialRequisition && !g.serviceOrder)
    if (typeFilter === 'mixed') result = result.filter(g => g.serviceOrder && g.materialRequisition)
    if (statusFilter !== 'all') {
      result = result.filter(g => g.serviceOrder?.status === statusFilter || g.materialRequisition?.status === statusFilter)
    }
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return result
  }, [orders, requisitions, statusFilter, typeFilter])

  const handleAction = async () => {
    if (!actionDialog) return
    setSubmitting(true)
    try {
      const extra: Record<string, unknown> = {}
      if (actionDialog.action === 'reject' || actionDialog.action === 'cancel') extra.reason = reason
      if (actionDialog.action === 'schedule') { extra.confirmed_date = confirmedDate; extra.confirmed_time = confirmedTime }
      await updateOrder(actionDialog.orderId, actionDialog.action, extra)
      toast.success('Encomenda actualizada')
      setActionDialog(null); setReason(''); setConfirmedDate(''); setConfirmedTime('')
    } catch (e: any) { toast.error(e.message || 'Erro ao actualizar') }
    finally { setSubmitting(false) }
  }

  const getServiceActions = (status: string) => {
    switch (status) {
      case 'pending': return [
        { action: 'accept', label: 'Aceitar', icon: CheckCircle2, variant: 'default' as const },
        { action: 'reject', label: 'Rejeitar', icon: XCircle, variant: 'destructive' as const, needsReason: true },
      ]
      case 'accepted': return [{ action: 'schedule', label: 'Agendar', icon: Calendar, variant: 'default' as const, needsSchedule: true }]
      case 'scheduled': return [{ action: 'start_production', label: 'Iniciar', icon: Play, variant: 'default' as const }]
      case 'in_production': return [{ action: 'deliver', label: 'Entregar', icon: Truck, variant: 'default' as const }]
      case 'delivered': return [{ action: 'complete', label: 'Concluir', icon: Star, variant: 'default' as const }]
      default: return []
    }
  }

  const getTypeBadges = (g: GroupedPurchase) => {
    const badges = []
    if (g.serviceOrder) badges.push(
      <span key="svc" className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted rounded-full px-2 py-0.5">
        <Camera className="h-3 w-3" />Serviço
      </span>
    )
    if (g.materialRequisition) badges.push(
      <span key="mat" className="inline-flex items-center gap-1 text-[10px] font-medium bg-orange-500/10 text-orange-700 rounded-full px-2 py-0.5">
        <Package className="h-3 w-3" />Material
      </span>
    )
    return badges
  }

  const getStatusBadges = (g: GroupedPurchase) => {
    const badges = []
    if (g.serviceOrder) {
      const cfg = MARKETING_ORDER_STATUS[g.serviceOrder.status as keyof typeof MARKETING_ORDER_STATUS]
      if (cfg) badges.push(
        <span key="svc-s" className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', cfg.bg, cfg.text)}>
          <span className={cn('h-1 w-1 rounded-full', cfg.dot)} />{cfg.label}
        </span>
      )
    }
    if (g.materialRequisition) {
      const cfg = REQUISITION_STATUS[g.materialRequisition.status as keyof typeof REQUISITION_STATUS]
      if (cfg) badges.push(
        <span key="mat-s" className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', cfg.bg, cfg.text)}>
          <span className={cn('h-1 w-1 rounded-full', cfg.dot)} />{cfg.label}
        </span>
      )
    }
    return badges
  }

  const getAllItems = (g: GroupedPurchase) => {
    const items: { id: string; name: string; qty?: number }[] = []
    if (g.serviceOrder?.items) for (const item of g.serviceOrder.items) items.push({ id: item.id, name: item.name })
    if (g.materialRequisition?.items) for (const item of g.materialRequisition.items) items.push({ id: item.id, name: item.product?.name || 'Produto', qty: item.quantity })
    return items
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px] rounded-full bg-muted/50 border-0 h-9 text-sm">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="service">Apenas Serviços</SelectItem>
            <SelectItem value="material">Apenas Materiais</SelectItem>
            <SelectItem value="mixed">Mistas (ambos)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] rounded-full bg-muted/50 border-0 h-9 text-sm">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            {Object.entries(ALL_STATUSES).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        </div>
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Nenhuma encomenda"
          description="As encomendas feitas pelos consultores aparecerão aqui."
        />
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[120px]">Tipo</TableHead>
                <TableHead>Consultor</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[180px]">Acções</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped.map((g) => {
                const items = getAllItems(g)
                const serviceActions = g.serviceOrder ? getServiceActions(g.serviceOrder.status) : []

                return (
                  <TableRow
                    key={g.groupId}
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => setSelectedPurchase(g)}
                  >
                    <TableCell>
                      <div className="flex flex-col gap-1">{getTypeBadges(g)}</div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{g.agentName}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {items.slice(0, 4).map(item => (
                          <span key={item.id} className="inline-flex text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                            {item.qty && item.qty > 1 ? `${item.qty}× ` : ''}{item.name}
                          </span>
                        ))}
                        {items.length > 4 && (
                          <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">+{items.length - 4}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-sm">
                      {formatCurrency(g.totalAmount)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(g.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">{getStatusBadges(g)}</div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {serviceActions.map(a => (
                          <Button
                            key={a.action}
                            variant={a.variant === 'destructive' ? 'ghost' : 'outline'}
                            size="sm"
                            className={cn('h-7 text-xs rounded-full', a.variant === 'destructive' && 'text-destructive')}
                            onClick={() => {
                              if ((a as any).needsReason || (a as any).needsSchedule) {
                                setActionDialog({ orderId: g.serviceOrder!.id, action: a.action })
                              } else {
                                updateOrder(g.serviceOrder!.id, a.action)
                                  .then(() => toast.success('Encomenda actualizada'))
                                  .catch((e: any) => toast.error(e.message))
                              }
                            }}
                          >
                            <a.icon className="mr-1 h-3 w-3" />
                            {a.label}
                          </Button>
                        ))}
                        {g.serviceOrder && ['pending', 'accepted', 'scheduled'].includes(g.serviceOrder.status) && (
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 rounded-full text-destructive"
                            onClick={() => setActionDialog({ orderId: g.serviceOrder!.id, action: 'cancel' })}
                          >
                            <Ban className="h-3 w-3" />
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

      {/* ─── Detail Dialog ─── */}
      <Dialog open={!!selectedPurchase} onOpenChange={(open) => { if (!open) setSelectedPurchase(null) }}>
        <DialogContent className="sm:max-w-[580px] max-h-[85vh] overflow-y-auto rounded-2xl">
          {selectedPurchase && (
            <>
              {/* Dark header */}
              <div className="-mx-6 -mt-6 mb-4 bg-neutral-900 rounded-t-2xl px-6 py-5">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2.5 text-white">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/15 backdrop-blur-sm">
                      <ShoppingBag className="h-4 w-4" />
                    </div>
                    Detalhes da Compra
                  </DialogTitle>
                  <DialogDescription className="text-neutral-400 mt-1 flex items-center gap-3">
                    <span>{formatDate(selectedPurchase.createdAt)}</span>
                    <Separator orientation="vertical" className="h-3 bg-neutral-700" />
                    <span>{selectedPurchase.agentName}</span>
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="space-y-4">
                {/* Type + status */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-1.5">{getTypeBadges(selectedPurchase)}</div>
                  <div className="flex gap-1.5">{getStatusBadges(selectedPurchase)}</div>
                </div>

                {/* Service Order */}
                {selectedPurchase.serviceOrder && (
                  <div className="rounded-xl border bg-card/50 p-4 space-y-3">
                    <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Camera className="h-3.5 w-3.5" />
                      Serviços & Packs
                      <span className="ml-auto text-[10px] rounded-full bg-muted px-2 py-0.5">
                        {(selectedPurchase.serviceOrder.items || []).length}
                      </span>
                    </h4>
                    {(selectedPurchase.serviceOrder.items || []).map((item, idx) => (
                      <div key={item.id}>
                        <div className="flex justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.name}</span>
                            {item.pack_id && (
                              <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">Pack</span>
                            )}
                          </div>
                          <span className="font-medium">{formatCurrency(item.price)}</span>
                        </div>
                        {idx < (selectedPurchase.serviceOrder!.items || []).length - 1 && <Separator className="my-2" />}
                      </div>
                    ))}
                    <Separator />
                    <div className="flex justify-between font-bold text-sm">
                      <span>Subtotal</span>
                      <span>{formatCurrency(selectedPurchase.serviceOrder.total_amount)}</span>
                    </div>
                  </div>
                )}

                {/* Material Requisition */}
                {selectedPurchase.materialRequisition && (
                  <div className="rounded-xl border bg-card/50 p-4 space-y-3">
                    <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5" />
                      Materiais
                      <span className="ml-auto text-[10px] rounded-full bg-muted px-2 py-0.5">
                        {(selectedPurchase.materialRequisition.items || []).length}
                      </span>
                    </h4>
                    {(selectedPurchase.materialRequisition.items || []).map((item, idx) => (
                      <div key={item.id}>
                        <div className="flex justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.product?.name || 'Produto'}</span>
                            <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                              x{item.quantity}
                            </span>
                          </div>
                          <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                        </div>
                        {idx < (selectedPurchase.materialRequisition!.items || []).length - 1 && <Separator className="my-2" />}
                      </div>
                    ))}
                    <Separator />
                    <div className="flex justify-between font-bold text-sm">
                      <span>Subtotal</span>
                      <span>{formatCurrency(selectedPurchase.materialRequisition.total_amount)}</span>
                    </div>
                    {selectedPurchase.materialRequisition.delivery_type && (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted rounded-full px-2.5 py-1 w-fit">
                        <MapPin className="h-3 w-3" />
                        {selectedPurchase.materialRequisition.delivery_type === 'pickup' ? 'Levantamento' : 'Entrega'}
                      </div>
                    )}
                  </div>
                )}

                {/* Grand Total */}
                <div className="rounded-xl bg-neutral-900 text-white p-4">
                  <div className="flex justify-between text-base font-bold">
                    <span>Total da Compra</span>
                    <span>{formatCurrency(selectedPurchase.totalAmount)}</span>
                  </div>
                </div>

                {/* Rejection/cancellation reasons */}
                {selectedPurchase.serviceOrder?.rejection_reason && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 space-y-1">
                    <p className="text-[11px] font-semibold text-red-800 uppercase">Motivo de Rejeição (Serviço)</p>
                    <p className="text-sm text-red-700">{selectedPurchase.serviceOrder.rejection_reason}</p>
                  </div>
                )}
                {selectedPurchase.serviceOrder?.cancellation_reason && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 space-y-1">
                    <p className="text-[11px] font-semibold text-amber-800 uppercase">Motivo de Cancelamento</p>
                    <p className="text-sm text-amber-700">{selectedPurchase.serviceOrder.cancellation_reason}</p>
                  </div>
                )}
                {selectedPurchase.materialRequisition?.rejection_reason && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 space-y-1">
                    <p className="text-[11px] font-semibold text-red-800 uppercase">Motivo de Rejeição (Material)</p>
                    <p className="text-sm text-red-700">{selectedPurchase.materialRequisition.rejection_reason}</p>
                  </div>
                )}

                {/* Timestamps */}
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Criado: {formatDate(selectedPurchase.createdAt)}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Action Dialog ─── */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
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
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Indique o motivo..." className="rounded-xl" />
            </div>
          )}

          {actionDialog?.action === 'schedule' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Data Confirmada</Label>
                <Input type="date" value={confirmedDate} onChange={(e) => setConfirmedDate(e.target.value)} className="rounded-full" />
              </div>
              <div className="space-y-2">
                <Label>Hora</Label>
                <Select value={confirmedTime} onValueChange={setConfirmedTime}>
                  <SelectTrigger className="rounded-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(MARKETING_TIME_SLOTS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setActionDialog(null)}>Cancelar</Button>
            <Button className="rounded-full" onClick={handleAction} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
