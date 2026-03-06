"use client"

import { useEffect, useState } from "react"
import {
  Workflow,
  Play,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Mail,
  TrendingUp,
  Send,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import ReactEChartsCore from "echarts-for-react/lib/core"
import * as echarts from "echarts/core"
import { BarChart } from "echarts/charts"
import { GridComponent, TooltipComponent, LegendComponent } from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"

echarts.use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

interface StatsData {
  overview: {
    totalFlows: number
    activeFlows: number
    totalRuns: number
    completedRuns: number
    failedRuns: number
    successRate: number
    totalDeliveries: number
    whatsappDeliveries: number
    emailDeliveries: number
  }
  executionsByDay: { day: string; total: number; completed: number; failed: number }[]
  integrationHealth: {
    whatsapp: { total: number; connected: number; status: string }
    email: { status: string }
    deliveryRate: number
  }
}

export function StatsCards() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/automacao/stats")
        const json = await res.json()
        if (res.ok) setStats(json)
      } catch (err) {
        console.error("[StatsCards] error:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) return null

  const { overview, integrationHealth } = stats

  const cards = [
    {
      title: "Fluxos",
      icon: Workflow,
      value: overview.totalFlows,
      subtitle: `${overview.activeFlows} activos`,
      color: "text-blue-600",
    },
    {
      title: "Execuções",
      icon: Play,
      value: overview.totalRuns,
      subtitle: "últimos 14 dias",
      color: "text-violet-600",
    },
    {
      title: "Taxa Sucesso",
      icon: TrendingUp,
      value: `${overview.successRate}%`,
      subtitle: `${overview.failedRuns} falha${overview.failedRuns !== 1 ? "s" : ""}`,
      color: overview.successRate >= 90 ? "text-emerald-600" : overview.successRate >= 70 ? "text-yellow-600" : "text-red-600",
    },
    {
      title: "Entregas",
      icon: Send,
      value: overview.totalDeliveries,
      subtitle: `${overview.whatsappDeliveries} WPP / ${overview.emailDeliveries} Email`,
      color: "text-emerald-600",
    },
  ]

  return (
    <div className="space-y-4">
      {/* Top cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={cn("h-4 w-4", card.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{card.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart + Health */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        {/* Mini bar chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Execuções - Últimos 14 dias</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniBarChart data={stats.executionsByDay} />
          </CardContent>
        </Card>

        {/* Integration health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Saúde das Integrações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={cn(
                "h-2 w-2 rounded-full",
                integrationHealth.whatsapp.status === "healthy" ? "bg-emerald-500" :
                integrationHealth.whatsapp.status === "degraded" ? "bg-yellow-500" : "bg-red-500"
              )} />
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">WhatsApp: {integrationHealth.whatsapp.connected} online</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn(
                "h-2 w-2 rounded-full",
                integrationHealth.email.status === "healthy" ? "bg-emerald-500" : "bg-red-500"
              )} />
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Email: Activo</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Taxa de entrega: {integrationHealth.deliveryRate}%</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MiniBarChart({ data }: { data: { day: string; total: number; completed: number; failed: number }[] }) {
  const days = data.map((d) =>
    new Date(d.day + "T00:00:00").toLocaleDateString("pt-PT", { day: "numeric", month: "short" })
  )

  const option: echarts.EChartsCoreOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    legend: {
      data: ["Concluídas", "Falhadas"],
      bottom: 0,
      textStyle: { fontSize: 11 },
    },
    grid: {
      left: 30,
      right: 8,
      top: 8,
      bottom: 28,
      containLabel: false,
    },
    xAxis: {
      type: "category",
      data: days,
      axisLabel: { fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      axisLabel: { fontSize: 10 },
      splitLine: { lineStyle: { type: "dashed", opacity: 0.3 } },
    },
    series: [
      {
        name: "Concluídas",
        type: "bar",
        stack: "total",
        data: data.map((d) => d.completed),
        itemStyle: { color: "#34d399", borderRadius: [0, 0, 0, 0] },
        barMaxWidth: 24,
      },
      {
        name: "Falhadas",
        type: "bar",
        stack: "total",
        data: data.map((d) => d.failed),
        itemStyle: { color: "#f87171", borderRadius: [2, 2, 0, 0] },
        barMaxWidth: 24,
      },
    ],
  }

  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      style={{ height: 180 }}
      notMerge
      lazyUpdate
    />
  )
}
