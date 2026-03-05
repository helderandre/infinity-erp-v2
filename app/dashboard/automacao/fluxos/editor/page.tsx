"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Save,
  Play,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FlowEditor } from "@/components/automations/flow-editor"
import { useFlows } from "@/hooks/use-flows"
import { useWhatsAppInstances } from "@/hooks/use-whatsapp-instances"
import type { FlowDefinition } from "@/lib/types/automation-flow"
import { isTriggerType } from "@/lib/types/automation-flow"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"

function FlowEditorContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const flowId = searchParams.get("id")
  const { getFlow, updateFlow, testFlow } = useFlows({ autoFetch: false })
  const { instances, refetch: fetchInstances } = useWhatsAppInstances()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [wppInstanceId, setWppInstanceId] = useState<string | null>(null)
  const [flowDefinition, setFlowDefinition] = useState<FlowDefinition | null>(
    null
  )
  const [loadingFlow, setLoadingFlow] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  // Load flow
  useEffect(() => {
    if (!flowId) {
      setLoadingFlow(false)
      return
    }

    const load = async () => {
      setLoadingFlow(true)
      const result = await getFlow(flowId)
      if (result) {
        setName(result.flow.name)
        setDescription(result.flow.description || "")
        setWppInstanceId(result.flow.wpp_instance_id)
        setFlowDefinition(result.flow.flow_definition)
      } else {
        toast.error("Fluxo não encontrado")
        router.push("/dashboard/automacao/fluxos")
      }
      setLoadingFlow(false)
    }

    load()
    fetchInstances()
  }, [flowId])

  // Save
  const handleSave = useCallback(
    async (definition: FlowDefinition) => {
      if (!flowId) return
      setSaving(true)

      // Check if WhatsApp node exists without instance
      const hasWppNode = definition.nodes.some((n) => n.type === "whatsapp")
      if (hasWppNode && !wppInstanceId) {
        toast.error("Seleccione uma instância WhatsApp para usar o node WhatsApp")
        setSaving(false)
        return
      }

      // Extract triggers from trigger nodes
      const triggers = definition.nodes
        .filter((n) => isTriggerType(n.type))
        .map((n) => {
          const triggerType = n.type.replace("trigger_", "")
          return {
            trigger_type: triggerType,
            config: n.data as unknown as Record<string, unknown>,
          }
        })

      const result = await updateFlow(flowId, {
        name,
        description: description || undefined,
        flow_definition: definition,
        wpp_instance_id: wppInstanceId,
        triggers,
      })

      setSaving(false)

      if (result) {
        toast.success("Fluxo guardado com sucesso")
      } else {
        toast.error("Erro ao guardar fluxo")
      }
    },
    [flowId, name, description, wppInstanceId, updateFlow]
  )

  // Test
  const handleTest = useCallback(async () => {
    if (!flowId) return
    setTesting(true)

    const result = await testFlow(flowId)
    setTesting(false)

    if (result) {
      toast.success(`Teste iniciado (run: ${result.run_id.slice(0, 8)}...)`)
    } else {
      toast.error("Erro ao iniciar teste")
    }
  }, [flowId, testFlow])

  if (loadingFlow) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-4 border-b px-4 py-3">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
          <div className="flex-1" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="flex-1">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    )
  }

  if (!flowId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Nenhum fluxo seleccionado</p>
      </div>
    )
  }

  const connectedInstances = instances.filter(
    (i) => i.connection_status === "connected"
  )

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b px-4 py-2 bg-background z-10">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/automacao/fluxos">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <div className="flex flex-col gap-0.5 min-w-0">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-7 text-sm font-semibold border-transparent hover:border-input focus:border-input px-1.5 w-64"
            placeholder="Nome do fluxo"
          />
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-5 text-[10px] text-muted-foreground border-transparent hover:border-input focus:border-input px-1.5 w-64"
            placeholder="Descrição (opcional)"
          />
        </div>

        <div className="flex-1" />

        {/* WhatsApp Instance Select */}
        <Select
          value={wppInstanceId || "none"}
          onValueChange={(v) => setWppInstanceId(v === "none" ? null : v)}
        >
          <SelectTrigger className="h-8 w-52 text-xs">
            <SelectValue placeholder="Instância WhatsApp" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem WhatsApp</SelectItem>
            {connectedInstances.map((inst) => (
              <SelectItem key={inst.id} value={inst.id}>
                {inst.name} ({inst.phone || "sem nº"})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={testing}
        >
          {testing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="mr-1.5 h-3.5 w-3.5" />
          )}
          Testar
        </Button>

        <Button
          size="sm"
          onClick={() => flowDefinition && handleSave(flowDefinition)}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-3.5 w-3.5" />
          )}
          Guardar
        </Button>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <FlowEditor
          initialDefinition={flowDefinition || undefined}
          onSave={(def) => {
            setFlowDefinition(def)
            handleSave(def)
          }}
          saving={saving}
        />
      </div>
    </div>
  )
}

export default function FlowEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-4 border-b px-4 py-3">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-48" />
            <div className="flex-1" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="flex-1">
            <Skeleton className="h-full w-full" />
          </div>
        </div>
      }
    >
      <FlowEditorContent />
    </Suspense>
  )
}
