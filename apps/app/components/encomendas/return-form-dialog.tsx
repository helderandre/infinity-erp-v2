'use client'

import { useState, useMemo } from 'react'
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
import { RETURN_CONDITION_LABELS } from '@/lib/constants'
import type { Product, ReturnCondition } from '@/types/encomenda'

interface ReturnFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: Product[]
  onSubmit: (data: {
    product_id: string
    variant_id: string | null
    agent_id: string
    quantity: number
    condition: ReturnCondition
    refund_amount: number
    reason: string | null
  }) => Promise<void> | void
}

export function ReturnFormDialog({
  open,
  onOpenChange,
  products,
  onSubmit,
}: ReturnFormDialogProps) {
  const [productId, setProductId] = useState('')
  const [variantId, setVariantId] = useState('')
  const [agentId, setAgentId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [condition, setCondition] = useState<ReturnCondition>('good')
  const [refundAmount, setRefundAmount] = useState(0)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId),
    [products, productId]
  )

  const returnableProducts = useMemo(
    () => products.filter((p) => p.is_returnable && p.is_active),
    [products]
  )

  const handleSubmit = async () => {
    if (!productId) {
      toast.error('Seleccione um produto')
      return
    }
    if (!agentId.trim()) {
      toast.error('Indique o consultor')
      return
    }
    if (quantity < 1) {
      toast.error('Quantidade minima: 1')
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({
        product_id: productId,
        variant_id: variantId || null,
        agent_id: agentId,
        quantity,
        condition,
        refund_amount: refundAmount,
        reason: reason || null,
      })
      setProductId('')
      setVariantId('')
      setAgentId('')
      setQuantity(1)
      setCondition('good')
      setRefundAmount(0)
      setReason('')
      onOpenChange(false)
      toast.success('Devolucao registada com sucesso')
    } catch {
      toast.error('Erro ao registar devolucao')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Devolucao</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Produto *</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleccionar produto" />
              </SelectTrigger>
              <SelectContent>
                {returnableProducts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProduct?.variants && selectedProduct.variants.length > 0 && (
            <div>
              <Label>Variante</Label>
              <Select value={variantId} onValueChange={setVariantId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccionar variante" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {selectedProduct.variants
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

          <div>
            <Label>Consultor (ID) *</Label>
            <Input
              placeholder="ID do consultor"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Quantidade *</Label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Condicao *</Label>
              <Select
                value={condition}
                onValueChange={(v) => setCondition(v as ReturnCondition)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.entries(RETURN_CONDITION_LABELS) as [
                      ReturnCondition,
                      string,
                    ][]
                  ).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Valor de reembolso (EUR)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={refundAmount}
              onChange={(e) => setRefundAmount(Number(e.target.value))}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Motivo</Label>
            <Textarea
              rows={3}
              placeholder="Descreva o motivo da devolucao..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'A registar...' : 'Registar Devolucao'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
