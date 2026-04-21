"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Workflow, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { FlowCard } from "@/components/automations/flow-card"
import { useFlows, type AutoFlow } from "@/hooks/use-flows"
import { useDebounce } from "@/hooks/use-debounce"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function FluxosContent() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 300)
  const { flows, loading, fetchFlows, createFlow, updateFlow, deleteFlow, activateFlow } =
    useFlows({ search: debouncedSearch })
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AutoFlow | null>(null)

  const handleCreate = async () => {
    setCreating(true)
    const flow = await createFlow()
    setCreating(false)
    if (flow) {
      toast.success("Automatismo criado com sucesso")
      router.push(`/dashboard/automacao/fluxos/editor?id=${flow.id}`)
    } else {
      toast.error("Erro ao criar automatismo")
    }
  }

  const handleEdit = (flow: AutoFlow) => {
    router.push(`/dashboard/automacao/fluxos/editor?id=${flow.id}`)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const ok = await deleteFlow(deleteTarget.id)
    if (ok) {
      toast.success("Automatismo eliminado")
      fetchFlows()
    } else {
      toast.error("Erro ao eliminar automatismo")
    }
    setDeleteTarget(null)
  }

  const handleToggleActive = async (flow: AutoFlow) => {
    const result = await activateFlow(flow.id, !flow.is_active)
    if (result?.ok) {
      toast.success(flow.is_active ? "Automatismo desactivado" : "Automatismo activado")
      fetchFlows()
    } else {
      toast.error(result?.error || "Erro ao actualizar automatismo")
    }
  }

  const handleDuplicate = async (flow: AutoFlow) => {
    const newFlow = await createFlow(`Copia de ${flow.name}`)
    if (newFlow && flow.draft_definition) {
      await updateFlow(newFlow.id, {
        description: flow.description || undefined,
        draft_definition: flow.draft_definition,
        wpp_instance_id: flow.wpp_instance_id,
      })
      toast.success("Automatismo duplicado")
      fetchFlows()
    } else {
      toast.error("Erro ao duplicar automatismo")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar automatismos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={handleCreate} disabled={creating}>
          <Plus className="mr-2 h-4 w-4" />
          {creating ? "A criar..." : "Novo Automatismo"}
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : flows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Workflow className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold">Nenhum automatismo encontrado</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {search
              ? "Tente outra pesquisa"
              : "Comece por criar o seu primeiro automatismo"}
          </p>
          {!search && (
            <Button onClick={handleCreate} disabled={creating}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Primeiro Automatismo
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow) => (
            <FlowCard
              key={flow.id}
              flow={flow}
              onEdit={handleEdit}
              onDelete={setDeleteTarget}
              onToggleActive={handleToggleActive}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar automatismo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar o automatismo &quot;{deleteTarget?.name}&quot;?
              Esta acção é irreversível e irá remover todos os triggers e execuções associadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
