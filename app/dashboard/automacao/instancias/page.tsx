"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { Plus, RefreshCw, Smartphone, Signal, Workflow } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/kibo-ui/spinner"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { InstanceCard } from "@/components/automations/instance-card"
import { InstanceConnectionSheet } from "@/components/automations/instance-connection-sheet"
import { CreateInstanceDialog } from "@/components/automations/create-instance-dialog"
import { useWhatsAppInstances } from "@/hooks/use-whatsapp-instances"
import type { WhatsAppConnectionStatus } from "@/lib/types/whatsapp-template"

export default function InstanciasPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InstanciasContent />
    </Suspense>
  )
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-72 mt-2" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  )
}

function InstanciasContent() {
  const {
    instances,
    loading,
    syncInstances,
    createInstance,
    connectInstance,
    disconnectInstance,
    checkStatus,
    assignUser,
    deleteInstance,
    refetch,
  } = useWhatsAppInstances()

  const [syncing, setSyncing] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [connectId, setConnectId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [assignId, setAssignId] = useState<string | null>(null)
  const [assignUserId, setAssignUserId] = useState<string>("")
  const [assignLoading, setAssignLoading] = useState(false)
  const [users, setUsers] = useState<{ id: string; commercial_name: string }[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())

  const withCardLoading = useCallback(async (id: string, fn: () => Promise<void>) => {
    setLoadingIds((prev) => new Set(prev).add(id))
    try {
      await fn()
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [])

  // Stats
  const stats = useMemo(() => {
    const total = instances.length
    const connected = instances.filter(
      (i) => (i.connection_status as WhatsAppConnectionStatus) === "connected"
    ).length
    const flows = instances.reduce((sum, i) => sum + (i.flow_count ?? 0), 0)
    return { total, connected, flows }
  }, [instances])

  const connectingInstance = instances.find((i) => i.id === connectId)
  const deletingInstance = instances.find((i) => i.id === deleteId)

  const handleSync = async () => {
    setSyncing(true)
    try {
      await syncInstances()
      toast.success("Instâncias sincronizadas com sucesso")
    } catch {
      toast.error("Erro ao sincronizar instâncias")
    } finally {
      setSyncing(false)
    }
  }

  const handleCreate = async (params: { name: string; user_id?: string }) => {
    try {
      await createInstance(params)
      toast.success("Instância criada com sucesso")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar instância")
      throw err
    }
  }

  const handleDisconnect = async (id: string) => {
    await withCardLoading(id, async () => {
      try {
        await disconnectInstance(id)
        toast.success("Instância desconectada")
      } catch {
        toast.error("Erro ao desconectar")
      }
    })
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const id = deleteId
    setDeleteId(null)
    await withCardLoading(id, async () => {
      try {
        await deleteInstance(id)
        toast.success("Instância eliminada com sucesso")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao eliminar instância")
      }
    })
  }

  const handleCheckStatus = async (id: string) => {
    await withCardLoading(id, async () => {
      try {
        const result = await checkStatus(id)
        await refetch()
        if (result.connected) {
          toast.success("Instância conectada")
        } else {
          toast.info("Estado actualizado")
        }
      } catch {
        toast.error("Erro ao verificar estado")
      }
    })
  }

  const assigningInstance = instances.find((i) => i.id === assignId)

  // Load users when assign dialog opens
  useEffect(() => {
    if (!assignId) return
    // Pre-select current user
    setAssignUserId(assigningInstance?.user_id ?? "none")

    let cancelled = false
    async function loadUsers() {
      setLoadingUsers(true)
      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        const { data } = await supabase
          .from("dev_users")
          .select("id, commercial_name")
          .eq("is_active", true)
          .order("commercial_name")
        if (!cancelled && data) {
          setUsers(
            data.map((u) => ({
              id: u.id,
              commercial_name: u.commercial_name || "Sem nome",
            }))
          )
        }
      } catch {
        // Lista opcional
      } finally {
        if (!cancelled) setLoadingUsers(false)
      }
    }
    loadUsers()
    return () => { cancelled = true }
  }, [assignId, assigningInstance?.user_id])

  const handleAssignUser = (id: string) => {
    setAssignId(id)
  }

  const handleAssignSubmit = async () => {
    if (!assignId) return
    const id = assignId
    setAssignLoading(true)
    setAssignId(null)
    try {
      await withCardLoading(id, async () => {
        const userId = assignUserId === "none" ? null : assignUserId
        await assignUser(id, userId)
        toast.success(userId ? "Utilizador atribuído com sucesso" : "Utilizador desatribuído")
      })
    } catch {
      toast.error("Erro ao atribuir utilizador")
    } finally {
      setAssignLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Instâncias WhatsApp</h1>
          <p className="text-muted-foreground text-sm">
            Gerir instâncias WhatsApp conectadas ao sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            {syncing ? (
              <Spinner variant="infinite" size={16} className="mr-2" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Actualizar
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="py-0">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-lg bg-emerald-100 p-2.5">
              <Smartphone className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">
                Instâncias · {stats.connected} on · {stats.total - stats.connected} off
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-0" >
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-lg bg-blue-100 p-2.5">
              <Signal className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {stats.total > 0
                  ? Math.round((stats.connected / stats.total) * 100)
                  : 0}
                %
              </p>
              <p className="text-xs text-muted-foreground">
                Conectadas ({stats.connected} de {stats.total})
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-lg bg-violet-100 p-2.5">
              <Workflow className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.flows}</p>
              <p className="text-xs text-muted-foreground">Fluxos vinculados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instance Cards */}
      {loading && instances.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : instances.length === 0 ? (
        <Card className="py-0">
          <CardContent className="flex flex-col items-center justify-center">
            <Smartphone className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium">Nenhuma instância</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Crie uma nova instância ou sincronize com a Uazapi
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSync}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sincronizar
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Criar instância
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 py-0">
          {instances.map((instance) => (
            <InstanceCard
              key={instance.id}
              instance={instance}
              loading={loadingIds.has(instance.id)}
              onConnect={setConnectId}
              onDisconnect={handleDisconnect}
              onDelete={setDeleteId}
              onAssignUser={handleAssignUser}
              onCheckStatus={handleCheckStatus}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <CreateInstanceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
      />

      {/* Connection Sheet */}
      <InstanceConnectionSheet
        open={!!connectId}
        onOpenChange={(open) => !open && setConnectId(null)}
        instanceId={connectId}
        instanceName={connectingInstance?.name ?? ""}
        onConnect={connectInstance}
        onCheckStatus={checkStatus}
        onSuccess={refetch}
      />

      {/* Assign User Dialog */}
      <Dialog open={!!assignId} onOpenChange={(open) => !open && setAssignId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {assigningInstance?.user_id ? "Alterar utilizador" : "Atribuir utilizador"}
            </DialogTitle>
            <DialogDescription>
              {assigningInstance?.user_id
                ? `Alterar ou remover o utilizador atribuído a "${assigningInstance?.name}".`
                : `Seleccione o utilizador responsável pela instância "${assigningInstance?.name}".`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="assign-user-select">Utilizador</Label>
            <Select value={assignUserId} onValueChange={setAssignUserId}>
              <SelectTrigger id="assign-user-select">
                <SelectValue
                  placeholder={loadingUsers ? "A carregar..." : "Seleccionar utilizador"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (desatribuir)</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.commercial_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignId(null)}>
              Cancelar
            </Button>
            <Button onClick={handleAssignSubmit} disabled={assignLoading}>
              {assignLoading && <Spinner variant="infinite" size={16} className="mr-2" />}
              {assignUserId === "none" ? "Desatribuir" : "Atribuir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar instância</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar a instância{" "}
              <strong>{deletingInstance?.name}</strong>? Esta acção irá remover a instância
              da Uazapi e do sistema. É irreversível.
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
