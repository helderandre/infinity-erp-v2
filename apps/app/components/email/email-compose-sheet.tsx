'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, MailX, Send, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/shared/empty-state'
import { CalendarRichEditor } from '@/components/calendar/calendar-rich-editor'
import { useIsMobile } from '@/hooks/use-mobile'
import { useEmailAccount } from '@/hooks/use-email-account'
import { useUser } from '@/hooks/use-user'
import { cn } from '@/lib/utils'

const DEFAULT_GOODBYE = 'Com os melhores cumprimentos,'

interface SignatureData {
  html: string | null
  url: string | null
  goodbye: string | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildSignatureHtml(sig: SignatureData): string {
  const goodbyeText = (sig.goodbye ?? '').trim() || DEFAULT_GOODBYE
  const goodbyeHtml = `<p style="margin:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a;white-space:pre-line;">${escapeHtml(goodbyeText)}</p>`
  let imageHtml = ''
  if (sig.html && sig.html.trim()) {
    imageHtml = sig.html
  } else if (sig.url) {
    imageHtml = `<img src="${sig.url}" alt="Assinatura" style="max-width:420px;width:100%;height:auto;" />`
  }
  return goodbyeHtml + imageHtml
}

interface EmailComposeSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipientEmail: string
  recipientName: string
}

