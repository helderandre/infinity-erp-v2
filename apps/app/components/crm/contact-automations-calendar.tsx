"use client"

import { useEffect, useMemo, useState } from "react"
import { parseISO, format } from "date-fns"
import { pt } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import type { ContactAutomationWithLastRun } from "@/hooks/use-contact-automations"
import { CONTACT_AUTOMATION_EVENT_LABELS_PT } from "@/types/contact-automation"

type RunSummary = {
  id: string
  contact_automation_id: string
  scheduled_for: string
  sent_at: string | null
  status: string
}

type DayMarker = {
  kind: "scheduled" | "sent" | "failed" | "skipped" | "pending"
  label: string
}

function dayKey(iso: string): string {
  const d = parseISO(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

const KIND_COLOR: Record<DayMarker["kind"], string> = {
  scheduled: "bg-sky-500",
  sent: "bg-emerald-500",
  failed: "bg-red-500",
  skipped: "bg-amber-500",
  pending: "bg-slate-400",
}

const KIND_LABEL: Record<DayMarker["kind"], string> = {
  scheduled: "Agendado",
  sent: "Enviado",
  failed: "Falhou",
  skipped: "Ignorado",
  pending: "Pendente",
}

export function ContactAutomationsCalendar({
  contactId,
  items,
}: {
  contactId: string
  items: ContactAutomationWithLastRun[]
}) {
  const [runs, setRuns] = useState<RunSummary[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Date | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/leads/${contactId}/automations/runs`)
        if (res.ok) {
          const data = (await res.json()) as RunSummary[]
          if (!cancelled) setRuns(data)
        } else if (!cancelled) {
          setRuns([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [contactId])

  // Mapa YYYY-MM-DD -> markers
  const markersByDay = useMemo(() => {
    const map = new Map<string, DayMarker[]>()

    function push(iso: string, marker: DayMarker) {
      const k = dayKey(iso)
      const arr = map.get(k)
      if (arr) arr.push(marker)
      else map.set(k, [marker])
    }

    // Próximos agendamentos (apenas status=scheduled)
    for (const a of items) {
      if (a.status !== "scheduled") continue
      const label =
        a.event_type === "festividade" && a.event_config?.label
          ? `Festividade: ${a.event_config.label}`
          : CONTACT_AUTOMATION_EVENT_LABELS_PT[a.event_type]
      push(a.trigger_at, { kind: "scheduled", label })
    }

    // Runs históricos
    for (const r of runs ?? []) {
      const kind: DayMarker["kind"] =
        r.status === "sent"
          ? "sent"
          : r.status === "failed"
            ? "failed"
            : r.status === "skipped"
              ? "skipped"
              : "pending"
      const automation = items.find((a) => a.id === r.contact_automation_id)
      const label = automation
        ? automation.event_type === "festividade" && automation.event_config?.label
          ? `Festividade: ${automation.event_config.label}`
          : CONTACT_AUTOMATION_EVENT_LABELS_PT[automation.event_type]
        : "Automatismo"
      const when = r.sent_at ?? r.scheduled_for
      push(when, { kind, label })
    }

    return map
  }, [items, runs])

  const modifiers = useMemo(() => {
    const scheduled: Date[] = []
    const sent: Date[] = []
    const failed: Date[] = []
    const other: Date[] = []
    for (const [key, arr] of markersByDay.entries()) {
      const [y, m, d] = key.split("-").map(Number)
      const date = new Date(y, m - 1, d)
      const kinds = new Set(arr.map((x) => x.kind))
      if (kinds.has("failed")) failed.push(date)
      else if (kinds.has("sent")) sent.push(date)
      else if (kinds.has("scheduled")) scheduled.push(date)
      else other.push(date)
    }
    return { scheduled, sent, failed, other }
  }, [markersByDay])

  const selectedMarkers = useMemo(() => {
    if (!selected) return []
    const k = `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, "0")}-${String(selected.getDate()).padStart(2, "0")}`
    return markersByDay.get(k) ?? []
  }, [selected, markersByDay])

  if (loading) {
    return <Skeleton className="h-72 w-full" />
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <LegendDot kind="scheduled" />
          <LegendDot kind="sent" />
          <LegendDot kind="failed" />
          <LegendDot kind="skipped" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 md:flex-row">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={setSelected}
          locale={pt}
          modifiers={modifiers}
          modifiersClassNames={{
            scheduled:
              "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-sky-500",
            sent:
              "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-emerald-500",
            failed:
              "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-red-500",
            other:
              "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-amber-500",
          }}
        />
        {selected && (
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-medium">
              {format(selected, "d 'de' MMMM yyyy", { locale: pt })}
            </p>
            {selectedMarkers.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum automatismo neste dia.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {selectedMarkers.map((m, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    <span
                      className={`inline-block h-2 w-2 shrink-0 rounded-full ${KIND_COLOR[m.kind]}`}
                    />
                    <span className="truncate">{m.label}</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      {KIND_LABEL[m.kind]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function LegendDot({ kind }: { kind: DayMarker["kind"] }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${KIND_COLOR[kind]}`} />
      <span className="text-muted-foreground">{KIND_LABEL[kind]}</span>
    </span>
  )
}
