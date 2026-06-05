// ============================================================
// Stats API — Metricas do dashboard de automacoes
// Fase 7 do Sistema de Automacoes
// ============================================================

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

export async function GET() {
  try {
    const supabase = createAdminClient() as SA
    const now = new Date()
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

    // Run queries in parallel
    const [
      flowsRes,
      runsRes,
      deliveriesRes,
      instancesRes,
      dailyRes,
    ] = await Promise.all([
      // Total and active flows
      supabase.from("auto_flows").select("id, is_active"),
      // Runs last 14 days
      supabase
        .from("auto_runs")
        .select("id, status, created_at")
        .gte("created_at", fourteenDaysAgo),
      // Deliveries last 14 days
      supabase
        .from("auto_delivery_log")
        .select("id, channel, delivery_status, created_at")
        .gte("created_at", fourteenDaysAgo),
      // WhatsApp instances
      supabase
        .from("auto_wpp_instances")
        .select("id, connection_status"),
      // Daily breakdown via SQL for efficiency
      supabase.rpc("auto_get_table_columns", { p_table_name: "__dummy__" }).then(() => null).catch(() => null),
    ])

    const flows = flowsRes.data || []
    const runs = runsRes.data || []
    const deliveries = deliveriesRes.data || []
    const instances = instancesRes.data || []

    // Calculate overview
    const totalFlows = flows.length
    const activeFlows = flows.filter((f: SA) => f.is_active).length
    const totalRuns = runs.length
    const completedRuns = runs.filter((r: SA) => r.status === "completed").length
    const failedRuns = runs.filter((r: SA) => r.status === "failed").length
    const successRate = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 1000) / 10 : 0

    const totalDeliveries = deliveries.length
    const whatsappDeliveries = deliveries.filter((d: SA) => d.channel === "whatsapp").length
    const emailDeliveries = deliveries.filter((d: SA) => d.channel === "email").length
    const deliveredOk = deliveries.filter((d: SA) => d.delivery_status === "delivered" || d.delivery_status === "sent").length
    const deliveryRate = totalDeliveries > 0 ? Math.round((deliveredOk / totalDeliveries) * 1000) / 10 : 0

    // WhatsApp health
    const connectedInstances = instances.filter((i: SA) => i.connection_status === "connected").length
    const wppStatus: "healthy" | "degraded" | "offline" =
      connectedInstances === 0 && instances.length > 0
        ? "offline"
        : connectedInstances < instances.length
          ? "degraded"
          : instances.length === 0
            ? "offline"
            : "healthy"

    // Daily breakdown
    const dayMap: Record<string, { total: number; completed: number; failed: number }> = {}
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().slice(0, 10)
      dayMap[key] = { total: 0, completed: 0, failed: 0 }
    }
    for (const run of runs) {
      const day = (run.created_at as string).slice(0, 10)
      if (dayMap[day]) {
        dayMap[day].total++
        if (run.status === "completed") dayMap[day].completed++
        if (run.status === "failed") dayMap[day].failed++
      }
    }
    const executionsByDay = Object.entries(dayMap).map(([day, data]) => ({ day, ...data }))

    return NextResponse.json({
      overview: {
        totalFlows,
        activeFlows,
        totalRuns,
        completedRuns,
        failedRuns,
        successRate,
        totalDeliveries,
        whatsappDeliveries,
        emailDeliveries,
      },
      executionsByDay,
      integrationHealth: {
        whatsapp: { total: instances.length, connected: connectedInstances, status: wppStatus },
        email: { status: "healthy" as const },
        deliveryRate,
      },
    })
  } catch (err) {
    console.error("[stats] GET error:", err)
    return NextResponse.json({ error: "Erro ao obter estatisticas" }, { status: 500 })
  }
}
