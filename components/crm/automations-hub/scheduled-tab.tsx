"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useScheduled } from "@/hooks/use-contact-automations-hub"
import { CONTACT_AUTOMATION_EVENT_LABELS_PT } from "@/types/contact-automation"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { EventsCardsGrid } from "./custom-events/events-cards-grid"
import { CustomEventWizard } from "./custom-events/custom-event-wizard"
import { CustomEventDetailDialog } from "./custom-events/custom-event-detail-dialog"
import { useCustomEvents } from "@/hooks/use-custom-events"

interface Props {
  userId: string
  canSeeAll: boolean
}

interface Consultant {
  id: string
  commercial_name: string
}

const STATE_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  muted: "bg-slate-100 text-slate-700",
  skipped_no_channel: "bg-red-100 text-red-800",
}

const STATE_LABELS: Record<string, string> = {
  active: "Activo",
  muted: "Mutado",
  skipped_no_channel: "Sem canal",
}

export function ScheduledTab({ userId, canSeeAll }: Props) {
  const [event, setEvent] = useState<string>("all")
  const [state, setState] = useState<string>("all")
  const [consultantFilter, setConsultantFilter] = useState<string>(canSeeAll ? "all" : userId)
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [wizardOpen, setWizardOpen] = useState(false)
  const [detailEventId, setDetailEventId] = useState<string | null>(null)
  const [detailIsFixed, setDetailIsFixed] = useState(false)
  const { events: customEvents } = useCustomEvents()

  const loadConsultants = useCallback(async () => {
    if (!canSeeAll) return
    try {
      const res = await fetch("/api/users/consultants")
      if (res.ok) {
        const data = await res.json()
        setConsultants(
          (data || []).map((c: Record<string, unknown>) => ({
            id: c.id as string,
            commercial_name: c.commercial_name as string,
          })),
        )
      }
    } catch { /* silently fail */ }
  }, [canSeeAll])

  useEffect(() => {
    void loadConsultants()
  }, [loadConsultants])

  const { rows, isLoading, error } = useScheduled({
    event_type: event !== "all" ? event : undefined,
    state: state !== "all" ? state : undefined,
    consultant_id: consultantFilter !== "all" ? consultantFilter : undefined,
  })

  const showConsultantColumn = canSeeAll && consultantFilter === "all"

  return (
    <div className="flex flex-col gap-6">
      {/* ═══ Events Cards Grid ═══ */}
      <EventsCardsGrid
        onEventClick={(id, isFixed) => {
          setDetailEventId(id)
          setDetailIsFixed(isFixed)
        }}
        onCreateClick={() => setWizardOpen(true)}
      />

      {/* ═══ Wizard dialog ═══ */}
      <CustomEventWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
      />

      {/* ═══ Detail dialog ═══ */}
      <CustomEventDetailDialog
        eventId={detailEventId}
        isFixed={detailIsFixed}
        open={!!detailEventId}
        onOpenChange={(open) => !open && setDetailEventId(null)}
      />

      {/* ═══ Scheduled table (existing) ═══ */}
      <div className="flex flex-wrap items-center gap-3">
        {canSeeAll && (
          <Select value={consultantFilter} onValueChange={setConsultantFilter}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Consultor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os consultores</SelectItem>
              <SelectItem value={userId}>Os meus</SelectItem>
              {consultants
                .filter((c) => c.id !== userId)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.commercial_name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}

        <Select value={event} onValueChange={setEvent}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Evento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os eventos</SelectItem>
            <SelectItem value="aniversario_contacto">Aniversário</SelectItem>
            <SelectItem value="natal">Natal</SelectItem>
            <SelectItem value="ano_novo">Ano Novo</SelectItem>
            {customEvents
              .filter((e) => e.status === "active")
              .map((e) => (
                <SelectItem key={e.id} value={e.name}>
                  {e.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Select value={state} onValueChange={setState}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            <SelectItem value="active">Activo</SelectItem>
            <SelectItem value="muted">Mutado</SelectItem>
            <SelectItem value="skipped_no_channel">Sem canal</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto text-xs text-muted-foreground">
          {isLoading ? "A carregar…" : `${rows.length} linhas`}
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                {showConsultantColumn && <TableHead>Consultor</TableHead>}
                <TableHead>Evento</TableHead>
                <TableHead>Próximo envio</TableHead>
                <TableHead>Canais</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Origem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={showConsultantColumn ? 7 : 6}
                    className="text-center text-sm text-muted-foreground"
                  >
                    Nenhum automatismo agendado
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, i) => (
                  <TableRow key={`${r.lead_id}-${r.event_type}-${i}`}>
                    <TableCell>
                      <Link
                        href={`/dashboard/leads/${r.lead_id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {r.lead_name ?? r.lead_id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    {showConsultantColumn && (
                      <TableCell className="text-sm">{r.agent_name ?? "—"}</TableCell>
                    )}
                    <TableCell className="text-sm">
                      {CONTACT_AUTOMATION_EVENT_LABELS_PT[
                        r.event_type as keyof typeof CONTACT_AUTOMATION_EVENT_LABELS_PT
                      ] ?? r.event_type}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.next_at ? new Date(r.next_at).toLocaleString("pt-PT") : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {r.channels_active.map((c) => (
                          <Badge key={c} variant="outline">
                            {c}
                          </Badge>
                        ))}
                        {r.channels_muted.map((c) => (
                          <Badge key={`m-${c}`} variant="secondary" className="line-through">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn("rounded-md px-2 py-0.5 text-xs", STATE_COLORS[r.state])}>
                        {STATE_LABELS[r.state]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.source === "virtual" ? "outline" : r.source === "custom_event" ? "secondary" : "default"}>
                        {r.source === "custom_event" ? "personalizado" : r.source}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
