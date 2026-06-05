'use client'

import { AlertTriangle, ArrowUpDown, Edit } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { StockRecord } from '@/types/encomenda'

interface StockTableProps {
  stock: StockRecord[]
  loading: boolean
  onAdjust: (stockId: string) => void
}

export function StockTable({ stock, loading, onAdjust }: StockTableProps) {
  if (loading) {
    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Variante</TableHead>
              <TableHead>Local</TableHead>
              <TableHead className="text-center">Disponivel</TableHead>
              <TableHead className="text-center">Reservado</TableHead>
              <TableHead className="text-center">Em Encomenda</TableHead>
              <TableHead className="text-center">Total</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 8 }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (stock.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border rounded-lg">
        <p className="font-medium">Nenhum registo de stock encontrado</p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <div className="flex items-center gap-1">
                Produto
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </TableHead>
            <TableHead>Variante</TableHead>
            <TableHead>Local</TableHead>
            <TableHead className="text-center">Disponivel</TableHead>
            <TableHead className="text-center">Reservado</TableHead>
            <TableHead className="text-center">Em Encomenda</TableHead>
            <TableHead className="text-center">Total</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {stock.map((record) => {
            const total =
              record.quantity_available +
              record.quantity_reserved +
              record.quantity_on_order
            const minAlert = record.product?.min_stock_alert ?? 0
            const isLow = record.quantity_available <= minAlert && minAlert > 0

            return (
              <TableRow key={record.id} className={isLow ? 'bg-red-50/50' : ''}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {isLow && (
                      <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                    )}
                    <span className="font-medium text-sm">
                      {record.product?.name ?? '—'}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {record.variant?.name ?? '—'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {record.location}
                </TableCell>
                <TableCell className="text-center">
                  <span
                    className={
                      isLow
                        ? 'font-bold text-red-600'
                        : 'font-medium'
                    }
                  >
                    {record.quantity_available}
                  </span>
                </TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {record.quantity_reserved}
                </TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {record.quantity_on_order}
                </TableCell>
                <TableCell className="text-center font-medium">{total}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onAdjust(record.id)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
