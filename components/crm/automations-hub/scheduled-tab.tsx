"use client"

import { useCallback, useEffect, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EventsCardsGrid } from "./custom-events/events-cards-grid"
import { CustomEventWizard } from "./custom-events/custom-event-wizard"
import { AutomationDetailSheet } from "./automation-detail-sheet/automation-detail-sheet"

interface Props {
  userId: string
  canSeeAll: boolean
}

interface Consultant {
  id: string
  commercial_name: string
}

export function ScheduledTab({ userId, canSeeAll }: Props) {
  const [consultantFilter, setConsultantFilter] = useState<string>(canSeeAll ? "all" : userId)
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [wizardOpen, setWizardOpen] = useState(false)
  const [detailEventId, setDetailEventId] = useState<string | null>(null)
  const [detailIsFixed, setDetailIsFixed] = useState(false)
  const [detailInitialFilter, setDetailInitialFilter] = useState<"all" | "failed">("all")

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

  // Para o endpoint de saúde: "all" não faz sentido (cada consultor tem os seus);
  // quando o broker não seleccionou um consultor específico, usa o próprio.
  const scopedConsultantId =
    consultantFilter === "all" ? (canSeeAll ? undefined : userId) : consultantFilter

  return (
    <div className="flex flex-col gap-6">
      {canSeeAll && (
        <div className="flex flex-wrap items-center gap-3">
          <Select value={consultantFilter} onValueChange={setConsultantFilter}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Consultor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Os meus</SelectItem>
              {consultants
                .filter((c) => c.id !== userId)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.commercial_name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Events Cards Grid */}
      <EventsCardsGrid
        consultantId={scopedConsultantId}
        onEventClick={(id, isFixed, opts) => {
          setDetailEventId(id)
          setDetailIsFixed(isFixed)
          setDetailInitialFilter(opts?.initialRunsFilter ?? "all")
        }}
        onCreateClick={() => setWizardOpen(true)}
      />

      {/* Wizard dialog */}
      <CustomEventWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
      />

      {/* Detail sheet */}
      <AutomationDetailSheet
        kind={detailIsFixed ? "fixed" : "custom"}
        eventId={detailEventId}
        open={!!detailEventId}
        onOpenChange={(open) => !open && setDetailEventId(null)}
        initialRunsFilter={detailInitialFilter}
      />
    </div>
  )
}
