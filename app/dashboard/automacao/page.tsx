"use client"

import { Suspense, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { DashboardContent } from "@/components/automations/pages/dashboard-content"
import { FluxosContent } from "@/components/automations/pages/fluxos-content"
import { ExecucoesContent } from "@/components/automations/pages/execucoes-content"

type TabValue = "dashboard" | "fluxos" | "execucoes"

const VALID_TABS: TabValue[] = ["dashboard", "fluxos", "execucoes"]

function AutomacaoPageInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const tab: TabValue = VALID_TABS.includes(tabParam as TabValue)
    ? (tabParam as TabValue)
    : "dashboard"

  const setTab = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === "dashboard") {
        params.delete("tab")
      } else {
        params.set("tab", value)
      }
      params.delete("detail")
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    },
    [pathname, router, searchParams]
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Automações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral, automatismos e histórico de execuções
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList>
          <TabsTrigger value="dashboard">Visão Geral</TabsTrigger>
          <TabsTrigger value="fluxos">Automatismos</TabsTrigger>
          <TabsTrigger value="execucoes">Execuções</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <DashboardContent onOpenExecucoes={() => setTab("execucoes")} />
        </TabsContent>
        <TabsContent value="fluxos" className="mt-6">
          <FluxosContent />
        </TabsContent>
        <TabsContent value="execucoes" className="mt-6">
          <ExecucoesContent />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function AutomacaoPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-72" />
          <div className="space-y-3 mt-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </div>
      }
    >
      <AutomacaoPageInner />
    </Suspense>
  )
}
