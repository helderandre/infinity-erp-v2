"use client"

import { Calendar, Gift, Mail, MessageCircle, Pause, Play, Trash2, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { CustomEventWithCounts } from "@/types/custom-event"

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-emerald-100", text: "text-emerald-800", label: "Activo" },
  paused: { bg: "bg-amber-100", text: "text-amber-800", label: "Pausado" },
  archived: { bg: "bg-slate-100", text: "text-slate-700", label: "Arquivado" },
}

interface AutomationEventCardProps {
  event: CustomEventWithCounts & { isFixed?: boolean }
  onClick: () => void
  onPause?: () => void
  onDelete?: () => void
}

export function AutomationEventCard({ event, onClick, onPause, onDelete }: AutomationEventCardProps) {
  const status = STATUS_STYLES[event.status] ?? STATUS_STYLES.active
  const date = new Date(event.event_date + "T00:00:00")
  const dayMonth = date.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border bg-card p-4 cursor-pointer",
        "transition-all duration-200 hover:shadow-md hover:border-primary/30 hover:scale-[1.01]",
        event.status === "paused" && "opacity-70",
        event.status === "archived" && "opacity-50",
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <div className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          event.isFixed ? "bg-primary/10 text-primary" : "bg-violet-100 text-violet-700",
        )}>
          {event.isFixed ? <Calendar className="h-4.5 w-4.5" /> : <Gift className="h-4.5 w-4.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold truncate">{event.name}</h3>
            <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-medium shrink-0", status.bg, status.text)}>
              {status.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {dayMonth} · {String(event.send_hour).padStart(2, "0")}:00
          </p>
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

      {/* Recurrence badge */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[10px]">
          {event.is_recurring ? "Anual" : "Única vez"}
        </Badge>
        {event.last_sent_at && (
          <span className="text-[10px] text-muted-foreground">
            Último: {new Date(event.last_sent_at).toLocaleDateString("pt-PT")}
          </span>
        )}
      </div>

      {/* Quick actions (only for custom events) */}
      {!event.isFixed && (
        <div
          className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {onPause && event.status !== "archived" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onPause}
              title={event.status === "paused" ? "Reactivar" : "Pausar"}
            >
              {event.status === "paused" ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
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
