"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Calendar, Check, ChevronLeft, ChevronRight, Loader2, Mail, MessageCircle, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { LeadMultiSelect } from "./lead-multi-select"
import { WizardTemplateStep } from "./wizard-template-step"

const STEPS = [
  { label: "Dados do Evento", icon: Calendar },
  { label: "Contactos", icon: Users },
  { label: "Templates", icon: Mail },
]

interface CustomEventWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CustomEventWizard({ open, onOpenChange }: CustomEventWizardProps) {
  const [step, setStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Step 1: Event data
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [eventDate, setEventDate] = useState("")
  const [sendHour, setSendHour] = useState(9)
  const [isRecurring, setIsRecurring] = useState(true)
  const [channelEmail, setChannelEmail] = useState(true)
  const [channelWhatsapp, setChannelWhatsapp] = useState(false)

  // Step 2: Leads
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)

  // Step 3: Templates
  const [emailTemplateId, setEmailTemplateId] = useState<string | null>(null)
  const [wppTemplateId, setWppTemplateId] = useState<string | null>(null)
  const [smtpAccountId, setSmtpAccountId] = useState<string | null>(null)
  const [wppInstanceId, setWppInstanceId] = useState<string | null>(null)

  function resetForm() {
    setStep(0)
    setName("")
    setDescription("")
    setEventDate("")
    setSendHour(9)
    setIsRecurring(true)
    setChannelEmail(true)
    setChannelWhatsapp(false)
    setSelectedLeadIds([])
    setSelectAll(false)
    setEmailTemplateId(null)
    setWppTemplateId(null)
    setSmtpAccountId(null)
    setWppInstanceId(null)
  }

  function canProceed(): boolean {
    if (step === 0) {
      return name.trim().length >= 2 && !!eventDate && (channelEmail || channelWhatsapp)
    }
    if (step === 1) {
      return selectAll || selectedLeadIds.length > 0
    }
    return true
  }

  async function handleSubmit() {
    const channels: string[] = []
    if (channelEmail) channels.push("email")
    if (channelWhatsapp) channels.push("whatsapp")

    setIsSubmitting(true)
    try {
      // 1. Create the event
      const res = await fetch("/api/automacao/custom-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          event_date: eventDate,
          send_hour: sendHour,
          is_recurring: isRecurring,
          channels,
          email_template_id: channelEmail ? emailTemplateId : null,
          wpp_template_id: channelWhatsapp ? wppTemplateId : null,
          smtp_account_id: channelEmail ? smtpAccountId : null,
          wpp_instance_id: channelWhatsapp ? wppInstanceId : null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Erro ao criar evento")
      }
      const event = await res.json()

      // 2. Add leads
      const leadsRes = await fetch(`/api/automacao/custom-events/${event.id}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectAll ? { all: true } : { lead_ids: selectedLeadIds }),
      })
      if (!leadsRes.ok) throw new Error("Erro ao associar contactos")

      toast.success("Automatismo agendado com sucesso!")
      resetForm()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar evento")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o) }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar Automatismo</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            return (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && <div className={cn("h-px w-6", i <= step ? "bg-primary" : "bg-muted")} />}
                <div className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  i === step ? "bg-primary text-primary-foreground" :
                  i < step ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}>
                  {i < step ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Step content */}
        <div className="min-h-[300px]">
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="evt-name">Nome do Automatismo *</Label>
                <Input
                  id="evt-name"
                  placeholder="Ex: Páscoa, Ramadão, Dia da Mãe, Carnaval..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="evt-desc">Descrição (opcional)</Label>
                <Textarea
                  id="evt-desc"
                  placeholder="Breve descrição do evento..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="evt-date">Data *</Label>
                  <Input
                    id="evt-date"
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Hora de Envio</Label>
                  <Select value={String(sendHour)} onValueChange={(v) => setSendHour(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, h) => (
                        <SelectItem key={h} value={String(h)}>
                          {String(h).padStart(2, "0")}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="evt-recurring"
                  checked={isRecurring}
                  onCheckedChange={setIsRecurring}
                />
                <Label htmlFor="evt-recurring" className="cursor-pointer">
                  Recorrente (anual)
                </Label>
                <Badge variant="secondary" className="text-[10px]">
                  {isRecurring ? "Repete todos os anos" : "Apenas uma vez"}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label>Canais de Envio *</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={channelEmail}
                      onCheckedChange={(v) => setChannelEmail(!!v)}
                    />
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Email</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={channelWhatsapp}
                      onCheckedChange={(v) => setChannelWhatsapp(!!v)}
                    />
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">WhatsApp</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <LeadMultiSelect
              selectedIds={selectedLeadIds}
              onSelectionChange={setSelectedLeadIds}
              selectAll={selectAll}
              onSelectAllChange={setSelectAll}
            />
          )}

          {step === 2 && (
            <WizardTemplateStep
              channelEmail={channelEmail}
              channelWhatsapp={channelWhatsapp}
              emailTemplateId={emailTemplateId}
              wppTemplateId={wppTemplateId}
              smtpAccountId={smtpAccountId}
              wppInstanceId={wppInstanceId}
              onEmailTemplateChange={setEmailTemplateId}
              onWppTemplateChange={setWppTemplateId}
              onSmtpAccountChange={setSmtpAccountId}
              onWppInstanceChange={setWppInstanceId}
            />
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => step > 0 ? setStep(step - 1) : onOpenChange(false)}
            className="rounded-full"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {step === 0 ? "Cancelar" : "Anterior"}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="rounded-full"
            >
              Seguinte
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  A criar...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Agendar
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
