'use client'

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { RequisitionsTable } from '@/components/encomendas/requisitions-table'
import { useEncomendaRequisitions } from '@/hooks/use-encomenda-requisitions'
import { REQUISITION_STATUS } from '@/lib/constants'
import { toast } from 'sonner'
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
import { ClipboardList } from 'lucide-react'

export default function MinhasRequisicoesPage() {
  const [cancelId, setCancelId] = useState<string | null>(null)

  const { requisitions, loading, filters, setFilters, performAction, refetch } =
    useEncomendaRequisitions(true)

  const handleCancel = async () => {
    if (!cancelId) return
    try {
      await performAction(cancelId, 'cancel')
      toast.success('Requisicao cancelada com sucesso')
    } catch {
      toast.error('Erro ao cancelar requisicao')
    } finally {
      setCancelId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Minhas Requisicoes</h1>
        <p className="text-muted-foreground">
          Acompanhe o estado das suas requisicoes de materiais
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Select
          value={filters.status ?? 'all'}
          onValueChange={(v) => setFilters((prev) => ({ ...prev, status: v === 'all' ? undefined : v }))}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            {Object.entries(REQUISITION_STATUS).map(([value, config]) => (
              <SelectItem key={value} value={value}>
                {config.label}
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
      ) : requisitions.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma requisicao encontrada"
          description={
            filters.status
              ? 'Tente ajustar o filtro de estado'
              : 'Ainda nao fez nenhuma requisicao. Visite o catalogo para encomendar materiais.'
          }
        />
      ) : (
        <RequisitionsTable
          requisitions={requisitions}
          loading={false}
          onAction={(id: string, action: string) => {
            if (action === 'cancel') {
              setCancelId(id)
            }
          }}
        />
      )}

      <AlertDialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar requisicao</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende cancelar esta requisicao? Esta accao e irreversivel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancelar Requisicao
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
