"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  MessageCircle,
  Mail,
  Timer,
  Database,
  Search,
  GitBranch,
  Variable,
  Globe,
  Reply,
  Bell,
  Webhook,
  Activity,
  Calendar,
  Play,
  RefreshCw,
  Circle,
} from "lucide-react"
import { Spinner } from "@/components/kibo-ui/spinner"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { RealtimeStep } from "@/hooks/use-realtime-execution"
import type { FlowDefinition, AutomationNode, AutomationEdge, DelayNodeData } from "@/lib/types/automation-flow"

// ── Node type icons & labels ──

const NODE_TYPE_ICONS: Record<string, React.ElementType> = {
  trigger_webhook: Webhook,
  trigger_status: Activity,
  trigger_schedule: Calendar,
  trigger_manual: Play,
  whatsapp: MessageCircle,
  email: Mail,
  delay: Timer,
  condition: GitBranch,
  supabase_query: Database,
  task_lookup: Search,
  set_variable: Variable,
  http_request: Globe,
  webhook_response: Reply,
  notification: Bell,
}

const NODE_TYPE_LABELS: Record<string, string> = {
  trigger_webhook: "Webhook",
  trigger_status: "Mudanca de Estado",
  trigger_schedule: "Agendamento",
  trigger_manual: "Manual",
  whatsapp: "WhatsApp",
  email: "Email",
  delay: "Aguardar",
  condition: "Condicao",
  supabase_query: "Consulta Banco",
  task_lookup: "Buscar Entidade",
  set_variable: "Definir Variavel",
  http_request: "HTTP Request",
  webhook_response: "Responder Webhook",
  notification: "Notificacao",
}

// ── Timeline step interface (combined flow node + step run) ──

export interface TimelineStep {
  nodeId: string
  nodeType: string
  nodeLabel: string
  status: "completed" | "running" | "failed" | "pending" | "scheduled" | "waiting" | "cancelled"
  stepRun?: RealtimeStep
  order: number
  scheduledFor?: string | null
  delayConfig?: { value: number; unit: string }
}

// ── Graph traversal: BFS from trigger ──

function traverseGraphBFS(nodes: AutomationNode[], edges: AutomationEdge[]): AutomationNode[] {
  const targetIds = new Set(edges.map((e) => e.target))
  const trigger = nodes.find((n) => !targetIds.has(n.id))
  if (!trigger) return nodes

  const ordered: AutomationNode[] = []
  const visited = new Set<string>()
  const queue = [trigger.id]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    const node = nodes.find((n) => n.id === current)
    if (node) ordered.push(node)

    const nextEdges = edges.filter((e) => e.source === current)
    for (const edge of nextEdges) {
      if (!visited.has(edge.target)) queue.push(edge.target)
    }
  }

  return ordered
}

// ── Build timeline: merge flow definition with step runs ──

export function buildTimeline(
  flowDefinition: FlowDefinition | null,
  stepRuns: RealtimeStep[]
): TimelineStep[] {
  // Fallback: if no flow definition, just show step runs
  if (!flowDefinition?.nodes?.length) {
    return stepRuns.map((step, index) => ({
      nodeId: step.node_id,
      nodeType: step.node_type,
      nodeLabel: step.node_label || NODE_TYPE_LABELS[step.node_type] || step.node_type,
      status: step.status,
      stepRun: step,
      order: index,
      scheduledFor: step.scheduled_for,
    }))
  }

  const orderedNodes = traverseGraphBFS(flowDefinition.nodes, flowDefinition.edges)
  const stepMap = new Map(stepRuns.map((s) => [s.node_id, s]))

  return orderedNodes.map((node, index) => {
    const step = stepMap.get(node.id)
    const nodeData = node.data as { label?: string; type?: string; value?: number; unit?: string }
    const nodeType = node.type || nodeData?.type || "unknown"

    let status: TimelineStep["status"]
    if (step) {
      status = step.status
    } else {
      // No step in DB — infer state from previous nodes
      const prevNode = orderedNodes[index - 1]
      const prevStep = prevNode ? stepMap.get(prevNode.id) : null

      if (!prevStep) {
        status = index === 0 ? "pending" : "waiting"
      } else if (prevStep.status === "completed") {
        status = "pending" // should be created soon
      } else if (prevStep.status === "failed" || prevStep.status === "cancelled") {
        status = "waiting"
      } else {
        status = "waiting"
      }
    }

    const delayConfig = nodeType === "delay" && nodeData?.value
      ? { value: nodeData.value, unit: nodeData.unit || "minutes" }
      : undefined

    return {
      nodeId: node.id,
      nodeType,
      nodeLabel: nodeData?.label || NODE_TYPE_LABELS[nodeType] || nodeType,
      status,
      stepRun: step || undefined,
      order: index,
      scheduledFor: step?.scheduled_for || null,
      delayConfig,
    }
  })
}

