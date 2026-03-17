'use client'

import { useState, useEffect, useMemo } from 'react'
import type { MarketingCatalogItem, MarketingCatalogAddon, MarketingPack } from '@/types/marketing'
import { formatCurrency } from '@/lib/constants'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  ShoppingCart, Loader2, AlertTriangle, Gift, Package,
  Calendar, Building2, Boxes, Camera
} from 'lucide-react'
import type { CartItem, CartMaterialItem } from './shop-tab'
import { cartItemPrice } from './shop-tab'

interface OrderFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cartItems: CartItem[]
  onOrderPlaced: () => void
}

export function OrderFormDialog({ open, onOpenChange, cartItems, onOrderPlaced }: OrderFormDialogProps) {
  const [submitting, setSubmitting] = useState(false)
  const [agentBalance, setAgentBalance] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    fetch('/api/marketing/conta-corrente?summary=true')
      .then(r => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setAgentBalance(data[0]?.current_balance ?? 0)
        }
      })
      .catch(() => {})
  }, [open])

  const serviceAndPackItems = cartItems.filter(ci => ci.type !== 'material')
  const materialItems = cartItems.filter((ci): ci is CartMaterialItem => ci.type === 'material')

  const totalAmount = useMemo(() => {
    return cartItems.reduce((sum, ci) => sum + cartItemPrice(ci), 0)
  }, [cartItems])

  const materialTotal = useMemo(() => {
    return materialItems.reduce((sum, ci) => sum + cartItemPrice(ci), 0)
  }, [materialItems])

  const serviceTotal = useMemo(() => {
    return serviceAndPackItems.reduce((sum, ci) => sum + cartItemPrice(ci), 0)
  }, [serviceAndPackItems])

  const balanceAfter = agentBalance !== null ? agentBalance - totalAmount : null

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      const checkout_group_id = crypto.randomUUID()

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
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items, checkout_group_id }),
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Erro ao criar encomenda de serviços')
        }
      }

      if (materialItems.length > 0) {
        const reqItems = materialItems.map(ci => ({
          product_id: ci.product.id,
          quantity: ci.quantity,
        }))

        const res = await fetch('/api/encomendas/requisitions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: reqItems,
            delivery_type: 'pickup',
            checkout_group_id,
          }),
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Erro ao criar requisição de materiais')
        }
      }

      toast.success('Compra realizada com sucesso!')
      onOrderPlaced()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar pedido')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto rounded-2xl">
        {/* Header with dark accent */}
        <div className="-mx-6 -mt-6 mb-4 bg-neutral-900 rounded-t-2xl px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-white">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/15 backdrop-blur-sm">
                <ShoppingCart className="h-4 w-4" />
              </div>
              Confirmar Compra
            </DialogTitle>
            <DialogDescription className="text-neutral-400 mt-1">
              Reveja os itens antes de confirmar.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4">
          {/* Services & Packs */}
          {serviceAndPackItems.length > 0 && (
            <div className="rounded-xl border bg-card/50 p-4 space-y-3">
              <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5" />
                Serviços & Packs
                <span className="ml-auto text-[10px] rounded-full bg-muted px-2 py-0.5">
                  {serviceAndPackItems.length}
                </span>
              </h4>
              {serviceAndPackItems.map((ci, idx) => (
                <div key={idx}>
                  {ci.type === 'service' ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{ci.service.name}</span>
                          <div className="flex items-center gap-1">
                            {ci.service.requires_scheduling && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                                <Calendar className="h-2.5 w-2.5" />
                              </span>
                            )}
                            {ci.service.requires_property && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                                <Building2 className="h-2.5 w-2.5" />
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="font-medium">{formatCurrency(ci.service.price)}</span>
                      </div>
                      {ci.selectedAddons.map((addon) => (
                        <div key={addon.id} className="flex justify-between text-sm pl-4 mt-1.5">
                          <span className="text-muted-foreground">+ {addon.name}</span>
                          {addon.price === 0 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5 font-medium">
                              <Gift className="h-3 w-3" />Grátis
                            </span>
                          ) : (
                            <span className="font-medium">{formatCurrency(addon.price)}</span>
                          )}
                        </div>
                      ))}
                    </>
                  ) : ci.type === 'pack' ? (
                    <div className="flex justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{ci.pack.name}</span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                          <Package className="h-3 w-3" />Pack
                        </span>
                      </div>
                      <span className="font-medium">{formatCurrency(ci.pack.price)}</span>
                    </div>
                  ) : null}
                  {idx < serviceAndPackItems.length - 1 && <Separator className="my-3" />}
                </div>
              ))}
              <Separator />
              <div className="flex justify-between text-sm font-bold">
                <span>Subtotal serviços</span>
                <span>{formatCurrency(serviceTotal)}</span>
              </div>
            </div>
          )}

          {/* Materials */}
          {materialItems.length > 0 && (
            <div className="rounded-xl border bg-card/50 p-4 space-y-3">
              <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Boxes className="h-3.5 w-3.5" />
                Materiais
                <span className="ml-auto text-[10px] rounded-full bg-muted px-2 py-0.5">
                  {materialItems.length}
                </span>
              </h4>
              {materialItems.map((ci, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{ci.product.name}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                        x{ci.quantity}
                      </span>
                    </div>
                    <span className="font-medium">{formatCurrency(ci.product.sell_price * ci.quantity)}</span>
                  </div>
                  {ci.product.is_personalizable && (
                    <p className="text-[11px] text-muted-foreground pl-4 mt-1">Personalizável — detalhes após confirmação</p>
                  )}
                  {idx < materialItems.length - 1 && <Separator className="my-3" />}
                </div>
              ))}
              <Separator />
              <div className="flex justify-between text-sm font-bold">
                <span>Subtotal materiais</span>
                <span>{formatCurrency(materialTotal)}</span>
              </div>
            </div>
          )}

          {/* Grand Total */}
          <div className="rounded-xl bg-neutral-900 text-white p-4">
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span>{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          {/* Balance impact */}
          {agentBalance !== null && (
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
          )}

          <p className="text-[11px] text-muted-foreground text-center">
            Serviços ficam disponíveis para utilização imediata. Materiais serão processados como requisição interna.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 mt-2">
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button className="rounded-full px-6" onClick={handleConfirm} disabled={submitting}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="mr-2 h-4 w-4" />
            )}
            Confirmar Compra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
