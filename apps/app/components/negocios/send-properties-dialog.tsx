'use client'

import {
  CheckCircle2,
  Loader2,
  Mail,
  MessageCircle,
  Send,
  X,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { SendRichText } from '@/components/documents/send-rich-text'
import {
  useSendProperties,
  type PropertySendCandidate,
  type SendResult,
} from '@/hooks/use-send-properties'
import { isValidEmail } from '@/lib/documents/email-validate'
import {
  formatE164ForDisplay,
  normalizeToE164,
} from '@/lib/documents/phone'
import {
  buildDefaultPropertiesIntro,
  buildDefaultPropertiesSubject,
  buildDefaultPropertiesWhatsappMessage,
} from '@/lib/documents/send-defaults'
import {
  renderPropertyGrid,
  type PropertyCardInput,
} from '@/lib/email/property-card-html'

export interface SendPropertiesDialogItem {
  id: string
  title: string
  priceLabel: string
  href: string
  location?: string
  specs?: string
  imageUrl?: string | null
  reference?: string | null
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  negocioId: string
  items: SendPropertiesDialogItem[]
  onSuccess?: () => void
}

type ChannelKey = 'email' | 'whatsapp'

type Choice = {
  candidate: PropertySendCandidate
  emailChecked: boolean
  whatsappChecked: boolean
}

type Adhoc = { id: string; value: string; channel: ChannelKey }

export function SendPropertiesDialog(props: Props) {
  const { open, onOpenChange, negocioId, items } = props
  const data = useSendProperties({ negocioId, enabled: open })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:w-full">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>Enviar imóveis</DialogTitle>
          <DialogDescription>
            {items.length} {items.length === 1 ? 'imóvel seleccionado' : 'imóveis seleccionados'}
          </DialogDescription>
        </DialogHeader>

        {data.isLoading || !data.recipients ? (
          <div className="space-y-3 px-6 py-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <Body
            {...props}
            data={data}
          />
        )}

        {data.isLoading || !data.recipients ? (
          <DialogFooter className="shrink-0 gap-2 border-t px-6 py-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  open,
  onOpenChange,
  negocioId,
  items,
  onSuccess,
  data,
}: Props & { data: ReturnType<typeof useSendProperties> }) {
  const { recipients, emailAccounts, whatsappInstances, results, isSending, send } = data
  if (!recipients) return null

  const [emailEnabled, setEmailEnabled] = useState(emailAccounts.length > 0)
  const [whatsappEnabled, setWhatsappEnabled] = useState(false)
  const [accountId, setAccountId] = useState(
    emailAccounts.length === 1 ? emailAccounts[0].id : ''
  )
  const [instanceId, setInstanceId] = useState(
    whatsappInstances.length === 1 ? whatsappInstances[0].id : ''
  )

  const initialChoices: Choice[] = useMemo(() => {
    const list: Choice[] = []
    if (recipients.consultant) {
      list.push({
        candidate: recipients.consultant,
        emailChecked: false,
        whatsappChecked: false,
      })
    }
    for (const o of recipients.owners) {
      list.push({
        candidate: o,
        emailChecked: !!o.email,
        whatsappChecked: !!o.phone,
      })
    }
    return list
  }, [recipients])
  const [choices, setChoices] = useState<Choice[]>(initialChoices)
  const [adhoc, setAdhoc] = useState<Adhoc[]>([])
  const [adhocEmail, setAdhocEmail] = useState('')
  const [adhocPhone, setAdhocPhone] = useState('')

  const [subject, setSubject] = useState(() =>
    buildDefaultPropertiesSubject({
      entityLabel: recipients.entityLabel,
      count: items.length,
    })
  )
  const [intro, setIntro] = useState(() =>
    buildDefaultPropertiesIntro({
      leadFirstName: recipients.leadFirstName,
      senderName: recipients.consultant?.label ?? null,
      count: items.length,
    })
  )
  const [whatsappMessage, setWhatsappMessage] = useState(() =>
    buildDefaultPropertiesWhatsappMessage({
      leadFirstName: recipients.leadFirstName,
      properties: items,
    })
  )

  // Keep defaults in sync if dialog reopens with different items/recipients
  useEffect(() => {
    setSubject(
      buildDefaultPropertiesSubject({
        entityLabel: recipients.entityLabel,
        count: items.length,
      })
    )
    setIntro(
      buildDefaultPropertiesIntro({
        leadFirstName: recipients.leadFirstName,
        senderName: recipients.consultant?.label ?? null,
        count: items.length,
      })
    )
    setWhatsappMessage(
      buildDefaultPropertiesWhatsappMessage({
        leadFirstName: recipients.leadFirstName,
        properties: items,
      })
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipients.leadFirstName, recipients.entityLabel, items.length])

  const setChoice = (
    id: string,
    source: PropertySendCandidate['source'],
    channel: ChannelKey,
    value: boolean
  ) => {
    setChoices((prev) =>
      prev.map((c) =>
        c.candidate.id === id && c.candidate.source === source
          ? {
              ...c,
              emailChecked: channel === 'email' ? value : c.emailChecked,
              whatsappChecked:
                channel === 'whatsapp' ? value : c.whatsappChecked,
            }
          : c
      )
    )
  }

  const addAdhocEmail = () => {
    const v = adhocEmail.trim()
    if (!v) return
    if (!isValidEmail(v)) {
      toast.error('Email inválido')
      return
    }
    if (adhoc.some((a) => a.channel === 'email' && a.value === v)) {
      setAdhocEmail('')
      return
    }
    setAdhoc((p) => [
      ...p,
      { id: `adhoc-email-${Date.now()}`, value: v, channel: 'email' },
    ])
    setAdhocEmail('')
  }

  const addAdhocPhone = () => {
    const e164 = normalizeToE164(adhocPhone, 'PT')
    if (!e164) {
      toast.error('Telemóvel inválido')
      return
    }
    if (adhoc.some((a) => a.channel === 'whatsapp' && a.value === e164)) {
      setAdhocPhone('')
      return
    }
    setAdhoc((p) => [
      ...p,
      { id: `adhoc-wa-${Date.now()}`, value: e164, channel: 'whatsapp' },
    ])
    setAdhocPhone('')
  }

  const removeAdhoc = (id: string) =>
    setAdhoc((p) => p.filter((a) => a.id !== id))

  const emailRecipients = useMemo(() => {
    const set = new Set<string>()
    for (const c of choices) {
      if (c.emailChecked && c.candidate.email) set.add(c.candidate.email)
    }
    for (const a of adhoc) {
      if (a.channel === 'email') set.add(a.value)
    }
    return Array.from(set)
  }, [choices, adhoc])

  const whatsappRecipients = useMemo(() => {
    const set = new Set<string>()
    for (const c of choices) {
      if (c.whatsappChecked && c.candidate.phone) {
        const e164 = normalizeToE164(c.candidate.phone, 'PT')
        if (e164) set.add(e164)
      }
    }
    for (const a of adhoc) {
      if (a.channel === 'whatsapp') set.add(a.value)
    }
    return Array.from(set)
  }, [choices, adhoc])

  const canSubmit = useMemo(() => {
    if (items.length === 0) return false
    if (!emailEnabled && !whatsappEnabled) return false
    if (emailEnabled) {
      if (!accountId) return false
      if (emailRecipients.length === 0) return false
      if (!subject.trim() || !intro.trim()) return false
    }
    if (whatsappEnabled) {
      if (!instanceId) return false
      if (whatsappRecipients.length === 0) return false
    }
    return true
  }, [
    items.length,
    emailEnabled,
    whatsappEnabled,
    accountId,
    emailRecipients.length,
    subject,
    intro,
    instanceId,
    whatsappRecipients.length,
  ])

  const failed = useMemo(
    () => results.filter((r) => r.status === 'failed'),
    [results]
  )

  const handleSubmit = async (onlyFailed?: SendResult[]) => {
    const emailTo = onlyFailed
      ? onlyFailed.filter((r) => r.channel === 'email').map((r) => r.to)
      : emailRecipients
    const whatsappTo = onlyFailed
      ? onlyFailed.filter((r) => r.channel === 'whatsapp').map((r) => r.to)
      : whatsappRecipients

    const result = await send({
      negocioId,
      negocio_property_ids: items.map((i) => i.id),
      email:
        emailEnabled && emailTo.length > 0
          ? {
              account_id: accountId,
              subject: subject.trim(),
              body_html: intro,
              recipients: emailTo,
            }
          : undefined,
      whatsapp:
        whatsappEnabled && whatsappTo.length > 0
          ? {
              instance_id: instanceId,
              message: whatsappMessage.trim() || undefined,
              recipients: whatsappTo,
            }
          : undefined,
    })

    if (result.ok) {
      const ok = (result.results ?? []).filter((r) => r.status === 'success').length
      const ko = (result.results ?? []).length - ok
      if (ko === 0) {
        toast.success(`Envio concluído: ${ok} sucessos`)
        onSuccess?.()
      } else {
        toast.warning(`Envio concluído: ${ok} sucessos, ${ko} falhas`)
      }
    }
  }

  const previewGridHtml = useMemo(() => {
    const cards: PropertyCardInput[] = items.map((i) => ({
      title: i.title,
      priceLabel: i.priceLabel,
      location: i.location || '',
      specs: i.specs || '',
      imageUrl: i.imageUrl ?? null,
      href: i.href,
      reference: i.reference ?? null,
    }))
    return renderPropertyGrid(cards)
  }, [items])

  const previewSrcDoc = useMemo(() => {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:16px;background:#f4f4f4;font-family:Arial,sans-serif;color:#0f172a;}.wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:16px;}</style></head><body><div class="wrap">${intro}${previewGridHtml}</div></body></html>`
  }, [intro, previewGridHtml])

  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
        {/* EMAIL */}
        <ChannelBlock
          label="Email"
          enabled={emailEnabled}
          onEnabledChange={setEmailEnabled}
          senderAvailable={emailAccounts.length > 0}
          senderUnavailableLabel="Sem conta de email configurada"
          configureHref="/dashboard/definicoes/email"
          configureLabel="Configurar"
        >
          <SenderPickerEmail
            accounts={emailAccounts}
            value={accountId}
            onChange={setAccountId}
          />
          <RecipientsBlock
            channel="email"
            choices={choices}
            onToggle={(id, source, v) => setChoice(id, source, 'email', v)}
            adhoc={adhoc}
            onRemoveAdhoc={removeAdhoc}
          />
          <div className="flex gap-2">
            <Input
              value={adhocEmail}
              onChange={(e) => setAdhocEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addAdhocEmail()
                }
              }}
              placeholder="Adicionar email"
            />
            <Button
              type="button"
              variant="outline"
              onClick={addAdhocEmail}
              disabled={!adhocEmail.trim()}
            >
              +
            </Button>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sp-subject">Assunto</Label>
            <Input
              id="sp-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Mensagem (acima da grelha)</Label>
            <SendRichText
              value={intro}
              onChange={setIntro}
              placeholder="Escreva aqui a mensagem que acompanha os imóveis…"
              minHeightClass="min-h-[120px]"
            />
            <p className="text-[10px] text-muted-foreground">
              A grelha com os imóveis é gerada automaticamente abaixo desta
              mensagem. Links externos podem não gerar pré-visualização rica.
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Pré-visualização do email
            </Label>
            <div className="overflow-hidden rounded-md border bg-[#f4f4f4]">
              <iframe
                title="Pré-visualização do email"
                srcDoc={previewSrcDoc}
                sandbox=""
                className="block h-[420px] w-full border-0"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Assim aparecerá aos destinatários: a sua mensagem seguida da
              grelha com {items.length}{' '}
              {items.length === 1 ? 'imóvel' : 'imóveis'}.
            </p>
          </div>
        </ChannelBlock>

        {/* WHATSAPP */}
        <ChannelBlock
          label="WhatsApp"
          enabled={whatsappEnabled}
          onEnabledChange={setWhatsappEnabled}
          senderAvailable={whatsappInstances.length > 0}
          senderUnavailableLabel="Sem instância de WhatsApp configurada"
          configureHref="/dashboard/definicoes/whatsapp"
          configureLabel="Configurar"
        >
          <SenderPickerWhatsapp
            instances={whatsappInstances}
            value={instanceId}
            onChange={setInstanceId}
          />
          <RecipientsBlock
            channel="whatsapp"
            choices={choices}
            onToggle={(id, source, v) => setChoice(id, source, 'whatsapp', v)}
            adhoc={adhoc}
            onRemoveAdhoc={removeAdhoc}
          />
          <div className="flex gap-2">
            <Input
              value={adhocPhone}
              onChange={(e) => setAdhocPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addAdhocPhone()
                }
              }}
              placeholder="Adicionar telemóvel"
            />
            <Button
              type="button"
              variant="outline"
              onClick={addAdhocPhone}
              disabled={!adhocPhone.trim()}
            >
              +
            </Button>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sp-wa-msg">Mensagem</Label>
            <Textarea
              id="sp-wa-msg"
              value={whatsappMessage}
              onChange={(e) => setWhatsappMessage(e.target.value)}
              rows={6}
            />
          </div>
        </ChannelBlock>

        {results.length > 0 && <SendProgress results={results} />}
      </div>

      <DialogFooter className="shrink-0 gap-2 border-t px-6 py-3">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Fechar
        </Button>
        {failed.length > 0 && !isSending ? (
          <Button type="button" onClick={() => handleSubmit(failed)} disabled={isSending}>
            <Send className="mr-1 h-4 w-4" />
            Reenviar falhados
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => handleSubmit()}
            disabled={!canSubmit || isSending}
          >
            <Send className="mr-1 h-4 w-4" />
            {isSending ? 'A enviar…' : 'Enviar'}
          </Button>
        )}
      </DialogFooter>
    </>
  )
}

