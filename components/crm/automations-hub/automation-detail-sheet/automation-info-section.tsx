"use client"

import { useState } from "react"
import { Check, Pencil, Power, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { AUTOMATION_SHEET_COPY } from "@/lib/constants-automations"
import type { CustomEventDetail } from "@/types/custom-event"
import { cn } from "@/lib/utils"

interface Props {
  event: CustomEventDetail
  onRefetch: () => void
}

type EditingField = "name" | "description" | "event_date" | "send_hour" | null

const HOURS = Array.from({ length: 24 }, (_, i) => i)

function pad(n: number) {
  return String(n).padStart(2, "0")
}

function formatDatePt(iso: string) {
  const d = new Date(iso + "T00:00:00")
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" })
}

export function AutomationInfoSection({ event, onRefetch }: Props) {
  const copy = AUTOMATION_SHEET_COPY.info
  const [editing, setEditing] = useState<EditingField>(null)
  const [draft, setDraft] = useState<string | number | boolean>("")
  const [busy, setBusy] = useState(false)

  async function persist(patch: Record<string, unknown>) {
    setBusy(true)
    try {
      const res = await fetch(`/api/automacao/custom-events/${event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error()
      toast.success(copy.saveSuccess)
      setEditing(null)
      onRefetch()
    } catch {
      toast.error(copy.saveError)
    } finally {
      setBusy(false)
    }
  }

  function startEdit(field: NonNullable<EditingField>, initialValue: string | number | boolean) {
    setEditing(field)
    setDraft(initialValue)
  }

  function cancelEdit() {
    setEditing(null)
  }

  async function saveCurrent() {
    if (editing === "name") {
      const v = String(draft).trim()
      if (!v) {
        toast.error("Nome não pode ficar vazio")
        return
      }
      await persist({ name: v })
    } else if (editing === "description") {
      const v = String(draft).trim()
      await persist({ description: v === "" ? null : v })
    } else if (editing === "event_date") {
      await persist({ event_date: String(draft) })
    } else if (editing === "send_hour") {
      await persist({ send_hour: Number(draft) })
    }
  }

  function toggleRecurring(next: boolean) {
    void persist({ is_recurring: next })
  }

  async function toggleChannel(channel: "email" | "whatsapp", next: boolean) {
    const current = new Set(event.channels)
    if (next) current.add(channel)
    else current.delete(channel)
    if (current.size === 0) {
      toast.error("Tem de haver pelo menos um canal activado")
      return
    }
    await persist({ channels: Array.from(current) })
  }

  const emailAvailable = event.effective_channels.email !== "unavailable"
  const wppAvailable = event.effective_channels.whatsapp !== "unavailable"

  const isActive = event.status === "active"

  async function toggleStatus(next: boolean) {
    await persist({ status: next ? "active" : "paused" })
  }

  return (
    <div className="space-y-5">
      {/* Activo / Desactivado — toggle prominente no topo */}
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
          isActive
            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30"
            : "border-border/40 bg-muted/40",
        )}
      >
        <Power
          className={cn(
            "h-4 w-4 shrink-0",
            isActive ? "text-emerald-600" : "text-muted-foreground",
          )}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {isActive ? "Activo" : "Desactivado"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isActive
              ? "Vai enviar mensagens conforme agendado."
              : "Não envia mensagens enquanto estiver desactivado."}
          </p>
        </div>
        <Switch
          checked={isActive}
          onCheckedChange={toggleStatus}
          disabled={busy}
          aria-label={isActive ? "Desactivar automatismo" : "Reactivar automatismo"}
        />
      </div>

      {/* Nome */}
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">{copy.name}</Label>
        {editing === "name" ? (
          <InlineEditRow
            input={
              <Input
                value={String(draft)}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveCurrent()
                  if (e.key === "Escape") cancelEdit()
                }}
                autoFocus
              />
            }
            onSave={saveCurrent}
            onCancel={cancelEdit}
            busy={busy}
          />
        ) : (
          <InlineDisplayRow
            label={event.name}
            onEdit={() => startEdit("name", event.name)}
          />
        )}
      </div>

      {/* Descrição */}
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          {copy.description}
        </Label>
        {editing === "description" ? (
          <InlineEditRow
            input={
              <Textarea
                value={String(draft)}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") cancelEdit()
                }}
                rows={3}
                autoFocus
              />
            }
            onSave={saveCurrent}
            onCancel={cancelEdit}
            busy={busy}
          />
        ) : (
          <InlineDisplayRow
            label={event.description ?? copy.descriptionEmpty}
            italic={!event.description}
            onEdit={() => startEdit("description", event.description ?? "")}
          />
        )}
      </div>

      {/* Data + Hora — lado a lado em desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            {copy.eventDate}
          </Label>
          {editing === "event_date" ? (
            <InlineEditRow
              input={
                <Input
                  type="date"
                  value={String(draft)}
                  onChange={(e) => setDraft(e.target.value)}
                  autoFocus
                />
              }
              onSave={saveCurrent}
              onCancel={cancelEdit}
              busy={busy}
            />
          ) : (
            <InlineDisplayRow
              label={formatDatePt(event.event_date)}
              onEdit={() => startEdit("event_date", event.event_date)}
            />
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            {copy.sendHour}
          </Label>
          {editing === "send_hour" ? (
            <InlineEditRow
              input={
                <Select
                  value={String(draft)}
                  onValueChange={(v) => setDraft(v)}
                >
                  <SelectTrigger autoFocus>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {pad(h)}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
              onSave={saveCurrent}
              onCancel={cancelEdit}
              busy={busy}
            />
          ) : (
            <InlineDisplayRow
              label={`${pad(event.send_hour)}:00`}
              onEdit={() => startEdit("send_hour", event.send_hour)}
            />
          )}
        </div>
      </div>

      {/* Recurring */}
      <div className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/30 px-4 py-3">
        <div>
          <p className="text-sm font-medium">{copy.recurring}</p>
          <p className="text-xs text-muted-foreground">
            {event.is_recurring ? "O automatismo repete-se anualmente." : "Dispara apenas uma vez."}
          </p>
        </div>
        <Switch
          checked={event.is_recurring}
          onCheckedChange={toggleRecurring}
          disabled={busy}
        />
      </div>

      {/* Canais */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Canais</Label>
        <div className="space-y-2">
          <ChannelToggle
            label="Email"
            state={event.effective_channels.email}
            checked={event.channels.includes("email")}
            disabled={!emailAvailable || busy}
            tooltip={!emailAvailable ? AUTOMATION_SHEET_COPY.channels.emailUnavailable : undefined}
            onCheckedChange={(v) => toggleChannel("email", v)}
          />
          <ChannelToggle
            label="WhatsApp"
            state={event.effective_channels.whatsapp}
            checked={event.channels.includes("whatsapp")}
            disabled={!wppAvailable || busy}
            tooltip={!wppAvailable ? AUTOMATION_SHEET_COPY.channels.whatsappUnavailable : undefined}
            onCheckedChange={(v) => toggleChannel("whatsapp", v)}
          />
        </div>
      </div>
    </div>
  )
}

function InlineDisplayRow({
  label,
  italic,
  onEdit,
}: {
  label: string
  italic?: boolean
  onEdit: () => void
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className={cn(
        "group flex w-full items-center justify-between rounded-lg border border-transparent px-3 py-2 text-left transition-colors hover:border-border hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring",
      )}
      title={AUTOMATION_SHEET_COPY.info.editHint}
    >
      <span className={cn("text-sm", italic && "italic text-muted-foreground")}>{label}</span>
      <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  )
}

function InlineEditRow({
  input,
  onSave,
  onCancel,
  busy,
}: {
  input: React.ReactNode
  onSave: () => void
  onCancel: () => void
  busy: boolean
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex-1">{input}</div>
      <div className="flex items-center gap-1">
        <Button size="icon" className="h-8 w-8" onClick={onSave} disabled={busy}>
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onCancel} disabled={busy}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function ChannelToggle({
  label,
  state,
  checked,
  disabled,
  tooltip,
  onCheckedChange,
}: {
  label: string
  state: "active" | "unavailable" | "off"
  checked: boolean
  disabled: boolean
  tooltip?: string
  onCheckedChange: (next: boolean) => void
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl border border-border/40 px-4 py-2.5 transition-colors",
        state === "unavailable" && "border-destructive/30 bg-destructive/5",
      )}
      title={tooltip}
    >
      <div>
        <p className="text-sm font-medium">{label}</p>
        {tooltip && <p className="text-xs text-destructive mt-0.5">{tooltip}</p>}
      </div>
      <Switch
        checked={checked && state !== "unavailable"}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  )
}
