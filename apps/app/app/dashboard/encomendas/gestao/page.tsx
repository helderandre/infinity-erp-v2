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
import { Settings2 } from 'lucide-react'

export default function GestaoRequisicoesPage() {
  const [cancelId, setCancelId] = useState<string | null>(null)

  const { requisitions, loading, filters, setFilters, performAction } =
    useEncomendaRequisitions(false)

  const handleAction = async (id: string, action: string) => {
    if (action === 'cancel') {
      setCancelId(id)
      return
    }
    try {
      await performAction(id, action)
      toast.success('Requisicao actualizada com sucesso')
    } catch {
      toast.error('Erro ao actualizar requisicao')
    }
  }

  const handleCancel = async () => {
    if (!cancelId) return
    try {
      await performAction(cancelId, 'cancel')
      toast.success('Requisicao cancelada')
    } catch {
      toast.error('Erro ao cancelar requisicao')
    } finally {
      setCancelId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestao de Requisicoes</h1>
        <p className="text-muted-foreground">
          Gerir e processar todas as requisicoes de materiais
        </p>
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
            {Object.entries(REQUISITION_STATUS).map(([value, config]) => (
              <SelectItem key={value} value={value}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.priority ?? 'all'}
          onValueChange={(v) => setFilters((prev) => ({ ...prev, priority: v === 'all' ? undefined : v }))}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as prioridades</SelectItem>
            <SelectItem value="low">Baixa</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="urgent">Urgente</SelectItem>
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
          icon={Settings2}
          title="Nenhuma requisicao encontrada"
          description={
            filters.status || filters.priority
              ? 'Tente ajustar os filtros aplicados'
              : 'Ainda nao existem requisicoes para gerir'
          }
        />
      ) : (
        <RequisitionsTable
          requisitions={requisitions}
          loading={false}
          onAction={handleAction}
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
