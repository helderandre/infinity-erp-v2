"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Calendar, Gift, Mail, MessageCircle, Settings2,
  BellOff, Bell,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { FixedEventOverrideDialog } from "./fixed-event-override-dialog"

const FIXED_EVENTS = [
  { key: "aniversario_contacto", label: "Aniversario do contacto", month: 0, day: 1, defaultHour: 9, needsBirthday: true },
  { key: "natal", label: "Natal", month: 11, day: 25, defaultHour: 5, needsBirthday: false },
  { key: "ano_novo", label: "Ano Novo", month: 11, day: 31, defaultHour: 5, needsBirthday: false },
] as const

interface Props {
  leadId: string
  birthday: string | null
}

interface Setting {
  event_type: string
  send_hour: number | null
  email_template_id: string | null
  wpp_template_id: string | null
  smtp_account_id: string | null
  wpp_instance_id: string | null
}

interface Mute {
  id: string
  event_type: string | null
  channel: string | null
  lead_id: string | null
  consultant_id: string | null
}

interface CustomEventEnrolled {
  id: string
  name: string
  event_date: string
  send_hour: number
  is_recurring: boolean
  channels: string[]
  status: string
  enrolled_at: string
}

type EventCardData = {
  id: string
  name: string
  dateLabel: string
  hour: number
  channels: string[]
  isFixed: boolean
  eventKey: string
  status: "active" | "personalizado" | "muted" | "disabled"
  isRecurring: boolean
}

export function FixedEventsSection({ leadId, birthday }: Props) {
  const [settings, setSettings] = useState<Setting[]>([])
  const [mutes, setMutes] = useState<Mute[]>([])
  const [customEvents, setCustomEvents] = useState<CustomEventEnrolled[]>([])
  const [isLoading, setLoading] = useState(true)
  const [dialogEvent, setDialogEvent] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, mRes, ceRes] = await Promise.all([
        fetch(`/api/leads/${leadId}/automation-settings`),
        fetch(`/api/contact-automation-mutes?lead_id=${leadId}`),
        fetch(`/api/leads/${leadId}/custom-events`),
      ])
      const sJson = await sRes.json()
      const mJson = await mRes.json()
      const ceJson = await ceRes.json()
      setSettings(sJson.settings ?? [])
      setMutes(mJson.mutes ?? [])
      setCustomEvents(ceJson.events ?? [])
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  function muteExists(eventType: string) {
    return mutes.find(
      (m) =>
        m.lead_id === leadId &&
        m.event_type === eventType &&
        m.channel === null,
    )
  }

  async function toggleMute(eventType: string) {
    const existing = muteExists(eventType)
    try {
      if (existing) {
        const res = await fetch(`/api/contact-automation-mutes?id=${existing.id}`, { method: "DELETE" })
        if (!res.ok) throw new Error((await res.json()).error ?? "Erro")
        toast.success("Automatismo reactivado")
      } else {
        const res = await fetch(`/api/contact-automation-mutes`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lead_id: leadId, event_type: eventType, channel: null }),
        })
        if (!res.ok) throw new Error((await res.json()).error ?? "Erro")
        toast.success("Automatismo desactivado")
      }
      void fetchAll()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  // Build card data for fixed events
  const fixedCards: EventCardData[] = FIXED_EVENTS.map((evt) => {
    const muted = !!muteExists(evt.key)
    const override = settings.find((s) => s.event_type === evt.key)
    const disabled = evt.needsBirthday && !birthday
    const hour = override?.send_hour ?? evt.defaultHour

    let dateLabel: string
    if (evt.key === "aniversario_contacto" && birthday) {
      const bd = new Date(birthday + "T00:00:00")
      dateLabel = bd.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })
    } else if (evt.key === "aniversario_contacto") {
      dateLabel = "—"
    } else {
      const d = new Date(2026, evt.month, evt.day)
      dateLabel = d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })
    }

    return {
      id: `fixed-${evt.key}`,
      name: evt.label,
      dateLabel,
      hour,
      channels: ["email", "whatsapp"],
      isFixed: true,
      eventKey: evt.key,
      status: disabled ? "disabled" : muted ? "muted" : override ? "personalizado" : "active",
      isRecurring: true,
    }
  })

  // Build card data for custom events
  const customCards: EventCardData[] = customEvents
    .filter((e) => e.status === "active")
    .map((evt) => {
      const muted = !!muteExists(evt.name)
      const d = new Date(evt.event_date + "T00:00:00")
      const dateLabel = d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })

      return {
        id: evt.id,
        name: evt.name,
        dateLabel,
        hour: evt.send_hour,
        channels: evt.channels,
        isFixed: false,
        eventKey: evt.name,
        status: muted ? "muted" : "active",
        isRecurring: evt.is_recurring,
      }
    })

  const allCards = [...fixedCards, ...customCards]

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Automatismos deste contacto</h3>
        <p className="text-xs text-muted-foreground">
          Eventos fixos e personalizados. Clique para personalizar ou desactivar.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {allCards.map((card) => (
          <EventCard
            key={card.id}
            card={card}
            onCustomize={() => setDialogEvent(card.eventKey)}
            onToggleMute={() => void toggleMute(card.eventKey)}
          />
        ))}

      </div>

      {dialogEvent && (
        <FixedEventOverrideDialog
          leadId={leadId}
          eventType={dialogEvent}
          open={!!dialogEvent}
          onOpenChange={(o) => !o && setDialogEvent(null)}
          onSaved={() => {
            setDialogEvent(null)
            void fetchAll()
          }}
        />
      )}
    </div>
  )
}

