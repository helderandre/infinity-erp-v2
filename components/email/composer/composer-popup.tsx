'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent } from '@tiptap/react'
import {
  Mail,
  Minus,
  Maximize2,
  Minimize2,
  X,
  ChevronDown,
  Send,
  Loader2,
  FileText,
  Paperclip,
  Image as ImageIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { TooltipProvider } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/use-user'
import {
  useEmailComposer,
  type ComposerDraft,
  type OpenComposerArgs,
} from '@/hooks/use-email-composer'
import { useComposerEditor } from './use-composer-editor'
import { ComposerToolbar } from './composer-toolbar'
import { ComposerAIPanel } from './composer-ai-panel'

type DraftStatus = 'idle' | 'saving' | 'saved' | 'error'

interface SignatureData {
  html: string | null
  url: string | null
  goodbye: string | null
}

const DEFAULT_GOODBYE = 'Com os melhores cumprimentos,'

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

function buildQuotedContent(state: OpenComposerArgs): string | null {
  if (state.replyTo) {
    const msg = state.replyTo
    const when = msg.date ? new Date(msg.date).toLocaleString('pt-PT') : ''
    const fromName = msg.from[0]?.name || ''
    const fromAddr = msg.from[0]?.address || ''
    const fromLabel = fromName
      ? `${fromName} &lt;${fromAddr}&gt;`
      : fromAddr
    const quoted = msg.html || (msg.text ? `<p>${msg.text.replace(/\n/g, '<br/>')}</p>` : '')
    return `<p style="color:#6b7280;font-size:13px;margin:12px 0 4px 0;">Em ${when}, ${fromLabel} escreveu:</p><blockquote style="border-left:3px solid #d1d5db;padding-left:12px;margin:0;color:#374151;">${quoted}</blockquote>`
  }
  if (state.forwardMessage) {
    const msg = state.forwardMessage
    const when = msg.date ? new Date(msg.date).toLocaleString('pt-PT') : ''
    const fromName = msg.from[0]?.name || ''
    const fromAddr = msg.from[0]?.address || ''
    const fromLabel = fromName
      ? `${fromName} &lt;${fromAddr}&gt;`
      : fromAddr
    const toLabel = msg.to
      .map((a) => (a.name ? `${a.name} &lt;${a.address}&gt;` : a.address))
      .join(', ')
    const quoted = msg.html || (msg.text ? `<p>${msg.text.replace(/\n/g, '<br/>')}</p>` : '')
    return `<p style="color:#6b7280;font-size:13px;margin:12px 0 4px 0;">---------- Mensagem reencaminhada ----------</p><p style="color:#374151;font-size:13px;margin:0 0 8px 0;"><strong>De:</strong> ${fromLabel}<br/><strong>Data:</strong> ${when}<br/><strong>Assunto:</strong> ${msg.subject}<br/><strong>Para:</strong> ${toLabel}</p>${quoted}`
  }
  return null
}

function buildInitialHtml(state: OpenComposerArgs): string {
  if (state.initialBodyHtml && state.initialBodyHtml.trim()) {
    return state.initialBodyHtml
  }
  const quoted = buildQuotedContent(state)
  if (quoted) return `<p></p><p></p>${quoted}`
  return '<p></p>'
}

function buildSubject(state: OpenComposerArgs): string {
  if (state.replyTo) {
    return state.replyTo.subject?.startsWith('Re:')
      ? state.replyTo.subject
      : `Re: ${state.replyTo.subject || ''}`
  }
  if (state.forwardMessage) {
    return state.forwardMessage.subject?.startsWith('Fwd:')
      ? state.forwardMessage.subject
      : `Fwd: ${state.forwardMessage.subject || ''}`
  }
  return state.initialSubject || ''
}

function buildInitialTo(state: OpenComposerArgs): string {
  if (state.replyTo) return state.replyTo.from[0]?.address || ''
  return state.initialTo || ''
}

function buildInitialCc(state: OpenComposerArgs): string {
  if (state.initialCc && state.initialCc.trim()) return state.initialCc
  if (!state.replyTo) return ''
  const sender = state.senderEmail?.toLowerCase()
  const cc = (state.replyTo.cc || [])
    .map((a) => a.address)
    .filter((addr): addr is string => !!addr && addr.toLowerCase() !== sender)
  return cc.join(', ')
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
    )
  }
  return btoa(binary)
}

