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

export default function FluxosPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 300)
  const { flows, loading, fetchFlows, createFlow, updateFlow, deleteFlow } =
    useFlows({ search: debouncedSearch })
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AutoFlow | null>(null)

  const handleCreate = async () => {
    setCreating(true)
    const flow = await createFlow()
    setCreating(false)
    if (flow) {
      toast.success("Fluxo criado com sucesso")
      router.push(`/dashboard/automacao/fluxos/editor?id=${flow.id}`)
    } else {
      toast.error("Erro ao criar fluxo")
    }
  }

  const handleEdit = (flow: AutoFlow) => {
    router.push(`/dashboard/automacao/fluxos/editor?id=${flow.id}`)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const ok = await deleteFlow(deleteTarget.id)
    if (ok) {
      toast.success("Fluxo eliminado")
      fetchFlows()
    } else {
      toast.error("Erro ao eliminar fluxo")
    }
    setDeleteTarget(null)
  }

  const handleToggleActive = async (flow: AutoFlow) => {
    const result = await updateFlow(flow.id, { is_active: !flow.is_active })
    if (result) {
      toast.success(flow.is_active ? "Fluxo desactivado" : "Fluxo activado")
      fetchFlows()
    } else {
      toast.error("Erro ao actualizar fluxo")
    }
  }

  const handleDuplicate = async (flow: AutoFlow) => {
    const newFlow = await createFlow(`Cópia de ${flow.name}`)
    if (newFlow && flow.flow_definition) {
      await updateFlow(newFlow.id, {
        description: flow.description || undefined,
        flow_definition: flow.flow_definition,
        wpp_instance_id: flow.wpp_instance_id,
      })
      toast.success("Fluxo duplicado")
      fetchFlows()
    } else {
      toast.error("Erro ao duplicar fluxo")
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fluxos de Automação</h1>
          <p className="text-sm text-muted-foreground">
            Crie e gerencie fluxos automatizados
          </p>
        </div>
        <Button onClick={handleCreate} disabled={creating}>
          <Plus className="mr-2 h-4 w-4" />
          {creating ? "A criar..." : "Novo Fluxo"}
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar fluxos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : flows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Workflow className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold">Nenhum fluxo encontrado</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {search
              ? "Tente outra pesquisa"
              : "Comece por criar o seu primeiro fluxo de automação"}
          </p>
          {!search && (
            <Button onClick={handleCreate} disabled={creating}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Primeiro Fluxo
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

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar fluxo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar o fluxo &quot;{deleteTarget?.name}&quot;?
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
