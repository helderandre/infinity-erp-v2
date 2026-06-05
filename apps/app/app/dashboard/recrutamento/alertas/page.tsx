"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { pt } from "date-fns/locale/pt"
import { toast } from "sonner"
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Phone,
  Calendar,
  ClipboardList,
  Flag,
  CheckCircle2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { getRecruitmentAlerts } from "@/app/dashboard/recrutamento/actions"
import type { RecruitmentAlert, AlertSeverity, AlertType } from "@/types/recruitment"
import { ALERT_TYPES, ALERT_SEVERITIES } from "@/types/recruitment"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_ICON: Record<AlertSeverity, React.ReactNode> = {
  urgent: <AlertTriangle className="h-4 w-4 text-red-600" />,
  warning: <AlertCircle className="h-4 w-4 text-amber-600" />,
  info: <Info className="h-4 w-4 text-blue-600" />,
}

const SEVERITY_CARD_STYLES: Record<AlertSeverity, string> = {
  urgent: "border-red-200 bg-red-50/50",
  warning: "border-amber-200 bg-amber-50/50",
  info: "border-blue-200 bg-blue-50/50",
}

function AlertTypeIcon({ type }: { type: AlertType }) {
  switch (type) {
    case "no_contact":
      return <Phone className="h-4 w-4" />
    case "follow_up_today":
      return <Calendar className="h-4 w-4" />
    case "interview_tomorrow":
      return <Calendar className="h-4 w-4" />
    case "onboarding_incomplete":
      return <ClipboardList className="h-4 w-4" />
    case "probation_milestone":
      return <Flag className="h-4 w-4" />
  }
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function AlertasPage() {
  const [alerts, setAlerts] = useState<RecruitmentAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"all" | AlertSeverity>("all")

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    const result = await getRecruitmentAlerts()
    if (result.error) {
      toast.error("Erro ao carregar alertas")
    } else {
      setAlerts(result.alerts)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  // Counts by severity
  const counts = useMemo(() => {
    const c = { urgent: 0, warning: 0, info: 0 }
    for (const a of alerts) c[a.severity]++
    return c
  }, [alerts])

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    if (activeTab === "all") return alerts
    return alerts.filter((a) => a.severity === activeTab)
  }, [alerts, activeTab])

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Alertas e Tarefas Pendentes</h1>
        <p className="text-muted-foreground text-sm">
          Acompanhe alertas importantes e accoes pendentes do recrutamento
        </p>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="border-red-200">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium">Urgentes</p>
                <p className="text-2xl font-bold text-red-700">{counts.urgent}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium">Avisos</p>
                <p className="text-2xl font-bold text-amber-700">{counts.warning}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-200">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <Info className="h-5 w-5" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium">Informativos</p>
                <p className="text-2xl font-bold text-blue-700">{counts.info}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "all" | AlertSeverity)}>
        <TabsList>
          <TabsTrigger value="all">
            Todos <Badge variant="secondary" className="ml-1.5 text-xs">{alerts.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="urgent">
            Urgentes <Badge variant="secondary" className="ml-1.5 text-xs">{counts.urgent}</Badge>
          </TabsTrigger>
          <TabsTrigger value="warning">
            Avisos <Badge variant="secondary" className="ml-1.5 text-xs">{counts.warning}</Badge>
          </TabsTrigger>
          <TabsTrigger value="info">
            Info <Badge variant="secondary" className="ml-1.5 text-xs">{counts.info}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Alert List */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : filteredAlerts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircle2 className="mb-3 h-12 w-12 text-emerald-500" />
            <p className="text-lg font-medium">Nenhum alerta pendente</p>
            <p className="text-muted-foreground text-sm">
              Tudo em dia! Nao existem alertas nesta categoria.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredAlerts.map((alert, idx) => (
            <Card key={`${alert.candidate_id}-${alert.type}-${idx}`} className={cn(SEVERITY_CARD_STYLES[alert.severity])}>
              <CardContent className="flex items-start gap-4 p-4">
                {/* Severity icon */}
                <div className="mt-0.5 shrink-0">{SEVERITY_ICON[alert.severity]}</div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={cn("text-xs", ALERT_SEVERITIES[alert.severity].color)}>
                      {ALERT_SEVERITIES[alert.severity].label}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <AlertTypeIcon type={alert.type} />
                      {ALERT_TYPES[alert.type].label}
                    </span>
                  </div>
                  <div className="mt-2">
                    <Link
                      href={`/dashboard/recrutamento/${alert.candidate_id}`}
                      className="text-primary text-sm font-medium hover:underline"
                    >
                      {alert.candidate_name}
                    </Link>
                    <p className="text-muted-foreground mt-0.5 text-sm">{alert.message}</p>
                  </div>
                  {alert.date && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {format(new Date(alert.date), "d 'de' MMMM, yyyy", { locale: pt })}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
