'use client'

import { useState, useEffect, useMemo } from 'react'
import type { MarketingCatalogItem, MarketingCatalogAddon, MarketingPack } from '@/types/marketing'
import { formatCurrency } from '@/lib/constants'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  ShoppingCart, Loader2, AlertTriangle, Gift, Package,
  Calendar, Building2, Clock
} from 'lucide-react'

// Cart item types (shared with shop-tab)
interface CartServiceItem {
  type: 'service'
  service: MarketingCatalogItem
  selectedAddons: MarketingCatalogAddon[]
}

interface CartPackItem {
  type: 'pack'
  pack: MarketingPack
}

type CartItem = CartServiceItem | CartPackItem

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

  const totalAmount = useMemo(() => {
    return cartItems.reduce((sum, ci) => {
      if (ci.type === 'service') {
        return sum + ci.service.price + ci.selectedAddons.reduce((s, a) => s + a.price, 0)
      }
      return sum + ci.pack.price
    }, 0)
  }, [cartItems])

  const balanceAfter = agentBalance !== null ? agentBalance - totalAmount : null

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      const items: Array<{ catalog_item_id?: string; pack_id?: string; name: string; price: number }> = []

      for (const ci of cartItems) {
        if (ci.type === 'service') {
          items.push({ catalog_item_id: ci.service.id, name: ci.service.name, price: ci.service.price })
          for (const addon of ci.selectedAddons) {
            items.push({ catalog_item_id: ci.service.id, name: `${addon.name} (${ci.service.name})`, price: addon.price })
          }
        } else {
          items.push({ pack_id: ci.pack.id, name: ci.pack.name, price: ci.pack.price })
        }
      }

      const res = await fetch('/api/marketing/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao criar encomenda')
      }

      toast.success('Compra realizada com sucesso! Os itens estão disponíveis nos seus produtos.')
      onOrderPlaced()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar pedido')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Confirmar Compra
          </DialogTitle>
          <DialogDescription>
            Reveja os itens antes de confirmar. Após a compra, os produtos ficam disponíveis para utilizar quando quiser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Items list */}
          <div className="rounded-lg border p-4 space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
              {cartItems.length} {cartItems.length === 1 ? 'item' : 'itens'}
            </h4>
            {cartItems.map((ci, idx) => (
              <div key={idx}>
                {ci.type === 'service' ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{ci.service.name}</span>
                        <div className="flex items-center gap-1">
                          {ci.service.requires_scheduling && (
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                          )}
                          {ci.service.requires_property && (
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      <span className="font-medium">{formatCurrency(ci.service.price)}</span>
                    </div>
                    {ci.selectedAddons.map((addon) => (
                      <div key={addon.id} className="flex justify-between text-sm pl-4 mt-1">
                        <span className="text-muted-foreground">+ {addon.name}</span>
                        {addon.price === 0 ? (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Gift className="h-3 w-3" />Incluído
                          </Badge>
                        ) : (
                          <span className="font-medium">{formatCurrency(addon.price)}</span>
                        )}
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{ci.pack.name}</span>
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Package className="h-3 w-3" />Pack
                      </Badge>
                    </div>
                    <span className="font-medium">{formatCurrency(ci.pack.price)}</span>
                  </div>
                )}
                {idx < cartItems.length - 1 && <Separator className="my-3" />}
              </div>
            ))}
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span>{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          {/* Balance impact */}
          {agentBalance !== null && (
            <div className="rounded-lg border p-4 space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Conta Corrente</h4>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Saldo actual</span>
                <span className={agentBalance < 0 ? 'text-red-600 font-medium' : ''}>
                  {formatCurrency(agentBalance)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Débito desta compra</span>
                <span className="text-red-600">-{formatCurrency(totalAmount)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm font-bold">
                <span>Saldo após compra</span>
                <span className={balanceAfter !== null && balanceAfter < 0 ? 'text-red-600' : 'text-emerald-600'}>
                  {balanceAfter !== null ? formatCurrency(balanceAfter) : '—'}
                </span>
              </div>
              {balanceAfter !== null && balanceAfter < 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-md p-2 mt-1">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  O saldo ficará negativo. Este valor será deduzido nas próximas comissões.
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Após a compra, os produtos ficam disponíveis para utilizar. Serviços que requerem imóvel ou agendamento serão configurados no momento da utilização.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
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
