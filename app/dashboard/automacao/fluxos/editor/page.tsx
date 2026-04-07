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
  Save,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
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
import Link from "next/link"
import { cn } from "@/lib/utils"

type SaveStatus = "saved" | "saving" | "error"
type EditorMode = "draft" | "production"

function FlowEditorContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const flowId = searchParams.get("id")
  const { getFlow, updateFlow, publishFlow, testFlow } = useFlows({ autoFetch: false })
  const { instances, refetch: fetchInstances } = useWhatsAppInstances()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [wppInstanceId, setWppInstanceId] = useState<string | null>(null)
  const [draftDefinition, setDraftDefinition] = useState<FlowDefinition | null>(null)
  const [publishedDefinition, setPublishedDefinition] = useState<FlowDefinition | null>(null)
  const [originalPublishedDefinition, setOriginalPublishedDefinition] = useState<FlowDefinition | null>(null)
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  const [loadingFlow, setLoadingFlow] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved")
  const [publishing, setPublishing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testerOpen, setTesterOpen] = useState(false)
  const [mode, setMode] = useState<EditorMode>("draft")
  const [productionDirty, setProductionDirty] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [pendingModeSwitch, setPendingModeSwitch] = useState<EditorMode | null>(null)
  const [savingProduction, setSavingProduction] = useState(false)
  const editorRef = useRef<FlowEditorHandle>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const latestDefinitionRef = useRef<FlowDefinition | null>(null)

  // Active definition based on mode
  const activeDefinition = mode === "draft" ? draftDefinition : publishedDefinition

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
        setDraftDefinition(result.flow.draft_definition)
        setPublishedDefinition(result.flow.published_definition)
        setOriginalPublishedDefinition(result.flow.published_definition)
        setHasUnpublishedChanges(result.flow.has_unpublished_changes)
        setPublishedAt(result.flow.published_at)
      } else {
        toast.error("Automatismo não encontrado")
        router.push("/dashboard/automacao/fluxos")
      }
      setLoadingFlow(false)
    }

    load()
    fetchInstances()
  }, [flowId])

  // Auto-save with debounce (only in draft mode)
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
    if (!flowId || !draftDefinition) return
    setSaveStatus("saving")
    try {
      await updateFlow(flowId, {
        name,
        description: description || undefined,
        draft_definition: draftDefinition,
        wpp_instance_id: wppInstanceId,
      })
      setSaveStatus("saved")
      setHasUnpublishedChanges(true)
    } catch {
      setSaveStatus("error")
    }
  }, [flowId, name, description, wppInstanceId, draftDefinition, updateFlow])

  // Debounced metadata save
  const metaSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const handleMetaChange = useCallback(() => {
    if (metaSaveTimeoutRef.current) clearTimeout(metaSaveTimeoutRef.current)
    metaSaveTimeoutRef.current = setTimeout(saveMetadata, 2000)
  }, [saveMetadata])

  // Handle flow save based on mode
  const handleFlowSave = useCallback(
    (definition: FlowDefinition) => {
      if (mode === "draft") {
        setDraftDefinition(definition)
        autoSave(definition)
      } else {
        // Production mode: local change only, mark dirty
        setPublishedDefinition(definition)
        setProductionDirty(true)
      }
    },
    [mode, autoSave]
  )

  // Save production explicitly
  const handleSaveProduction = useCallback(async () => {
    if (!flowId || !publishedDefinition) return

    setSavingProduction(true)
    try {
      await updateFlow(flowId, { published_definition: publishedDefinition })

      // Sync triggers via publish endpoint
      await fetch(`/api/automacao/fluxos/${flowId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_production_edit: true }),
      })

      setOriginalPublishedDefinition(publishedDefinition)
      setProductionDirty(false)
      toast.success("Versão de produção guardada")
    } catch {
      toast.error("Erro ao guardar versão de produção")
    } finally {
      setSavingProduction(false)
    }
  }, [flowId, publishedDefinition, updateFlow])

  // Mode switch with discard guard
  const handleModeSwitch = useCallback(
    (newMode: EditorMode) => {
      if (newMode === mode) return

      if (mode === "production" && productionDirty) {
        setPendingModeSwitch(newMode)
        setShowDiscardDialog(true)
        return
      }

      setMode(newMode)
    },
    [mode, productionDirty]
  )

  const handleDiscardConfirm = useCallback(() => {
    setPublishedDefinition(originalPublishedDefinition)
    setProductionDirty(false)
    setShowDiscardDialog(false)
    if (pendingModeSwitch) {
      setMode(pendingModeSwitch)
      setPendingModeSwitch(null)
    }
  }, [originalPublishedDefinition, pendingModeSwitch])

  const handleDiscardCancel = useCallback(() => {
    setShowDiscardDialog(false)
    setPendingModeSwitch(null)
  }, [])

  // Revert draft to published
  const handleRevertDraftToPublished = useCallback(async () => {
    if (!flowId || !publishedDefinition) return

    try {
      await updateFlow(flowId, { draft_definition: publishedDefinition })
      setDraftDefinition(publishedDefinition)
      setHasUnpublishedChanges(false)
      toast.success("Rascunho revertido para a versão de produção")
    } catch {
      toast.error("Erro ao reverter rascunho")
    }
  }, [flowId, publishedDefinition, updateFlow])

  // Publish
  const handlePublish = useCallback(async () => {
    if (!flowId) return

    // First, flush any pending auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    if (draftDefinition) {
      await updateFlow(flowId, {
        name,
        description: description || undefined,
        draft_definition: draftDefinition,
        wpp_instance_id: wppInstanceId,
      })
    }

    setPublishing(true)
    const result = await publishFlow(flowId)
    setPublishing(false)

    if (!result) {
      toast.error("Erro ao publicar automatismo")
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

    toast.success("Automatismo publicado!", {
      description: `${result.triggers_count} gatilho(s) sincronizado(s)`,
    })
    setHasUnpublishedChanges(false)
    setPublishedAt(result.published_at || new Date().toISOString())
    // Sync local published definition
    if (draftDefinition) {
      setPublishedDefinition(draftDefinition)
      setOriginalPublishedDefinition(draftDefinition)
    }
  }, [flowId, draftDefinition, name, description, wppInstanceId, updateFlow, publishFlow])

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
        <p className="text-muted-foreground">Nenhum automatismo seleccionado.</p>
      </div>
    )
  }

  const connectedInstances = instances.filter(
    (i) => i.connection_status === "connected"
  )

  const isNeverPublished = !publishedDefinition && !publishedAt

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
            placeholder="Nome do automatismo"
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

        {/* Draft / Production Toggle */}
        <div className="flex items-center rounded-lg border bg-muted p-0.5">
          <button
            onClick={() => handleModeSwitch("draft")}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              mode === "draft"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Rascunho
          </button>
          <button
            onClick={() => handleModeSwitch("production")}
            disabled={isNeverPublished}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              mode === "production"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              isNeverPublished && "opacity-50 cursor-not-allowed"
            )}
            title={isNeverPublished ? "Publica o automatismo primeiro" : undefined}
          >
            Produção
          </button>
        </div>

        {/* Status indicators */}
        {mode === "draft" && (
          <>
            {saveStatus === "saving" ? (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Spinner variant="infinite" size={12} />
                A guardar...
              </span>
            ) : saveStatus === "error" ? (
              <span className="flex items-center gap-1 text-[10px] text-destructive">
                <CloudOff className="h-3 w-3" />
                Erro ao guardar
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Cloud className="h-3 w-3" />
                Guardado
              </span>
            )}
          </>
        )}
        {mode === "production" && !productionDirty && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-600">
            <CheckCircle className="h-3 w-3" />
            Versão em produção
          </span>
        )}
        {mode === "production" && productionDirty && (
          <span className="flex items-center gap-1 text-[10px] text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            Alterações não guardadas
          </span>
        )}

        {/* Badges */}
        {mode === "draft" && hasUnpublishedChanges && publishedDefinition && (
          <Badge variant="outline" className="text-[10px] gap-1 text-amber-600 border-amber-300 bg-amber-50">
            Rascunho difere da produção
          </Badge>
        )}
        {mode === "draft" && !publishedAt && (
          <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
            Nunca publicado
          </Badge>
        )}

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

        {/* Revert draft to production (only in draft mode when diverged) */}
        {mode === "draft" && hasUnpublishedChanges && publishedDefinition && (
          <Button variant="ghost" size="sm" onClick={handleRevertDraftToPublished}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reverter
          </Button>
        )}

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

        {/* Primary action button depends on mode */}
        {mode === "draft" ? (
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
        ) : (
          <Button
            size="sm"
            onClick={handleSaveProduction}
            disabled={savingProduction || !productionDirty}
          >
            {savingProduction ? (
              <Spinner variant="infinite" size={14} className="mr-1.5" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Guardar
          </Button>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <FlowEditor
          key={mode}
          ref={editorRef}
          initialDefinition={activeDefinition || undefined}
          onSave={handleFlowSave}
          saving={saveStatus === "saving"}
        />
      </div>

      {/* Tester Sheet */}
      <AutomationTester
        flowId={flowId}
        flowDefinition={activeDefinition}
        open={testerOpen}
        onOpenChange={setTesterOpen}
      />

      {/* Discard changes AlertDialog */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterações não guardadas</AlertDialogTitle>
            <AlertDialogDescription>
              Fizeste alterações à versão de produção que ainda não foram guardadas.
              Se mudares para o rascunho, essas alterações serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardCancel}>
              Continuar a editar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDiscardConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Descartar alterações
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
