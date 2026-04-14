'use client'

import { Send, X } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
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
import {
  useSendDocuments,
  type EmailAccount,
  type RecipientsPayload,
  type SendCandidate,
  type SendResult,
  type WhatsappInstance,
} from '@/hooks/use-send-documents'
import { isValidEmail } from '@/lib/documents/email-validate'
import { DOCUMENT_LABELS } from '@/lib/documents/labels'
import { formatE164ForDisplay, normalizeToE164 } from '@/lib/documents/phone'
import {
  buildDefaultEmailBody,
  buildDefaultSubject,
  buildDefaultWhatsappMessage,
} from '@/lib/documents/send-defaults'

import { SendProgressList } from './send-progress-list'
import { SendRichText } from './send-rich-text'
import type { DocumentDomain, DocumentFile, DocumentFolder } from './types'

const MAX_EMAIL_BYTES = 25 * 1024 * 1024

interface SendDocumentsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  domain: DocumentDomain
  entityId: string
  folders: DocumentFolder[]
  onSuccess?: () => void
}

type ChannelKey = 'email' | 'whatsapp'

type CandidateChoice = {
  candidate: SendCandidate
  emailChecked: boolean
  whatsappChecked: boolean
}

type AdhocItem = {
  id: string
  value: string
  channel: ChannelKey
}

