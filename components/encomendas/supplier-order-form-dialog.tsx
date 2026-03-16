'use client'

import { useState, useMemo } from 'react'
import { Plus, Minus, Trash2, Calendar } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/constants'
import type { Product, Supplier } from '@/types/encomenda'

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
    items: { product_id: string; variant_id: string | null; quantity_ordered: number; unit_cost: number }[]
    expected_delivery_date: string | null
    notes: string | null
  }) => Promise<void> | void
}

export function SupplierOrderFormDialog({
  open,
  onOpenChange,
  suppliers,
  products,
  onSubmit,
}: SupplierOrderFormDialogProps) {
  const [supplierId, setSupplierId] = useState('')
  const [items, setItems] = useState<OrderItem[]>([])
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.unit_cost * item.quantity, 0),
    [items]
  )

  const addItem = (product: Product) => {
    const existing = items.find(
      (i) => i.product.id === product.id && !i.variant_id
    )
    if (existing) {
      setItems((prev) =>
        prev.map((i) =>
          i === existing ? { ...i, quantity: i.quantity + 1 } : i
        )
      )
    } else {
      setItems((prev) => [
        ...prev,
        {
          product,
          variant_id: null,
          quantity: 1,
          unit_cost: product.unit_cost ?? 0,
        },
      ])
    }
  }

  const updateQuantity = (index: number, delta: number) => {
    setItems((prev) =>
      prev
        .map((item, i) =>
          i === index
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    )
  }

  const updateCost = (index: number, cost: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, unit_cost: cost } : item))
    )
  }

  const updateVariant = (index: number, variantId: string) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, variant_id: variantId || null } : item
      )
    )
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
      await onSubmit({
        supplier_id: supplierId,
        items: items.map((item) => ({
          product_id: item.product.id,
          variant_id: item.variant_id,
          quantity_ordered: item.quantity,
          unit_cost: item.unit_cost,
        })),
        expected_delivery_date: expectedDate || null,
        notes: notes || null,
      })
      setSupplierId('')
      setItems([])
      setExpectedDate('')
      setNotes('')
      onOpenChange(false)
      toast.success('Encomenda a fornecedor criada')
    } catch {
      toast.error('Erro ao criar encomenda')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Encomenda a Fornecedor</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
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

          {/* Add products */}
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
                <div
                  key={`${item.product.id}-${index}`}
                  className="border rounded-lg p-3 space-y-2"
                >
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

                  {/* Variant */}
                  {item.product.variants && item.product.variants.length > 0 && (
                    <div>
                      <Label className="text-xs">Variante</Label>
                      <Select
                        value={item.variant_id ?? ''}
                        onValueChange={(v) => updateVariant(index, v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Base" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Base</SelectItem>
                          {item.product.variants
                            .filter((v) => v.is_active)
                            .map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!supplierId || items.length === 0 || submitting}
          >
            {submitting ? 'A criar...' : 'Criar Encomenda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