// ─── Event Card ───

const STATUS_CONFIG = {
  active: { bg: "bg-emerald-100", text: "text-emerald-800", label: "Activo" },
  personalizado: { bg: "bg-blue-100", text: "text-blue-800", label: "Personalizado" },
  muted: { bg: "bg-slate-100", text: "text-slate-700", label: "Desactivado" },
  disabled: { bg: "bg-slate-100", text: "text-slate-500", label: "Indisponível" },
} as const

function EventCard({
  card,
  onCustomize,
  onToggleMute,
}: {
  card: EventCardData
  onCustomize: () => void
  onToggleMute: () => void
}) {
  const status = STATUS_CONFIG[card.status]
  const isDisabled = card.status === "disabled"

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border bg-card p-4",
        "transition-all duration-200",
        isDisabled && "opacity-50",
        card.status === "muted" && "opacity-70",
        !isDisabled && "hover:shadow-md hover:border-primary/30",
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <div className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          card.isFixed ? "bg-primary/10 text-primary" : "bg-violet-100 text-violet-700",
        )}>
          {card.isFixed ? <Calendar className="h-4.5 w-4.5" /> : <Gift className="h-4.5 w-4.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold truncate">{card.name}</h3>
            <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-medium shrink-0", status.bg, status.text)}>
              {status.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {card.dateLabel} · {String(card.hour).padStart(2, "0")}:00
          </p>
        </div>
      </div>

      {/* Channels */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="flex gap-1">
          {card.channels.includes("email") && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-0.5">
              <Mail className="h-2.5 w-2.5" /> Email
            </Badge>
          )}
          {card.channels.includes("whatsapp") && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-0.5">
              <MessageCircle className="h-2.5 w-2.5" /> WPP
            </Badge>
          )}
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {card.isRecurring ? "Anual" : "Única vez"}
        </Badge>
      </div>

      {/* Actions */}
      {!isDisabled && (
        <div className="flex items-center gap-1 pt-1 border-t">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1"
            onClick={onCustomize}
          >
            <Settings2 className="h-3.5 w-3.5" />
            Personalizar
          </Button>
          <Button
            size="sm"
            variant={card.status === "muted" ? "default" : "ghost"}
            className={cn("h-7 text-xs gap-1", card.status === "muted" && "bg-emerald-600 hover:bg-emerald-700")}
            onClick={onToggleMute}
          >
            {card.status === "muted" ? (
              <>
                <Bell className="h-3.5 w-3.5" /> Activar
              </>
            ) : (
              <>
                <BellOff className="h-3.5 w-3.5" /> Desactivar
              </>
            )}
          </Button>
        </div>
      )}

      {isDisabled && (
        <p className="text-[11px] text-muted-foreground italic">
          Sem data de nascimento definida
        </p>
      )}
    </div>
  )
}
