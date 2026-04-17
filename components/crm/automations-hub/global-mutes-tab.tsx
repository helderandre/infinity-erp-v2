"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

const FIXED_EVENTS = [
  { key: "aniversario_contacto", label: "Aniversários" },
  { key: "natal", label: "Natal" },
  { key: "ano_novo", label: "Ano Novo" },
] as const

const CHANNELS: Array<{ key: "email" | "whatsapp" | null; label: string }> = [
  { key: null, label: "Ambos" },
  { key: "email", label: "Email" },
  { key: "whatsapp", label: "WhatsApp" },
]

interface MuteRow {
  id: string
  consultant_id: string | null
  lead_id: string | null
  event_type: string | null
  channel: string | null
}

interface Props {
  userId: string
}

export function GlobalMutesTab({ userId }: Props) {
  const [mutes, setMutes] = useState<MuteRow[]>([])
  const [isLoading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const fetchMutes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/contact-automation-mutes`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Erro")
      setMutes((json.mutes ?? []).filter((m: MuteRow) => m.lead_id === null))
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchMutes()
  }, [fetchMutes])

  function findMute(eventType: string | null, channel: string | null) {
    return mutes.find(
      (m) =>
        m.consultant_id === userId &&
        m.lead_id === null &&
        m.event_type === eventType &&
        m.channel === channel,
    )
  }

  async function toggle(eventType: string | null, channel: string | null) {
    const key = `${eventType ?? "all"}-${channel ?? "all"}`
    setBusyKey(key)
    const existing = findMute(eventType, channel)
    try {
      if (existing) {
        const res = await fetch(`/api/contact-automation-mutes?id=${existing.id}`, { method: "DELETE" })
        if (!res.ok) throw new Error((await res.json()).error ?? "Erro")
      } else {
        const res = await fetch(`/api/contact-automation-mutes`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            consultant_id: userId,
            lead_id: null,
            event_type: eventType,
            channel,
          }),
        })
        if (!res.ok) throw new Error((await res.json()).error ?? "Erro")
      }
      toast.success("Mute actualizado")
      void fetchMutes()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusyKey(null)
    }
  }

  if (isLoading) {
    return <Skeleton className="h-64" />
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Silenciar TUDO</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            {CHANNELS.map((ch) => {
              const key = `all-${ch.key ?? "all"}`
              return (
                <div key={key} className="flex items-center gap-2">
                  <Switch
                    id={key}
                    checked={!!findMute(null, ch.key)}
                    onCheckedChange={() => void toggle(null, ch.key)}
                    disabled={busyKey === key}
                  />
                  <Label htmlFor={key}>{ch.label}</Label>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {FIXED_EVENTS.map((evt) => (
          <Card key={evt.key}>
            <CardHeader>
              <CardTitle className="text-base">{evt.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                {CHANNELS.map((ch) => {
                  const key = `${evt.key}-${ch.key ?? "all"}`
                  return (
                    <div key={key} className="flex items-center justify-between">
                      <Label htmlFor={key}>{ch.label}</Label>
                      <Switch
                        id={key}
                        checked={!!findMute(evt.key, ch.key)}
                        onCheckedChange={() => void toggle(evt.key, ch.key)}
                        disabled={busyKey === key}
                      />
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
