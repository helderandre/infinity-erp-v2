'use client'

import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { StockTable } from '@/components/encomendas/stock-table'
import { StockAdjustDialog } from '@/components/encomendas/stock-adjust-dialog'
import { useEncomendaStock } from '@/hooks/use-encomenda-stock'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Package, History } from 'lucide-react'
import { formatDate, STOCK_MOVEMENT_LABELS } from '@/lib/constants'
import type { StockMovementType } from '@/types/encomenda'

export function StockShopTab() {
  const [adjustStockId, setAdjustStockId] = useState<string | null>(null)
  const [showMovements, setShowMovements] = useState(false)

  const { stock, movements, loading, alertsOnly, setAlertsOnly, adjustStock, fetchMovements } =
    useEncomendaStock()

  const adjustRecord = adjustStockId ? stock.find((s) => s.id === adjustStockId) ?? null : null

  const handleAdjust = async (quantity: number, reason: string) => {
    if (!adjustStockId) return
    try {
      await adjustStock(adjustStockId, quantity, reason)
      toast.success('Stock ajustado com sucesso')
      setAdjustStockId(null)
    } catch {
      toast.error('Erro ao ajustar stock')
    }
  }

  const handleViewMovements = async (stockId: string) => {
    setShowMovements(true)
    await fetchMovements(stockId)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Switch
          id="alerts-only-shop"
          checked={alertsOnly}
          onCheckedChange={setAlertsOnly}
        />
        <Label htmlFor="alerts-only-shop" className="text-sm">
          Apenas alertas (stock abaixo do mínimo)
        </Label>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : stock.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum registo de stock"
          description={
            alertsOnly
              ? 'Não existem produtos com stock abaixo do mínimo.'
              : 'Ainda não existem registos de stock.'
          }
        />
      ) : (
        <StockTable
          stock={stock}
          loading={false}
          onAdjust={(stockId: string) => setAdjustStockId(stockId)}
        />
      )}

      <StockAdjustDialog
        open={!!adjustStockId}
        onOpenChange={() => setAdjustStockId(null)}
        stockRecord={adjustRecord}
        onSubmit={handleAdjust}
      />

      <Dialog open={showMovements} onOpenChange={setShowMovements}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Movimentos de Stock
            </DialogTitle>
          </DialogHeader>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Sem movimentos registados para este produto.
            </p>
          ) : (
            <div className="max-h-[400px] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((mov) => (
                    <TableRow key={mov.id}>
                      <TableCell className="text-muted-foreground">
                        {formatDate(mov.created_at)}
                      </TableCell>
                      <TableCell>
                        {STOCK_MOVEMENT_LABELS[mov.movement_type as StockMovementType] ?? mov.movement_type}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {mov.notes || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
