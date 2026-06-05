'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { SupplierOrder } from '@/types/encomenda'

interface SupplierOrderReceiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: SupplierOrder
  onSubmit: (
    items: { item_id: string; quantity_received: number }[]
  ) => Promise<void> | void
}

export function SupplierOrderReceiveDialog({
  open,
  onOpenChange,
  order,
  onSubmit,
}: SupplierOrderReceiveDialogProps) {
  const [received, setReceived] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    order.items?.forEach((item) => {
      map[item.id] = item.quantity_ordered - item.quantity_received
    })
    return map
  })
  const [submitting, setSubmitting] = useState(false)

  const updateReceived = (itemId: string, value: number, maxRemaining: number) => {
    setReceived((prev) => ({
      ...prev,
      [itemId]: Math.max(0, Math.min(value, maxRemaining)),
    }))
  }

  const handleSubmit = async () => {
    const data = Object.entries(received)
      .filter(([, qty]) => qty > 0)
      .map(([item_id, quantity_received]) => ({ item_id, quantity_received }))

    if (data.length === 0) {
      toast.error('Indique pelo menos 1 item recebido')
      return
    }

    setSubmitting(true)
    try {
      await onSubmit(data)
      onOpenChange(false)
      toast.success('Recepcao registada com sucesso')
    } catch {
      toast.error('Erro ao registar recepcao')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="h-5 w-5" />
            Recepcao de Encomenda — {order.reference}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Indique a quantidade recebida para cada item. A quantidade nao pode
            exceder o que falta receber.
          </p>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Variante</TableHead>
                  <TableHead className="text-center">Encomendado</TableHead>
                  <TableHead className="text-center">Ja Recebido</TableHead>
                  <TableHead className="text-center">Por Receber</TableHead>
                  <TableHead className="text-center">Receber Agora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items?.map((item) => {
                  const remaining =
                    item.quantity_ordered - item.quantity_received
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-sm">
                        {item.product?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.variant?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.quantity_ordered}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {item.quantity_received}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {remaining}
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min={0}
                          max={remaining}
                          value={received[item.id] ?? 0}
                          onChange={(e) =>
                            updateReceived(
                              item.id,
                              Number(e.target.value),
                              remaining
                            )
                          }
                          className="h-8 w-20 mx-auto text-center"
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'A registar...' : 'Confirmar Recepcao'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
