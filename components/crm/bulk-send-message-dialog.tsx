'use client'

/**
 * BulkSendMessageDialog — composes a free-form message and sends it to
 * every contact represented in the kanban multi-selection.
 *
 *   • mode = "whatsapp" → single text body, instance picker
 *   • mode = "email"    → subject + HTML body, account picker
 *
 * The dialog dedups by contact (one message per unique lead, never N
 * messages per N selected cards belonging to the same person), supports
 * `{{nome}}` substitution, and forwards everything to a single POST to
 * /api/crm/contacts/bulk-message — which handles the actual dispatch +
 * the anti-ban delay + the activity-log writes.
 */

import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  Loader2, Check, AlertCircle, Mail, MessageSquare, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'

export type BulkMessageMode = 'whatsapp' | 'email'

export interface BulkMessageContact {
  id: string             // lead_id (contact_id)
  name: string
  email: string | null
  phone: string | null
  /** The kanban card the user picked for this contact (used to attach
   *  the activity to that negócio in the timeline). */
  source_negocio_id?: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: BulkMessageMode
  /** Already deduped at the kanban level — one entry per unique contact. */
  contacts: BulkMessageContact[]
  onDone?: () => void
}

interface EmailAccount {
  id: string
  email_address: string
  display_name: string
}
interface WhatsappInstance {
  id: string
  name: string
  phone: string | null
  profile_name: string | null
}

interface PerChannelResult { ok: boolean; skipped?: boolean; error?: string }
interface PerTargetResult {
  contact_id: string
  email?: PerChannelResult
  whatsapp?: PerChannelResult
}