export function SendDocumentsDialog(props: SendDocumentsDialogProps) {
  const { open, onOpenChange, domain, entityId, folders } = props
  const data = useSendDocuments({ domain, entityId, enabled: open })

  const allFiles = useMemo(() => folders.flatMap((f) => f.files), [folders])
  const totalSize = allFiles.reduce((acc, f) => acc + (f.size || 0), 0)
  const totalSizeMB = Math.round((totalSize / (1024 * 1024)) * 10) / 10

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{DOCUMENT_LABELS.send.title}</DialogTitle>
          <DialogDescription>
            {folders.length} {folders.length === 1 ? 'pasta' : 'pastas'} ·{' '}
            {DOCUMENT_LABELS.send.attachmentsSummary(allFiles.length, totalSizeMB)}
          </DialogDescription>
        </DialogHeader>

        {data.isLoading || !data.recipients ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <SendDocumentsBody
            {...props}
            allFiles={allFiles}
            totalSize={totalSize}
            recipients={data.recipients}
            emailAccounts={data.emailAccounts}
            whatsappInstances={data.whatsappInstances}
            results={data.results}
            isSending={data.isSending}
            send={data.send}
          />
        )}

        {data.isLoading || !data.recipients ? (
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {DOCUMENT_LABELS.actions.close}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

// ─── Inner body — only mounts when data is ready, so useState initialisers
// can derive defaults from props without setState-in-effect.

function SendDocumentsBody(
  props: SendDocumentsDialogProps & {
    allFiles: DocumentFile[]
    totalSize: number
    recipients: RecipientsPayload
    emailAccounts: EmailAccount[]
    whatsappInstances: WhatsappInstance[]
    results: SendResult[]
    isSending: boolean
    send: ReturnType<typeof useSendDocuments>['send']
  }
) {
  const {
    onOpenChange,
    domain,
    entityId,
    folders,
    onSuccess,
    allFiles,
    totalSize,
    recipients,
    emailAccounts,
    whatsappInstances,
    results,
    isSending,
    send,
  } = props

  const [emailEnabled, setEmailEnabled] = useState(emailAccounts.length > 0)
  const [whatsappEnabled, setWhatsappEnabled] = useState(false)
  const [accountId, setAccountId] = useState<string>(
    emailAccounts.length === 1 ? emailAccounts[0].id : ''
  )
  const [instanceId, setInstanceId] = useState<string>(
    whatsappInstances.length === 1 ? whatsappInstances[0].id : ''
  )
  const [choices, setChoices] = useState<CandidateChoice[]>(() =>
    buildInitialChoices(recipients)
  )
  const [adhoc, setAdhoc] = useState<AdhocItem[]>([])
  const [adhocEmailInput, setAdhocEmailInput] = useState('')
  const [adhocPhoneInput, setAdhocPhoneInput] = useState('')
  const [subject, setSubject] = useState(() =>
    buildDefaultSubject({ domain, entityRef: recipients.entityRef })
  )
  const [bodyHtml, setBodyHtml] = useState(() =>
    buildDefaultEmailBody({
      folderNames: folders.map((f) => f.name),
      entityRef: recipients.entityRef,
      senderName: recipients.consultant?.label ?? null,
    })
  )
  const [whatsappMessage, setWhatsappMessage] = useState(() =>
    buildDefaultWhatsappMessage({
      folderNames: folders.map((f) => f.name),
      entityRef: recipients.entityRef,
    })
  )

  const setChoiceField = (
    candidateId: string,
    source: SendCandidate['source'],
    field: 'email' | 'whatsapp',
    value: boolean
  ) => {
    setChoices((prev) =>
      prev.map((c) =>
        c.candidate.id === candidateId && c.candidate.source === source
          ? {
              ...c,
              emailChecked: field === 'email' ? value : c.emailChecked,
              whatsappChecked:
                field === 'whatsapp' ? value : c.whatsappChecked,
            }
          : c
      )
    )
  }

  const addAdhocEmail = () => {
    const value = adhocEmailInput.trim()
    if (!value) return
    if (!isValidEmail(value)) {
      toast.error(DOCUMENT_LABELS.send.invalidEmail)
      return
    }
    if (
      adhoc.some((a) => a.channel === 'email' && a.value === value) ||
      choices.some((c) => c.candidate.email === value && c.emailChecked)
    ) {
      setAdhocEmailInput('')
      return
    }
    setAdhoc((prev) => [
      ...prev,
      { id: `adhoc-email-${Date.now()}`, value, channel: 'email' },
    ])
    setAdhocEmailInput('')
  }

  const addAdhocPhone = () => {
    const e164 = normalizeToE164(adhocPhoneInput, 'PT')
    if (!e164) {
      toast.error(DOCUMENT_LABELS.send.invalidPhone)
      return
    }
    if (
      adhoc.some((a) => a.channel === 'whatsapp' && a.value === e164) ||
      choices.some((c) => c.candidate.phone === e164 && c.whatsappChecked)
    ) {
      setAdhocPhoneInput('')
      return
    }
    setAdhoc((prev) => [
      ...prev,
      { id: `adhoc-wa-${Date.now()}`, value: e164, channel: 'whatsapp' },
    ])
    setAdhocPhoneInput('')
  }

  const removeAdhoc = (id: string) =>
    setAdhoc((prev) => prev.filter((a) => a.id !== id))

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

  const tooLargeForEmail = totalSize > MAX_EMAIL_BYTES

  const canSubmit = useMemo(() => {
    if (allFiles.length === 0) return false
    if (!emailEnabled && !whatsappEnabled) return false
    if (emailEnabled) {
      if (!accountId) return false
      if (emailRecipients.length === 0) return false
      if (!subject.trim() || !bodyHtml.trim()) return false
    }
    if (whatsappEnabled) {
      if (!instanceId) return false
      if (whatsappRecipients.length === 0) return false
    }
    return true
  }, [
    allFiles.length,
    emailEnabled,
    whatsappEnabled,
    accountId,
    emailRecipients.length,
    subject,
    bodyHtml,
    instanceId,
    whatsappRecipients.length,
  ])

  const failedResults = useMemo(
    () => results.filter((r) => r.status === 'failed'),
    [results]
  )

  const handleSubmit = async (onlyFailed?: SendResult[]) => {
    if (tooLargeForEmail && emailEnabled) {
      toast.warning(DOCUMENT_LABELS.send.attachmentsTooLarge)
    }
    const filesPayload = allFiles.map((f) => ({
      id: f.id,
      name: f.name,
      url: f.url,
      mimeType: f.mimeType,
      size: f.size,
    }))

    const emailRecipientsToUse = onlyFailed
      ? onlyFailed.filter((r) => r.channel === 'email').map((r) => r.to)
      : emailRecipients
    const whatsappRecipientsToUse = onlyFailed
      ? onlyFailed.filter((r) => r.channel === 'whatsapp').map((r) => r.to)
      : whatsappRecipients

    const result = await send({
      domain,
      entityId,
      files: filesPayload,
      email:
        emailEnabled && emailRecipientsToUse.length > 0
          ? {
              account_id: accountId,
              subject: subject.trim(),
              body_html: bodyHtml,
              recipients: emailRecipientsToUse,
            }
          : undefined,
      whatsapp:
        whatsappEnabled && whatsappRecipientsToUse.length > 0
          ? {
              instance_id: instanceId,
              message: whatsappMessage.trim() || undefined,
              recipients: whatsappRecipientsToUse,
            }
          : undefined,
    })

    if (result.ok) {
      const succeeded = (result.results ?? []).filter(
        (r) => r.status === 'success'
      ).length
      const failed = (result.results ?? []).length - succeeded
      if (failed === 0) {
        toast.success(DOCUMENT_LABELS.send.allSent)
        onSuccess?.()
      } else {
        toast.warning(DOCUMENT_LABELS.send.partialFailed(failed))
      }
    }
  }

  return (
    <>
      <div className="space-y-4">
        {/* EMAIL */}
        <ChannelBlock
          channel="email"
          label={DOCUMENT_LABELS.send.channelEmail}
          enabled={emailEnabled}
          onEnabledChange={setEmailEnabled}
          senderAvailable={emailAccounts.length > 0}
          senderUnavailableLabel={DOCUMENT_LABELS.send.noEmailAccounts}
          configureHref="/dashboard/definicoes/email"
          configureLabel={DOCUMENT_LABELS.send.configureEmail}
        >
          <SenderPicker
            kind="email"
            accounts={emailAccounts}
            value={accountId}
            onChange={setAccountId}
          />
          <RecipientsBlock
            channel="email"
            choices={choices}
            onToggle={(id, source, value) =>
              setChoiceField(id, source, 'email', value)
            }
            adhoc={adhoc}
            onRemoveAdhoc={removeAdhoc}
          />
          <div className="flex gap-2">
            <Input
              value={adhocEmailInput}
              onChange={(e) => setAdhocEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addAdhocEmail()
                }
              }}
              placeholder={DOCUMENT_LABELS.send.addAdhocEmail}
            />
            <Button
              type="button"
              variant="outline"
              onClick={addAdhocEmail}
              disabled={!adhocEmailInput.trim()}
            >
              +
            </Button>
          </div>
          <div className="space-y-1">
            <Label htmlFor="send-subject">{DOCUMENT_LABELS.send.subject}</Label>
            <Input
              id="send-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>{DOCUMENT_LABELS.send.emailBody}</Label>
            <SendRichText
              value={bodyHtml}
              onChange={setBodyHtml}
              placeholder={DOCUMENT_LABELS.send.emailBody}
              minHeightClass="min-h-[160px]"
            />
          </div>
          {tooLargeForEmail && (
            <p className="text-xs text-amber-600">
              {DOCUMENT_LABELS.send.attachmentsTooLarge}
            </p>
          )}
        </ChannelBlock>

        {/* WHATSAPP */}
        <ChannelBlock
          channel="whatsapp"
          label={DOCUMENT_LABELS.send.channelWhatsapp}
          enabled={whatsappEnabled}
          onEnabledChange={setWhatsappEnabled}
          senderAvailable={whatsappInstances.length > 0}
          senderUnavailableLabel={DOCUMENT_LABELS.send.noWhatsappInstances}
          configureHref="/dashboard/definicoes/whatsapp"
          configureLabel={DOCUMENT_LABELS.send.configureWhatsapp}
        >
          <SenderPicker
            kind="whatsapp"
            instances={whatsappInstances}
            value={instanceId}
            onChange={setInstanceId}
          />
          <RecipientsBlock
            channel="whatsapp"
            choices={choices}
            onToggle={(id, source, value) =>
              setChoiceField(id, source, 'whatsapp', value)
            }
            adhoc={adhoc}
            onRemoveAdhoc={removeAdhoc}
          />
          <div className="flex gap-2">
            <Input
              value={adhocPhoneInput}
              onChange={(e) => setAdhocPhoneInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addAdhocPhone()
                }
              }}
              placeholder={DOCUMENT_LABELS.send.addAdhocPhone}
            />
            <Button
              type="button"
              variant="outline"
              onClick={addAdhocPhone}
              disabled={!adhocPhoneInput.trim()}
            >
              +
            </Button>
          </div>
          <div className="space-y-1">
            <Label htmlFor="send-wa-message">
              {DOCUMENT_LABELS.send.whatsappMessage}
            </Label>
            <Textarea
              id="send-wa-message"
              value={whatsappMessage}
              onChange={(e) => setWhatsappMessage(e.target.value)}
              rows={3}
            />
          </div>
        </ChannelBlock>

        {results.length > 0 && <SendProgressList results={results} />}
      </div>

      <DialogFooter className="gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          {DOCUMENT_LABELS.actions.close}
        </Button>
        {failedResults.length > 0 && !isSending ? (
          <Button
            type="button"
            onClick={() => handleSubmit(failedResults)}
            disabled={isSending}
          >
            <Send className="mr-1 h-4 w-4" />
            {DOCUMENT_LABELS.actions.retry}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => handleSubmit()}
            disabled={!canSubmit || isSending}
          >
            <Send className="mr-1 h-4 w-4" />
            {isSending
              ? DOCUMENT_LABELS.send.sending
              : DOCUMENT_LABELS.actions.send}
          </Button>
        )}
      </DialogFooter>
    </>
  )
}

