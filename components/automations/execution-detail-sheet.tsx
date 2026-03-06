"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  MessageCircle,
  Mail,
} from "lucide-react"
import { Spinner } from "@/components/kibo-ui/spinner"
import { toast } from "sonner"
import { useExecutions, type ExecutionDetail, type ExecutionDelivery } from "@/hooks/use-executions"
import { ExecutionTimeline } from "./execution-timeline"
import type { RealtimeStep } from "@/hooks/use-realtime-execution"

interface ExecutionDetailSheetProps {
  executionId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRetried?: () => void
}

export function ExecutionDetailSheet({ executionId, open, onOpenChange, onRetried }: ExecutionDetailSheetProps) {
  const { getDetail, retryExecution } = useExecutions({ autoFetch: false })
  const [detail, setDetail] = useState<ExecutionDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [retryingStepId, setRetryingStepId] = useState<string | null>(null)

  useEffect(() => {
    if (!executionId || !open) return
    setLoading(true)
    getDetail(executionId).then((d) => {
      setDetail(d)
      setLoading(false)
    })
  }, [executionId, open, getDetail])

  // Retry all failed steps
  const handleRetryAll = useCallback(async () => {
    if (!executionId) return
    setRetrying(true)
    const ok = await retryExecution(executionId)
    setRetrying(false)
    if (ok) {
      toast.success("Steps falhados reenviados")
      onRetried?.()
      const d = await getDetail(executionId)
      setDetail(d)
    } else {
      toast.error("Erro ao reenviar")
    }
  }, [executionId, retryExecution, getDetail, onRetried])

  // Retry individual step
  const handleRetryStep = useCallback(async (stepId: string) => {
    if (!executionId) return
    setRetryingStepId(stepId)
    try {
      const res = await fetch(`/api/automacao/execucoes/${executionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step_id: stepId }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error)
      }
      toast.success("Step re-enfileirado para processamento")
      onRetried?.()
      const d = await getDetail(executionId)
      setDetail(d)
    } catch (err) {
      console.error("[ExecutionDetailSheet] retry step error:", err)
      toast.error("Erro ao reenviar step")
    } finally {
      setRetryingStepId(null)
    }
  }, [executionId, getDetail, onRetried])

  const run = detail?.run
  const steps = detail?.steps || []
  const deliveries = detail?.deliveries || []
  const hasFailed = steps.some((s) => s.status === "failed")

  // Convert steps to RealtimeStep format for timeline
  const timelineSteps: RealtimeStep[] = steps.map((s) => ({
    id: s.id,
    node_id: s.node_id,
    node_type: s.node_type,
    node_label: s.node_label,
    status: s.status,
    input_data: s.input_data,
    output_data: s.output_data,
    error_message: s.error_message,
    duration_ms: s.duration_ms,
    started_at: s.started_at,
    completed_at: s.completed_at,
    scheduled_for: s.scheduled_for,
    created_at: s.created_at,
  }))

  const completedSteps = steps.filter((s) => s.status === "completed").length
  const failedSteps = steps.filter((s) => s.status === "failed").length
  const isFinished = steps.length > 0 && !steps.some((s) => s.status === "running" || s.status === "pending")
  const overallStatus: "idle" | "running" | "completed" | "failed" =
    !run ? "idle" : failedSteps > 0 && isFinished ? "failed" : isFinished ? "completed" : "running"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {loading ? "A carregar..." : run?.auto_flows?.name || "Execucao"}
          </SheetTitle>
          <SheetDescription>
            {run?.id ? `ID: ${run.id.slice(0, 8)}...` : ""}
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Spinner variant="infinite" size={24} className="text-muted-foreground" />
          </div>
        )}

        {!loading && run && (
          <div className="mt-6 space-y-6">
            {/* Run info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Estado</span>
                <div className="mt-0.5">
                  <RunStatusBadge status={run.status} />
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Disparado por</span>
                <p className="mt-0.5 font-medium">{run.triggered_by || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Inicio</span>
                <p className="mt-0.5 font-medium">
                  {run.started_at
                    ? new Date(run.started_at).toLocaleString("pt-PT")
                    : "—"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Conclusao</span>
                <p className="mt-0.5 font-medium">
                  {run.completed_at
                    ? new Date(run.completed_at).toLocaleString("pt-PT")
                    : "—"}
                </p>
              </div>
            </div>

            {/* Retry all button */}
            {hasFailed && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetryAll}
                disabled={retrying}
                className="w-full"
              >
                {retrying ? (
                  <Spinner variant="infinite" size={14} className="mr-2" />
                ) : (
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                )}
                Reenviar todos os passos falhados
              </Button>
            )}

            <Separator />

            {/* Timeline */}
            <div>
              <h4 className="text-sm font-medium mb-3">Passos</h4>
              <ExecutionTimeline
                steps={timelineSteps}
                totalSteps={steps.length}
                completedSteps={completedSteps}
                failedSteps={failedSteps}
                overallStatus={overallStatus}
                onRetryStep={handleRetryStep}
                retryingStepId={retryingStepId}
              />
            </div>

            {/* Deliveries */}
            {deliveries.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-3">Entregas</h4>
                  <div className="space-y-2">
                    {deliveries.map((d) => (
                      <DeliveryRow key={d.id} delivery={d} />
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Step data viewer */}
            {steps.some((s) => s.output_data && Object.keys(s.output_data).length > 0) && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-3">Dados dos Passos</h4>
                  <div className="space-y-2">
                    {steps
                      .filter((s) => s.output_data && Object.keys(s.output_data).length > 0)
                      .map((s) => (
                        <div key={s.id} className="rounded-md border p-2">
                          <p className="text-xs font-medium mb-1">{s.node_label || s.node_type}</p>
                          <pre className="text-[10px] text-muted-foreground overflow-x-auto max-h-32 whitespace-pre-wrap">
                            {JSON.stringify(s.output_data, null, 2)}
                          </pre>
                        </div>
                      ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function RunStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "destructive" | "outline" | "secondary"; icon: React.ElementType | null }> = {
    completed: { label: "Concluido", variant: "outline", icon: CheckCircle2 },
    failed: { label: "Falhou", variant: "destructive", icon: XCircle },
    running: { label: "A executar", variant: "default", icon: null },
    pending: { label: "Pendente", variant: "secondary", icon: Clock },
    cancelled: { label: "Cancelado", variant: "secondary", icon: Clock },
  }
  const m = map[status] || map.pending
  const Icon = m.icon
  return (
    <Badge variant={m.variant} className="text-xs">
      {status === "running" ? (
        <Spinner variant="infinite" size={12} className="mr-1" />
      ) : Icon ? (
        <Icon className="mr-1 h-3 w-3" />
      ) : null}
      {m.label}
    </Badge>
  )
}

function DeliveryRow({ delivery }: { delivery: ExecutionDelivery }) {
  const isWpp = delivery.channel === "whatsapp"
  return (
    <div className="flex items-start gap-2 rounded-md border p-2 text-sm">
      {isWpp ? (
        <MessageCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
      ) : (
        <Mail className="h-4 w-4 text-sky-500 shrink-0 mt-0.5" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{delivery.recipient || "—"}</span>
          <Badge
            variant={delivery.delivery_status === "delivered" || delivery.delivery_status === "sent" ? "outline" : "destructive"}
            className="text-[10px] h-4"
          >
            {delivery.delivery_status}
          </Badge>
        </div>
        {delivery.message_preview && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {delivery.message_preview}
          </p>
        )}
        {delivery.error_detail && (
          <p className="text-xs text-red-500 mt-0.5">{delivery.error_detail}</p>
        )}
      </div>
    </div>
  )
}
