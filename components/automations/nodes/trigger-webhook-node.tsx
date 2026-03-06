"use client"

import { memo, useEffect, useCallback, useState } from "react"
import type { NodeProps } from "@xyflow/react"
import { useReactFlow } from "@xyflow/react"
import {
  Webhook,
  Copy,
  Check,
  Radio,
  Square,
  RotateCcw,
  Pin,
  Settings2,
  ArrowRight,
  Lightbulb,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { NodeWrapper } from "./node-wrapper"
import type { TriggerWebhookNodeData, WebhookFieldMapping } from "@/lib/types/automation-flow"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useWebhookTestListener } from "@/hooks/use-webhook-test-listener"
import { WebhookJsonTree } from "@/components/automations/webhook-json-tree"
import { WebhookFieldMapper } from "@/components/automations/webhook-field-mapper"
import { toast } from "sonner"

// ── Main Node Component ──

function TriggerWebhookNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as TriggerWebhookNodeData
  const { updateNodeData } = useReactFlow()
  const [copied, setCopied] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Auto-generate webhookKey if missing
  useEffect(() => {
    if (!nodeData.webhookKey) {
      const key = crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      updateNodeData(id, { ...nodeData, webhookKey: key })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const webhookUrl = nodeData.webhookKey
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/webhook/${nodeData.webhookKey}`
    : null

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const hasMappings = nodeData.webhookMappings && nodeData.webhookMappings.length > 0
  const mappingCount = nodeData.webhookMappings?.length || 0

  return (
    <NodeWrapper
      id={id}
      nodeType="trigger_webhook"
      selected={selected}
      icon={<Webhook />}
      title={nodeData.label || "Webhook"}
      showTargetHandle={false}
    >
      {webhookUrl ? (
        <div className="space-y-2">
          {/* Compact URL pill */}
          <div className="flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5">
            <span className="shrink-0 rounded bg-background px-1.5 py-0.5 text-[10px] font-mono font-semibold border">
              POST
            </span>
            <code className="flex-1 truncate text-[10px] font-mono">
              {webhookUrl}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 p-0.5 hover:text-foreground"
            >
              {copied ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>

          {/* Status summary */}
          <div className="flex items-center gap-2">
            {hasMappings ? (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-orange-300 text-orange-600 bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:bg-orange-950/30"
              >
                {mappingCount} campo{mappingCount !== 1 ? "s" : ""} mapeado{mappingCount !== 1 ? "s" : ""}
              </Badge>
            ) : (
              <span className="text-[10px] text-muted-foreground">
                Nao configurado
              </span>
            )}
          </div>

          {/* Configure button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-[10px]"
            onClick={(e) => {
              e.stopPropagation()
              setSheetOpen(true)
            }}
          >
            <Settings2 className="h-3 w-3 mr-1" />
            Configurar
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground/70">
          A gerar chave do webhook...
        </p>
      )}

      {/* Configuration Sheet */}
      {webhookUrl && (
        <WebhookConfigSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          nodeId={id}
          nodeData={nodeData}
          webhookUrl={webhookUrl}
          onUpdateNodeData={(updates) => updateNodeData(id, { ...nodeData, ...updates })}
        />
      )}
    </NodeWrapper>
  )
}

export const TriggerWebhookNode = memo(TriggerWebhookNodeInner)

// ── Configuration Sheet ──

type StepId = "receive" | "choose" | "variables"

interface WebhookConfigSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  nodeId: string
  nodeData: TriggerWebhookNodeData
  webhookUrl: string
  onUpdateNodeData: (updates: Partial<TriggerWebhookNodeData>) => void
}

function WebhookConfigSheet({
  open,
  onOpenChange,
  nodeData,
  webhookUrl,
  onUpdateNodeData,
}: WebhookConfigSheetProps) {
  const [activeStep, setActiveStep] = useState<StepId>("receive")
  const [copied, setCopied] = useState(false)
  const [localMappings, setLocalMappings] = useState<WebhookFieldMapping[]>(
    nodeData.webhookMappings || []
  )
  const [localSample, setLocalSample] = useState<Record<string, unknown> | undefined>(
    nodeData.samplePayload
  )

  const { state, countdown, capture, startListening, stopListening, reset } =
    useWebhookTestListener()

  // Sync local state when sheet opens
  useEffect(() => {
    if (open) {
      setLocalMappings(nodeData.webhookMappings || [])
      setLocalSample(nodeData.samplePayload)
      if (nodeData.samplePayload) {
        setActiveStep("choose")
      } else {
        setActiveStep("receive")
      }
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleUseSample = useCallback(() => {
    if (capture?.payload) {
      setLocalSample(capture.payload)
      toast.success("Payload guardado como exemplo")
    }
  }, [capture])

  const handleSave = useCallback(() => {
    onUpdateNodeData({
      samplePayload: localSample,
      webhookMappings: localMappings,
    })
    onOpenChange(false)
    toast.success("Webhook configurado")
  }, [localSample, localMappings, onUpdateNodeData, onOpenChange])

  // Use received or saved payload
  const activePayload = capture?.payload || localSample
  const hasPayload = !!activePayload
  const canGoToVariables = localMappings.length > 0

  // When payload arrives, auto-switch to choose step
  const handlePayloadReady = useCallback(() => {
    handleUseSample()
    setActiveStep("choose")
  }, [handleUseSample])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="data-[side=right]:sm:max-w-[600px] w-full p-0 flex flex-col"
        side="right"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle>Configurar Webhook</SheetTitle>
          <SheetDescription>
            Recebe dados de fontes externas (formularios, APIs, plataformas de pagamento, etc.)
          </SheetDescription>
          {/* URL bar */}
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 mt-2">
            <span className="shrink-0 rounded bg-background px-2 py-0.5 text-xs font-mono font-semibold border">
              POST
            </span>
            <code className="flex-1 truncate text-xs font-mono">
              {webhookUrl}
            </code>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopy}>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Envia um POST com JSON para este endereco.
          </p>
        </SheetHeader>

        {/* Body */}
        {!hasPayload ? (
          /* ── Full-width: Receive step (no payload yet) ── */
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="px-6 py-6">
                <StepReceive
                  state={state}
                  countdown={countdown}
                  capture={capture}
                  webhookKey={nodeData.webhookKey!}
                  localSample={localSample}
                  onStartListening={startListening}
                  onStopListening={stopListening}
                  onReset={reset}
                  onUseSample={handleUseSample}
                  onGoNext={handlePayloadReady}
                />
              </div>
            </ScrollArea>
          </div>
        ) : (
          /* ── Tabs: JSON colapsavel no topo + Escolher Dados / Variaveis ── */
          <Tabs
            value={activeStep === "receive" ? "choose" : activeStep}
            onValueChange={(v) => setActiveStep(v as StepId)}
            className="flex-1 flex flex-col min-h-0"
          >
            {/* Collapsible JSON preview + re-listen controls */}
            <PayloadPreviewBar
              payload={activePayload}
              state={state}
              countdown={countdown}
              capture={capture}
              webhookKey={nodeData.webhookKey!}
              onStartListening={startListening}
              onStopListening={stopListening}
              onReset={reset}
              onUseSample={handleUseSample}
            />

            <TabsList className="mx-6 mt-3 grid w-auto grid-cols-2 shrink-0">
              <TabsTrigger value="choose" className="text-xs">
                Escolher Dados
              </TabsTrigger>
              <TabsTrigger
                value="variables"
                disabled={!canGoToVariables}
                className="text-xs"
              >
                Variaveis
                {localMappings.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 text-[10px] font-medium px-1">
                    {localMappings.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="choose" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full">
                <div className="px-6 py-4">
                  <WebhookFieldMapper
                    payload={activePayload}
                    mappings={localMappings}
                    onMappingsChange={setLocalMappings}
                  />
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="variables" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full">
                <div className="px-6 py-4 space-y-4">
                  <StepVariables
                    mappings={localMappings}
                    payload={activePayload}
                  />
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-6 py-4 shrink-0">
          <div />
          <div className="flex items-center gap-2">
            {hasPayload && activeStep !== "variables" && canGoToVariables && (
              <Button variant="ghost" size="sm" onClick={() => setActiveStep("variables")}>
                Ver Variaveis
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            )}
            {localMappings.length > 0 && (
              <Button size="sm" onClick={handleSave}>
                Guardar
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Collapsible Payload Preview Bar ──

function PayloadPreviewBar({
  payload,
  state,
  countdown,
  capture,
  webhookKey,
  onStartListening,
  onStopListening,
  onReset,
  onUseSample,
}: {
  payload: Record<string, unknown>
  state: "idle" | "listening" | "received" | "timeout"
  countdown: number
  capture: { payload: Record<string, unknown> } | null
  webhookKey: string
  onStartListening: (key: string) => void
  onStopListening: () => void
  onReset: () => void
  onUseSample: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mx-6 mt-3 rounded-lg border bg-muted/20 shrink-0">
      {/* Header — always visible */}
      <div className="flex items-center justify-between px-3 py-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-xs font-medium hover:text-foreground transition-colors"
        >
          <Pin className="h-3 w-3 text-muted-foreground" />
          <span>Payload de exemplo</span>
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
        <div className="flex items-center gap-1.5">
          {/* Listening status inline */}
          {state === "listening" && (
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span className="text-[10px] text-muted-foreground">{countdown}s</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-[10px] px-1.5"
                onClick={onStopListening}
              >
                Parar
              </Button>
            </div>
          )}
          {state === "received" && capture && (
            <div className="flex items-center gap-1.5">
              <Check className="h-3 w-3 text-emerald-500" />
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                Novo recebido!
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-5 text-[10px] px-1.5"
                onClick={onUseSample}
              >
                Usar
              </Button>
            </div>
          )}
          {(state === "idle" || state === "timeout") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-[10px] px-1.5"
              onClick={() => {
                onReset()
                onStartListening(webhookKey)
              }}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Ouvir novo
            </Button>
          )}
        </div>
      </div>
      {/* Collapsible JSON tree */}
      {expanded && (
        <div className="border-t px-3 py-2 max-h-48 overflow-auto">
          <WebhookJsonTree data={payload} initialExpanded />
        </div>
      )}
    </div>
  )
}

// ── Step 1: Receive ──

function StepReceive({
  state,
  countdown,
  capture,
  webhookKey,
  localSample,
  onStartListening,
  onStopListening,
  onReset,
  onUseSample,
  onGoNext,
}: {
  state: "idle" | "listening" | "received" | "timeout"
  countdown: number
  capture: { payload: Record<string, unknown> } | null
  webhookKey: string
  localSample?: Record<string, unknown>
  onStartListening: (key: string) => void
  onStopListening: () => void
  onReset: () => void
  onUseSample: () => void
  onGoNext: () => void
}) {
  // No payload at all — show listen button
  if (state === "idle" && !capture && !localSample) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
          <Radio className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">Aguardando webhook...</p>
          <p className="text-xs text-muted-foreground mt-1">
            Envia um POST para o URL acima para testar.
            <br />
            O sistema vai capturar os dados automaticamente.
          </p>
        </div>
        <Button onClick={() => onStartListening(webhookKey)}>
          <Radio className="h-4 w-4 mr-2" />
          Comecar a Ouvir
        </Button>
      </div>
    )
  }

  // Listening with countdown
  if (state === "listening") {
    const progress = (countdown / 120) * 100
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
            </span>
          </div>
        </div>
        <div>
          <p className="text-sm font-medium">A ouvir...</p>
          <p className="text-xs text-muted-foreground mt-1">
            Envia agora um POST para o URL.
          </p>
        </div>
        {/* Progress bar */}
        <div className="w-full max-w-xs">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{countdown}s</p>
        </div>
        <Button variant="outline" size="sm" onClick={onStopListening}>
          <Square className="h-3.5 w-3.5 mr-1.5" />
          Parar
        </Button>
      </div>
    )
  }

  // Timeout
  if (state === "timeout") {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
          <Radio className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">Nenhum webhook recebido</p>
          <p className="text-xs text-muted-foreground mt-1">
            O tempo de espera expirou (120s). Tenta novamente.
          </p>
        </div>
        <Button onClick={() => onStartListening(webhookKey)}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    )
  }

  // Received (fresh capture)
  if (state === "received" && capture) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Webhook recebido!
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Dados recebidos:</p>
          <WebhookJsonTree data={capture.payload} />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onUseSample}>
            <Pin className="h-3.5 w-3.5 mr-1.5" />
            Guardar como exemplo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onReset()
              onStartListening(webhookKey)
            }}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Ouvir novamente
          </Button>
        </div>

        <div className="pt-2">
          <Button onClick={() => { onUseSample(); onGoNext() }}>
            Escolher Dados
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    )
  }

  // Idle with saved sample — show it and allow re-listen
  if (localSample) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
            <Pin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium">Payload de exemplo guardado</p>
            <p className="text-xs text-muted-foreground">
              Podes usar este payload ou ouvir um novo.
            </p>
          </div>
        </div>

        <WebhookJsonTree data={localSample} />

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onStartListening(webhookKey)}>
            <Radio className="h-3.5 w-3.5 mr-1.5" />
            Ouvir novamente
          </Button>
        </div>

        <div className="pt-2">
          <Button onClick={onGoNext}>
            Escolher Dados
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    )
  }

  return null
}

// ── Step 3: Variables Summary ──

function StepVariables({
  mappings,
  payload,
}: {
  mappings: WebhookFieldMapping[]
  payload?: Record<string, unknown>
}) {
  function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce((current: unknown, key: string) => {
      if (current === null || current === undefined) return undefined
      return (current as Record<string, unknown>)[key]
    }, obj)
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Variaveis disponiveis neste fluxo</p>
        <p className="text-xs text-muted-foreground mt-1">
          Estas variaveis podem ser usadas nos passos seguintes (WhatsApp, Email, Condicoes, etc.)
        </p>
      </div>

      <div className="rounded-lg border divide-y">
        {mappings.map((m) => {
          const sampleValue = payload ? getNestedValue(payload, m.webhookPath) : undefined
          return (
            <div key={m.variableKey} className="flex items-center gap-3 px-4 py-3">
              <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
              <span className="font-mono text-sm font-medium text-orange-600 dark:text-orange-400">
                {m.variableKey}
              </span>
              {sampleValue !== undefined && sampleValue !== null && (
                <span className="text-xs text-muted-foreground truncate ml-auto">
                  {String(sampleValue).length > 40
                    ? String(sampleValue).slice(0, 40) + "\u2026"
                    : String(sampleValue)}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Tip */}
      <div className="rounded-lg bg-muted/50 border p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
          <p className="text-xs font-medium">Dica</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Nos proximos passos, usa o botao <span className="font-mono bg-muted px-1 rounded">{"{ }"}</span> para inserir estas variaveis nas mensagens.
        </p>
        <div className="rounded-md bg-background border p-3 font-mono text-xs text-muted-foreground">
          &quot;Ola <span className="text-orange-600 dark:text-orange-400">[{mappings[0]?.variableKey || "wh_nome"}]</span>! O estado da sua compra e <span className="text-orange-600 dark:text-orange-400">[{mappings.find(m => m.variableKey.includes("estado"))?.variableKey || mappings[1]?.variableKey || "wh_estado"}]</span>&quot;
        </div>
      </div>
    </div>
  )
}
