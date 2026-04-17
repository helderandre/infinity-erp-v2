"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FixedEventOverrideDialog } from "./fixed-event-override-dialog"

const FIXED_EVENTS = [
  { key: "aniversario_contacto", label: "Aniversário do contacto" },
  { key: "natal", label: "Natal" },
  { key: "ano_novo", label: "Ano Novo" },
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

export function FixedEventsSection({ leadId, birthday }: Props) {
  const [settings, setSettings] = useState<Setting[]>([])
  const [mutes, setMutes] = useState<Mute[]>([])
  const [isLoading, setLoading] = useState(true)
  const [dialogEvent, setDialogEvent] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, mRes] = await Promise.all([
        fetch(`/api/leads/${leadId}/automation-settings`),
        fetch(`/api/contact-automation-mutes?lead_id=${leadId}`),
      ])
      const sJson = await sRes.json()
      const mJson = await mRes.json()
      setSettings(sJson.settings ?? [])
      setMutes(mJson.mutes ?? [])
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  function muteExists(eventType: string, channel: string | null) {
    return mutes.find(
      (m) =>
        m.lead_id === leadId &&
        m.event_type === eventType &&
        (channel === null ? m.channel === null : m.channel === channel),
    )
  }

  async function toggleMute(eventType: string) {
    const existing = muteExists(eventType, null)
    try {
      if (existing) {
        const res = await fetch(`/api/contact-automation-mutes?id=${existing.id}`, { method: "DELETE" })
        if (!res.ok) throw new Error((await res.json()).error ?? "Erro")
      } else {
        const res = await fetch(`/api/contact-automation-mutes`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            lead_id: leadId,
            event_type: eventType,
            channel: null,
          }),
        })
        if (!res.ok) throw new Error((await res.json()).error ?? "Erro")
      }
      toast.success("Mute actualizado")
      void fetchAll()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  if (isLoading) return <Skeleton className="h-32" />

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Eventos fixos</h3>
          <p className="text-xs text-muted-foreground">
            Disparados automaticamente a partir do estado do lead e do consultor responsável.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`/dashboard/crm/automatismos-contactos?tab=agendados`}>
            Abrir no hub CRM
          </Link>
        </Button>
      </div>
      <div className="grid gap-2">
        {FIXED_EVENTS.map((evt) => {
          const muted = muteExists(evt.key, null)
          const override = settings.find((s) => s.event_type === evt.key)
          const disabled = evt.key === "aniversario_contacto" && !birthday
          return (
            <Card key={evt.key} className={disabled ? "opacity-50" : ""}>
              <CardContent className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="text-sm font-medium">{evt.label}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {disabled ? (
                        <span>Sem data de nascimento</span>
                      ) : muted ? (
                        <Badge variant="outline">Mutado</Badge>
                      ) : override ? (
                        <Badge variant="secondary">Personalizado</Badge>
                      ) : (
                        <Badge variant="default">Automático</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => setDialogEvent(evt.key)}
                  >
                    Personalizar
                  </Button>
                  <Button
                    size="sm"
                    variant={muted ? "default" : "ghost"}
                    disabled={disabled}
                    onClick={() => void toggleMute(evt.key)}
                  >
                    {muted ? "Desmutar" : "Mutar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
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
