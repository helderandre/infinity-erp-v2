'use client'

import { useState } from 'react'
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
import type { StockRecord } from '@/types/encomenda'

interface StockAdjustDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stockRecord: StockRecord | null
  onSubmit: (quantity: number, reason: string) => Promise<void> | void
}

export function StockAdjustDialog({
  open,
  onOpenChange,
  stockRecord,
  onSubmit,
}: StockAdjustDialogProps) {
  const [quantity, setQuantity] = useState(0)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (quantity === 0) {
      toast.error('Quantidade nao pode ser zero')
      return
    }
    if (!reason.trim()) {
      toast.error('Motivo obrigatorio')
      return
    }

    setSubmitting(true)
    try {
      await onSubmit(quantity, reason)
      setQuantity(0)
      setReason('')
      onOpenChange(false)
      toast.success('Stock ajustado com sucesso')
    } catch {
      toast.error('Erro ao ajustar stock')
    } finally {
      setSubmitting(false)
    }
  }

  if (!stockRecord) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar Stock</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current info */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Produto:</span>
              <span className="font-medium">
                {stockRecord.product?.name ?? '—'}
              </span>
            </div>
            {stockRecord.variant && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Variante:</span>
                <span>{stockRecord.variant.name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Local:</span>
              <span>{stockRecord.location}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Disponivel actual:</span>
              <span className="font-bold">{stockRecord.quantity_available}</span>
            </div>
          </div>

          {/* Adjustment */}
          <div>
            <Label>
              Ajuste (positivo = adicionar, negativo = remover)
            </Label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="mt-1"
              placeholder="Ex: 10 ou -5"
            />
            {quantity !== 0 && (
              <p className="text-xs mt-1 text-muted-foreground">
                Novo stock disponivel:{' '}
                <span className="font-bold">
                  {stockRecord.quantity_available + quantity}
                </span>
              </p>
            )}
          </div>

          {/* Reason */}
          <div>
            <Label>Motivo *</Label>
            <Textarea
              rows={3}
              placeholder="Descreva o motivo do ajuste..."
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
            {submitting ? 'A guardar...' : 'Confirmar Ajuste'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
