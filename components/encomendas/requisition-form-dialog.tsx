'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Minus, Trash2, ShoppingCart, Truck, MapPin, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createRequisitionSchema } from '@/lib/validations/encomenda'
import { formatCurrency, DELIVERY_TYPE_LABELS, REQUISITION_PRIORITY } from '@/lib/constants'
import type { Product } from '@/types/encomenda'

type FormValues = z.infer<typeof createRequisitionSchema>

interface CartItem {
  product: Product
  variant_id: string | null
  quantity: number
  personalization_data: Record<string, string> | null
}

interface RequisitionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: Product[]
  onSubmit: (data: FormValues) => Promise<void> | void
}

export function RequisitionFormDialog({
  open,
  onOpenChange,
  products,
  onSubmit,
}: RequisitionFormDialogProps) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('pickup')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [priority, setPriority] = useState<string>('normal')
  const [requestedDate, setRequestedDate] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const total = useMemo(
    () => cart.reduce((sum, item) => {
      const variantCost = item.variant_id
        ? item.product.variants?.find((v) => v.id === item.variant_id)?.additional_cost ?? 0
        : 0
      return sum + (item.product.sell_price + variantCost) * item.quantity
    }, 0),
    [cart]
  )

  const addToCart = (product: Product) => {
    const existing = cart.find(
      (i) => i.product.id === product.id && !i.variant_id
    )
    if (existing) {
      setCart((prev) =>
        prev.map((i) =>
          i === existing ? { ...i, quantity: i.quantity + 1 } : i
        )
      )
    } else {
      setCart((prev) => [
        ...prev,
        {
          product,
          variant_id: null,
          quantity: 1,
          personalization_data: product.is_personalizable ? {} : null,
        },
      ])
    }
  }

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item, i) =>
          i === index ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
        )
        .filter((item) => item.quantity > 0)
    )
  }

  const updateVariant = (index: number, variantId: string) => {
    setCart((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, variant_id: variantId || null } : item
      )
    )
  }

  const updatePersonalization = (index: number, key: string, value: string) => {
    setCart((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              personalization_data: {
                ...(item.personalization_data ?? {}),
                [key]: value,
              },
            }
          : item
      )
    )
  }

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error('Adicione pelo menos 1 item')
      return
    }

    setSubmitting(true)
    try {
      const data: FormValues = {
        property_id: propertyId || null,
        items: cart.map((item) => ({
          product_id: item.product.id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          personalization_data: item.personalization_data,
          notes: null,
        })),
        delivery_type: deliveryType,
        delivery_address: deliveryType === 'delivery' ? deliveryAddress : null,
        delivery_notes: deliveryNotes || null,
        requested_delivery_date: requestedDate || null,
        priority: priority as any,
        payment_method: 'conta_corrente' as const,
      }
      await onSubmit(data)
      setCart([])
      setDeliveryType('pickup')
      setDeliveryAddress('')
      setDeliveryNotes('')
      setPriority('normal')
      setRequestedDate('')
      setPropertyId('')
      onOpenChange(false)
      toast.success('Requisicao criada com sucesso')
    } catch {
      toast.error('Erro ao criar requisicao')
    } finally {
      setSubmitting(false)
    }
  }

  const needsPropertyLink = cart.some((i) => i.product.is_property_linked)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Nova Requisicao
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Product selector */}
          <div>
            <Label className="text-sm font-medium">Adicionar produtos</Label>
            <div className="mt-2 grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-2">
              {products
                .filter((p) => p.is_active)
                .map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addToCart(product)}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-accent text-left text-sm transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{product.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground shrink-0">
                      {formatCurrency(product.sell_price)}
                    </span>
                  </button>
                ))}
            </div>
          </div>

          {/* Cart items */}
          {cart.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Itens ({cart.length})
              </Label>

              {cart.map((item, index) => {
                const variantCost = item.variant_id
                  ? item.product.variants?.find((v) => v.id === item.variant_id)?.additional_cost ?? 0
                  : 0
                const unitPrice = item.product.sell_price + variantCost
                const subtotal = unitPrice * item.quantity

                return (
                  <div
                    key={`${item.product.id}-${index}`}
                    className="border rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-sm">{item.product.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {formatCurrency(unitPrice)} / un.
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(index, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-medium w-8 text-center">
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
                        <span className="text-sm font-semibold w-20 text-right">
                          {formatCurrency(subtotal)}
                        </span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => removeFromCart(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Variant selector */}
                    {item.product.variants && item.product.variants.length > 0 && (
                      <div>
                        <Label className="text-xs">Variante</Label>
                        <Select
                          value={item.variant_id ?? ''}
                          onValueChange={(v) => updateVariant(index, v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Seleccionar variante" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Base</SelectItem>
                            {item.product.variants
                              .filter((v) => v.is_active)
                              .map((v) => (
                                <SelectItem key={v.id} value={v.id}>
                                  {v.name}
                                  {v.additional_cost > 0 && ` (+${formatCurrency(v.additional_cost)})`}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Personalization fields */}
                    {item.product.is_personalizable &&
                      item.product.personalization_fields?.map((pf) => (
                        <div key={pf.key}>
                          <Label className="text-xs">
                            {pf.label} {pf.required && '*'}
                          </Label>
                          {pf.type === 'textarea' ? (
                            <Textarea
                              rows={2}
                              placeholder={pf.placeholder}
                              value={item.personalization_data?.[pf.key] ?? ''}
                              onChange={(e) =>
                                updatePersonalization(index, pf.key, e.target.value)
                              }
                              className="text-xs"
                            />
                          ) : pf.type === 'select' ? (
                            <Select
                              value={item.personalization_data?.[pf.key] ?? ''}
                              onValueChange={(v) => updatePersonalization(index, pf.key, v)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder={pf.placeholder ?? 'Seleccionar'} />
                              </SelectTrigger>
                              <SelectContent>
                                {pf.options?.map((opt) => (
                                  <SelectItem key={opt} value={opt}>
                                    {opt}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              placeholder={pf.placeholder}
                              value={item.personalization_data?.[pf.key] ?? ''}
                              onChange={(e) =>
                                updatePersonalization(index, pf.key, e.target.value)
                              }
                              className="h-8 text-xs"
                            />
                          )}
                        </div>
                      ))}
                  </div>
                )
              })}
            </div>
          )}

          {/* Property link */}
          {needsPropertyLink && (
            <div>
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Imovel associado
              </Label>
              <Input
                placeholder="ID ou referencia do imovel"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="mt-1"
              />
            </div>
          )}

          {/* Delivery */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5" />
                Tipo de entrega
              </Label>
              <div className="flex gap-2 mt-1">
                {(Object.entries(DELIVERY_TYPE_LABELS) as [string, string][]).map(
                  ([key, label]) => (
                    <Button
                      key={key}
                      type="button"
                      size="sm"
                      variant={deliveryType === key ? 'default' : 'outline'}
                      onClick={() => setDeliveryType(key as 'pickup' | 'delivery')}
                    >
                      {label}
                    </Button>
                  )
                )}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REQUISITION_PRIORITY).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      {val.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {deliveryType === 'delivery' && (
              <div className="col-span-2">
                <Label className="text-sm">Morada de entrega</Label>
                <Input
                  placeholder="Morada completa"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Data pretendida
              </Label>
              <Input
                type="date"
                value={requestedDate}
                onChange={(e) => setRequestedDate(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm">Notas de entrega</Label>
              <Textarea
                rows={2}
                placeholder="Instrucoes especiais..."
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Summary */}
          {cart.length > 0 && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {cart.reduce((sum, i) => sum + i.quantity, 0)} item(s)
                </span>
                <div className="text-right">
                  <span className="text-sm text-muted-foreground mr-2">Total:</span>
                  <span className="text-lg font-bold">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={cart.length === 0 || submitting}
          >
            {submitting ? 'A submeter...' : 'Submeter Requisicao'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
