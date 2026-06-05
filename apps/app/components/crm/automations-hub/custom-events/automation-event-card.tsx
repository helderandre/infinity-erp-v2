"use client"

import { useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { pt } from "date-fns/locale"
import { AlertTriangle, Calendar, Gift, Mail, MessageCircle, Pause, Play, Trash2, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { resolveHealthBucket, type HealthBucket } from "@/lib/automacao/resolve-health-bucket"
import type { CustomEventWithCounts, HealthSummaryRow } from "@/types/custom-event"

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-emerald-100", text: "text-emerald-800", label: "Activo" },
  paused: { bg: "bg-slate-100", text: "text-slate-700", label: "Desactivado" },
  archived: { bg: "bg-slate-100", text: "text-slate-700", label: "Desactivado" },
}

const DOT_STYLES: Record<HealthBucket, { bg: string; title: string }> = {
  completed_one_shot: { bg: "bg-emerald-600", title: "Concluído" },
  failures_unresolved: { bg: "bg-red-500", title: "Falhas por resolver" },
  ok: { bg: "bg-emerald-500", title: "A correr normalmente" },
  idle: { bg: "bg-slate-300", title: "Sem envios recentes" },
}

interface AutomationEventCardProps {
  event: CustomEventWithCounts & { isFixed?: boolean }
  health?: HealthSummaryRow
  onClick: () => void
  onFailuresClick?: () => void
  onPause?: () => void
  onDelete?: () => void
}

function useIsTouch() {
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const mq = window.matchMedia("(pointer: coarse)")
    const update = () => setIsTouch(mq.matches)
    update()
    mq.addEventListener?.("change", update)
    return () => mq.removeEventListener?.("change", update)
  }, [])
  return isTouch
}

function formatRelativePt(iso: string | null): string {
  if (!iso) return ""
  try {
    return formatDistanceToNow(new Date(iso), { locale: pt, addSuffix: true })
  } catch {
    return ""
  }
}

function formatShortDatePt(iso: string | null): string {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" })
  } catch {
    return ""
  }
}

export function AutomationEventCard({
  event,
  health,
  onClick,
  onFailuresClick,
  onPause,
  onDelete,
}: AutomationEventCardProps) {
  const status = STATUS_STYLES[event.status] ?? STATUS_STYLES.active
  const date = new Date(event.event_date + "T00:00:00")
  const dayMonth = date.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })

  const bucket = resolveHealthBucket(health)
  const dot = DOT_STYLES[bucket]
  const isCompleted = !!health?.completed_one_shot
  const failedCount = health?.failed_unresolved_count ?? 0
  const failedItems = health?.failed_unresolved ?? []
  const sent30d = health?.runs_last_30d.sent ?? 0
  const failed30d = health?.runs_last_30d.failed ?? 0
  const showCounts = failed30d > 0

  const isTouch = useIsTouch()

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border bg-card p-4 cursor-pointer",
        "transition-all duration-200 hover:shadow-md hover:border-primary/30 hover:scale-[1.01]",
        event.status === "paused" && "opacity-70",
        event.status === "archived" && "opacity-50",
        isCompleted && "opacity-[0.92]",
      )}
    >
      {/* Health dot */}
      <span
        aria-label={dot.title}
        title={dot.title}
        className={cn(
          "absolute top-3 right-3 h-2 w-2 rounded-full ring-2 ring-background",
          dot.bg,
        )}
      />

      {/* Header */}
      <div className="flex items-start gap-2.5 pr-5">
        <div className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          event.isFixed ? "bg-primary/10 text-primary" : "bg-violet-100 text-violet-700",
        )}>
          {event.isFixed ? <Calendar className="h-4.5 w-4.5" /> : <Gift className="h-4.5 w-4.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold truncate">{event.name}</h3>
            {isCompleted ? (
              <span className="rounded-md px-1.5 py-0.5 text-[10px] font-medium shrink-0 bg-emerald-50 text-emerald-700">
                Concluído
              </span>
            ) : (
              <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-medium shrink-0", status.bg, status.text)}>
                {status.label}
              </span>
            )}
          </div>
          {!isCompleted && (
            <p className="text-xs text-muted-foreground">
              {dayMonth} · {String(event.send_hour).padStart(2, "0")}:00
            </p>
          )}
        </div>
      </div>

      {/* Channels + leads count */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          <span>{event.lead_count} contacto{event.lead_count !== 1 ? "s" : ""}</span>
        </div>
        <span className="text-muted-foreground/40">·</span>
        <div className="flex gap-1">
          {event.channels.includes("email") && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-0.5">
              <Mail className="h-2.5 w-2.5" /> Email
            </Badge>
          )}
          {event.channels.includes("whatsapp") && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-0.5">
              <MessageCircle className="h-2.5 w-2.5" /> WPP
            </Badge>
          )}
        </div>
      </div>

      {/* Últimas execuções */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground min-h-[18px]">
        <HealthSummaryLine
          bucket={bucket}
          health={health}
          lastRunAt={health?.last_run_at ?? null}
        />
        {showCounts && health && (
          <span className="inline-flex items-center gap-1.5 shrink-0">
            <span className="text-muted-foreground/70">·</span>
            <span className="text-muted-foreground">✓ {sent30d}</span>
            <span className="text-red-600 font-medium">✕ {failed30d}</span>
          </span>
        )}
        {failedCount > 0 && onFailuresClick && (
          <FailuresBadge
            count={failedCount}
            items={failedItems}
            suppressTooltip={isTouch}
            onClick={(e) => {
              e.stopPropagation()
              onFailuresClick()
            }}
          />
        )}
      </div>

      {/* Recurrence badge */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[10px]">
          {event.is_recurring ? "Anual" : "Única vez"}
        </Badge>
      </div>

      {/* Quick actions (only for custom events) */}
      {!event.isFixed && (
        <div
          className="absolute top-8 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {onPause && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onPause}
              title={event.status === "active" ? "Desactivar" : "Reactivar"}
            >
              {event.status === "active" ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onDelete}
              title="Eliminar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function HealthSummaryLine({
  bucket,
  health,
  lastRunAt,
}: {
  bucket: HealthBucket
  health: HealthSummaryRow | undefined
  lastRunAt: string | null
}) {
  if (!health || !lastRunAt) {
    return <span className="text-muted-foreground/70">Sem envios ainda</span>
  }
  if (bucket === "completed_one_shot") {
    return <span>Concluído em {formatShortDatePt(lastRunAt)}</span>
  }
  return <span>Último envio: {formatRelativePt(lastRunAt)}</span>
}

function FailuresBadge({
  count,
  items,
  suppressTooltip,
  onClick,
}: {
  count: number
  items: { lead_name: string | null }[]
  suppressTooltip: boolean
  onClick: (e: React.MouseEvent) => void
}) {
  const label = `${count} falha${count === 1 ? "" : "s"}`
  const names = items.map((i) => i.lead_name).filter((n): n is string => !!n).slice(0, 5)
  const extra = Math.max(0, count - names.length)
  const tooltipText = [...names, extra > 0 ? `+${extra}` : null].filter(Boolean).join(", ")

  const button = (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 hover:bg-red-100 transition-colors"
    >
      <AlertTriangle className="h-2.5 w-2.5" />
      {label}
    </button>
  )

  if (suppressTooltip || tooltipText.length === 0) return button

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] text-xs">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