function buildInitialChoices(recipients: RecipientsPayload): CandidateChoice[] {
  const list: CandidateChoice[] = []
  if (recipients.consultant) {
    list.push({
      candidate: recipients.consultant,
      emailChecked: !!recipients.consultant.email,
      whatsappChecked: !!recipients.consultant.phone,
    })
  }
  for (const owner of recipients.owners) {
    list.push({
      candidate: owner,
      emailChecked: !!owner.email && !!owner.isMain,
      whatsappChecked: !!owner.phone && !!owner.isMain,
    })
  }
  return list
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
  channel: ChannelKey
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

function SenderPicker(
  props:
    | {
        kind: 'email'
        accounts: { id: string; email_address: string; display_name: string }[]
        value: string
        onChange: (v: string) => void
      }
    | {
        kind: 'whatsapp'
        instances: {
          id: string
          name: string
          phone: string | null
          profile_name: string | null
        }[]
        value: string
        onChange: (v: string) => void
      }
) {
  if (props.kind === 'email') {
    if (props.accounts.length === 1) {
      const a = props.accounts[0]
      return (
        <p className="text-xs text-muted-foreground">
          {DOCUMENT_LABELS.send.senderEmailLabel}:{' '}
          <span className="font-medium text-foreground">
            {a.display_name} &lt;{a.email_address}&gt;
          </span>
        </p>
      )
    }
    return (
      <div className="space-y-1">
        <Label className="text-xs">{DOCUMENT_LABELS.send.senderEmailLabel}</Label>
        <Select value={props.value} onValueChange={props.onChange}>
          <SelectTrigger>
            <SelectValue placeholder={DOCUMENT_LABELS.send.senderPickEmail} />
          </SelectTrigger>
          <SelectContent>
            {props.accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.display_name} &lt;{a.email_address}&gt;
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }
  if (props.instances.length === 1) {
    const i = props.instances[0]
    return (
      <p className="text-xs text-muted-foreground">
        {DOCUMENT_LABELS.send.senderWhatsappLabel}:{' '}
        <span className="font-medium text-foreground">
          {i.profile_name || i.name} {i.phone ? `(${i.phone})` : ''}
        </span>
      </p>
    )
  }
  return (
    <div className="space-y-1">
      <Label className="text-xs">
        {DOCUMENT_LABELS.send.senderWhatsappLabel}
      </Label>
      <Select value={props.value} onValueChange={props.onChange}>
        <SelectTrigger>
          <SelectValue placeholder={DOCUMENT_LABELS.send.senderPickWhatsapp} />
        </SelectTrigger>
        <SelectContent>
          {props.instances.map((i) => (
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
  choices: CandidateChoice[]
  onToggle: (
    id: string,
    source: SendCandidate['source'],
    value: boolean
  ) => void
  adhoc: AdhocItem[]
  onRemoveAdhoc: (id: string) => void
}) {
  const channelAdhoc = adhoc.filter((a) => a.channel === channel)
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        {DOCUMENT_LABELS.send.recipientsTitle}
      </Label>
      <div className="space-y-1.5">
        {choices.map((c) => {
          const checked =
            channel === 'email' ? c.emailChecked : c.whatsappChecked
          const value =
            channel === 'email' ? c.candidate.email : c.candidate.phone
          const disabled = !value
          const tooltipText =
            channel === 'email'
              ? DOCUMENT_LABELS.send.noEmailTooltip
              : DOCUMENT_LABELS.send.noPhoneTooltip
          const label =
            c.candidate.source === 'consultant'
              ? DOCUMENT_LABELS.send.consultantLabel
              : c.candidate.isMain
                ? DOCUMENT_LABELS.send.ownerMainLabel
                : DOCUMENT_LABELS.send.ownerLabel
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
                  {label}
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
                  <TooltipContent>{tooltipText}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          }
          return (
            <div key={`${c.candidate.source}-${c.candidate.id}`}>{row}</div>
          )
        })}
        {channelAdhoc.map((a) => (
          <div key={a.id} className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 text-xs">
              {channel === 'whatsapp' ? formatE164ForDisplay(a.value) : a.value}
              <button
                type="button"
                onClick={() => onRemoveAdhoc(a.id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remover"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {DOCUMENT_LABELS.send.adhocLabel}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  )
}