// ── Countdown timer component ──

function CountdownTimer({ scheduledFor }: { scheduledFor: string }) {
  const [remaining, setRemaining] = useState("")

  useEffect(() => {
    const target = new Date(scheduledFor).getTime()

    function tick() {
      const diff = target - Date.now()
      if (diff <= 0) {
        setRemaining("A processar...")
        return
      }
      const mins = Math.floor(diff / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setRemaining(mins > 0 ? `${mins}m ${secs}s restantes` : `${secs}s restantes`)
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [scheduledFor])

  return (
    <span className="text-xs text-violet-600 dark:text-violet-400 font-mono">
      {remaining}
    </span>
  )
}

// ── Step status icon ──

function StepStatusIcon({ status }: { status: TimelineStep["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    case "running":
      return <Spinner variant="infinite" size={16} className="text-blue-500" />
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />
    case "pending":
      return <Clock className="h-4 w-4 text-amber-500" />
    case "scheduled":
      return <Timer className="h-4 w-4 text-violet-500" />
    case "cancelled":
      return <Ban className="h-4 w-4 text-slate-400" />
    case "waiting":
      return <Circle className="h-4 w-4 text-muted-foreground/30" />
  }
}

// ── Connector line color ──

function connectorColor(status: TimelineStep["status"]) {
  switch (status) {
    case "completed":
      return "bg-emerald-300 dark:bg-emerald-700"
    case "running":
      return "bg-blue-300 dark:bg-blue-700"
    case "failed":
      return "bg-red-300 dark:bg-red-700"
    case "waiting":
      return "bg-muted-foreground/15"
    default:
      return "bg-muted-foreground/25"
  }
}

// ── Delay unit label ──

function delayUnitLabel(unit: string) {
  switch (unit) {
    case "minutes": return "minutos"
    case "hours": return "horas"
    case "days": return "dias"
    default: return unit
  }
}

// ── Step result subtitle ──

function StepSubtitle({ step }: { step: TimelineStep }) {
  const { status, nodeType, stepRun, scheduledFor, delayConfig } = step

  if (status === "running") {
    return <span className="text-xs text-blue-500">A processar...</span>
  }

  if (status === "failed" && stepRun?.error_message) {
    return (
      <span className="text-xs text-red-600 dark:text-red-400 line-clamp-2">
        {stepRun.error_message}
      </span>
    )
  }

  // Pending with scheduled_for in future = countdown
  if (status === "pending" && scheduledFor && new Date(scheduledFor) > new Date()) {
    return <CountdownTimer scheduledFor={scheduledFor} />
  }

  if (status === "waiting") {
    return <span className="text-xs text-muted-foreground">A aguardar passo anterior</span>
  }

  if (status === "completed") {
    // Duration
    const duration = stepRun?.duration_ms != null
      ? stepRun.duration_ms < 1000
        ? `${stepRun.duration_ms}ms`
        : `${(stepRun.duration_ms / 1000).toFixed(1)}s`
      : null

    // Contextual result
    let result: string | null = null
    if (nodeType === "delay" && delayConfig) {
      result = `Esperou ${delayConfig.value} ${delayUnitLabel(delayConfig.unit)}`
    } else if (nodeType === "supabase_query" && stepRun?.output_data) {
      const op = (stepRun.output_data as Record<string, unknown>)?.operation
      result = op === "inserted" ? "Registo criado"
        : op === "updated" ? "Registo actualizado"
        : op === "upserted" ? "Registo upserted"
        : null
    } else if (nodeType === "whatsapp") {
      result = "Mensagens enviadas"
    } else if (nodeType === "email") {
      result = "Email enviado"
    }

    return (
      <span className="text-xs text-muted-foreground">
        {result && <span className="text-emerald-600 dark:text-emerald-400">{result}</span>}
        {result && duration && <span className="mx-1">&middot;</span>}
        {duration && <span>{duration}</span>}
      </span>
    )
  }

  return null
}

// ── Main component ──

interface ExecutionTimelineProps {
  steps: RealtimeStep[]
  totalSteps: number
  completedSteps: number
  failedSteps: number
  overallStatus: "idle" | "running" | "completed" | "failed"
  compact?: boolean
  onRetryStep?: (stepId: string) => void
  retryingStepId?: string | null
  flowDefinition?: FlowDefinition | null
}

export function ExecutionTimeline({
  steps,
  totalSteps: _totalSteps,
  completedSteps: _completedSteps,
  failedSteps: _failedSteps,
  overallStatus,
  compact = false,
  onRetryStep,
  retryingStepId,
  flowDefinition,
}: ExecutionTimelineProps) {
  const timeline = useMemo(
    () => buildTimeline(flowDefinition || null, steps),
    [flowDefinition, steps]
  )

  const completed = timeline.filter((s) => s.status === "completed").length
  const failed = timeline.filter((s) => s.status === "failed").length
  const total = timeline.length
  const progress = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0

  return (
    <div className="space-y-3">
      {/* Progress header */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {overallStatus === "running" && "Execucao a decorrer..."}
            {overallStatus === "completed" && "Execucao concluida"}
            {overallStatus === "failed" && "Execucao com falhas"}
            {overallStatus === "idle" && "A aguardar"}
          </span>
          <span className="text-muted-foreground tabular-nums">
            {completed}/{total} passos
          </span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Timeline steps */}
      <div className="space-y-0">
        {timeline.map((step, i) => {
          const NodeIcon = NODE_TYPE_ICONS[step.nodeType] || Play
          const requiresManualRetry = step.status === "failed" &&
            step.stepRun?.output_data?.requires_manual_retry === true

          return (
            <div key={step.nodeId} className="relative">
              {/* Connector line */}
              {i > 0 && (
                <div
                  className={cn(
                    "absolute left-[9px] -top-0 w-0.5 h-2",
                    connectorColor(step.status)
                  )}
                />
              )}

              <div
                className={cn(
                  "flex items-start gap-2.5 rounded-md px-2.5 py-2 mt-0 transition-colors",
                  step.status === "completed" && "bg-emerald-50/50 dark:bg-emerald-950/20",
                  step.status === "running" && "bg-blue-50/50 dark:bg-blue-950/20",
                  step.status === "failed" && "bg-red-50/50 dark:bg-red-950/20",
                  step.status === "pending" && "bg-amber-50/30 dark:bg-amber-950/10",
                  step.status === "waiting" && "opacity-50",
                )}
              >
                {/* Status icon */}
                <div className="mt-0.5 shrink-0">
                  <StepStatusIcon status={step.status} />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <NodeIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">{step.nodeLabel}</span>
                  </div>

                  {!compact && (
                    <>
                      <div className="mt-0.5">
                        <StepSubtitle step={step} />
                      </div>

                      {/* Manual retry button */}
                      {requiresManualRetry && onRetryStep && step.stepRun && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-1.5 h-7 text-xs"
                          onClick={() => onRetryStep(step.stepRun!.id)}
                          disabled={retryingStepId === step.stepRun.id}
                        >
                          {retryingStepId === step.stepRun.id ? (
                            <Spinner variant="infinite" size={12} className="mr-1.5" />
                          ) : (
                            <RefreshCw className="mr-1.5 h-3 w-3" />
                          )}
                          Tentar Novamente
                        </Button>
                      )}
                    </>
                  )}
                </div>

                {/* Time */}
                {step.stepRun?.started_at && (
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 mt-0.5">
                    {new Date(step.stepRun.started_at).toLocaleTimeString("pt-PT", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {timeline.length === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            A aguardar execucao...
          </div>
        )}
      </div>
    </div>
  )
}
