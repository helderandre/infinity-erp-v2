'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Plus, Minus, Trash2, Calendar, User, Building2, ChevronRight, Receipt, Package } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency, PAYMENT_METHODS } from '@/lib/constants'
import type { Product, Supplier, BillingEntity } from '@/types/encomenda'

interface RequisitionItemForOrder {
  id: string
  product_id: string
  variant_id: string | null
  quantity: number
  unit_price: number
  subtotal: number
  notes: string | null
  product?: { id: string; name: string; sku: string | null; thumbnail_url: string | null }
  variant?: { id: string; name: string } | null
}

interface RequisitionForOrder {
  id: string
  reference: string
  payment_method: string
  total_amount: number
  created_at: string
  items: RequisitionItemForOrder[]
}

interface AgentGroup {
  agent_id: string
  agent_name: string
  billing: {
    personal: { name: string; nif: string; address: string | null; email: string | null }
    empresa?: { name: string; nif: string; address: string | null; email: string | null }
  } | null
  requisitions: RequisitionForOrder[]
}

interface OrderItem {
  product: Product
  variant_id: string | null
  quantity: number
  unit_cost: number
}

interface SupplierOrderFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  suppliers: Supplier[]
  products: Product[]
  onSubmit: (data: {
    supplier_id: string
    agent_id?: string | null
    items: { product_id: string; variant_id: string | null; quantity_ordered: number; unit_cost: number }[]
    expected_delivery_date: string | null
    notes: string | null
    billing_entity?: string | null
    billing_name?: string | null
    billing_nif?: string | null
    billing_address?: string | null
    billing_email?: string | null
  }) => Promise<void> | void
}

type Step = 'select-agent' | 'select-items' | 'order-details'