// ───────────────────────────────────────────────────────────────────────────

export function EmailComposerPopup() {
  const { drafts } = useEmailComposer()

  if (drafts.length === 0) return null

  const hasFullscreen = drafts.some((d) => d.mode === 'fullscreen')

  // Every draft lives in the same parent container so mode transitions don't
  // reparent its subtree (which would unmount the TipTap editor and lose state
  // like dropped images). Fullscreen windows break out of the flex row via
  // fixed positioning on their wrapper; the others hide behind a fullscreen one.
  return (
    <div className="pointer-events-none fixed bottom-0 right-0 z-50 flex flex-row-reverse items-end gap-2 px-6">
      {drafts.map((d) => {
        const isFullscreen = d.mode === 'fullscreen'
        return (
          <div
            key={d.uid}
            className={cn(
              'pointer-events-auto',
              isFullscreen && 'fixed inset-6 sm:inset-10 md:inset-16 z-[60]',
              !isFullscreen && hasFullscreen && 'hidden'
            )}
          >
            <ComposerWindow draft={d} stacked={!isFullscreen} />
          </div>
        )
      })}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────

interface WindowProps {
  draft: ComposerDraft
  stacked: boolean
}

function ComposerWindow({ draft, stacked }: WindowProps) {
  const { user } = useUser()
  const { closeComposer, setDraftMode } = useEmailComposer()
  const state: OpenComposerArgs & { uid: string } = draft
  const mode = draft.mode
  const onClose = useCallback(() => closeComposer(draft.uid), [closeComposer, draft.uid])
  const setMode = useCallback(
    (next: ComposerDraft['mode']) => setDraftMode(draft.uid, next),
    [setDraftMode, draft.uid]
  )

  const [to, setTo] = useState(() => buildInitialTo(state))
  const [cc, setCc] = useState(() => buildInitialCc(state))
  const [bcc, setBcc] = useState('')
  const [subject, setSubject] = useState(() => buildSubject(state))
  const [showCcBcc, setShowCcBcc] = useState(() => buildInitialCc(state).length > 0)
  const [attachments, setAttachments] = useState<File[]>([])
  const [bodyHtml, setBodyHtml] = useState<string>(() => buildInitialHtml(state))
  const [isSending, setIsSending] = useState(false)

  const [signature, setSignature] = useState<SignatureData>({
    html: null,
    url: null,
    goodbye: null,
  })
  const [signatureEnabled, setSignatureEnabled] = useState(() => !state.omitSignature)
  // Always available — we fall back to the default goodbye text.
  const signatureAvailable = true

  const [draftUid, setDraftUid] = useState<number | null>(null)
  const [draftStatus, setDraftStatus] = useState<DraftStatus>('idle')
  const savedKeyRef = useRef('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [isDragging, setIsDragging] = useState(false)
  const [uploadingInline, setUploadingInline] = useState(false)
  const dragDepthRef = useRef(0)

  const editor = useComposerEditor({
    initialHtml: buildInitialHtml(state),
    onUpdate: setBodyHtml,
  })

  // Load signature once on mount
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    fetch(`/api/consultants/${user.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        const profile =
          data?.dev_consultant_profiles || data?.profile || data || null
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

  // ── Autosave draft ────────────────────────────────────────────────────────
  const buildDraftHtml = useCallback((): string => {
    const sigHtml = signatureEnabled ? buildSignatureHtml(signature) : ''
    const sep = sigHtml ? '<br/><br/>' : ''
    return bodyHtml + sep + sigHtml
  }, [bodyHtml, signatureEnabled, signature])

  const saveDraft = useCallback(
    async (opts: { silent?: boolean } = {}): Promise<void> => {
      const plainBody =
        editor?.getText()?.trim() ??
        bodyHtml.replace(/<[^>]+>/g, '').trim()
      const hasAnything =
        to.trim() || cc.trim() || bcc.trim() || subject.trim() || plainBody
      if (!hasAnything) return

      const draftKey = JSON.stringify({
        to,
        cc,
        bcc,
        subject,
        bodyHtml,
        signatureEnabled,
        sigHtml: signature.html,
        sigUrl: signature.url,
        sigGoodbye: signature.goodbye,
      })
      if (draftKey === savedKeyRef.current) return

      if (!opts.silent) setDraftStatus('saving')

      try {
        const res = await fetch('/api/email/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to,
            cc,
            bcc,
            subject,
            body_html: buildDraftHtml(),
            in_reply_to: state.replyTo?.messageId,
            existing_draft_uid: draftUid ?? undefined,
            account_id: state.accountId || undefined,
          }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error || 'Erro ao guardar rascunho')
        if (typeof data?.uid === 'number') setDraftUid(data.uid)
        savedKeyRef.current = draftKey
        if (!opts.silent) {
          setDraftStatus('saved')
          if (savedStatusTimerRef.current) clearTimeout(savedStatusTimerRef.current)
          savedStatusTimerRef.current = setTimeout(() => setDraftStatus('idle'), 2500)
        }
      } catch {
        if (!opts.silent) setDraftStatus('error')
      }
    },
    [
      editor,
      bodyHtml,
      to,
      cc,
      bcc,
      subject,
      buildDraftHtml,
      draftUid,
      state.replyTo?.messageId,
      state.accountId,
      signatureEnabled,
      signature.html,
      signature.url,
      signature.goodbye,
    ]
  )

  // Debounced autosave — ~2s after last change
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void saveDraft()
    }, 2000)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [to, cc, bcc, subject, bodyHtml, signatureEnabled, saveDraft])

  // Hold the latest saveDraft so the unmount-flush effect below always calls the current one.
  const saveDraftRef = useRef(saveDraft)
  useEffect(() => {
    saveDraftRef.current = saveDraft
  }, [saveDraft])

  // Fire a best-effort silent flush when this window unmounts (covers stack-cap rotation
  // where the user never clicked close and the pending debounced save would otherwise be lost).
  useEffect(
    () => () => {
      void saveDraftRef.current({ silent: true })
    },
    []
  )

  useEffect(
    () => () => {
      if (savedStatusTimerRef.current) clearTimeout(savedStatusTimerRef.current)
    },
    []
  )

  // ── Close handler — flush draft then close ───────────────────────────────
  const handleClose = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    await saveDraft({ silent: true })
    onClose()
  }, [saveDraft, onClose])

  const handleDiscard = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    savedKeyRef.current = JSON.stringify({ discarded: true })
    onClose()
  }, [onClose])

  // ── Send ─────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const toAddrs = to
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean)
    if (toAddrs.length === 0) {
      toast.error('Destinatário é obrigatório')
      return
    }
    if (!subject.trim()) {
      toast.error('Assunto é obrigatório')
      return
    }

    setIsSending(true)
    try {
      const ccAddrs = cc
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)
      const bccAddrs = bcc
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)

      const fileAttachments = await Promise.all(
        attachments.map(async (file) => ({
          filename: file.name,
          content_type: file.type || 'application/octet-stream',
          data_base64: await fileToBase64(file),
        }))
      )

      const payload = {
        to: toAddrs,
        cc: ccAddrs.length > 0 ? ccAddrs : undefined,
        bcc: bccAddrs.length > 0 ? bccAddrs : undefined,
        subject: subject.trim(),
        body_html: buildDraftHtml(),
        in_reply_to: state.replyTo?.messageId || undefined,
        attachments: fileAttachments.length > 0 ? fileAttachments : undefined,
        account_id: state.accountId || undefined,
      }

      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(result?.error || result?.detail || 'Erro ao enviar')
      }
      toast.success('Email enviado')
      savedKeyRef.current = JSON.stringify({ sent: true })
      state.onSent?.()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar email')
    } finally {
      setIsSending(false)
    }
  }, [
    to,
    cc,
    bcc,
    subject,
    attachments,
    buildDraftHtml,
    state,
    onClose,
  ])

  // ── Handlers passed to toolbar ───────────────────────────────────────────
  const handleAttachFiles = useCallback((files: File[]) => {
    setAttachments((prev) => [...prev, ...files])
  }, [])

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const uploadInlineImage = useCallback(
    async (file: File) => {
      if (!editor) return
      if (!file.type.startsWith('image/')) return
      setUploadingInline(true)
      try {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/libraries/emails/upload-attachment', {
          method: 'POST',
          body: fd,
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error || 'Erro ao enviar imagem')
        editor.chain().focus().setImage({ src: data.url, alt: file.name }).run()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao enviar imagem')
      } finally {
        setUploadingInline(false)
      }
    },
    [editor]
  )

  const handleDroppedFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      const images = files.filter((f) => f.type.startsWith('image/'))
      const others = files.filter((f) => !f.type.startsWith('image/'))
      if (others.length > 0) handleAttachFiles(others)
      for (const img of images) {
        await uploadInlineImage(img)
      }
    },
    [handleAttachFiles, uploadInlineImage]
  )

  // Drag handlers — use a depth counter so enter/leave on children don't flicker
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    dragDepthRef.current += 1
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes('Files')) return
      e.preventDefault()
      dragDepthRef.current = 0
      setIsDragging(false)
      const files = Array.from(e.dataTransfer.files)
      void handleDroppedFiles(files)
    },
    [handleDroppedFiles]
  )

  const sigPreviewHtml = useMemo(
    () => buildSignatureHtml(signature),
    [signature]
  )

  const title = state.replyTo
    ? 'Responder'
    : state.forwardMessage
      ? 'Reencaminhar'
      : 'Nova mensagem'

  // The parent wrapper positions each window (flex row for stacked, fixed inset
  // for fullscreen). The window itself only controls its own size + chrome.
  const windowStyle = cn(
    'flex flex-col bg-background border shadow-2xl',
    stacked && mode === 'minimized' &&
      'w-80 rounded-t-lg border-b-0 h-10 overflow-hidden',
    stacked && mode === 'normal' &&
      'w-[560px] max-w-[calc(100vw-2rem)] rounded-t-lg border-b-0 h-[min(600px,90vh)]',
    !stacked && 'w-full h-full rounded-lg'
  )

  const draftIndicator = (() => {
    if (uploadingInline) {
      return (
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />A enviar imagem…
        </span>
      )
    }
    if (draftStatus === 'saving') {
      return (
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />A guardar…
        </span>
      )
    }
    if (draftStatus === 'saved') {
      return (
        <span className="text-[11px] text-muted-foreground">Rascunho guardado</span>
      )
    }
    if (draftStatus === 'error') {
      return (
        <span className="text-[11px] text-destructive">
          Erro ao guardar rascunho
        </span>
      )
    }
    return null
  })()

  return (
    <TooltipProvider>
      <div
        className={windowStyle}
        role="dialog"
        aria-label={title}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && mode !== 'minimized' && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-t-lg bg-primary/5 backdrop-blur-[1px]">
            <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-primary/60 bg-background/90 px-6 py-4 shadow-lg">
              <ImageIcon className="h-6 w-6 text-primary" />
              <p className="text-sm font-medium">Largar para adicionar</p>
              <p className="text-xs text-muted-foreground">
                Imagens entram no corpo · outros ficheiros como anexos
              </p>
            </div>
          </div>
        )}
        {/* Header */}
        <div
          className={cn(
            'flex items-center justify-between gap-2 bg-neutral-800 text-neutral-50 px-3 py-2 shrink-0 rounded-t-lg',
            mode !== 'fullscreen' && 'cursor-pointer'
          )}
          onClick={
            mode === 'minimized'
              ? () => setMode('normal')
              : undefined
          }
        >
          <div className="flex items-center gap-2 min-w-0">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="text-sm font-medium truncate">
              {mode === 'minimized' && subject.trim()
                ? subject
                : title}
            </span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-neutral-300 hover:bg-neutral-700 hover:text-neutral-50"
              onClick={(e) => {
                e.stopPropagation()
                setMode(mode === 'minimized' ? 'normal' : 'minimized')
              }}
              aria-label="Minimizar"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-neutral-300 hover:bg-neutral-700 hover:text-neutral-50"
              onClick={(e) => {
                e.stopPropagation()
                setMode(mode === 'fullscreen' ? 'normal' : 'fullscreen')
              }}
              aria-label={mode === 'fullscreen' ? 'Sair do ecrã completo' : 'Ecrã completo'}
            >
              {mode === 'fullscreen' ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-neutral-300 hover:bg-neutral-700 hover:text-neutral-50"
              onClick={(e) => {
                e.stopPropagation()
                void handleClose()
              }}
              aria-label="Fechar"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {mode !== 'minimized' && (
          <>
            {/* Recipient fields */}
            <div className="shrink-0 border-b px-3 py-2 space-y-1.5 bg-background">
              {state.senderEmail && (
                <div className="flex items-center gap-2 text-xs">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground w-10 shrink-0">
                    De
                  </Label>
                  <Badge variant="secondary" className="font-normal text-[11px]">
                    {state.senderName
                      ? `${state.senderName} <${state.senderEmail}>`
                      : state.senderEmail}
                  </Badge>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground w-10 shrink-0">
                  Para
                </Label>
                <Input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="h-7 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1 text-sm flex-1"
                />
                <Collapsible open={showCcBcc} onOpenChange={setShowCcBcc}>
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-[11px] text-muted-foreground gap-0.5 shrink-0"
                    >
                      Cc/Bcc
                      <ChevronDown
                        className={cn(
                          'h-3 w-3 transition-transform',
                          showCcBcc && 'rotate-180'
                        )}
                      />
                    </Button>
                  </CollapsibleTrigger>
                </Collapsible>
              </div>
              <Collapsible open={showCcBcc}>
                <CollapsibleContent className="space-y-1.5 data-[state=open]:animate-none">
                  <div className="flex items-center gap-2">
                    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground w-10 shrink-0">
                      Cc
                    </Label>
                    <Input
                      value={cc}
                      onChange={(e) => setCc(e.target.value)}
                      placeholder="email@exemplo.com"
                      className="h-7 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1 text-sm flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground w-10 shrink-0">
                      Bcc
                    </Label>
                    <Input
                      value={bcc}
                      onChange={(e) => setBcc(e.target.value)}
                      placeholder="email@exemplo.com"
                      className="h-7 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1 text-sm flex-1"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
              <div className="flex items-center gap-2">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground w-10 shrink-0">
                  Assunto
                </Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Assunto"
                  className="h-7 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1 text-sm flex-1 font-medium"
                />
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-auto bg-background">
              <EditorContent editor={editor} />
              {signatureEnabled && sigPreviewHtml && (
                <div
                  className="px-4 pb-4 pt-2 border-t border-dashed mx-4 my-2 text-sm text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: sigPreviewHtml }}
                />
              )}
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="shrink-0 border-t bg-background px-3 py-1.5 flex flex-wrap gap-1.5">
                {attachments.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 text-xs"
                  >
                    <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate max-w-[140px]">{file.name}</span>
                    <span className="text-muted-foreground shrink-0">
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => removeAttachment(i)}
                      title="Remover"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Toolbar */}
            <ComposerToolbar
              editor={editor}
              signatureEnabled={signatureEnabled}
              signatureAvailable={signatureAvailable}
              onSignatureToggle={() => setSignatureEnabled((v) => !v)}
              onAttachFiles={handleAttachFiles}
              onInlineImageUpload={uploadInlineImage}
              onDiscard={handleDiscard}
              endSlot={
                <ComposerAIPanel
                  editor={editor}
                  replyTo={state.replyTo}
                  forwardMessage={state.forwardMessage}
                  currentSubject={subject}
                  onSubjectChange={setSubject}
                />
              }
            />

            {/* Send bar */}
            <div className="shrink-0 border-t bg-background px-3 py-2 flex items-center justify-between gap-2">
              <Button
                type="button"
                onClick={handleSend}
                disabled={isSending}
                size="sm"
                className="h-8"
              >
                {isSending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />A enviar…
                  </>
                ) : (
                  <>
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    Enviar
                  </>
                )}
              </Button>
              <div className="flex items-center gap-2">
                {draftIndicator}
                {attachments.length > 0 && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />
                    {attachments.length}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  )
}
