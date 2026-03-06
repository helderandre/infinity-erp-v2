"use client"

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
} from "lucide-react"
import { Spinner } from "@/components/kibo-ui/spinner"
import { cn } from "@/lib/utils"
import type { RealtimeStep } from "@/hooks/use-realtime-execution"
import { Progress } from "@/components/ui/progress"

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
  trigger_status: "Mudança de Estado",
  trigger_schedule: "Agendamento",
  trigger_manual: "Manual",
  whatsapp: "WhatsApp",
  email: "Email",
  delay: "Aguardar",
  condition: "Condição",
  supabase_query: "Consulta Banco",
  task_lookup: "Buscar Entidade",
  set_variable: "Definir Variável",
  http_request: "HTTP Request",
  webhook_response: "Responder Webhook",
  notification: "Notificação",
}

const STATUS_STYLES: Record<string, { icon: React.ElementType | null; color: string; bg: string }> = {
  completed: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  failed: { icon: XCircle, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/30" },
  running: { icon: null, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30" },
  pending: { icon: Clock, color: "text-slate-400", bg: "bg-slate-50 dark:bg-slate-900/30" },
  cancelled: { icon: Ban, color: "text-slate-400", bg: "bg-slate-50 dark:bg-slate-900/30" },
}

interface ExecutionTimelineProps {
  steps: RealtimeStep[]
  totalSteps: number
  completedSteps: number
  failedSteps: number
  overallStatus: "idle" | "running" | "completed" | "failed"
  compact?: boolean
}

export function ExecutionTimeline({
  steps,
  totalSteps,
  completedSteps,
  failedSteps,
  overallStatus,
  compact = false,
}: ExecutionTimelineProps) {
  const progress = totalSteps > 0 ? Math.round(((completedSteps + failedSteps) / totalSteps) * 100) : 0

  return (
    <div className="space-y-3">
      {/* Progress header */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {overallStatus === "running" && "Execução a decorrer..."}
            {overallStatus === "completed" && "Execução concluída"}
            {overallStatus === "failed" && "Execução com falhas"}
            {overallStatus === "idle" && "A aguardar"}
          </span>
          <span className="text-muted-foreground tabular-nums">
            {completedSteps + failedSteps}/{totalSteps} passos
          </span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Steps */}
      <div className="space-y-1">
        {steps.map((step) => {
          const statusStyle = STATUS_STYLES[step.status] || STATUS_STYLES.pending
          const StatusIcon = statusStyle.icon
          const NodeIcon = NODE_TYPE_ICONS[step.node_type] || Play
          const nodeLabel = step.node_label || NODE_TYPE_LABELS[step.node_type] || step.node_type

          return (
            <div
              key={step.id}
              className={cn(
                "flex items-start gap-2.5 rounded-md px-2.5 py-2 transition-colors",
                statusStyle.bg
              )}
            >
              {/* Status icon */}
              <div className={cn("mt-0.5 shrink-0", statusStyle.color)}>
                {step.status === "running" ? (
                  <Spinner variant="infinite" size={16} />
                ) : StatusIcon ? (
                  <StatusIcon className="h-4 w-4" />
                ) : null}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <NodeIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{nodeLabel}</span>
                </div>

                {!compact && (
                  <>
                    {/* Duration */}
                    {step.duration_ms != null && step.status === "completed" && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {step.duration_ms < 1000
                          ? `${step.duration_ms}ms`
                          : `${(step.duration_ms / 1000).toFixed(1)}s`}
                      </p>
                    )}

                    {/* Error */}
                    {step.error_message && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 line-clamp-2">
                        {step.error_message}
                      </p>
                    )}

                    {/* Scheduled for (delay nodes) */}
                    {step.status === "pending" && step.scheduled_for && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Agendado para {new Date(step.scheduled_for).toLocaleString("pt-PT")}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Time */}
              {step.started_at && (
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 mt-0.5">
                  {new Date(step.started_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              )}
            </div>
          )
        })}

        {steps.length === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            A aguardar execução...
          </div>
        )}
      </div>
    </div>
  )
}
