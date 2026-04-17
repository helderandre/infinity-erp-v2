"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useCustomEvents } from "@/hooks/use-custom-events"
import type { CustomEventWithCounts } from "@/types/custom-event"
import { AutomationEventCard } from "./automation-event-card"

// Fixed events definition (lead_count filled dynamically)
function buildFixedEvents(leadCount: number): Array<CustomEventWithCounts & { isFixed: boolean }> {
  return [
    {
      id: "fixed-aniversario",
      consultant_id: "",
      name: "Aniversário do Contacto",
      description: null,
      event_date: "2026-01-01",
      send_hour: 9,
      is_recurring: true,
      channels: ["email", "whatsapp"],
      email_template_id: null,
      wpp_template_id: null,
      smtp_account_id: null,
      wpp_instance_id: null,
      status: "active",
      last_triggered_year: null,
      created_at: "",
      updated_at: "",
      lead_count: leadCount,
      last_sent_at: null,
      isFixed: true,
    },
    {
      id: "fixed-natal",
      consultant_id: "",
      name: "Natal",
      description: null,
      event_date: "2026-12-25",
      send_hour: 5,
      is_recurring: true,
      channels: ["email", "whatsapp"],
      email_template_id: null,
      wpp_template_id: null,
      smtp_account_id: null,
      wpp_instance_id: null,
      status: "active",
      last_triggered_year: null,
      created_at: "",
      updated_at: "",
      lead_count: leadCount,
      last_sent_at: null,
      isFixed: true,
    },
    {
      id: "fixed-ano-novo",
      consultant_id: "",
      name: "Ano Novo",
      description: null,
      event_date: "2026-12-31",
      send_hour: 5,
      is_recurring: true,
      channels: ["email", "whatsapp"],
      email_template_id: null,
      wpp_template_id: null,
      smtp_account_id: null,
      wpp_instance_id: null,
      status: "active",
      last_triggered_year: null,
      created_at: "",
      updated_at: "",
      lead_count: leadCount,
      last_sent_at: null,
      isFixed: true,
    },
  ]
}

interface EventsCardsGridProps {
  onEventClick: (eventId: string, isFixed: boolean) => void
  onCreateClick: () => void
}

export function EventsCardsGrid({ onEventClick, onCreateClick }: EventsCardsGridProps) {
  const { events, isLoading, refetch } = useCustomEvents()
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [fixedLeadCount, setFixedLeadCount] = useState(0)

  const fetchFixedCount = useCallback(async () => {
    try {
      const res = await fetch("/api/automacao/custom-events/eligible-leads?limit=1")
      if (res.ok) {
        const data = await res.json()
        setFixedLeadCount(data.total ?? 0)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchFixedCount() }, [fetchFixedCount])

  async function handleTogglePause(evt: CustomEventWithCounts) {
    const newStatus = evt.status === "paused" ? "active" : "paused"
    try {
      const res = await fetch(`/api/automacao/custom-events/${evt.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()
      toast.success(newStatus === "paused" ? "Automatismo pausado" : "Automatismo reactivado")
      refetch()
    } catch {
      toast.error("Erro ao alterar estado do automatismo")
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/automacao/custom-events/${deleteTarget}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Automatismo eliminado")
      refetch()
    } catch {
      toast.error("Erro ao eliminar automatismo")
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    )
  }

  const allEvents = [
    ...buildFixedEvents(fixedLeadCount),
    ...events.map((e) => ({ ...e, isFixed: false })),
  ]

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {allEvents.map((evt) => (
          <AutomationEventCard
            key={evt.id}
            event={evt}
            onClick={() => onEventClick(evt.id, evt.isFixed)}
            onPause={evt.isFixed ? undefined : () => handleTogglePause(evt as CustomEventWithCounts)}
            onDelete={evt.isFixed ? undefined : () => setDeleteTarget(evt.id)}
          />
        ))}

        {/* Add new card */}
        <button
          type="button"
          onClick={onCreateClick}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 p-4 min-h-[136px] cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Plus className="h-4.5 w-4.5" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">Agendar Automatismo</span>
        </button>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar automatismo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar este automatismo? Os contactos associados e o histórico de envios serão perdidos. Esta acção é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "A eliminar..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
