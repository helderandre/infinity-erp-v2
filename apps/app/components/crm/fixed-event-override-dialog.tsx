"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Mail, MessageCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const HOURS = Array.from({ length: 24 }, (_, i) => i)

const EVENT_LABELS: Record<string, string> = {
  aniversario_contacto: "Aniversário do contacto",
  natal: "Natal",
  ano_novo: "Ano Novo",
}

const DEFAULT_HOURS: Record<string, number> = {
  aniversario_contacto: 9,
  natal: 5,
  ano_novo: 5,
}

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
  is_default?: boolean
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

interface Mute {
  id: string
  event_type: string | null
  channel: string | null
  lead_id: string | null
}

const SCOPE_PRIORITY: Record<string, number> = { lead: 0, consultant: 1, global: 2 }
const SCOPE_LABELS: Record<string, string> = { lead: "contacto", consultant: "consultor", global: "geral" }

function scopeLabel(scope: string) {
  return SCOPE_LABELS[scope] ?? scope
}

function resolveTemplate(templates: Template[]): Template | null {
  if (templates.length === 0) return null
  const sorted = [...templates]
    .filter((t) => t.is_active)
    .sort((a, b) => (SCOPE_PRIORITY[a.scope] ?? 9) - (SCOPE_PRIORITY[b.scope] ?? 9))
  return sorted[0] ?? null
}

function resolveSmtp(accounts: SmtpAccount[]): SmtpAccount | null {
  const active = accounts.filter((a) => a.is_active)
  return active.find((a) => a.is_default) ?? active[0] ?? null
}