// ─── Sub-components ───

function ChannelBlock({
  label,
  enabled,
  onEnabledChange,
  senderAvailable,
  senderUnavailableLabel,
  configureHref,
  configureLabel,
  children,
}: {
  label: string
  enabled: boolean
  onEnabledChange: (v: boolean) => void
  senderAvailable: boolean
  senderUnavailableLabel: string
  configureHref: string
  configureLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Switch
            checked={enabled && senderAvailable}
            onCheckedChange={(v) => onEnabledChange(Boolean(v))}
            disabled={!senderAvailable}
          />
          {label}
        </Label>
        {!senderAvailable && (
          <Link
            href={configureHref}
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            {configureLabel}
          </Link>
        )}
      </div>
      {!senderAvailable ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {senderUnavailableLabel}
        </p>
      ) : enabled ? (
        <div className="mt-3 space-y-3">{children}</div>
      ) : null}
    </div>
  )
}

function SenderPickerEmail({
  accounts,
  value,
  onChange,
}: {
  accounts: { id: string; email_address: string; display_name: string }[]
  value: string
  onChange: (v: string) => void
}) {
  if (accounts.length === 1) {
    const a = accounts[0]
    return (
      <p className="text-xs text-muted-foreground">
        Conta:{' '}
        <span className="font-medium text-foreground">
          {a.display_name} &lt;{a.email_address}&gt;
        </span>
      </p>
    )
  }
  return (
    <div className="space-y-1">
      <Label className="text-xs">Conta</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Escolha uma conta" />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.display_name} &lt;{a.email_address}&gt;
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function SenderPickerWhatsapp({
  instances,
  value,
  onChange,
}: {
  instances: { id: string; name: string; phone: string | null; profile_name: string | null }[]
  value: string
  onChange: (v: string) => void
}) {
  if (instances.length === 1) {
    const i = instances[0]
    return (
      <p className="text-xs text-muted-foreground">
        Instância:{' '}
        <span className="font-medium text-foreground">
          {i.profile_name || i.name} {i.phone ? `(${i.phone})` : ''}
        </span>
      </p>
    )
  }
  return (
    <div className="space-y-1">
      <Label className="text-xs">Instância</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Escolha uma instância" />
        </SelectTrigger>
        <SelectContent>
          {instances.map((i) => (
            <SelectItem key={i.id} value={i.id}>
              {i.profile_name || i.name} {i.phone ? `(${i.phone})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function RecipientsBlock({
  channel,
  choices,
  onToggle,
  adhoc,
  onRemoveAdhoc,
}: {
  channel: ChannelKey
  choices: Choice[]
  onToggle: (
    id: string,
    source: PropertySendCandidate['source'],
    value: boolean
  ) => void
  adhoc: Adhoc[]
  onRemoveAdhoc: (id: string) => void
}) {
  const ad = adhoc.filter((a) => a.channel === channel)
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        Destinatários
      </Label>
      <div className="space-y-1.5">
        {choices.map((c) => {
          const checked =
            channel === 'email' ? c.emailChecked : c.whatsappChecked
          const value =
            channel === 'email' ? c.candidate.email : c.candidate.phone
          const disabled = !value
          const tooltip =
            channel === 'email' ? 'Sem email' : 'Sem telemóvel'
          const badgeLabel =
            c.candidate.source === 'consultant' ? 'Consultor' : 'Lead'
          const display =
            channel === 'whatsapp' && value
              ? formatE164ForDisplay(normalizeToE164(value, 'PT') || value)
              : value
          const row = (
            <div className="flex items-center gap-2">
              <Checkbox
                id={`${channel}-${c.candidate.source}-${c.candidate.id}`}
                checked={checked && !disabled}
                disabled={disabled}
                onCheckedChange={(v) =>
                  onToggle(c.candidate.id, c.candidate.source, Boolean(v))
                }
              />
              <Label
                htmlFor={`${channel}-${c.candidate.source}-${c.candidate.id}`}
                className={
                  disabled
                    ? 'cursor-not-allowed text-sm text-muted-foreground'
                    : 'cursor-pointer text-sm'
                }
              >
                <span className="font-medium">{c.candidate.label}</span>
                <Badge variant="secondary" className="ml-2 text-[10px]">
                  {badgeLabel}
                </Badge>
                {display && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {display}
                  </span>
                )}
              </Label>
            </div>
          )
          if (disabled) {
            return (
              <TooltipProvider key={`${c.candidate.source}-${c.candidate.id}`}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>{row}</div>
                  </TooltipTrigger>
                  <TooltipContent>{tooltip}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          }
          return (
            <div key={`${c.candidate.source}-${c.candidate.id}`}>{row}</div>
          )
        })}
        {ad.map((a) => (
          <div key={a.id} className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge variant="outline" className="max-w-full gap-1 text-xs">
              <span className="truncate">
                {channel === 'whatsapp'
                  ? formatE164ForDisplay(a.value)
                  : a.value}
              </span>
              <button
                type="button"
                onClick={() => onRemoveAdhoc(a.id)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Remover"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              Adicionado
            </Badge>
          </div>
        ))}
      </div>
    </div>
  )
}

function SendProgress({ results }: { results: SendResult[] }) {
  return (
    <div className="rounded-lg border bg-muted/30">
      <ul className="divide-y text-sm">
        {results.map((r, idx) => {
          const Icon =
            r.status === 'success'
              ? CheckCircle2
              : r.status === 'failed'
                ? XCircle
                : Loader2
          const colorClass =
            r.status === 'success'
              ? 'text-emerald-600'
              : r.status === 'failed'
                ? 'text-red-600'
                : 'text-muted-foreground'
          const ChannelIcon = r.channel === 'email' ? Mail : MessageCircle
          const statusLabel =
            r.status === 'success'
              ? 'Enviado'
              : r.status === 'failed'
                ? 'Falhou'
                : r.status === 'sending'
                  ? 'A enviar'
                  : 'Pendente'
          const row = (
            <li
              key={`${r.channel}:${r.to}:${idx}`}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <ChannelIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate font-medium">{r.to}</span>
              </span>
              <span className={`flex shrink-0 items-center gap-1 text-xs ${colorClass}`}>
                <Icon
                  className={`h-3.5 w-3.5 ${
                    r.status === 'sending' ? 'animate-spin' : ''
                  }`}
                />
                {statusLabel}
              </span>
            </li>
          )
          if (r.status === 'failed' && r.error) {
            return (
              <TooltipProvider key={`${r.channel}:${r.to}:${idx}`}>
                <Tooltip>
                  <TooltipTrigger asChild>{row}</TooltipTrigger>
                  <TooltipContent className="max-w-sm">{r.error}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          }
          return row
        })}
      </ul>
    </div>
  )
}
