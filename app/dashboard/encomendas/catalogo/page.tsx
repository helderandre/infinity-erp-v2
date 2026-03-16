'use client'

import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { ProductCatalogGrid } from '@/components/encomendas/product-catalog-grid'
import { RequisitionFormDialog } from '@/components/encomendas/requisition-form-dialog'
import { useEncomendaProducts } from '@/hooks/use-encomenda-products'
import { useEncomendaRequisitions } from '@/hooks/use-encomenda-requisitions'
import { toast } from 'sonner'
import { ShoppingBag } from 'lucide-react'
import type { Product } from '@/types/encomenda'

export default function CatalogoPage() {
  const [showRequisitionDialog, setShowRequisitionDialog] = useState(false)

  const { products, categories, loading } = useEncomendaProducts()
  const { createRequisition } = useEncomendaRequisitions()

  const handleOrderClick = (product: Product) => {
    // Open requisition dialog (product pre-selection handled inside the dialog)
    setShowRequisitionDialog(true)
  }

  const handleRequisitionSubmit = async (data: Record<string, unknown>) => {
    try {
      await createRequisition(data)
      toast.success('Requisicao criada com sucesso')
      setShowRequisitionDialog(false)
    } catch {
      toast.error('Erro ao criar requisicao. Tente novamente.')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Catalogo de Materiais</h1>
        <p className="text-muted-foreground">
          Consulte os materiais disponiveis e faca as suas requisicoes
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-3">
              <Skeleton className="h-40 w-full rounded-md" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Nenhum material encontrado"
          description="Ainda nao existem materiais no catalogo"
        />
      ) : (
        <ProductCatalogGrid
          products={products}
          categories={categories}
          onOrder={handleOrderClick}
        />
      )}

      <RequisitionFormDialog
        open={showRequisitionDialog}
        onOpenChange={setShowRequisitionDialog}
        products={products}
        onSubmit={handleRequisitionSubmit}
      />
    </div>
  )
}
