'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { RequisitionsTable } from '@/components/encomendas/requisitions-table'
import { useEncomendaRequisitions } from '@/hooks/use-encomenda-requisitions'
import { REQUISITION_STATUS } from '@/lib/constants'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  ClipboardList, Package, Star, ThumbsUp, Loader2, PackageCheck, ChevronDown,
} from 'lucide-react'
import { useUser } from '@/hooks/use-user'

export default function MinhasRequisicoesPage() {
  const { user } = useUser()
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [pendingPickups, setPendingPickups] = useState<any[]>([])
  const [pickupsLoading, setPickupsLoading] = useState(true)
  const [feedbackOrderId, setFeedbackOrderId] = useState<string | null>(null)
  const [feedbackRating, setFeedbackRating] = useState(0)
  const [feedbackHover, setFeedbackHover] = useState(0)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [feedbackRecommend, setFeedbackRecommend] = useState(true)
  const [feedbackAnonymous, setFeedbackAnonymous] = useState(false)
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [pickingUp, setPickingUp] = useState<string | null>(null)

  const { requisitions, loading, filters, setFilters, performAction, refetch } =
    useEncomendaRequisitions(true)

  // Fetch orders pending pickup for this user (at_store or picked_up)
  const fetchPickups = useCallback(async () => {
    if (!user?.id) return
    setPickupsLoading(true)
    try {
      const [res1, res2] = await Promise.all([
        fetch(`/api/encomendas/supplier-orders?status=at_store&agent_id=${user.id}`),
        fetch(`/api/encomendas/supplier-orders?status=picked_up&agent_id=${user.id}`),
      ])
      const atStore = await res1.json()
      const pickedUp = await res2.json()
      setPendingPickups([
        ...(Array.isArray(atStore) ? atStore : atStore.data || []),
        ...(Array.isArray(pickedUp) ? pickedUp : pickedUp.data || []),
      ])
    } catch { /* */ }
    finally { setPickupsLoading(false) }
  }, [user?.id])

  useEffect(() => { fetchPickups() }, [fetchPickups])

  const handlePickup = async (orderId: string) => {
    setPickingUp(orderId)
    try {
      const res = await fetch(`/api/encomendas/supplier-orders/${orderId}/pickup`, { method: 'POST' })
      if (res.ok) {
        toast.success('Encomenda levantada!')
        setFeedbackOrderId(orderId)
        fetchPickups()
      } else {
        const err = await res.json()
        toast.error(err.error || 'Erro')
      }
    } catch { toast.error('Erro ao levantar encomenda') }
    finally { setPickingUp(null) }
  }

  const handleFeedbackSubmit = async () => {
    if (!feedbackOrderId || feedbackRating === 0) {
      toast.error('Seleccione uma avaliação')
      return
    }
    setFeedbackSubmitting(true)
    try {
      const res = await fetch(`/api/encomendas/supplier-orders/${feedbackOrderId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: feedbackRating,
          comment: feedbackComment || null,
          would_recommend: feedbackRecommend,
          is_anonymous: feedbackAnonymous,
        }),
      })
      if (res.ok) {
        toast.success('Feedback submetido! Obrigado.')
        setFeedbackOrderId(null)
        setFeedbackRating(0)
        setFeedbackComment('')
        setFeedbackRecommend(true)
        setFeedbackAnonymous(false)
        fetchPickups()
      } else {
        const err = await res.json()
        toast.error(err.error || 'Erro ao submeter feedback')
      }
    } catch { toast.error('Erro ao submeter feedback') }
    finally { setFeedbackSubmitting(false) }
  }

  const handleCancel = async () => {
    if (!cancelId) return
    try {
      await performAction(cancelId, 'cancel')
      toast.success('Requisicao cancelada com sucesso')
    } catch {
      toast.error('Erro ao cancelar requisicao')
    } finally {
      setCancelId(null)
    }
  }

  const [pageTab, setPageTab] = useState<'orders' | 'requisitions'>('orders')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  // Fetch ALL supplier orders for this user (not just pickups)
  const [myOrders, setMyOrders] = useState<any[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)

  const fetchMyOrders = useCallback(async () => {
    if (!user?.id) return
    setOrdersLoading(true)
    try {
      const res = await fetch(`/api/encomendas/supplier-orders?agent_id=${user.id}`)
      const data = await res.json()
      setMyOrders(Array.isArray(data) ? data : data.data || [])
    } catch { /* */ }
    finally { setOrdersLoading(false) }
  }, [user?.id])

  useEffect(() => { fetchMyOrders() }, [fetchMyOrders])

  const fmtCurrency = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })

  const statusLabels: Record<string, { label: string; color: string }> = {
    ordered: { label: 'Encomendado', color: 'bg-blue-500/10 text-blue-600' },
    at_store: { label: 'Na Loja', color: 'bg-amber-500/10 text-amber-600' },
    picked_up: { label: 'Levantado', color: 'bg-emerald-500/10 text-emerald-600' },
    completed: { label: 'Concluído', color: 'bg-neutral-500/10 text-neutral-600' },
    cancelled: { label: 'Cancelado', color: 'bg-red-500/10 text-red-600' },
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">As Minhas Encomendas</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe as suas encomendas e dê feedback aos fornecedores
        </p>
      </div>

      {/* Tab pills */}
      <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/30 backdrop-blur-sm">
        {([['orders', 'Encomendas', Package] as const, ['requisitions', 'Requisições', ClipboardList] as const]).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setPageTab(key)}
            className={cn('inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-colors duration-300',
              pageTab === key ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          ><Icon className="h-3.5 w-3.5" />{label}</button>
        ))}
      </div>

      {/* ═══ Orders Tab (ENC-) ═══ */}
      {pageTab === 'orders' && (
        <>
          {ordersLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
          ) : myOrders.length === 0 ? (
            <EmptyState icon={Package} title="Sem encomendas" description="Quando comprar na Infinity Store, as suas encomendas aparecerão aqui." />
          ) : (
            <div className="space-y-3">
              {myOrders.map((order) => {
                const statusSteps = ['ordered', 'at_store', 'picked_up', 'completed']
                const currentStep = statusSteps.indexOf(order.status)
                const st = statusLabels[order.status] || { label: order.status, color: 'bg-muted text-muted-foreground' }
                const needsPickup = order.status === 'at_store'
                const needsFeedback = order.status === 'picked_up'
                const isExpanded = expandedOrder === order.id
                return (
                  <div key={order.id} className="rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
                    {/* Clickable header */}
                    <button
                      type="button"
                      className="w-full p-4 text-left hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                    >
                      {/* Row 1: ref + status + total */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <span className="font-bold text-sm">{order.reference}</span>
                          <Badge variant="secondary" className={cn('text-[10px] rounded-full', st.color)}>{st.label}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{fmtCurrency.format(order.total_cost || 0)}</span>
                          <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        {order.supplier && (
                          <span className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-white/10 px-2.5 py-0.5 text-[10px] font-medium">{order.supplier.name}</span>
                        )}
                        {order.items?.length > 0 && (
                          <span className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-white/10 px-2.5 py-0.5 text-[10px] text-muted-foreground">
                            {order.items.reduce((s: number, i: any) => s + (i.quantity_ordered || 0), 0)} artigos
                          </span>
                        )}
                      </div>

                      {/* Progress */}
                      <div className="flex items-center gap-0.5">
                        {statusSteps.map((_, idx) => (
                          <div key={idx} className={cn('h-1 flex-1 rounded-full', idx <= currentStep ? 'bg-emerald-500' : 'bg-neutral-200 dark:bg-white/10')} />
                        ))}
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t px-4 py-3 space-y-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">
                        {/* Items list */}
                        {order.items?.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Artigos</p>
                            {order.items.map((item: any) => (
                              <div key={item.id} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <Package className="h-3 w-3 text-muted-foreground" />
                                  <span>{item.product?.name || 'Produto'}</span>
                                  {item.variant?.name && <span className="text-xs text-muted-foreground">({item.variant.name})</span>}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span>×{item.quantity_ordered}</span>
                                  <span className="font-medium text-foreground">{fmtCurrency.format(item.subtotal || 0)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Order info */}
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {order.expected_delivery_date && <span>Entrega prevista: {new Date(order.expected_delivery_date).toLocaleDateString('pt-PT')}</span>}
                          {order.notes && <span>Notas: {order.notes}</span>}
                          <span>Criado: {new Date(order.created_at).toLocaleDateString('pt-PT')}</span>
                        </div>

                        {/* Action buttons */}
                        {(needsPickup || needsFeedback) && (
                          <div className="flex items-center gap-2 pt-1">
                            {needsPickup && (
                              <Button size="sm" className="rounded-full gap-1.5 text-xs flex-1"
                                disabled={pickingUp === order.id}
                                onClick={(e) => { e.stopPropagation(); handlePickup(order.id) }}>
                                {pickingUp === order.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PackageCheck className="h-3.5 w-3.5" />}
                                Confirmar Levantamento
                              </Button>
                            )}
                            {needsFeedback && (
                              <Button size="sm" variant="outline" className="rounded-full gap-1.5 text-xs flex-1"
                                onClick={(e) => { e.stopPropagation(); setFeedbackOrderId(order.id) }}>
                                <Star className="h-3.5 w-3.5" />Dar Feedback
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ═══ Requisitions Tab (REQ-) ═══ */}
      {pageTab === 'requisitions' && (
        <>
          <div className="flex items-center gap-4">
            <Select
              value={filters.status ?? 'all'}
              onValueChange={(v) => setFilters((prev) => ({ ...prev, status: v === 'all' ? undefined : v }))}
            >
              <SelectTrigger className="w-[200px] rounded-xl">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                {Object.entries(REQUISITION_STATUS).map(([value, config]) => (
                  <SelectItem key={value} value={value}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : requisitions.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Sem requisições"
              description={filters.status ? 'Tente ajustar o filtro' : 'Visite a Infinity Store para encomendar materiais.'} />
          ) : (
            <RequisitionsTable requisitions={requisitions} loading={false}
              onAction={(id: string, action: string) => { if (action === 'cancel') setCancelId(id) }} />
          )}
        </>
      )}

      {/* Cancel Dialog */}
      <AlertDialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar requisição</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende cancelar esta requisição? Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancelar Requisição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Feedback Dialog */}
      <Dialog open={!!feedbackOrderId} onOpenChange={(open) => { if (!open) setFeedbackOrderId(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Avaliar Encomenda</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Stars */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Avaliação *</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} type="button"
                    onMouseEnter={() => setFeedbackHover(s)}
                    onMouseLeave={() => setFeedbackHover(0)}
                    onClick={() => setFeedbackRating(s)}
                    className="p-0.5 transition-transform hover:scale-110"
                  >
                    <Star className={cn('h-7 w-7',
                      s <= (feedbackHover || feedbackRating) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/20'
                    )} />
                  </button>
                ))}
              </div>
            </div>

            {/* Recommend */}
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Recomendaria este fornecedor?</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{feedbackRecommend ? 'Sim' : 'Não'}</span>
                <Switch checked={feedbackRecommend} onCheckedChange={setFeedbackRecommend} />
              </div>
            </div>

            {/* Comment */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Comentário (opcional)</Label>
              <Textarea
                rows={3}
                className="rounded-xl resize-none text-sm"
                placeholder="Qualidade do produto, tempo de entrega, embalagem..."
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
              />
            </div>

            {/* Anonymous */}
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Submeter anonimamente</Label>
              <Switch checked={feedbackAnonymous} onCheckedChange={setFeedbackAnonymous} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setFeedbackOrderId(null)}>Cancelar</Button>
            <Button className="rounded-full gap-1.5" disabled={feedbackRating === 0 || feedbackSubmitting} onClick={handleFeedbackSubmit}>
              {feedbackSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
              Submeter Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
