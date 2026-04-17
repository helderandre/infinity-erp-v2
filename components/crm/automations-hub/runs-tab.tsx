"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { useRuns, type RunStatusFilter } from "@/hooks/use-contact-automations-hub"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { CONTACT_AUTOMATION_EVENT_LABELS_PT } from "@/types/contact-automation"

interface Props {
  userId: string
  canSeeAll: boolean
}

interface Consultant {
  id: string
  commercial_name: string
}

const STATUS_OPTIONS: Array<{ value: RunStatusFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendentes" },
  { value: "sent", label: "Concluídos" },
  { value: "failed", label: "Falhados" },
  { value: "skipped", label: "Saltados" },
]

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  sent: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  skipped: "bg-slate-100 text-slate-700",
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  sent: "Concluído",
  failed: "Falhado",
  skipped: "Saltado",
}

export function RunsTab({ userId, canSeeAll }: Props) {
  const [status, setStatus] = useState<RunStatusFilter>("all")
  const [consultantFilter, setConsultantFilter] = useState<string>(canSeeAll ? "all" : userId)
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const { rows: allRows, isLoading, error, refetch } = useRuns(status)

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

  // Client-side filter by consultant
  const rows = consultantFilter === "all"
    ? allRows
    : allRows.filter((r) => r.leads?.agent_id === consultantFilter)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rescheduleTarget, setRescheduleTarget] = useState<string | null>(null)
  const [rescheduleTime, setRescheduleTime] = useState<string>("")

  async function retry(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/automacao/runs/${id}/retry`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Erro")
      toast.success("Run reexecutado")
      void refetch()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  async function reschedule() {
    if (!rescheduleTarget || !rescheduleTime) return
    setBusyId(rescheduleTarget)
    try {
      const res = await fetch(`/api/automacao/runs/${rescheduleTarget}/reschedule`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trigger_at: new Date(rescheduleTime).toISOString() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Erro")
      toast.success("Run reagendado")
      setRescheduleTarget(null)
      setRescheduleTime("")
      void refetch()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
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

        <Select value={status} onValueChange={(v) => setStatus(v as RunStatusFilter)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto text-xs text-muted-foreground">
          {isLoading ? "A carregar…" : `${rows.length} run${rows.length !== 1 ? "s" : ""}`}
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
                <TableHead>Quando</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Detalhe</TableHead>
                <TableHead className="text-right">Acções</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    Nenhum run encontrado nos últimos 30 dias
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">
                      {new Date(r.sent_at ?? r.scheduled_for).toLocaleString("pt-PT")}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-xs font-medium",
                          STATUS_STYLES[r.status] ?? "bg-muted text-foreground",
                        )}
                      >
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.kind}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.leads?.nome || r.leads?.full_name || r.lead_id?.slice(0, 8) || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.event_type
                        ? (CONTACT_AUTOMATION_EVENT_LABELS_PT[
                            r.event_type as keyof typeof CONTACT_AUTOMATION_EVENT_LABELS_PT
                          ] ?? r.event_type)
                        : "—"}
                    </TableCell>
                    <TableCell
                      className="max-w-96 truncate text-xs text-muted-foreground"
                      title={r.error ?? r.skip_reason ?? undefined}
                    >
                      {r.status === "failed"
                        ? (r.error ?? "Erro sem detalhe")
                        : r.status === "skipped"
                        ? (r.skip_reason ?? "Sem motivo registado")
                        : r.status === "sent"
                        ? r.sent_at
                          ? `Enviado ${new Date(r.sent_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`
                          : "Enviado"
                        : r.status === "pending"
                        ? "A aguardar próximo tick"
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "failed" ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busyId === r.id}
                            onClick={() => void retry(r.id)}
                          >
                            Reexecutar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === r.id}
                            onClick={() => setRescheduleTarget(r.id)}
                          >
                            Reagendar
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!rescheduleTarget} onOpenChange={(v) => !v && setRescheduleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reagendar run</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reschedule-at">Novo horário</Label>
            <Input
              id="reschedule-at"
              type="datetime-local"
              value={rescheduleTime}
              onChange={(e) => setRescheduleTime(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRescheduleTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={reschedule} disabled={!rescheduleTime}>
              Reagendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
