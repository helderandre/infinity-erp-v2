"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  contactId: string
  automationId: string | null
  initial: {
    trigger_at: string
    timezone: string
    recurrence: "once" | "yearly"
  } | null
  onSaved: () => void
}

function isoToTzLocal(iso: string, timeZone: string): string {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d)
  const map: Record<string, string> = {}
  for (const p of parts) map[p.type] = p.value
  const hour = map.hour === "24" ? "00" : map.hour
  return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}`
}

function tzOffsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at)
  const map: Record<string, string> = {}
  for (const p of parts) map[p.type] = p.value
  const h = map.hour === "24" ? 0 : Number(map.hour)
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    h,
    Number(map.minute),
    Number(map.second),
  )
  return asUtc - at.getTime()
}

function tzLocalToIso(local: string, timeZone: string): string {
  const [date, time] = local.split("T")
  const [y, m, d] = date.split("-").map(Number)
  const [hh, mm] = time.split(":").map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const offset = tzOffsetMs(timeZone, new Date(guess))
  return new Date(guess - offset).toISOString()
}

export function ContactAutomationEditDialog({
  open,
  onOpenChange,
  contactId,
  automationId,
  initial,
  onSaved,
}: Props) {
  const [localDateTime, setLocalDateTime] = useState("")
  const [timezone, setTimezone] = useState("Europe/Lisbon")
  const [recurrence, setRecurrence] = useState<"once" | "yearly">("once")
  const [email, setEmail] = useState("")
  const [telemovel, setTelemovel] = useState("")
  const [initialEmail, setInitialEmail] = useState("")
  const [initialPhone, setInitialPhone] = useState("")
  const [loadingContact, setLoadingContact] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setTimezone(initial.timezone)
      setLocalDateTime(isoToTzLocal(initial.trigger_at, initial.timezone))
      setRecurrence(initial.recurrence)
    }
    let cancelled = false
    ;(async () => {
      setLoadingContact(true)
      try {
        const res = await fetch(`/api/leads/${contactId}`)
        if (res.ok) {
          const lead = await res.json()
          if (!cancelled) {
            setEmail(lead.email ?? "")
            setTelemovel(lead.telemovel ?? "")
            setInitialEmail(lead.email ?? "")
            setInitialPhone(lead.telemovel ?? "")
          }
        }
      } finally {
        if (!cancelled) setLoadingContact(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, initial, contactId])

  function handleTimezoneChange(next: string) {
    if (localDateTime) {
      const iso = tzLocalToIso(localDateTime, timezone)
      setLocalDateTime(isoToTzLocal(iso, next))
    }
    setTimezone(next)
  }

  async function handleSave() {
    if (!automationId) return
    if (!localDateTime) {
      toast.error("Escolhe uma data e hora")
      return
    }
    setSaving(true)
    try {
      const contactChanged =
        email.trim() !== initialEmail || telemovel.trim() !== initialPhone
      if (contactChanged) {
        const res = await fetch(`/api/leads/${contactId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim() || null,
            telemovel: telemovel.trim() || null,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => null)
          throw new Error(err?.error || "Erro ao actualizar contacto")
        }
      }

      const iso = tzLocalToIso(localDateTime, timezone)
      const res = await fetch(
        `/api/leads/${contactId}/automations/${automationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trigger_at: iso, timezone, recurrence }),
        },
      )
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || "Erro ao guardar")
      }
      toast.success("Automatismo actualizado")
      onSaved()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar agendamento</DialogTitle>
          <DialogDescription>
            Ajusta a data, hora e os dados de contacto usados nos envios.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <Select value={timezone} onValueChange={handleTimezoneChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Europe/Lisbon">Europe/Lisbon</SelectItem>
                <SelectItem value="Europe/London">Europe/London</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Próxima execução</Label>
            <Input
              type="datetime-local"
              value={localDateTime}
              onChange={(e) => setLocalDateTime(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Data e hora em {timezone}.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Recorrência</Label>
            <RadioGroup
              value={recurrence}
              onValueChange={(v) => setRecurrence(v as "once" | "yearly")}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="once" id="edit-rec-once" />
                <Label htmlFor="edit-rec-once" className="cursor-pointer font-normal">
                  Apenas uma vez
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="yearly" id="edit-rec-yearly" />
                <Label htmlFor="edit-rec-yearly" className="cursor-pointer font-normal">
                  Todos os anos
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>Email do contacto</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@exemplo.com"
              disabled={loadingContact}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Telemóvel do contacto</Label>
            <Input
              type="tel"
              value={telemovel}
              onChange={(e) => setTelemovel(e.target.value)}
              placeholder="+351 912 345 678"
              disabled={loadingContact}
            />
            <p className="text-[11px] text-muted-foreground">
              Estes dados são usados nos envios de email e WhatsApp.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loadingContact}>
            {saving ? "A guardar..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
