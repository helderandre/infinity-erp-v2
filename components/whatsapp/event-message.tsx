"use client"

import { useState, useEffect, useCallback } from "react"
import { CalendarDays, Clock, BellRing, XCircle, CalendarPlus, X, Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { CalendarEventForm } from "@/components/calendar/calendar-event-form"
import type { CalendarEventFormData } from "@/lib/validations/calendar"
import type { WppMessage, EventData } from "@/lib/types/whatsapp-web"

interface EventMessageProps {
  message: WppMessage
}

function formatEventDate(timestamp: number | null): string {
  if (!timestamp) return ""
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString("pt-PT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function formatEventTime(timestamp: number | null): string {
  if (!timestamp) return ""
  const date = new Date(timestamp * 1000)
  return date.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatReminderOffset(seconds: number | null): string {
  if (!seconds) return ""
  if (seconds < 60) return `${seconds}s antes`
  if (seconds < 3600) return `${Math.round(seconds / 60)} min antes`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h antes`
  return `${Math.round(seconds / 86400)} dia(s) antes`
}

function toISODateTimeLocal(timestamp: number | null): string {
  if (!timestamp) return ""
  const d = new Date(timestamp * 1000)
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

export function EventMessage({ message }: EventMessageProps) {
  const event = message.event_data as EventData | null
  const [formOpen, setFormOpen] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [removing, setRemoving] = useState(false)

  // Check if already saved on mount
  useEffect(() => {
    if (!event) {
      setChecking(false)
      return
    }
    let cancelled = false
    async function check() {
      try {
        const res = await fetch(`/api/whatsapp/messages/${message.id}/save-to-calendar`)
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setSavedId(data.calendar_event_id || null)
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setChecking(false)
      }
    }
    check()
    return () => { cancelled = true }
  }, [message.id, event])

  const handleSaveToCalendar = useCallback(async (data: CalendarEventFormData) => {
    const res = await fetch(`/api/whatsapp/messages/${message.id}/save-to-calendar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (res.status === 409) {
      const body = await res.json()
      setSavedId(body.id)
      toast.info("Este evento já está guardado no calendário")
      return
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || "Erro ao guardar")
    }

    const body = await res.json()
    setSavedId(body.id)
  }, [message.id])

  const handleRemoveFromCalendar = useCallback(async () => {
    setRemoving(true)
    try {
      const res = await fetch(`/api/whatsapp/messages/${message.id}/save-to-calendar`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error()
      setSavedId(null)
      toast.success("Evento removido do calendário")
    } catch {
      toast.error("Erro ao remover evento do calendário")
    } finally {
      setRemoving(false)
    }
  }, [message.id])

  if (!event) return null

  const name = event.name || message.text || "Evento"
  const startDate = formatEventDate(event.startTime)
  const startTime = formatEventTime(event.startTime)
  const endTime = formatEventTime(event.endTime)

  const initialData: Partial<CalendarEventFormData> = {
    title: name,
    description: event.hasReminder
      ? `Lembrete: ${formatReminderOffset(event.reminderOffsetSec)}`
      : undefined,
    category: "reminder",
    start_date: toISODateTimeLocal(event.startTime),
    end_date: toISODateTimeLocal(event.endTime),
    all_day: false,
    visibility: "private",
  }

  return (
    <>
      <div className="min-w-[260px] max-w-[320px]">
        <button
          type="button"
          onClick={() => !savedId && setFormOpen(true)}
          className="w-full text-left"
        >
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border hover:bg-muted/80 transition-colors cursor-pointer">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold truncate">{name}</p>
                {event.isCanceled && (
                  <span className="flex items-center gap-0.5 text-[10px] text-red-600 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded-full shrink-0">
                    <XCircle className="h-3 w-3" />
                    Cancelado
                  </span>
                )}
              </div>

              {startDate && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  <span>{startDate}</span>
                </div>
              )}

              {startTime && (
                <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {startTime}
                    {endTime && endTime !== startTime && ` – ${endTime}`}
                  </span>
                </div>
              )}

              {event.hasReminder && event.reminderOffsetSec && (
                <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                  <BellRing className="h-3.5 w-3.5 shrink-0" />
                  <span>{formatReminderOffset(event.reminderOffsetSec)}</span>
                </div>
              )}
            </div>
          </div>
        </button>

        {/* Tag: saved to calendar OR save button */}
        {!checking && (
          <div className="mt-1.5">
            {savedId ? (
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                  <Check className="h-3 w-3" />
                  Guardado no calendário
                </span>
                <button
                  type="button"
                  onClick={handleRemoveFromCalendar}
                  disabled={removing}
                  className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-destructive transition-colors px-1 py-0.5 rounded"
                  title="Remover do calendário"
                >
                  {removing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary hover:text-primary/80 px-2"
                onClick={() => setFormOpen(true)}
              >
                <CalendarPlus className="h-3.5 w-3.5 mr-1" />
                Guardar no calendário
              </Button>
            )}
          </div>
        )}
      </div>

      <CalendarEventForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSaveToCalendar}
        initialData={initialData}
      />
    </>
  )
}
