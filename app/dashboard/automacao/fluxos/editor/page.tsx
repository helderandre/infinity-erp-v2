"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Cloud,
  CloudOff,
  Play,
  FlaskConical,
  Rocket,
} from "lucide-react"
import { Spinner } from "@/components/kibo-ui/spinner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { FlowEditor, type FlowEditorHandle } from "@/components/automations/flow-editor"
import { AutomationTester } from "@/components/automations/automation-tester"
import { useFlows } from "@/hooks/use-flows"
import { useWhatsAppInstances } from "@/hooks/use-whatsapp-instances"
import type { FlowDefinition } from "@/lib/types/automation-flow"
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

type SaveStatus = "saved" | "saving" | "error"

function FlowEditorContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const flowId = searchParams.get("id")
  const { getFlow, updateFlow, publishFlow, testFlow } = useFlows({ autoFetch: false })
  const { instances, refetch: fetchInstances } = useWhatsAppInstances()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [wppInstanceId, setWppInstanceId] = useState<string | null>(null)
  const [flowDefinition, setFlowDefinition] = useState<FlowDefinition | null>(null)
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  const [loadingFlow, setLoadingFlow] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved")
  const [publishing, setPublishing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testerOpen, setTesterOpen] = useState(false)
  const editorRef = useRef<FlowEditorHandle>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const latestDefinitionRef = useRef<FlowDefinition | null>(null)

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
        setFlowDefinition(result.flow.draft_definition)
        setHasUnpublishedChanges(result.flow.has_unpublished_changes)
        setPublishedAt(result.flow.published_at)
      } else {
        toast.error("Fluxo não encontrado")
        router.push("/dashboard/automacao/fluxos")
      }
      setLoadingFlow(false)
    }

    load()
    fetchInstances()
  }, [flowId])

  // Auto-save with debounce
  const autoSave = useCallback(
    async (definition: FlowDefinition) => {
      if (!flowId) return

      latestDefinitionRef.current = definition
      setSaveStatus("saving")
      setHasUnpublishedChanges(true)

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await updateFlow(flowId, {
            name,
            description: description || undefined,
            draft_definition: definition,
            wpp_instance_id: wppInstanceId,
          })
          setSaveStatus("saved")
        } catch {
          setSaveStatus("error")
          // Retry after 5s
          setTimeout(() => {
            if (latestDefinitionRef.current) {
              autoSave(latestDefinitionRef.current)
            }
          }, 5000)
        }
      }, 2000)
    },
    [flowId, name, description, wppInstanceId, updateFlow]
  )

  // Save metadata changes (name, description, wpp instance)
  const saveMetadata = useCallback(async () => {
    if (!flowId || !flowDefinition) return
    setSaveStatus("saving")
    try {
      await updateFlow(flowId, {
        name,
        description: description || undefined,
        draft_definition: flowDefinition,
        wpp_instance_id: wppInstanceId,
      })
      setSaveStatus("saved")
      setHasUnpublishedChanges(true)
    } catch {
      setSaveStatus("error")
    }
  }, [flowId, name, description, wppInstanceId, flowDefinition, updateFlow])

  // Debounced metadata save
  const metaSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const handleMetaChange = useCallback(() => {
    if (metaSaveTimeoutRef.current) clearTimeout(metaSaveTimeoutRef.current)
    metaSaveTimeoutRef.current = setTimeout(saveMetadata, 2000)
  }, [saveMetadata])

  // Publish
  const handlePublish = useCallback(async () => {
    if (!flowId) return

    // First, flush any pending auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    if (flowDefinition) {
      await updateFlow(flowId, {
        name,
        description: description || undefined,
        draft_definition: flowDefinition,
        wpp_instance_id: wppInstanceId,
      })
    }

    setPublishing(true)
    const result = await publishFlow(flowId)
    setPublishing(false)

    if (!result) {
      toast.error("Erro ao publicar fluxo")
      return
    }

    if (!result.ok) {
      if (result.errors) {
        result.errors.forEach((e: string) => toast.error(e))
      } else {
        toast.error(result.error || "Erro ao publicar")
      }
      return
    }

    toast.success("Fluxo publicado!", {
      description: `${result.triggers_count} gatilho(s) sincronizado(s)`,
    })
    setHasUnpublishedChanges(false)
    setPublishedAt(result.published_at || new Date().toISOString())
  }, [flowId, flowDefinition, name, description, wppInstanceId, updateFlow, publishFlow])

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
        <p className="text-muted-foreground">Nenhum fluxo seleccionado.</p>
      </div>
    )
  }

  const connectedInstances = instances.filter(
    (i) => i.connection_status === "connected"
  )

  // Publication status badge
  const PublicationBadge = () => {
    if (!publishedAt) {
      return (
        <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
          Nunca publicado
        </Badge>
      )
    }
    if (hasUnpublishedChanges) {
      return (
        <Badge variant="outline" className="text-[10px] gap-1 text-yellow-600 border-yellow-300 bg-yellow-50">
          Alterações não publicadas
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 border-emerald-300 bg-emerald-50">
        Publicado
      </Badge>
    )
  }

  // Save status indicator
  const SaveIndicator = () => {
    if (saveStatus === "saving") {
      return (
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Spinner variant="infinite" size={12} />
          A guardar...
        </span>
      )
    }
    if (saveStatus === "error") {
      return (
        <span className="flex items-center gap-1 text-[10px] text-destructive">
          <CloudOff className="h-3 w-3" />
          Erro ao guardar
        </span>
      )
    }
    return (
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Cloud className="h-3 w-3" />
        Guardado
      </span>
    )
  }

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
            onChange={(e) => {
              setName(e.target.value)
              handleMetaChange()
            }}
            className="h-7 text-sm font-semibold border-transparent hover:border-input focus:border-input px-1.5 w-64"
            placeholder="Nome do fluxo"
          />
          <Input
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              handleMetaChange()
            }}
            className="h-5 text-[10px] text-muted-foreground border-transparent hover:border-input focus:border-input px-1.5 w-64"
            placeholder="Descrição (opcional)"
          />
        </div>

        <PublicationBadge />
        <SaveIndicator />

        <div className="flex-1" />

        {/* WhatsApp Instance Select */}
        <Select
          value={wppInstanceId || "none"}
          onValueChange={(v) => {
            setWppInstanceId(v === "none" ? null : v)
            handleMetaChange()
          }}
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
            <Spinner variant="infinite" size={14} className="mr-1.5" />
          ) : (
            <Play className="mr-1.5 h-3.5 w-3.5" />
          )}
          Testar
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setTesterOpen(true)}
        >
          <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
          Teste Avançado
        </Button>

        <Button
          size="sm"
          onClick={handlePublish}
          disabled={publishing}
        >
          {publishing ? (
            <Spinner variant="infinite" size={14} className="mr-1.5" />
          ) : (
            <Rocket className="mr-1.5 h-3.5 w-3.5" />
          )}
          Publicar
        </Button>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <FlowEditor
          ref={editorRef}
          initialDefinition={flowDefinition || undefined}
          onSave={(def) => {
            setFlowDefinition(def)
            autoSave(def)
          }}
          saving={saveStatus === "saving"}
        />
      </div>

      {/* Tester Sheet */}
      <AutomationTester
        flowId={flowId}
        flowDefinition={flowDefinition}
        open={testerOpen}
        onOpenChange={setTesterOpen}
      />
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
