'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/encomendas/status-badge'
import { SupplierOrderFormDialog } from '@/components/encomendas/supplier-order-form-dialog'
import { SupplierOrderReceiveDialog } from '@/components/encomendas/supplier-order-receive-dialog'
import { useEncomendaSupplierOrders } from '@/hooks/use-encomenda-supplier-orders'
import { useEncomendaSuppliers } from '@/hooks/use-encomenda-suppliers'
import { useEncomendaProducts } from '@/hooks/use-encomenda-products'
import { SUPPLIER_ORDER_STATUS } from '@/lib/constants'
import { formatDate, formatCurrency } from '@/lib/constants'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, ShoppingCart, MoreHorizontal, PackageCheck, Truck, XCircle } from 'lucide-react'
import type { SupplierOrder } from '@/types/encomenda'

export default function EncomendasFornecedorPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [receiveOrderData, setReceiveOrderData] = useState<SupplierOrder | null>(null)

  const { orders, loading, filters, setFilters, createOrder, updateStatus, receiveOrder } =
    useEncomendaSupplierOrders()
  const { suppliers } = useEncomendaSuppliers()
  const { products } = useEncomendaProducts()

  const handleCreate = async (data: {
    supplier_id: string
    items: { product_id: string; variant_id: string | null; quantity_ordered: number; unit_cost: number }[]
    expected_delivery_date: string | null
    notes: string | null
  }) => {
    try {
      await createOrder(data)
      toast.success('Encomenda criada com sucesso')
      setShowCreateDialog(false)
    } catch {
      toast.error('Erro ao criar encomenda')
    }
  }

  const handleStatusUpdate = async (orderId: string, status: string) => {
    try {
      await updateStatus(orderId, status)
      toast.success('Estado da encomenda actualizado')
    } catch {
      toast.error('Erro ao actualizar estado da encomenda')
    }
  }

  const handleReceive = async (items: { item_id: string; quantity_received: number }[]) => {
    if (!receiveOrderData) return
    try {
      await receiveOrder(receiveOrderData.id, items)
      toast.success('Encomenda recebida com sucesso')
      setReceiveOrderData(null)
    } catch {
      toast.error('Erro ao registar recepcao')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Encomendas a Fornecedores</h1>
          <p className="text-muted-foreground">
            Gestao de encomendas e recepcao de materiais
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Encomenda
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Select
          value={filters.status ?? 'all'}
          onValueChange={(v) => setFilters((prev) => ({ ...prev, status: v === 'all' ? undefined : v }))}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            {Object.entries(SUPPLIER_ORDER_STATUS).map(([value, config]) => (
              <SelectItem key={value} value={value}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.supplier_id ?? 'all'}
          onValueChange={(v) => setFilters((prev) => ({ ...prev, supplier_id: v === 'all' ? undefined : v }))}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Fornecedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os fornecedores</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="rounded-lg border">
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Nenhuma encomenda encontrada"
          description={
            filters.status || filters.supplier_id
              ? 'Tente ajustar os filtros aplicados'
              : 'Comece por criar a primeira encomenda a fornecedor'
          }
          action={
            !filters.status && !filters.supplier_id
              ? { label: 'Nova Encomenda', onClick: () => setShowCreateDialog(true) }
              : undefined
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referencia</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Entrega Prevista</TableHead>
                <TableHead>Entrega Real</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium font-mono text-sm">
                    {order.reference}
                  </TableCell>
                  <TableCell>{order.supplier?.name || '—'}</TableCell>
                  <TableCell>
                    <StatusBadge status={order.status} type="supplier_order" />
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(order.total_cost)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {order.expected_delivery_date
                      ? formatDate(order.expected_delivery_date)
                      : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {order.actual_delivery_date
                      ? formatDate(order.actual_delivery_date)
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {order.status === 'draft' && (
                          <DropdownMenuItem
                            onClick={() => handleStatusUpdate(order.id, 'sent')}
                          >
                            <Truck className="mr-2 h-4 w-4" />
                            Marcar como Enviada
                          </DropdownMenuItem>
                        )}
                        {(order.status === 'sent' || order.status === 'confirmed' || order.status === 'shipped' || order.status === 'partially_received') && (
                          <DropdownMenuItem
                            onClick={() => setReceiveOrderData(order)}
                          >
                            <PackageCheck className="mr-2 h-4 w-4" />
                            Registar Recepcao
                          </DropdownMenuItem>
                        )}
                        {['draft', 'sent'].includes(order.status) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleStatusUpdate(order.id, 'cancelled')}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Cancelar
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <SupplierOrderFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        suppliers={suppliers}
        products={products}
        onSubmit={handleCreate}
      />

      {receiveOrderData && (
        <SupplierOrderReceiveDialog
          open={!!receiveOrderData}
          onOpenChange={() => setReceiveOrderData(null)}
          order={receiveOrderData}
          onSubmit={handleReceive}
        />
      )}
    </div>
  )
}