export function BulkSendMessageDialog({
  open, onOpenChange, mode, contacts, onDone,
}: Props) {
  const isMobile = useIsMobile()

  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [instances, setInstances] = useState<WhatsappInstance[]>([])
  const [accountId, setAccountId] = useState('')
  const [instanceId, setInstanceId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<PerTargetResult[] | null>(null)

  // Lazy-load sender list when sheet opens (or mode changes).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    if (mode === 'email') {
      fetch('/api/email/account')
        .then((r) => (r.ok ? r.json() : null))
        .then((res) => {
          if (cancelled) return
          const accs: EmailAccount[] = Array.isArray(res)
            ? res
            : res?.accounts ?? res?.data ?? []
          setAccounts(accs)
          if (accs.length > 0) setAccountId((id) => id || accs[0].id)
        })
        .catch(() => {})
    } else {
      fetch('/api/whatsapp/instances')
        .then((r) => (r.ok ? r.json() : null))
        .then((res) => {
          if (cancelled) return
          const insts: WhatsappInstance[] = Array.isArray(res)
            ? res
            : res?.instances ?? res?.data ?? []
          setInstances(insts)
          if (insts.length > 0) setInstanceId((id) => id || insts[0].id)
        })
        .catch(() => {})
    }
    return () => { cancelled = true }
  }, [open, mode])

  // Reset every user choice when the sheet closes — re-opening always
  // starts fresh (no leftover subject / body / results).
  useEffect(() => {
    if (open) return
    setSubject('')
    setBody('')
    setResults(null)
    setSubmitting(false)
  }, [open])

  // Counts per channel availability so the user can see who'll be skipped.
  const reachable = useMemo(() => {
    let withEmail = 0
    let withPhone = 0
    for (const c of contacts) {
      if (c.email) withEmail++
      if (c.phone) withPhone++
    }
    return { withEmail, withPhone }
  }, [contacts])

  const meta = META[mode]
  const channelMissing = mode === 'email'
    ? contacts.length - reachable.withEmail
    : contacts.length - reachable.withPhone

  const canSubmit =
    !submitting &&
    contacts.length > 0 &&
    body.trim().length > 0 &&
    (mode === 'email'
      ? !!accountId && subject.trim().length > 0
      : !!instanceId)

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    setResults(null)
    try {
      const targets = contacts.map((c) => ({
        contact_id: c.id,
        ...(c.source_negocio_id ? { negocio_id: c.source_negocio_id } : {}),
      }))

      const requestBody: Record<string, unknown> = { targets }
      if (mode === 'email') {
        // Wrap the user's plain text into a minimal HTML paragraph so the
        // endpoint's body_html requirement is satisfied. Newlines map to
        // <br/> inside the wrapper for visual fidelity.
        const html = `<p>${escapeHtml(body)}</p>`
        requestBody.email = {
          account_id: accountId,
          subject: subject.trim(),
          body_html: html,
        }
      } else {
        requestBody.whatsapp = {
          instance_id: instanceId,
          message: body.trim(),
        }
      }

      const res = await fetch('/api/crm/contacts/bulk-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json?.error ?? 'Falha no envio')
        return
      }
      // Queue-based response — sends fan out asynchronously, the user
      // is free to keep working in the kanban while the worker drains
      // the queue at the configured stagger.
      const queued = Number(json?.queued ?? 0)
      const scheduledLast = json?.scheduled_last
      const totalMin = scheduledLast
        ? Math.max(0, Math.round((new Date(scheduledLast).getTime() - Date.now()) / 60000))
        : 0
      const desc =
        totalMin > 0
          ? `Espalhado por ~${totalMin} ${totalMin === 1 ? 'minuto' : 'minutos'}.`
          : 'O primeiro arranca já a seguir.'
      toast.success(
        `${queued} ${queued === 1 ? 'envio agendado' : 'envios agendados'}`,
        { description: desc },
      )
      onDone?.()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado')
    } finally {
      setSubmitting(false)
    }
  }, [contacts, mode, accountId, subject, body, instanceId, onDone])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[90dvh] data-[side=bottom]:max-h-[90dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[640px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        <SheetHeader className={cn('shrink-0 px-6 gap-0', isMobile ? 'pt-8 pb-3' : 'pt-6 pb-3')}>
          <SheetTitle className="text-lg font-semibold tracking-tight inline-flex items-center gap-2">
            <meta.icon className="h-5 w-5" />
            {meta.title}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {contacts.length} {contacts.length === 1 ? 'contacto' : 'contactos'}
            {channelMissing > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                {' '}· {channelMissing} sem {meta.channelLabel}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-3 space-y-5">

          {/* ── Sender picker ── */}
          <Section title="De">
            {mode === 'email' ? (
              accounts.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Sem contas de email configuradas.
                </p>
              ) : accounts.length === 1 ? (
                <p className="text-[12px] text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {accounts[0].display_name} &lt;{accounts[0].email_address}&gt;
                  </span>
                </p>
              ) : (
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.display_name} &lt;{a.email_address}&gt;
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            ) : instances.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sem instâncias WhatsApp configuradas.
              </p>
            ) : instances.length === 1 ? (
              <p className="text-[12px] text-muted-foreground">
                <span className="font-medium text-foreground">
                  {instances[0].profile_name || instances[0].name}
                  {instances[0].phone ? ` (${instances[0].phone})` : ''}
                </span>
              </p>
            ) : (
              <Select value={instanceId} onValueChange={setInstanceId}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.profile_name || i.name}
                      {i.phone ? ` (${i.phone})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Section>

          {/* ── Subject (email only) ── */}
          {mode === 'email' && (
            <Section title="Assunto">
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Assunto do email"
                className="h-9"
              />
            </Section>
          )}

          {/* ── Compose ── */}
          <Section
            title="Mensagem"
            subtitle="Suporta {{nome}} para personalizar com o nome de cada contacto."
          >
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={mode === 'email' ? 8 : 6}
              placeholder={meta.bodyPlaceholder}
              className="resize-none text-sm"
            />
            {/\{\{\s*nome\s*\}\}/.test(body) && (
              <p className="text-[10px] text-muted-foreground mt-1 inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                {'{{nome}}'} será substituído pelo nome de cada destinatário.
              </p>
            )}
          </Section>

          {/* ── Recipient preview ── */}
          <Section title="Destinatários">
            <div className="rounded-2xl ring-1 ring-border/40 bg-background/40 max-h-44 overflow-y-auto divide-y divide-border/30">
              {contacts.map((c) => {
                const reachableHere =
                  mode === 'email' ? !!c.email : !!c.phone
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                  >
                    <span className="font-medium truncate">{c.name}</span>
                    <span
                      className={cn(
                        'text-[10px] tabular-nums',
                        reachableHere ? 'text-muted-foreground' : 'text-amber-600',
                      )}
                    >
                      {reachableHere
                        ? mode === 'email' ? c.email : c.phone
                        : `Sem ${META[mode].channelLabel}`}
                    </span>
                  </div>
                )
              })}
            </div>
          </Section>

          {/* ── Results ── */}
          {results && (
            <Section title="Resultados">
              <div className="space-y-1.5">
                {results.map((r) => {
                  const channelRes = (r as any)[mode] as PerChannelResult | undefined
                  const ok = !!channelRes?.ok
                  const contact = contacts.find((c) => c.id === r.contact_id)
                  return (
                    <div
                      key={r.contact_id}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px]',
                        ok
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'bg-red-500/10 text-red-700 dark:text-red-400',
                      )}
                    >
                      {ok ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                      <span className="font-medium truncate flex-1">
                        {contact?.name ?? r.contact_id.slice(0, 8)}
                      </span>
                      <span className="text-[10px] opacity-80">
                        {ok
                          ? 'enviado'
                          : channelRes?.skipped
                            ? channelRes.error
                            : (channelRes?.error ?? 'falhou')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </Section>
          )}
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-border/40 bg-muted/20">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {results ? 'Fechar' : 'Cancelar'}
          </Button>
          {!results && (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {meta.cta}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

const META = {
  whatsapp: {
    title: 'Mensagem WhatsApp',
    icon: MessageSquare,
    cta: 'Enviar WhatsApp',
    channelLabel: 'telemóvel',
    bodyPlaceholder: 'Olá {{nome}}, …',
  },
  email: {
    title: 'Email',
    icon: Mail,
    cta: 'Enviar email',
    channelLabel: 'email',
    bodyPlaceholder: 'Olá {{nome}},\n\n…',
  },
} as const

function Section({
  title, subtitle, children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground/80 mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  )
}

const HTML_ESCAPE_RE = /[&<>"']/g
const HTML_ENTITY: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}
function escapeHtml(s: string): string {
  return s.replace(HTML_ESCAPE_RE, (c) => HTML_ENTITY[c]).replace(/\n/g, '<br/>')
}
