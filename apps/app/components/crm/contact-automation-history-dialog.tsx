"use client"

import { useEffect, useState } from "react"
import { format, parseISO } from "date-fns"
import { pt } from "date-fns/locale"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { ContactAutomationRun } from "@/types/contact-automation"

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  sent: "Enviado",
  failed: "Falhou",
  skipped: "Ignorado",
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "default",
  sent: "secondary",
  failed: "destructive",
  skipped: "outline",
}

interface Props {
  contactId: string
  automationId: string
  open: boolean
  onOpenChange: (o: boolean) => void
}

export function ContactAutomationHistoryDialog({
  contactId,
  automationId,
  open,
  onOpenChange,
}: Props) {
  const [runs, setRuns] = useState<ContactAutomationRun[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch(`/api/leads/${contactId}/automations/${automationId}/runs`)
      .then((r) => r.json())
      .then((d) => setRuns(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [open, contactId, automationId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Histórico do automatismo</DialogTitle>
          <DialogDescription>
            Tentativas de envio e respectivo estado.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : runs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Ainda não há execuções registadas.
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {runs.map((r) => (
              <div key={r.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {format(parseISO(r.scheduled_for), "d 'de' MMMM yyyy 'às' HH:mm", {
                      locale: pt,
                    })}
                  </span>
                  <Badge variant={STATUS_VARIANTS[r.status]} className="text-[10px]">
                    {STATUS_LABELS[r.status] ?? r.status}
                  </Badge>
                </div>
                {r.sent_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Enviado em{" "}
                    {format(parseISO(r.sent_at), "d/M/yyyy HH:mm", { locale: pt })}
                  </p>
                )}
                {r.skip_reason && (
                  <p className="text-xs text-amber-700 mt-1">Motivo: {r.skip_reason}</p>
                )}
                {r.error && (
                  <p className="text-xs text-red-700 mt-1">Erro: {r.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
