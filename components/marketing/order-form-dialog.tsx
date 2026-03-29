'use client'

import { useState, useEffect, useMemo } from 'react'
import { useUser } from '@/hooks/use-user'
import type { CartPropertyBundle, CartCampaignItem } from '@/types/marketing'
import { formatCurrency } from '@/lib/constants'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  ShoppingCart, Loader2, AlertTriangle, Gift, Package,
  Calendar, Building2, Boxes, Camera, Megaphone, FileText, Trash2, ArrowRight, ArrowLeft, CreditCard
} from 'lucide-react'
import type { CartItem, CartMaterialItem } from './shop-tab'
import { cartItemPrice, cartItemName } from './shop-tab'

interface OrderFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cartItems: CartItem[]
  onRemoveItem: (index: number) => void
  onOrderPlaced: () => void
}

export function OrderFormDialog({ open, onOpenChange, cartItems, onRemoveItem, onOrderPlaced }: OrderFormDialogProps) {
  const { user } = useUser()
  const [step, setStep] = useState<1 | 2>(1)
  const [submitting, setSubmitting] = useState(false)
  const [agentBalance, setAgentBalance] = useState<number | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'conta_corrente' | 'invoice'>('conta_corrente')

  // Reset step when dialog opens
  useEffect(() => {
    if (open) { setStep(1); setPaymentMethod('conta_corrente') }
  }, [open])

  // Fetch current user's balance
  useEffect(() => {
    if (!open || step !== 2 || !user?.id) return
    fetch(`/api/marketing/conta-corrente?agent_id=${user.id}&limit=1`)
      .then(r => r.json())
      .then((result) => {
        const txs = result?.data || (Array.isArray(result) ? result : [])
        if (txs.length > 0) {
          setAgentBalance(txs[0]?.balance_after ?? 0)
        } else {
          setAgentBalance(0)
        }
      })
      .catch(() => setAgentBalance(0))
  }, [open, step, user?.id])

  const totalAmount = useMemo(() => {
    return cartItems.reduce((sum, ci) => sum + cartItemPrice(ci), 0)
  }, [cartItems])

  const balanceAfter = agentBalance !== null ? agentBalance - totalAmount : null

  // Close if cart becomes empty after removing items
  useEffect(() => {
    if (open && cartItems.length === 0) onOpenChange(false)
  }, [cartItems.length, open, onOpenChange])

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      const checkout_group_id = crypto.randomUUID()
      const propertyBundles = cartItems.filter((ci): ci is CartPropertyBundle => ci.type === 'property_bundle')
      const serviceAndPackItems = cartItems.filter(ci => ci.type === 'service' || ci.type === 'pack')
      const materialItems = cartItems.filter((ci): ci is CartMaterialItem => ci.type === 'material')
      const campaignItems = cartItems.filter((ci): ci is CartCampaignItem => ci.type === 'campaign')

      for (const bundle of propertyBundles) {
        const items: Array<{ catalog_item_id?: string; name: string; price: number }> = []
        for (const svc of bundle.services) {
          items.push({ catalog_item_id: svc.service.id, name: svc.service.name, price: svc.service.price })
          for (const addon of svc.selectedAddons) {
            items.push({ catalog_item_id: svc.service.id, name: `${addon.name} (${svc.service.name})`, price: addon.price })
          }
        }
        const res = await fetch('/api/marketing/orders', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items,
            checkout_group_id,
            payment_method: paymentMethod,
            property_id: bundle.propertyId,
            property_bundle_data: { ...bundle.propertyInfo, availability: bundle.availability },
            proposed_dates: bundle.availability?.preferred_dates || [],
          }),
        })
        if (!res.ok) throw new Error((await res.json()).error || 'Erro ao criar encomenda')
      }

      if (serviceAndPackItems.length > 0) {
        const items: Array<{ catalog_item_id?: string; pack_id?: string; name: string; price: number }> = []
        for (const ci of serviceAndPackItems) {
          if (ci.type === 'service') {
            items.push({ catalog_item_id: ci.service.id, name: ci.service.name, price: ci.service.price })
            for (const addon of ci.selectedAddons) {
              items.push({ catalog_item_id: ci.service.id, name: `${addon.name} (${ci.service.name})`, price: addon.price })
            }
          } else if (ci.type === 'pack') {
            items.push({ pack_id: ci.pack.id, name: ci.pack.name, price: ci.pack.price })
          }
        }
        const res = await fetch('/api/marketing/orders', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items, checkout_group_id, payment_method: paymentMethod }),
        })
        if (!res.ok) throw new Error((await res.json()).error || 'Erro ao criar encomenda')
      }

      if (materialItems.length > 0) {
        const res = await fetch('/api/encomendas/requisitions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: materialItems.map(ci => ({ product_id: ci.product.id, quantity: ci.quantity })),
            delivery_type: 'pickup', checkout_group_id, payment_method: paymentMethod,
          }),
        })
        if (!res.ok) throw new Error((await res.json()).error || 'Erro ao criar requisição')
      }

      for (const ci of campaignItems) {
        const res = await fetch('/api/marketing/campaigns', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...ci.campaignData, total_cost: ci.totalCost, checkout_group_id, payment_method: paymentMethod }),
        })
        if (!res.ok) throw new Error((await res.json()).error || 'Erro ao criar campanha')
      }

      toast.success('Compra realizada com sucesso!')
      onOrderPlaced()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar pedido')
    } finally {
      setSubmitting(false)
    }
  }

  const getItemIcon = (item: CartItem) => {
    if (item.type === 'property_bundle') return Building2
    if (item.type === 'campaign') return Megaphone
    if (item.type === 'material') return Package
    return Camera
  }

  const getItemLabel = (item: CartItem) => {
    if (item.type === 'property_bundle') return 'Imóvel'
    if (item.type === 'campaign') return 'Campanha'
    if (item.type === 'material') return 'Material'
    if (item.type === 'pack') return 'Pack'
    return 'Serviço'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[480px] h-[85vh] sm:h-[80vh] rounded-2xl p-0 flex flex-col overflow-hidden">
        {/* Dark header */}
        <div className="bg-neutral-900 px-5 py-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-white">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/15 backdrop-blur-sm">
                {step === 1 ? <ShoppingCart className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
              </div>
              {step === 1 ? 'Carrinho' : 'Pagamento'}
            </DialogTitle>
            <DialogDescription className="text-neutral-400 mt-1">
              {step === 1 ? `${cartItems.length} ${cartItems.length === 1 ? 'item' : 'itens'} no carrinho` : 'Seleccione o método de pagamento'}
            </DialogDescription>
          </DialogHeader>
          {/* Step dots */}
          <div className="flex items-center justify-center gap-2.5 mt-3">
            {[1, 2].map((s) => (
              <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${s === step ? 'w-6 bg-white' : s < step ? 'w-1.5 bg-white/60' : 'w-1.5 bg-white/25'}`} />
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* ═══ STEP 1: Cart review with delete ═══ */}
          {step === 1 && (
            <div className="space-y-2">
              {cartItems.map((item, idx) => {
                const Icon = getItemIcon(item)
                const label = getItemLabel(item)
                const price = cartItemPrice(item)
                const name = cartItemName(item)

                return (
                  <div key={idx} className="flex items-center gap-3 rounded-xl border bg-card p-3 group hover:shadow-sm transition-all">
                    <div className="flex items-center justify-center h-9 w-9 rounded-full bg-muted/60 shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">{label}</span>
                        {item.type === 'material' && (
                          <span className="text-[10px] text-muted-foreground">x{item.quantity}</span>
                        )}
                        {item.type === 'property_bundle' && (
                          <span className="text-[10px] text-muted-foreground leading-snug">
                            {item.services.map(s => {
                              const addonNames = s.selectedAddons.filter(a => a.price > 0).map(a => a.name)
                              return addonNames.length > 0
                                ? `${s.service.name} + ${addonNames.join(' + ')}`
                                : s.service.name
                            }).join(', ')}
                          </span>
                        )}
                        {item.type === 'service' && item.selectedAddons.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            + {item.selectedAddons.map(a => a.name).join(', ')}
                          </span>
                        )}
                        {item.type === 'campaign' && (
                          <span className="text-[10px] text-muted-foreground">
                            {item.campaignData.duration_days}d · {formatCurrency(item.campaignData.budget_amount)}/{item.campaignData.budget_type === 'daily' ? 'dia' : 'total'}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-bold shrink-0">{formatCurrency(price)}</span>
                    <button
                      onClick={() => onRemoveItem(idx)}
                      className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}

              {/* Total */}
              <div className="rounded-xl bg-neutral-900 text-white p-4 mt-3">
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ═══ STEP 2: Payment method ═══ */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Payment toggle */}
              <div className="rounded-xl border bg-card/50 p-4 space-y-3">
                <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Método de Pagamento</h4>
                <div className="flex p-1 rounded-full bg-muted/30">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('conta_corrente')}
                    className={`flex-1 text-sm font-medium py-2 px-4 rounded-full transition-all ${
                      paymentMethod === 'conta_corrente'
                        ? 'bg-neutral-900 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Conta Corrente
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('invoice')}
                    className={`flex-1 text-sm font-medium py-2 px-4 rounded-full transition-all ${
                      paymentMethod === 'invoice'
                        ? 'bg-neutral-900 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Fatura
                  </button>
                </div>
              </div>

              {/* Balance or invoice info */}
              {paymentMethod === 'conta_corrente' ? (
                agentBalance !== null && (
                  <div className="rounded-xl border bg-card/50 p-4 space-y-2.5">
                    <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Conta Corrente</h4>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Saldo actual</span>
                      <span className={agentBalance < 0 ? 'text-red-600 font-medium' : 'font-medium'}>
                        {formatCurrency(agentBalance)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Débito desta compra</span>
                      <span className="text-red-600 font-medium">-{formatCurrency(totalAmount)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm font-bold">
                      <span>Saldo após compra</span>
                      <span className={balanceAfter !== null && balanceAfter < 0 ? 'text-red-600' : 'text-emerald-600'}>
                        {balanceAfter !== null ? formatCurrency(balanceAfter) : '—'}
                      </span>
                    </div>
                    {balanceAfter !== null && balanceAfter < 0 && (
                      <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-xl p-2.5 mt-1">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        O saldo ficará negativo. Este valor será deduzido nas próximas comissões.
                      </div>
                    )}
                  </div>
                )
              ) : (
                <div className="rounded-xl border bg-card/50 p-4">
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4 shrink-0" />
                    O prestador de serviços emitirá uma fatura para pagamento.
                  </div>
                </div>
              )}

              {/* Total reminder */}
              <div className="rounded-xl bg-neutral-900 text-white p-4">
                <div className="flex justify-between text-base font-bold">
                  <span>Total a pagar</span>
                  <span>{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer — always visible */}
        <div className="border-t px-5 py-3 flex items-center justify-between gap-3 shrink-0 bg-background">
          {step === 1 ? (
            <>
              <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button className="rounded-full px-6" onClick={() => setStep(2)} disabled={cartItems.length === 0}>
                Pagamento
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="rounded-full" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <Button className="rounded-full px-6" onClick={handleConfirm} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShoppingCart className="mr-2 h-4 w-4" />
                )}
                Confirmar Compra
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
