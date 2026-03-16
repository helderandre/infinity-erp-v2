'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { Badge } from '@/components/ui/badge'
import { ProductFormDialog } from '@/components/encomendas/product-form-dialog'
import { useEncomendaProducts } from '@/hooks/use-encomenda-products'
import { useEncomendaSuppliers } from '@/hooks/use-encomenda-suppliers'
import { formatCurrency } from '@/lib/constants'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Package, MoreHorizontal, Pencil, Ban } from 'lucide-react'
import type { Product } from '@/types/encomenda'

export default function ProdutosPage() {
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [deactivateId, setDeactivateId] = useState<string | null>(null)

  const { products, categories, loading, createProduct, updateProduct, deleteProduct } =
    useEncomendaProducts()
  const { suppliers } = useEncomendaSuppliers()

  const handleFormSubmit = async (data: Partial<Product>) => {
    try {
      if (editProduct) {
        await updateProduct(editProduct.id, data)
        toast.success('Produto actualizado com sucesso')
      } else {
        await createProduct(data)
        toast.success('Produto criado com sucesso')
      }
      setShowFormDialog(false)
      setEditProduct(null)
    } catch {
      toast.error(editProduct ? 'Erro ao actualizar produto' : 'Erro ao criar produto')
    }
  }

  const handleDeactivate = async () => {
    if (!deactivateId) return
    try {
      await deleteProduct(deactivateId)
      toast.success('Produto desactivado com sucesso')
    } catch {
      toast.error('Erro ao desactivar produto')
    } finally {
      setDeactivateId(null)
    }
  }

  const handleEdit = (product: Product) => {
    setEditProduct(product)
    setShowFormDialog(true)
  }

  const handleNewClick = () => {
    setEditProduct(null)
    setShowFormDialog(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestao de Produtos</h1>
          <p className="text-muted-foreground">
            Gerir catalogo de produtos e materiais disponiveis
          </p>
        </div>
        <Button onClick={handleNewClick}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Produto
        </Button>
      </div>

      {loading ? (
        <div className="rounded-lg border">
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum produto encontrado"
          description="Comece por adicionar o primeiro produto ao catalogo"
          action={{ label: 'Novo Produto', onClick: handleNewClick }}
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Preco</TableHead>
                <TableHead>Personalizavel</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const categoryName = categories.find((c) => c.id === product.category_id)?.name ?? '—'
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {product.sku || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {categoryName}
                    </TableCell>
                    <TableCell className="text-right">
                      {product.sell_price != null ? formatCurrency(product.sell_price) : '—'}
                    </TableCell>
                    <TableCell>
                      {product.is_personalizable ? (
                        <Badge variant="outline">Sim</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Nao</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.is_active ? 'default' : 'secondary'}>
                        {product.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(product)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          {product.is_active && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeactivateId(product.id)}
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              Desactivar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ProductFormDialog
        open={showFormDialog}
        onOpenChange={(open: boolean) => {
          setShowFormDialog(open)
          if (!open) setEditProduct(null)
        }}
        categories={categories}
        product={editProduct}
        suppliers={suppliers}
        onSubmit={handleFormSubmit}
      />

      <AlertDialog open={!!deactivateId} onOpenChange={() => setDeactivateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desactivar produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende desactivar este produto? Deixara de aparecer no catalogo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
