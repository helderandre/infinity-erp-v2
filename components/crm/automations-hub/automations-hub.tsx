"use client"

import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, ArrowRight, Bell, Calendar, History, FileCode2, Settings } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useChannelAvailability } from "@/hooks/use-automation-detail"
import { ScheduledTab } from "./scheduled-tab"
import { RunsTab } from "./runs-tab"
import { MyTemplatesTab } from "./my-templates-tab"
import { AccountsTab } from "./accounts-tab"

type TabKey = "automatismos" | "execucoes" | "templates" | "configuracoes"

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "automatismos", label: "Automatismos", icon: Calendar },
  { key: "execucoes", label: "Execuções", icon: History },
  { key: "templates", label: "Templates", icon: FileCode2 },
  { key: "configuracoes", label: "Canais de Envio", icon: Settings },
]

interface AutomationsHubProps {
  userId: string
  isBroker: boolean
  canSeeAll: boolean
}

export function AutomationsHub({ userId, isBroker, canSeeAll }: AutomationsHubProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab") as TabKey | null
  const activeTab: TabKey = tabParam && TABS.some((t) => t.key === tabParam) ? tabParam : "automatismos"

  function setTab(tab: TabKey) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", tab)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="space-y-5">
      {/* ═══ Hero header ═══ */}
      <div className="relative overflow-hidden rounded-2xl bg-neutral-900 px-6 sm:px-8 py-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-white/15 backdrop-blur-sm">
              <Bell className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Automatismos de Contactos
            </h1>
          </div>

          {/* Tab selector — inside hero */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 overflow-x-auto scrollbar-hide w-fit max-w-full">
            {TABS.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300",
                    activeTab === t.key
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-300 hover:text-white hover:bg-white/10",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ═══ Aviso: canais sem conta/instância ═══ */}
      {activeTab !== "configuracoes" && (
        <ChannelAvailabilityBanner onGoToChannels={() => setTab("configuracoes")} />
      )}

      {/* ═══ Tab content ═══ */}
      <div className="animate-in fade-in duration-300">
        {activeTab === "automatismos" && (
          <Suspense fallback={<Skeleton className="h-96" />}>
            <ScheduledTab userId={userId} canSeeAll={canSeeAll} />
          </Suspense>
        )}
        {activeTab === "execucoes" && (
          <Suspense fallback={<Skeleton className="h-96" />}>
            <RunsTab userId={userId} canSeeAll={canSeeAll} />
          </Suspense>
        )}
        {activeTab === "templates" && (
          <Suspense fallback={<Skeleton className="h-96" />}>
            <MyTemplatesTab userId={userId} />
          </Suspense>
        )}
        {activeTab === "configuracoes" && (
          <Suspense fallback={<Skeleton className="h-96" />}>
            <AccountsTab />
          </Suspense>
        )}
      </div>
    </div>
  )
}

function ChannelAvailabilityBanner({ onGoToChannels }: { onGoToChannels: () => void }) {
  const { availability } = useChannelAvailability()
  if (!availability) return null

  const emailMissing = !availability.email.available
  const wppMissing = !availability.whatsapp.available
  if (!emailMissing && !wppMissing) return null

  const missing: string[] = []
  if (emailMissing) missing.push("conta de email")
  if (wppMissing) missing.push("instância WhatsApp")
  const missingText = missing.join(" e ")

  return (
    <button
      type="button"
      onClick={onGoToChannels}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-left transition-colors",
        "hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/30 dark:hover:bg-amber-950/50",
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200/60 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
          Faltam canais de envio configurados
        </p>
        <p className="text-xs text-amber-800/80 dark:text-amber-200/70">
          Os seus automatismos não vão enviar nada enquanto não tiver {missingText}.
          Configure em Canais de Envio.
        </p>
      </div>
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-200/70 px-3 py-1 text-xs font-medium text-amber-900 transition-transform group-hover:translate-x-0.5 dark:bg-amber-900/50 dark:text-amber-200">
        Configurar
        <ArrowRight className="h-3 w-3" />
      </span>
    </button>
  )
}
