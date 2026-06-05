"use client"

import Link from "next/link"
import {
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
} from "lucide-react"
import { Spinner } from "@/components/kibo-ui/spinner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { StatsCards } from "@/components/automations/stats-cards"
import { useExecutions, type ExecutionRun } from "@/hooks/use-executions"
import { formatDistanceToNow } from "date-fns"
import { pt } from "date-fns/locale"

const STATUS_CONFIG: Record<string, { icon: React.ElementType | null; color: string; label: string }> = {
  completed: { icon: CheckCircle2, color: "text-emerald-500", label: "Concluído" },
  failed: { icon: XCircle, color: "text-red-500", label: "Falhou" },
  running: { icon: null, color: "text-blue-500", label: "A executar" },
  pending: { icon: Clock, color: "text-slate-400", label: "Pendente" },
}

export function DashboardContent({ onOpenExecucoes }: { onOpenExecucoes?: () => void }) {
  const { executions, loading } = useExecutions({ limit: 8 })

  return (
    <div className="flex flex-col gap-6">
      <StatsCards />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">Últimas Execuções</CardTitle>
          {onOpenExecucoes ? (
            <Button variant="ghost" size="sm" className="text-xs" onClick={onOpenExecucoes}>
              Ver todas <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" asChild className="text-xs">
              <Link href="/dashboard/automacao?tab=execucoes">
                Ver todas <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : executions.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhuma execução registada. Teste um automatismo para começar.
            </div>
          ) : (
            <div className="space-y-1">
              {executions.map((exec) => (
                <RecentExecutionRow key={exec.id} execution={exec} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function RecentExecutionRow({ execution }: { execution: ExecutionRun }) {
  const config = STATUS_CONFIG[execution.status] || STATUS_CONFIG.pending
  const Icon = config.icon
  const flowName = execution.auto_flows?.name || "Automatismo"
  const timeAgo = execution.created_at
    ? formatDistanceToNow(new Date(execution.created_at), { locale: pt, addSuffix: true })
    : ""

  return (
    <Link
      href={`/dashboard/automacao?tab=execucoes&detail=${execution.id}`}
      className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors"
    >
      {execution.status === "running" ? (
        <Spinner variant="infinite" size={16} className={`shrink-0 ${config.color}`} />
      ) : (
        Icon ? <Icon className={`h-4 w-4 shrink-0 ${config.color}`} /> : null
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{flowName}</p>
        <p className="text-xs text-muted-foreground">
          {execution.completed_steps}/{execution.total_steps} passos {timeAgo && `\u00B7 ${timeAgo}`}
        </p>
      </div>
      <Badge variant="outline" className="text-[10px] shrink-0">
        {config.label}
      </Badge>
    </Link>
  )
}
