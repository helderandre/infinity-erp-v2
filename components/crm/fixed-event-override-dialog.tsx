"use client"

import { useCallback, useEffect, useState } from "react"
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const HOURS = Array.from({ length: 24 }, (_, i) => i)

interface Props {
  leadId: string
  eventType: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

interface Template {
  id: string
  name: string
  scope: string
  scope_id: string | null
  category: string | null
  is_active: boolean
}

interface SmtpAccount {
  id: string
  display_name: string
  email_address: string
  is_active: boolean
}

interface WppInstance {
  id: string
  name: string
  connection_status: string
}

interface ExistingSetting {
  event_type: string
  send_hour: number | null
  email_template_id: string | null
  wpp_template_id: string | null
  smtp_account_id: string | null
  wpp_instance_id: string | null
}

export function FixedEventOverrideDialog({
  leadId,
  eventType,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const [emailTpls, setEmailTpls] = useState<Template[]>([])
  const [wppTpls, setWppTpls] = useState<Template[]>([])
  const [smtpAccs, setSmtpAccs] = useState<SmtpAccount[]>([])
  const [wppInsts, setWppInsts] = useState<WppInstance[]>([])
  const [existing, setExisting] = useState<ExistingSetting | null>(null)

  const [emailTemplateId, setEmailTemplateId] = useState<string>("")
  const [wppTemplateId, setWppTemplateId] = useState<string>("")
  const [smtpAccountId, setSmtpAccountId] = useState<string>("")
  const [wppInstanceId, setWppInstanceId] = useState<string>("")
  const [sendHour, setSendHour] = useState<string>("")
  const [isSaving, setSaving] = useState(false)

  const fetchAll = useCallback(async () => {
    const [emailRes, wppRes, smtpRes, wppInstRes, settingsRes] = await Promise.all([
      fetch(`/api/automacao/email-templates?category=${eventType}`),
      fetch(`/api/automacao/templates-wpp?category=${eventType}`),
      fetch(`/api/leads/${leadId}/smtp-accounts`).catch(() => null),
      fetch(`/api/automacao/instancias`).catch(() => null),
      fetch(`/api/leads/${leadId}/automation-settings`),
    ])

    try {
      setEmailTpls((await emailRes.json()).templates ?? [])
      setWppTpls((await wppRes.json()).templates ?? [])
      if (smtpRes?.ok) setSmtpAccs((await smtpRes.json()).accounts ?? [])
      if (wppInstRes?.ok) setWppInsts((await wppInstRes.json()).instances ?? [])
      const settingsJson = await settingsRes.json()
      const row = (settingsJson.settings ?? []).find(
        (s: ExistingSetting) => s.event_type === eventType,
      )
      if (row) {
        setExisting(row)
        setEmailTemplateId(row.email_template_id ?? "")
        setWppTemplateId(row.wpp_template_id ?? "")
        setSmtpAccountId(row.smtp_account_id ?? "")
        setWppInstanceId(row.wpp_instance_id ?? "")
        setSendHour(row.send_hour !== null ? String(row.send_hour) : "")
      }
    } catch (err) {
      toast.error((err as Error).message)
    }
  }, [leadId, eventType])

  useEffect(() => {
    if (open) void fetchAll()
  }, [open, fetchAll])

  async function save() {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        event_type: eventType,
        email_template_id: emailTemplateId || null,
        wpp_template_id: wppTemplateId || null,
        smtp_account_id: smtpAccountId || null,
        wpp_instance_id: wppInstanceId || null,
        send_hour: sendHour ? Number(sendHour) : null,
      }
      const res = await fetch(`/api/leads/${leadId}/automation-settings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Erro")
      toast.success("Override guardado")
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function clear() {
    setSaving(true)
    try {
      const res = await fetch(
        `/api/leads/${leadId}/automation-settings?event_type=${eventType}`,
        { method: "DELETE" },
      )
      if (!res.ok) throw new Error((await res.json()).error ?? "Erro")
      toast.success("Override removido")
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Personalizar evento: {eventType}</DialogTitle>
          <DialogDescription>
            Campos vazios caem na cascata (lead → consultor → global).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label>Template de email</Label>
            <Select value={emailTemplateId} onValueChange={setEmailTemplateId}>
              <SelectTrigger><SelectValue placeholder="Usar cascata" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Usar cascata</SelectItem>
                {emailTpls.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.scope})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>Template de WhatsApp</Label>
            <Select value={wppTemplateId} onValueChange={setWppTemplateId}>
              <SelectTrigger><SelectValue placeholder="Usar cascata" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Usar cascata</SelectItem>
                {wppTpls.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.scope})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {smtpAccs.length > 0 && (
            <div className="grid gap-1">
              <Label>Conta SMTP</Label>
              <Select value={smtpAccountId} onValueChange={setSmtpAccountId}>
                <SelectTrigger><SelectValue placeholder="Automática (primeira)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Automática (primeira activa)</SelectItem>
                  {smtpAccs.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.display_name} — {a.email_address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {wppInsts.length > 0 && (
            <div className="grid gap-1">
              <Label>Instância WhatsApp</Label>
              <Select value={wppInstanceId} onValueChange={setWppInstanceId}>
                <SelectTrigger><SelectValue placeholder="Automática (primeira)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Automática (primeira conectada)</SelectItem>
                  {wppInsts.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-1">
            <Label>Hora de envio (Europe/Lisbon)</Label>
            <Select value={sendHour} onValueChange={setSendHour}>
              <SelectTrigger><SelectValue placeholder="Default (08:00)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Default (08:00)</SelectItem>
                {HOURS.map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {String(h).padStart(2, "0")}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          {existing && (
            <Button variant="ghost" onClick={clear} disabled={isSaving}>
              Remover override
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={isSaving}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
