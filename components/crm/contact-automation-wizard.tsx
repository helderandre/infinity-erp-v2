"use client"

import { useEffect, useMemo, useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useContactAutomations } from "@/hooks/use-contact-automations"
import {
  CONTACT_AUTOMATION_EVENT_TYPES,
  CONTACT_AUTOMATION_EVENT_LABELS_PT,
  type ContactAutomationEventType,
} from "@/types/contact-automation"
import {
  EVENT_TYPE_TO_CATEGORY,
  getAllowedCategoriesForEvent,
  TEMPLATE_CATEGORY_LABELS_PT,
} from "@/lib/constants-template-categories"

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  contactId: string
  contactBirthday: string | null
  hasDeals: boolean
  onCreated: () => void
}

interface Deal {
  id: string
  tipo: string
  expected_close_date: string | null
  localizacao: string | null
}

interface SmtpAccount {
  id: string
  display_name: string
  email_address: string
  is_active: boolean
  is_verified: boolean
}

interface WppInstance {
  id: string
  name: string
  connection_status: string
  phone: string | null
}

interface TemplateLite {
  id: string
  name: string
  subject?: string
  category: string | null
}

type Channel = "email" | "whatsapp"

export function ContactAutomationWizard({
  open,
  onOpenChange,
  contactId,
  contactBirthday,
  hasDeals,
  onCreated,
}: Props) {
  const { create } = useContactAutomations(contactId)
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  // Step 1
  const [eventType, setEventType] = useState<ContactAutomationEventType>("natal")
  const [festLabel, setFestLabel] = useState("")
  const [festMonth, setFestMonth] = useState<number>(1)
  const [festDay, setFestDay] = useState<number>(1)
  const [dealId, setDealId] = useState<string | null>(null)

  // Step 2
  const [channels, setChannels] = useState<Channel[]>(["email"])

  // Step 3
  const [smtpAccountId, setSmtpAccountId] = useState<string | null>(null)
  const [wppInstanceId, setWppInstanceId] = useState<string | null>(null)

  // Step 4
  const [emailTemplateId, setEmailTemplateId] = useState<string | null>(null)
  const [wppTemplateId, setWppTemplateId] = useState<string | null>(null)
  const [overrideEmailSubject, setOverrideEmailSubject] = useState("")
  const [overrideEmailBody, setOverrideEmailBody] = useState("")
  const [editEmailOverride, setEditEmailOverride] = useState(false)

  // Step 5
  const [recurrence, setRecurrence] = useState<"once" | "yearly">("yearly")

  // Step 6
  const [sendHour, setSendHour] = useState(8)
  const [timezone, setTimezone] = useState("Europe/Lisbon")

  // Data
  const [deals, setDeals] = useState<Deal[]>([])
  const [smtpAccounts, setSmtpAccounts] = useState<SmtpAccount[]>([])
  const [wppInstances, setWppInstances] = useState<WppInstance[]>([])
  const [emailTemplates, setEmailTemplates] = useState<TemplateLite[]>([])
  const [wppTemplates, setWppTemplates] = useState<TemplateLite[]>([])

  useEffect(() => {
    if (!open) return
    // Carrega deals, smtps, instances iniciais
    if (hasDeals) {
      fetch(`/api/negocios?lead_id=${contactId}&limit=100`)
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((json) => setDeals(Array.isArray(json) ? json : json?.data ?? []))
        .catch(() => setDeals([]))
    }
    fetch(`/api/email/account`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        const arr = Array.isArray(list) ? list : list?.accounts ?? list?.data ?? []
        const active = arr.filter((a: SmtpAccount) => a.is_active && a.is_verified)
        setSmtpAccounts(active)
        if (active.length === 1) setSmtpAccountId(active[0].id)
      })
      .catch(() => setSmtpAccounts([]))
    fetch(`/api/whatsapp/instances`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        const arr = Array.isArray(list) ? list : list?.instances ?? []
        const connected = arr.filter((i: WppInstance) => i.connection_status === "connected")
        setWppInstances(connected)
        if (connected.length === 1) setWppInstanceId(connected[0].id)
      })
      .catch(() => setWppInstances([]))
  }, [open, contactId, hasDeals])

  // Filtra templates quando muda evento ou canais
  useEffect(() => {
    if (!open) return
    const allowed = getAllowedCategoriesForEvent(eventType).join(",")
    if (channels.includes("email")) {
      fetch(`/api/libraries/emails?categories=${encodeURIComponent(allowed)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((list) => setEmailTemplates(Array.isArray(list) ? list : []))
        .catch(() => setEmailTemplates([]))
    } else {
      setEmailTemplates([])
    }
    if (channels.includes("whatsapp")) {
      fetch(`/api/automacao/templates-wpp?categories=${encodeURIComponent(allowed)}`)
        .then((r) => (r.ok ? r.json() : { templates: [] }))
        .then((res) => setWppTemplates(res.templates ?? []))
        .catch(() => setWppTemplates([]))
    } else {
      setWppTemplates([])
    }
  }, [open, eventType, channels])

  const canAdvance = useMemo(() => {
    if (step === 1) {
      if (eventType === "aniversario_contacto" && !contactBirthday) return false
      if (eventType === "aniversario_fecho" && !dealId) return false
      if (eventType === "festividade") {
        return festLabel.trim().length > 0 && festMonth >= 1 && festMonth <= 12 && festDay >= 1 && festDay <= 31
      }
      return true
    }
    if (step === 2) return channels.length > 0
    if (step === 3) {
      if (channels.includes("email") && !smtpAccountId) return false
      if (channels.includes("whatsapp") && !wppInstanceId) return false
      return true
    }
    if (step === 4) {
      if (channels.includes("email") && !emailTemplateId && !(editEmailOverride && overrideEmailBody)) return false
      if (channels.includes("whatsapp") && !wppTemplateId) return false
      return true
    }
    return true
  }, [step, eventType, contactBirthday, dealId, festLabel, festMonth, festDay, channels, smtpAccountId, wppInstanceId, emailTemplateId, wppTemplateId, editEmailOverride, overrideEmailBody])

  const reset = () => {
    setStep(1)
    setEventType("natal")
    setFestLabel("")
    setFestMonth(1)
    setFestDay(1)
    setDealId(null)
    setChannels(["email"])
    setSmtpAccountId(null)
    setWppInstanceId(null)
    setEmailTemplateId(null)
    setWppTemplateId(null)
    setOverrideEmailSubject("")
    setOverrideEmailBody("")
    setEditEmailOverride(false)
    setRecurrence("yearly")
    setSendHour(8)
    setTimezone("Europe/Lisbon")
  }

  const submit = async () => {
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        event_type: eventType,
        channels,
        recurrence,
        send_hour: sendHour,
        timezone,
      }
      if (eventType === "festividade") {
        payload.event_config = { label: festLabel, month: festMonth, day: festDay }
      } else {
        payload.event_config = {}
      }
      if (eventType === "aniversario_fecho") payload.deal_id = dealId
      if (channels.includes("email")) {
        payload.email_template_id = emailTemplateId
        payload.smtp_account_id = smtpAccountId
        if (editEmailOverride && (overrideEmailSubject || overrideEmailBody)) {
          payload.template_overrides = {
            email: {
              subject: overrideEmailSubject || undefined,
              body_html: overrideEmailBody || undefined,
            },
          }
        }
      }
      if (channels.includes("whatsapp")) {
        payload.wpp_template_id = wppTemplateId
        payload.wpp_instance_id = wppInstanceId
      }
      await create(payload)
      toast.success("Automatismo criado com sucesso")
      reset()
      onCreated()
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar")
    } finally {
      setSubmitting(false)
    }
  }

  const allowedCats = getAllowedCategoriesForEvent(eventType)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] overflow-hidden p-0">
        <div className="flex flex-col">
        <DialogHeader className="pb-4">
          <DialogTitle>Criar automatismo ({step}/6)</DialogTitle>
          <DialogDescription>Agendar envio automático por email ou WhatsApp.</DialogDescription>
        </DialogHeader>
        <div className="min-w-0 pb-4 space-y-4 [&>*]:min-w-0">

        {step === 1 && (
          <div className="space-y-3">
            <Label>Tipo de evento</Label>
            <RadioGroup value={eventType} onValueChange={(v) => setEventType(v as ContactAutomationEventType)}>
              {CONTACT_AUTOMATION_EVENT_TYPES
                // Os 3 eventos fixos passam a ser implícitos (geridos no hub CRM + overrides).
                .filter((t) => t !== "aniversario_contacto" && t !== "natal" && t !== "ano_novo")
                .map((t) => {
                const disabled = t === "aniversario_fecho" && !hasDeals
                return (
                  <div key={t} className={`flex items-center gap-2 ${disabled ? "opacity-40" : ""}`}>
                    <RadioGroupItem value={t} id={t} disabled={disabled} />
                    <Label htmlFor={t} className="cursor-pointer font-normal">
                      {CONTACT_AUTOMATION_EVENT_LABELS_PT[t]}
                      {disabled && t === "aniversario_fecho" && (
                        <span className="ml-1 text-xs text-muted-foreground">(contacto sem negócios)</span>
                      )}
                    </Label>
                  </div>
                )
              })}
            </RadioGroup>
            {eventType === "aniversario_fecho" && (
              <div className="space-y-1 pt-2">
                <Label>Negócio</Label>
                <Select value={dealId ?? ""} onValueChange={(v) => setDealId(v)}>
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue placeholder="Escolher negócio" className="truncate" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
                    {deals.map((d) => (
                      <SelectItem key={d.id} value={d.id} disabled={!d.expected_close_date}>
                        <span className="truncate">
                          {d.tipo}{d.localizacao ? ` — ${d.localizacao}` : ""}{" "}
                          {d.expected_close_date ? `(fecho: ${d.expected_close_date})` : "(sem data fecho)"}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {eventType === "festividade" && (
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="col-span-3 space-y-1">
                  <Label>Nome da festividade</Label>
                  <Input value={festLabel} onChange={(e) => setFestLabel(e.target.value)} placeholder="ex: São João" />
                </div>
                <div className="space-y-1">
                  <Label>Mês</Label>
                  <Input type="number" min={1} max={12} value={festMonth} onChange={(e) => setFestMonth(+e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Dia</Label>
                  <Input type="number" min={1} max={31} value={festDay} onChange={(e) => setFestDay(+e.target.value)} />
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <Label>Canal(is)</Label>
            <div className="space-y-2">
              {(["email", "whatsapp"] as Channel[]).map((c) => (
                <label key={c} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={channels.includes(c)}
                    onCheckedChange={(v) =>
                      setChannels(v
                        ? [...new Set([...channels, c])]
                        : channels.filter((x) => x !== c))
                    }
                  />
                  <span className="text-sm">{c === "email" ? "Email" : "WhatsApp"}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            {channels.includes("email") && (
              <div className="space-y-1">
                <Label>Conta de email (remetente)</Label>
                {smtpAccounts.length === 0 ? (
                  <p className="text-sm text-red-700">Nenhuma conta SMTP activa. Configura em Definições → Email.</p>
                ) : (
                  <Select value={smtpAccountId ?? ""} onValueChange={setSmtpAccountId}>
                    <SelectTrigger className="w-full min-w-0">
                      <SelectValue placeholder="Escolher conta" className="truncate" />
                    </SelectTrigger>
                    <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
                      {smtpAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="truncate">
                            {a.display_name} &lt;{a.email_address}&gt;
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            {channels.includes("whatsapp") && (
              <div className="space-y-1">
                <Label>Instância WhatsApp</Label>
                {wppInstances.length === 0 ? (
                  <p className="text-sm text-red-700">Nenhuma instância conectada. Configura em Automações → WhatsApp.</p>
                ) : (
                  <Select value={wppInstanceId ?? ""} onValueChange={setWppInstanceId}>
                    <SelectTrigger className="w-full min-w-0">
                      <SelectValue placeholder="Escolher instância" className="truncate" />
                    </SelectTrigger>
                    <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
                      {wppInstances.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          <span className="truncate">
                            {i.name} {i.phone ? `(${i.phone})` : ""}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-muted-foreground">Categorias permitidas:</span>
              {allowedCats.map((c) => (
                <Badge key={c} variant="outline" className="text-[10px]">
                  {TEMPLATE_CATEGORY_LABELS_PT[c]}
                </Badge>
              ))}
            </div>
            {channels.includes("email") && (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Template de email</Label>
                  <button
                    type="button"
                    className="text-xs text-primary underline"
                    onClick={() => setEditEmailOverride((v) => !v)}
                  >
                    {editEmailOverride ? "Usar só o template" : "Editar só para este contacto"}
                  </button>
                </div>
                <Select value={emailTemplateId ?? ""} onValueChange={setEmailTemplateId}>
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue placeholder="Escolher template" className="truncate" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
                    {emailTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="flex flex-col min-w-0">
                          <span className="truncate font-medium">{t.name}</span>
                          {t.subject && (
                            <span className="truncate text-xs text-muted-foreground">{t.subject}</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editEmailOverride && (
                  <div className="space-y-2 pt-2">
                    <Input
                      placeholder="Assunto (deixa vazio para usar do template)"
                      value={overrideEmailSubject}
                      onChange={(e) => setOverrideEmailSubject(e.target.value)}
                    />
                    <Textarea
                      placeholder="Corpo HTML (deixa vazio para usar do template)"
                      rows={6}
                      value={overrideEmailBody}
                      onChange={(e) => setOverrideEmailBody(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}
            {channels.includes("whatsapp") && (
              <div className="space-y-2 rounded-lg border p-3">
                <Label className="text-sm">Template de WhatsApp</Label>
                <Select value={wppTemplateId ?? ""} onValueChange={setWppTemplateId}>
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue placeholder="Escolher template" className="truncate" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
                    {wppTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="truncate">{t.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3">
            <Label>Recorrência</Label>
            <RadioGroup value={recurrence} onValueChange={(v) => setRecurrence(v as "once" | "yearly")}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="once" id="once" />
                <Label htmlFor="once" className="cursor-pointer font-normal">Apenas uma vez (próxima ocorrência)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="yearly" id="yearly" />
                <Label htmlFor="yearly" className="cursor-pointer font-normal">Todos os anos</Label>
              </div>
            </RadioGroup>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Hora de envio</Label>
                <Input type="number" min={0} max={23} value={sendHour} onChange={(e) => setSendHour(+e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Europe/Lisbon">Europe/Lisbon</SelectItem>
                    <SelectItem value="Europe/London">Europe/London</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <p><strong>Evento:</strong> {CONTACT_AUTOMATION_EVENT_LABELS_PT[eventType]}{eventType === "festividade" ? ` (${festLabel} ${festDay}/${festMonth})` : ""}</p>
              <p><strong>Canais:</strong> {channels.join(", ")}</p>
              <p><strong>Recorrência:</strong> {recurrence === "yearly" ? "Todos os anos" : "Apenas uma vez"}</p>
              <p><strong>Hora:</strong> {String(sendHour).padStart(2, "0")}:00 {timezone}</p>
              <p className="text-xs text-muted-foreground pt-1">Categoria sugerida para novos templates: {TEMPLATE_CATEGORY_LABELS_PT[EVENT_TYPE_TO_CATEGORY[eventType]]}</p>
            </div>
          </div>
        )}

        </div>
        <DialogFooter className="flex items-center justify-between border-t px-6 py-4">
          <div>
            {step > 1 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={submitting}>
                Voltar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            {step < 6 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canAdvance}>
                Avançar
              </Button>
            ) : (
              <Button onClick={submit} disabled={submitting}>
                {submitting ? "A criar..." : "Confirmar"}
              </Button>
            )}
          </div>
        </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
