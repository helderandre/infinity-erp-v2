"use client"

import { useCallback, useEffect, useState } from "react"
import { Mail, MessageCircle } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

interface Template {
  id: string
  name: string
  subject?: string
  description?: string
}

interface Account {
  id: string
  email?: string
  name?: string
  label?: string
}

interface WizardTemplateStepProps {
  channelEmail: boolean
  channelWhatsapp: boolean
  emailTemplateId: string | null
  wppTemplateId: string | null
  smtpAccountId: string | null
  wppInstanceId: string | null
  onEmailTemplateChange: (id: string | null) => void
  onWppTemplateChange: (id: string | null) => void
  onSmtpAccountChange: (id: string | null) => void
  onWppInstanceChange: (id: string | null) => void
}

export function WizardTemplateStep({
  channelEmail,
  channelWhatsapp,
  emailTemplateId,
  wppTemplateId,
  smtpAccountId,
  wppInstanceId,
  onEmailTemplateChange,
  onWppTemplateChange,
  onSmtpAccountChange,
  onWppInstanceChange,
}: WizardTemplateStepProps) {
  const [emailTemplates, setEmailTemplates] = useState<Template[]>([])
  const [wppTemplates, setWppTemplates] = useState<Template[]>([])
  const [smtpAccounts, setSmtpAccounts] = useState<Account[]>([])
  const [wppInstances, setWppInstances] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const promises: Promise<void>[] = []

      if (channelEmail) {
        promises.push(
          fetch("/api/automacao/email-templates?scope=consultant&active=true")
            .then((r) => r.json())
            .then((data) => setEmailTemplates(Array.isArray(data) ? data : [])),
          fetch("/api/consultant/accounts/email")
            .then((r) => r.json())
            .then((data) => setSmtpAccounts(Array.isArray(data) ? data : []))
            .catch(() => setSmtpAccounts([])),
        )
      }

      if (channelWhatsapp) {
        promises.push(
          fetch("/api/automacao/templates-wpp?scope=consultant&active=true")
            .then((r) => r.json())
            .then((data) => setWppTemplates(Array.isArray(data) ? data : []))
            .catch(() => setWppTemplates([])),
          fetch("/api/automacao/instancias")
            .then((r) => r.json())
            .then((data) => setWppInstances(Array.isArray(data) ? data : []))
            .catch(() => setWppInstances([])),
        )
      }

      await Promise.allSettled(promises)
    } catch {
      // Silently handle — selects will just be empty
    } finally {
      setLoading(false)
    }
  }, [channelEmail, channelWhatsapp])

  useEffect(() => { loadData() }, [loadData])

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {channelEmail && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Mail className="h-4 w-4 text-blue-600" />
            Email
          </div>

          <div className="space-y-2">
            <Label>Template de Email</Label>
            <Select
              value={emailTemplateId ?? "none"}
              onValueChange={(v) => onEmailTemplateChange(v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar template..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem template (usar cascata)</SelectItem>
                {emailTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}{t.subject ? ` — ${t.subject}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Conta de Email</Label>
            <Select
              value={smtpAccountId ?? "none"}
              onValueChange={(v) => onSmtpAccountChange(v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar conta..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Usar conta predefinida</SelectItem>
                {smtpAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.email ?? a.name ?? a.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {channelWhatsapp && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MessageCircle className="h-4 w-4 text-green-600" />
            WhatsApp
          </div>

          <div className="space-y-2">
            <Label>Template WhatsApp</Label>
            <Select
              value={wppTemplateId ?? "none"}
              onValueChange={(v) => onWppTemplateChange(v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar template..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem template (usar cascata)</SelectItem>
                {wppTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Instância WhatsApp</Label>
            <Select
              value={wppInstanceId ?? "none"}
              onValueChange={(v) => onWppInstanceChange(v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar instância..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Usar instância predefinida</SelectItem>
                {wppInstances.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>
                    {inst.name ?? inst.label ?? inst.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {!channelEmail && !channelWhatsapp && (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          Nenhum canal seleccionado. Volte ao passo 1 para seleccionar pelo menos um canal.
        </div>
      )}
    </div>
  )
}