function resolveWpp(instances: WppInstance[]): WppInstance | null {
  return instances.find((i) => i.connection_status === "connected") ?? null
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
  const [mutes, setMutes] = useState<Mute[]>([])

  const [emailTemplateId, setEmailTemplateId] = useState<string>("__none__")
  const [wppTemplateId, setWppTemplateId] = useState<string>("__none__")
  const [smtpAccountId, setSmtpAccountId] = useState<string>("__none__")
  const [wppInstanceId, setWppInstanceId] = useState<string>("__none__")
  const [sendHour, setSendHour] = useState<string>("__none__")
  const [isSaving, setSaving] = useState(false)

  // Resolved defaults
  const resolvedEmail = useMemo(() => resolveTemplate(emailTpls), [emailTpls])
  const resolvedWpp = useMemo(() => resolveTemplate(wppTpls), [wppTpls])
  const resolvedSmtp = useMemo(() => resolveSmtp(smtpAccs), [smtpAccs])
  const resolvedWppInst = useMemo(() => resolveWpp(wppInsts), [wppInsts])
  const defaultHour = DEFAULT_HOURS[eventType] ?? 9

  // Channel mute state
  const emailMute = mutes.find(
    (m) => m.lead_id === leadId && m.event_type === eventType && m.channel === "email",
  )
  const wppMute = mutes.find(
    (m) => m.lead_id === leadId && m.event_type === eventType && m.channel === "whatsapp",
  )
  const allMute = mutes.find(
    (m) => m.lead_id === leadId && m.event_type === eventType && m.channel === null,
  )
  const emailActive = !emailMute && !allMute
  const wppActive = !wppMute && !allMute

  const fetchAll = useCallback(async () => {
    const [emailRes, wppRes, smtpRes, wppInstRes, settingsRes, mutesRes] = await Promise.all([
      fetch(`/api/automacao/email-templates?category=${eventType}`),
      fetch(`/api/automacao/templates-wpp?category=${eventType}`),
      fetch(`/api/leads/${leadId}/smtp-accounts`).catch(() => null),
      fetch(`/api/automacao/instancias`).catch(() => null),
      fetch(`/api/leads/${leadId}/automation-settings`),
      fetch(`/api/contact-automation-mutes?lead_id=${leadId}&event_type=${eventType}`),
    ])

    try {
      setEmailTpls((await emailRes.json()).templates ?? [])
      setWppTpls((await wppRes.json()).templates ?? [])
      if (smtpRes?.ok) setSmtpAccs((await smtpRes.json()).accounts ?? [])
      if (wppInstRes?.ok) setWppInsts((await wppInstRes.json()).instances ?? [])
      if (mutesRes.ok) setMutes((await mutesRes.json()).mutes ?? [])
      const settingsJson = await settingsRes.json()
      const row = (settingsJson.settings ?? []).find(
        (s: ExistingSetting) => s.event_type === eventType,
      )
      if (row) {
        setExisting(row)
        setEmailTemplateId(row.email_template_id ?? "__none__")
        setWppTemplateId(row.wpp_template_id ?? "__none__")
        setSmtpAccountId(row.smtp_account_id ?? "__none__")
        setWppInstanceId(row.wpp_instance_id ?? "__none__")
        setSendHour(row.send_hour !== null ? String(row.send_hour) : "__none__")
      } else {
        setExisting(null)
        setEmailTemplateId("__none__")
        setWppTemplateId("__none__")
        setSmtpAccountId("__none__")
        setWppInstanceId("__none__")
        setSendHour("__none__")
      }
    } catch (err) {
      toast.error((err as Error).message)
    }
  }, [leadId, eventType])

  useEffect(() => {
    if (open) void fetchAll()
  }, [open, fetchAll])

  async function toggleChannelMute(channel: "email" | "whatsapp") {
    const existingMute = channel === "email" ? emailMute : wppMute
    try {
      if (existingMute) {
        // Remove channel-specific mute → activate
        const res = await fetch(`/api/contact-automation-mutes?id=${existingMute.id}`, { method: "DELETE" })
        if (!res.ok) throw new Error((await res.json()).error ?? "Erro")
      } else if (allMute) {
        // Has an "all channels" mute — remove it and create the OTHER channel mute
        // (effectively: unmute this channel, keep the other muted)
        const otherChannel = channel === "email" ? "whatsapp" : "email"
        await fetch(`/api/contact-automation-mutes?id=${allMute.id}`, { method: "DELETE" })
        await fetch(`/api/contact-automation-mutes`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lead_id: leadId, event_type: eventType, channel: otherChannel }),
        })
      } else {
        // Create channel-specific mute → deactivate
        const res = await fetch(`/api/contact-automation-mutes`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lead_id: leadId, event_type: eventType, channel }),
        })
        if (!res.ok) throw new Error((await res.json()).error ?? "Erro")
      }
      void fetchAll()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function save() {
    setSaving(true)
    try {
      const none = (v: string) => (!v || v === "__none__") ? null : v
      const payload: Record<string, unknown> = {
        event_type: eventType,
        email_template_id: none(emailTemplateId),
        wpp_template_id: none(wppTemplateId),
        smtp_account_id: none(smtpAccountId),
        wpp_instance_id: none(wppInstanceId),
        send_hour: none(sendHour) ? Number(sendHour) : null,
      }
      const res = await fetch(`/api/leads/${leadId}/automation-settings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Erro")
      toast.success("Personalização guardada")
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
      toast.success("Personalização removida")
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const eventLabel = EVENT_LABELS[eventType] ?? eventType

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Personalizar: {eventLabel}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          {/* ═══ Channel toggles ═══ */}
          <div className="grid gap-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Canais de envio</Label>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Email</span>
              </div>
              <Switch
                checked={emailActive}
                onCheckedChange={() => void toggleChannelMute("email")}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium">WhatsApp</span>
              </div>
              <Switch
                checked={wppActive}
                onCheckedChange={() => void toggleChannelMute("whatsapp")}
              />
            </div>
          </div>

          {/* ═══ Email template ═══ */}
          {emailActive && (
            <div className="grid gap-1">
              <Label>Template de email</Label>
              <Select value={emailTemplateId} onValueChange={setEmailTemplateId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    {resolvedEmail
                      ? `${resolvedEmail.name} (${scopeLabel(resolvedEmail.scope)})`
                      : "Nenhum template disponível"}
                  </SelectItem>
                  {emailTpls
                    .filter((t) => t.id !== resolvedEmail?.id)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({scopeLabel(t.scope)})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ═══ SMTP account ═══ */}
          {emailActive && smtpAccs.length > 0 && (
            <div className="grid gap-1">
              <Label>Conta SMTP</Label>
              <Select value={smtpAccountId} onValueChange={setSmtpAccountId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    {resolvedSmtp
                      ? `${resolvedSmtp.display_name} — ${resolvedSmtp.email_address}`
                      : "Nenhuma conta activa"}
                  </SelectItem>
                  {smtpAccs
                    .filter((a) => a.id !== resolvedSmtp?.id)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.display_name} — {a.email_address}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ═══ WPP template ═══ */}
          {wppActive && (
            <div className="grid gap-1">
              <Label>Template de WhatsApp</Label>
              <Select value={wppTemplateId} onValueChange={setWppTemplateId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    {resolvedWpp
                      ? `${resolvedWpp.name} (${scopeLabel(resolvedWpp.scope)})`
                      : "Nenhum template disponível"}
                  </SelectItem>
                  {wppTpls
                    .filter((t) => t.id !== resolvedWpp?.id)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({scopeLabel(t.scope)})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ═══ WPP instance ═══ */}
          {wppActive && wppInsts.length > 0 && (
            <div className="grid gap-1">
              <Label>Instância WhatsApp</Label>
              <Select value={wppInstanceId} onValueChange={setWppInstanceId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    {resolvedWppInst
                      ? resolvedWppInst.name
                      : "Nenhuma instância conectada"}
                  </SelectItem>
                  {wppInsts
                    .filter((i) => i.id !== resolvedWppInst?.id)
                    .map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name} {i.connection_status !== "connected" ? "(desconectada)" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ═══ Send hour ═══ */}
          <div className="grid gap-1">
            <Label>Hora de envio</Label>
            <p className="text-[11px] text-muted-foreground">Horário de Lisboa (Europe/Lisbon)</p>
            <Select value={sendHour} onValueChange={setSendHour}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  {String(defaultHour).padStart(2, "0")}:00
                </SelectItem>
                {HOURS.filter((h) => h !== defaultHour).map((h) => (
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
              Repor predefinição
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
