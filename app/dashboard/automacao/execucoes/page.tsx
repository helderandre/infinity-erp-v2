"use client"


import { useCallback, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Ban,
  Filter,
} from "lucide-react"
import { Spinner } from "@/components/kibo-ui/spinner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useExecutions, type ExecutionRun } from "@/hooks/use-executions"
import { useFlows } from "@/hooks/use-flows"
import { ExecutionTimeline } from "@/components/automations/execution-timeline"
import { ExecutionDetailSheet } from "@/components/automations/execution-detail-sheet"
import type { RealtimeStep } from "@/hooks/use-realtime-execution"
import { formatDistanceToNow } from "date-fns"
import { pt } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Suspense } from "react"

const STATUS_CONFIG: Record<string, { icon: React.ElementType | null; color: string; label: string }> = {
  completed: { icon: CheckCircle2, color: "text-emerald-500", label: "Concluído" },
  failed: { icon: XCircle, color: "text-red-500", label: "Falhou" },
  running: { icon: null, color: "text-blue-500", label: "A executar" },
  pending: { icon: Clock, color: "text-slate-400", label: "Pendente" },
  cancelled: { icon: Ban, color: "text-slate-400", label: "Cancelado" },
}

function ExecucoesContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const detailId = searchParams.get("detail")

  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [flowFilter, setFlowFilter] = useState<string>("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(!!detailId)
  const [selectedExecId, setSelectedExecId] = useState<string | null>(detailId)

  const { flows } = useFlows()
  const {
    executions,
    total,
    loading,
    page,
    totalPages,
    fetchExecutions,
    retryExecution,
    nextPage,
    prevPage,
  } = useExecutions({
    status: statusFilter !== "all" ? statusFilter : undefined,
    flowId: flowFilter !== "all" ? flowFilter : undefined,
    limit: 30,
  })

  // Open detail sheet from URL param
  useEffect(() => {
    if (detailId) {
      setSelectedExecId(detailId)
      setSheetOpen(true)
    }
  }, [detailId])

  const openDetail = (id: string) => {
    setSelectedExecId(id)
    setSheetOpen(true)
  }

  const handleRetry = useCallback(async (execId: string) => {
    const ok = await retryExecution(execId)
    if (ok) {
      toast.success("Steps falhados reenviados")
      fetchExecutions(0)
    } else {
      toast.error("Erro ao reenviar")
    }
  }, [retryExecution, fetchExecutions])

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header + Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Execuções</h1>
          <p className="text-sm text-muted-foreground">{total} execuções</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estados</SelectItem>
              <SelectItem value="completed">Concluídos</SelectItem>
              <SelectItem value="failed">Falhados</SelectItem>
              <SelectItem value="running">A executar</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
            </SelectContent>
          </Select>
          <Select value={flowFilter} onValueChange={setFlowFilter}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Automatismo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os automatismos</SelectItem>
              {flows.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => fetchExecutions(0)}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-4 w-48" />
                <div className="flex-1" />
                <Skeleton className="h-5 w-20" />
              </div>
              <Skeleton className="h-3 w-64" />
            </div>
          ))}
        </div>
      ) : executions.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">
          Nenhuma execução encontrada com os filtros actuais.
        </div>
      ) : (
        <div className="space-y-2">
          {executions.map((exec) => (
            <ExecutionCard
              key={exec.id}
              execution={exec}
              isExpanded={expandedId === exec.id}
              onToggle={() => setExpandedId(expandedId === exec.id ? null : exec.id)}
              onOpenDetail={() => openDetail(exec.id)}
              onRetry={() => handleRetry(exec.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <Button variant="outline" size="sm" onClick={prevPage} disabled={page <= 1}>
            <ChevronLeft className="mr-1 h-3.5 w-3.5" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={nextPage} disabled={page >= totalPages}>
            Próxima
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Detail sheet */}
      <ExecutionDetailSheet
        executionId={selectedExecId}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) {
            setSelectedExecId(null)
            // Remove detail param from URL
            if (detailId) {
              router.replace("/dashboard/automacao/execucoes")
            }
          }
        }}
        onRetried={() => fetchExecutions(0)}
      />
    </div>
  )
}

function ExecutionCard({
  execution,
  isExpanded,
  onToggle,
  onOpenDetail,
  onRetry,
}: {
  execution: ExecutionRun
  isExpanded: boolean
  onToggle: () => void
  onOpenDetail: () => void
  onRetry: () => void
}) {
  const config = STATUS_CONFIG[execution.status] || STATUS_CONFIG.pending
  const Icon = config.icon
  const flowName = execution.auto_flows?.name || "Automatismo"
  const timeAgo = execution.created_at
    ? formatDistanceToNow(new Date(execution.created_at), { locale: pt, addSuffix: true })
    : ""
  const hasFailed = execution.status === "failed"

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className={cn("rounded-lg border transition-colors", isExpanded && "border-muted-foreground/20")}>
        <div className="flex items-center gap-3 p-4">
          <CollapsibleTrigger asChild>
            <button type="button" className="flex items-center gap-3 min-w-0 flex-1 text-left">
              {execution.status === "running" ? (
                <Spinner variant="infinite" size={20} className={cn("shrink-0", config.color)} />
              ) : Icon ? (
                <Icon className={cn("h-5 w-5 shrink-0", config.color)} />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{flowName}</p>
                <p className="text-xs text-muted-foreground">
                  {execution.completed_steps}/{execution.total_steps} passos
                  {execution.failed_steps > 0 && ` \u00B7 ${execution.failed_steps} falha${execution.failed_steps > 1 ? "s" : ""}`}
                  {timeAgo && ` \u00B7 ${timeAgo}`}
                </p>
              </div>
            </button>
          </CollapsibleTrigger>
          <div className="flex items-center gap-2">
            {hasFailed && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={onRetry}
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                Reenviar
              </Button>
            )}
            <Badge variant="outline" className="text-[10px]">
              {config.label}
            </Badge>
          </div>
        </div>

        <CollapsibleContent>
          <div className="border-t px-4 py-3 space-y-3">
            <ExpandedSteps executionId={execution.id} />
            <Button variant="ghost" size="sm" className="text-xs" onClick={onOpenDetail}>
              Ver detalhes completos
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function ExpandedSteps({ executionId }: { executionId: string }) {
  const { getDetail } = useExecutions({ autoFetch: false })
  const [steps, setSteps] = useState<RealtimeStep[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDetail(executionId).then((d) => {
      if (d) {
        setSteps(
          d.steps.map((s) => ({
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
        )
      }
      setLoading(false)
    })
  }, [executionId, getDetail])

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    )
  }

  const completedSteps = steps.filter((s) => s.status === "completed").length
  const failedSteps = steps.filter((s) => s.status === "failed").length
  const isFinished = steps.length > 0 && !steps.some((s) => s.status === "running" || s.status === "pending")
  const overallStatus: "idle" | "running" | "completed" | "failed" =
    failedSteps > 0 && isFinished ? "failed" : isFinished ? "completed" : "running"

  return (
    <ExecutionTimeline
      steps={steps}
      totalSteps={steps.length}
      completedSteps={completedSteps}
      failedSteps={failedSteps}
      overallStatus={overallStatus}
      compact
    />
  )
}

function ExecucoesPageInner() {
  return (
    <Suspense
      fallback={
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </div>
      }
    >
      <ExecucoesContent />
    </Suspense>
  )
}

export default function ExecucoesPage() {
  return (
    <Suspense fallback={null}>
      <ExecucoesPageInner />
    </Suspense>
  )
}