function textToHtml(text: string): string {
  if (!text) return ''
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${escape(para).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function AiAssistButton({
  recipientName,
  recipientEmail,
  subject,
  bodyHtml,
  onApply,
}: {
  recipientName: string
  recipientEmail: string
  subject: string
  bodyHtml: string
  onApply: (result: { subject: string; body: string }) => void
}) {
  const [open, setOpen] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [tone, setTone] = useState<'professional' | 'friendly' | 'formal'>('professional')
  const [loading, setLoading] = useState(false)

  const existingDraftText = bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const hasDraft = existingDraftText.length > 0

  async function handleGenerate() {
    if (loading) return
    if (!hasDraft && !instruction.trim()) {
      toast.error('Escreva uma instrução ou algum texto para polir')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/email/ai-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: recipientName,
          contact_email: recipientEmail,
          subject: subject || undefined,
          instruction: instruction.trim() || undefined,
          existing_draft: hasDraft ? existingDraftText : undefined,
          tone,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar com IA')
      onApply({ subject: data.subject || '', body: data.body || '' })
      setInstruction('')
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar com IA')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-[11px] font-medium text-primary hover:bg-primary/10"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {hasDraft ? 'Polir com IA' : 'Gerar com IA'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-2.5">
          <div>
            <p className="text-xs font-medium mb-1">
              {hasDraft ? 'O que melhorar ou alterar?' : 'O que deseja dizer?'}
            </p>
            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={
                hasDraft
                  ? 'Ex: mais curto, tom mais formal, agradece a rapidez...'
                  : 'Ex: agendar reunião para amanhã às 10h para rever o dossiê X'
              }
              rows={4}
              className="text-xs resize-none"
              disabled={loading}
              autoFocus
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Tom</span>
            <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
              <SelectTrigger className="h-7 flex-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Profissional</SelectItem>
                <SelectItem value="friendly">Amigável</SelectItem>
                <SelectItem value="formal">Formal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            size="sm"
            className="w-full h-8"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            )}
            {hasDraft ? 'Polir' : 'Gerar'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function EmailComposeSheet({
  open,
  onOpenChange,
  recipientEmail,
  recipientName,
}: EmailComposeSheetProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const { user } = useUser()
  const { accounts, selectedAccountId, setSelectedAccountId, isLoading, selectedAccount } =
    useEmailAccount()

  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [sending, setSending] = useState(false)
  const [signature, setSignature] = useState<SignatureData>({ html: null, url: null, goodbye: null })
  const [includeSignature, setIncludeSignature] = useState(true)

  useEffect(() => {
    if (!open) {
      setSubject('')
      setBodyHtml('')
      setSending(false)
    }
  }, [open])

  // Load signature once per logged-in user
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    fetch(`/api/consultants/${user.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        const profile = data?.dev_consultant_profiles || data?.profile || data
        setSignature({
          html: profile?.email_signature_html || null,
          url: profile?.email_signature_url || null,
          goodbye: profile?.email_signature_goodbye || null,
        })
      })
      .catch(() => {
        /* no signature — use defaults */
      })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const canSend =
    !!selectedAccountId &&
    !!recipientEmail &&
    subject.trim().length > 0 &&
    bodyHtml.replace(/<[^>]+>/g, '').trim().length > 0

  async function handleSend() {
    if (!canSend || sending) return
    setSending(true)
    try {
      const sigHtml = includeSignature ? buildSignatureHtml(signature) : ''
      const finalHtml = sigHtml ? `${bodyHtml}<br/><br/>${sigHtml}` : bodyHtml
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: [recipientEmail],
          subject: subject.trim(),
          body_html: finalHtml,
          account_id: selectedAccountId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const parts = [data.error, data.detail].filter(Boolean)
        throw new Error(parts.join(' — ') || 'Erro ao enviar email')
      }
      toast.success('Email enviado')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar email')
    } finally {
      setSending(false)
    }
  }

  const noAccount = !isLoading && accounts.length === 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        showCloseButton={false}
        className={cn(
          'p-0 gap-0 flex flex-col overflow-hidden border-border/40 shadow-2xl bg-background',
          isMobile
            ? 'data-[side=bottom]:h-[85dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[540px] sm:rounded-l-3xl'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}
        <SheetTitle className="sr-only">Enviar email a {recipientName}</SheetTitle>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : noAccount ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <EmptyState
              icon={MailX}
              title="Sem conta de email configurada"
              description="Ligue uma conta de email para enviar mensagens a partir do ERP."
              action={{
                label: 'Configurar email',
                onClick: () => {
                  onOpenChange(false)
                  router.push('/dashboard/definicoes/email')
                },
              }}
            />
          </div>
        ) : (
          <div className={cn('flex-1 min-h-0 flex flex-col', isMobile && 'pt-3')}>
            {/* Header */}
            <div className="shrink-0 px-5 pt-5 pb-3 border-b">
              <h2 className="text-base font-semibold truncate">Novo email</h2>
              <p className="text-xs text-muted-foreground truncate">
                Para {recipientName} · {recipientEmail}
              </p>
            </div>

            {/* Fields */}
            <div className="shrink-0 px-5 py-3 space-y-2.5 border-b">
              {accounts.length > 1 && (
                <div className="flex items-center gap-2">
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground w-12 shrink-0">
                    De
                  </label>
                  <Select
                    value={selectedAccountId ?? undefined}
                    onValueChange={setSelectedAccountId}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.display_name
                            ? `${acc.display_name} <${acc.email_address}>`
                            : acc.email_address}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {accounts.length === 1 && selectedAccount && (
                <div className="flex items-center gap-2">
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground w-12 shrink-0">
                    De
                  </label>
                  <span className="text-xs text-muted-foreground truncate">
                    {selectedAccount.display_name
                      ? `${selectedAccount.display_name} <${selectedAccount.email_address}>`
                      : selectedAccount.email_address}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground w-12 shrink-0">
                  Assunto
                </label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Assunto do email"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-3">
              <CalendarRichEditor
                value={bodyHtml}
                onChange={setBodyHtml}
                placeholder={`Escreva uma mensagem para ${recipientName}...`}
                className="min-h-[220px]"
                toolbarExtra={
                  <AiAssistButton
                    recipientName={recipientName}
                    recipientEmail={recipientEmail}
                    subject={subject}
                    bodyHtml={bodyHtml}
                    onApply={({ subject: s, body }) => {
                      if (!subject.trim() && s) setSubject(s)
                      setBodyHtml(textToHtml(body))
                    }}
                  />
                }
              />

              {/* Signature preview */}
              {includeSignature && (
                <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] uppercase tracking-wider font-semibold">
                      Assinatura
                    </span>
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                      onClick={() => setIncludeSignature(false)}
                    >
                      Remover
                    </button>
                  </div>
                  <div
                    className="[&_p]:m-0 [&_p]:mb-1 [&_img]:max-w-[260px] [&_img]:h-auto"
                    dangerouslySetInnerHTML={{ __html: buildSignatureHtml(signature) }}
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-5 py-3 border-t flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <Switch
                  checked={includeSignature}
                  onCheckedChange={setIncludeSignature}
                  className="scale-75"
                />
                <span>Incluir assinatura</span>
              </label>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  disabled={sending}
                >
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSend} disabled={!canSend || sending}>
                  {sending ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-1.5" />
                  )}
                  Enviar
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