export function SupplierOrderFormDialog({
  open,
  onOpenChange,
  suppliers,
  products,
  onSubmit,
}: SupplierOrderFormDialogProps) {
  const [step, setStep] = useState<Step>('select-agent')
  const [agentGroups, setAgentGroups] = useState<AgentGroup[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<AgentGroup | null>(null)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [billingEntity, setBillingEntity] = useState<BillingEntity | null>(null)

  // Order details
  const [supplierId, setSupplierId] = useState('')
  const [items, setItems] = useState<OrderItem[]>([])
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Manual mode (no agent linked)
  const [manualMode, setManualMode] = useState(false)

  const fetchAgentGroups = useCallback(async () => {
    setLoadingGroups(true)
    try {
      const res = await fetch('/api/encomendas/requisitions/items-for-order')
      if (res.ok) {
        const data = await res.json()
        setAgentGroups(data)
      }
    } catch {
      console.error('Error fetching agent groups')
    } finally {
      setLoadingGroups(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setStep('select-agent')
      setSelectedAgent(null)
      setSelectedItemIds(new Set())
      setBillingEntity(null)
      setSupplierId('')
      setItems([])
      setExpectedDate('')
      setNotes('')
      setManualMode(false)
      fetchAgentGroups()
    }
  }, [open, fetchAgentGroups])

  // When agent is selected, auto-select billing entity
  useEffect(() => {
    if (selectedAgent?.billing) {
      if (selectedAgent.billing.empresa) {
        setBillingEntity('empresa')
      } else {
        setBillingEntity('personal')
      }
    }
  }, [selectedAgent])

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.unit_cost * item.quantity, 0),
    [items]
  )

  const selectedItems = useMemo(() => {
    if (!selectedAgent) return []
    const allItems: (RequisitionItemForOrder & { requisition_ref: string })[] = []
    for (const req of selectedAgent.requisitions) {
      for (const item of req.items) {
        if (selectedItemIds.has(item.id)) {
          allItems.push({ ...item, requisition_ref: req.reference })
        }
      }
    }
    return allItems
  }, [selectedAgent, selectedItemIds])

  const toggleItem = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const toggleAllRequisitionItems = (req: RequisitionForOrder) => {
    const reqItemIds = req.items.map((i) => i.id)
    const allSelected = reqItemIds.every((id) => selectedItemIds.has(id))
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      for (const id of reqItemIds) {
        if (allSelected) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  const proceedToDetails = () => {
    if (manualMode) {
      setStep('order-details')
      return
    }

    if (selectedItems.length === 0) {
      toast.error('Seleccione pelo menos 1 item')
      return
    }

    // Pre-populate order items from selected requisition items
    const orderItems: OrderItem[] = selectedItems.map((item) => {
      const product = products.find((p) => p.id === item.product_id)
      return {
        product: product || { id: item.product_id, name: item.product?.name || '—' } as Product,
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_cost: product?.unit_cost ?? item.unit_price,
      }
    })
    setItems(orderItems)
    setStep('order-details')
  }

  const addItem = (product: Product) => {
    const existing = items.find((i) => i.product.id === product.id && !i.variant_id)
    if (existing) {
      setItems((prev) =>
        prev.map((i) => (i === existing ? { ...i, quantity: i.quantity + 1 } : i))
      )
    } else {
      setItems((prev) => [
        ...prev,
        { product, variant_id: null, quantity: 1, unit_cost: product.unit_cost ?? 0 },
      ])
    }
  }

  const updateQuantity = (index: number, delta: number) => {
    setItems((prev) =>
      prev
        .map((item, i) =>
          i === index ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
        )
        .filter((item) => item.quantity > 0)
    )
  }

  const updateCost = (index: number, cost: number) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, unit_cost: cost } : item)))
  }

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!supplierId) {
      toast.error('Seleccione um fornecedor')
      return
    }
    if (items.length === 0) {
      toast.error('Adicione pelo menos 1 item')
      return
    }

    setSubmitting(true)
    try {
      const billingInfo = selectedAgent?.billing && billingEntity
        ? selectedAgent.billing[billingEntity]
        : null

      await onSubmit({
        supplier_id: supplierId,
        agent_id: selectedAgent?.agent_id || null,
        items: items.map((item) => ({
          product_id: item.product.id,
          variant_id: item.variant_id,
          quantity_ordered: item.quantity,
          unit_cost: item.unit_cost,
        })),
        expected_delivery_date: expectedDate || null,
        notes: notes || null,
        billing_entity: billingEntity,
        billing_name: billingInfo?.name || null,
        billing_nif: billingInfo?.nif || null,
        billing_address: billingInfo?.address || null,
        billing_email: billingInfo?.email || null,
      })
      onOpenChange(false)
    } catch {
      toast.error('Erro ao criar encomenda')
    } finally {
      setSubmitting(false)
    }
  }

  const currentBilling = selectedAgent?.billing && billingEntity
    ? selectedAgent.billing[billingEntity]
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Nova Encomenda a Fornecedor
            {step !== 'select-agent' && (
              <Badge variant="outline" className="ml-2 text-xs font-normal">
                {step === 'select-items' ? 'Seleccionar Itens' : 'Detalhes da Encomenda'}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ═══ STEP 1: Select Agent ═══ */}
        {step === 'select-agent' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Seleccione o consultor para associar a encomenda, ou crie uma encomenda manual sem consultor associado.
            </p>

            {loadingGroups ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : agentGroups.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhuma requisicao aprovada pendente de encomenda.
              </div>
            ) : (
              <div className="space-y-2">
                {agentGroups.map((group) => {
                  const totalItems = group.requisitions.reduce(
                    (sum, r) => sum + r.items.length, 0
                  )
                  const hasInvoice = group.requisitions.some(
                    (r) => r.payment_method === 'invoice'
                  )

                  return (
                    <button
                      key={group.agent_id}
                      type="button"
                      onClick={() => {
                        setSelectedAgent(group)
                        setSelectedItemIds(new Set())
                        setManualMode(false)
                        setStep('select-items')
                      }}
                      className="w-full flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors text-left"
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{group.agent_name}</span>
                          {hasInvoice && (
                            <Badge variant="default" className="text-[10px]">
                              Fatura
                            </Badge>
                          )}
                          {group.billing?.empresa && (
                            <Badge variant="outline" className="text-[10px]">
                              <Building2 className="h-3 w-3 mr-1" />
                              Empresa
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {group.requisitions.length} requisicao(oes) · {totalItems} item(s)
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  )
                })}
              </div>
            )}

            <DialogFooter className="flex-row justify-between sm:justify-between">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setManualMode(true)
                  setSelectedAgent(null)
                  setStep('order-details')
                }}
              >
                Encomenda Manual
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ═══ STEP 2: Select Items from Agent's Requisitions ═══ */}
        {step === 'select-items' && selectedAgent && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{selectedAgent.agent_name}</span>
            </div>

            {/* Billing entity selector */}
            {selectedAgent.billing && (
              <div className="rounded-lg border bg-card/50 p-4 space-y-3">
                <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
                  Dados de Faturacao
                </h4>
                <div className="flex p-1 rounded-full bg-muted/30">
                  <button
                    type="button"
                    onClick={() => setBillingEntity('personal')}
                    className={`flex-1 text-sm font-medium py-2 px-4 rounded-full transition-all flex items-center justify-center gap-1.5 ${
                      billingEntity === 'personal'
                        ? 'bg-neutral-900 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <User className="h-3.5 w-3.5" />
                    Pessoal
                  </button>
                  {selectedAgent.billing.empresa && (
                    <button
                      type="button"
                      onClick={() => setBillingEntity('empresa')}
                      className={`flex-1 text-sm font-medium py-2 px-4 rounded-full transition-all flex items-center justify-center gap-1.5 ${
                        billingEntity === 'empresa'
                          ? 'bg-neutral-900 text-white shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      Empresa
                    </button>
                  )}
                </div>

                {currentBilling && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Nome:</span>{' '}
                      <span className="font-medium">{currentBilling.name || '—'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">NIF:</span>{' '}
                      <span className="font-medium">{currentBilling.nif || '—'}</span>
                    </div>
                    {currentBilling.address && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Morada:</span>{' '}
                        <span className="font-medium">{currentBilling.address}</span>
                      </div>
                    )}
                    {currentBilling.email && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Email:</span>{' '}
                        <span className="font-medium">{currentBilling.email}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Requisitions with items */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Seleccionar itens das requisicoes</Label>
              {selectedAgent.requisitions.map((req) => {
                const allSelected = req.items.every((i) => selectedItemIds.has(i.id))
                const someSelected = req.items.some((i) => selectedItemIds.has(i.id))

                return (
                  <div key={req.id} className="border rounded-lg overflow-hidden">
                    <div
                      className="flex items-center gap-3 px-3 py-2 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleAllRequisitionItems(req)}
                    >
                      <Checkbox
                        checked={allSelected}
                        className={someSelected && !allSelected ? 'opacity-50' : ''}
                      />
                      <div className="flex-1 flex items-center gap-2">
                        <span className="font-mono text-xs font-medium">{req.reference}</span>
                        <Badge variant={req.payment_method === 'invoice' ? 'default' : 'secondary'} className="text-[10px]">
                          {PAYMENT_METHODS[req.payment_method] ?? req.payment_method}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {req.items.length} item(s)
                      </span>
                    </div>

                    <div className="divide-y">
                      {req.items.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-accent/50 transition-colors cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedItemIds.has(item.id)}
                            onCheckedChange={() => toggleItem(item.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm">{item.product?.name ?? '—'}</span>
                            {item.variant && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({item.variant.name})
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {item.quantity}x
                          </span>
                          <span className="text-xs font-medium w-16 text-right">
                            {formatCurrency(item.subtotal)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <DialogFooter className="flex-row justify-between sm:justify-between">
              <Button variant="outline" onClick={() => setStep('select-agent')}>
                Voltar
              </Button>
              <Button onClick={proceedToDetails} disabled={selectedItemIds.size === 0}>
                Continuar ({selectedItemIds.size} item(s))
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ═══ STEP 3: Order Details ═══ */}
        {step === 'order-details' && (
          <div className="space-y-5">
            {/* Agent + billing summary */}
            {selectedAgent && currentBilling && (
              <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{selectedAgent.agent_name}</span>
                  <Badge variant="outline" className="text-[10px] ml-auto">
                    {billingEntity === 'empresa' ? 'Empresa' : 'Pessoal'}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {currentBilling.name} · NIF: {currentBilling.nif || '—'}
                </div>
              </div>
            )}

            {/* Supplier */}
            <div>
              <Label>Fornecedor *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccionar fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers
                    .filter((s) => s.is_active)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Add more products (manual or supplement) */}
            <div>
              <Label>Adicionar produtos</Label>
              <div className="mt-1 grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-lg p-2">
                {products
                  .filter((p) => p.is_active)
                  .map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addItem(product)}
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-accent text-left text-sm transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{product.name}</span>
                    </button>
                  ))}
              </div>
            </div>

            {/* Items */}
            {items.length > 0 && (
              <div className="space-y-3">
                <Label>Itens ({items.length})</Label>
                {items.map((item, index) => (
                  <div key={`${item.product.id}-${index}`} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{item.product.name}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(index, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(index, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-1">
                        <Label className="text-xs shrink-0">Custo un.:</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={item.unit_cost}
                          onChange={(e) => updateCost(index, Number(e.target.value))}
                          className="h-7 w-24 text-xs"
                        />
                      </div>

                      <span className="ml-auto text-sm font-semibold">
                        {formatCurrency(item.unit_cost * item.quantity)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Delivery date & notes */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Data prevista de entrega
                </Label>
                <Input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Notas</Label>
                <Textarea
                  rows={2}
                  placeholder="Observacoes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Total */}
            {items.length > 0 && (
              <div className="border-t pt-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {items.reduce((sum, i) => sum + i.quantity, 0)} item(s)
                </span>
                <div>
                  <span className="text-sm text-muted-foreground mr-2">Total:</span>
                  <span className="text-lg font-bold">{formatCurrency(total)}</span>
                </div>
              </div>
            )}

            <DialogFooter className="flex-row justify-between sm:justify-between">
              <Button
                variant="outline"
                onClick={() => setStep(manualMode ? 'select-agent' : 'select-items')}
              >
                Voltar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!supplierId || items.length === 0 || submitting}
              >
                {submitting ? 'A criar...' : 'Criar Encomenda'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
