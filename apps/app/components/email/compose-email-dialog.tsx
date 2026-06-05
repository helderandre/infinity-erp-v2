'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Editor, Frame, Element, useEditor } from '@craftjs/core'
import { Layers } from '@craftjs/layers'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Send,
  Loader2,
  ChevronDown,
  Paperclip,
  X,
  FileText,
  Mail,
  Save,
  Building2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { renderEmailToHtml, wrapEmailHtml, extractAttachmentsFromState } from '@/lib/email-renderer'
import { useEmailTemplates } from '@/hooks/use-email-templates'

// Craft.js editor components
import { EmailToolbox } from '@/components/email-editor/email-toolbox'
import { EmailSettingsPanel } from '@/components/email-editor/email-settings-panel'
import { EmailLayer } from '@/components/email-editor/email-layer'
import { RenderNode } from '@/components/email-editor/email-render-node'
import { EmailContainer } from '@/components/email-editor/user/email-container'
import { EmailText } from '@/components/email-editor/user/email-text'
import { EmailHeading } from '@/components/email-editor/user/email-heading'
import { EmailImage } from '@/components/email-editor/user/email-image'
import { EmailButton } from '@/components/email-editor/user/email-button'
import { EmailDivider } from '@/components/email-editor/user/email-divider'
import { EmailSpacer } from '@/components/email-editor/user/email-spacer'
import { EmailAttachment } from '@/components/email-editor/user/email-attachment'
import { EmailGrid } from '@/components/email-editor/user/email-grid'
import { EmailPortalLinks } from '@/components/email-editor/user/email-portal-links'
import { populatePortalLinksInState, fetchPortalLinks } from '@/lib/email-portal-utils'

import type { FullMessage } from '@/hooks/use-email-inbox'

const resolver = {
  EmailContainer,
  EmailText,
  EmailHeading,
  EmailImage,
  EmailButton,
  EmailDivider,
  EmailSpacer,
  EmailAttachment,
  EmailGrid,
  EmailPortalLinks,
}

interface ComposeEmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  replyTo?: FullMessage | null
  forwardMessage?: FullMessage | null
  senderEmail?: string
  senderName?: string
  accountId?: string | null
  processId?: string
  processType?: string
  onSent?: () => void
  /** Pre-fill subject when opening */
  initialSubject?: string
  /** Pre-fill recipients (comma-separated) */
  initialTo?: string
  /** Initial AI instruction to auto-generate the body when the dialog opens */
  initialAiInstruction?: string
  /** External attachments to include (URL-based, fetched server-side on send) */
  initialPathAttachments?: { filename: string; url: string }[]
}

// ─── Right sidebar (Properties + Layers) ────────────────────────────────────

function RightSidebar() {
  return (
    <Tabs
      defaultValue="properties"
      className="w-60 shrink-0 border-l flex flex-col overflow-hidden gap-0"
    >
      <TabsList className="w-full rounded-none border-b h-9 shrink-0">
        <TabsTrigger value="properties" className="flex-1 text-xs">
          Propriedades
        </TabsTrigger>
        <TabsTrigger value="layers" className="flex-1 text-xs">
          Camadas
        </TabsTrigger>
      </TabsList>
      <TabsContent value="properties" className="mt-0 flex-1 overflow-auto">
        <EmailSettingsPanel />
      </TabsContent>
      <TabsContent value="layers" className="mt-0 flex-1 overflow-auto">
        <Layers expandRootOnLoad renderLayer={EmailLayer} />
      </TabsContent>
    </Tabs>
  )
}

// ─── Inner editor canvas (needs useEditor context) ──────────────────────────

interface EditorCanvasProps {
  loadedEditorState: string | undefined
  quotedHtml?: string
  quotedLabel?: string
  onSend: (html: string, editorState: string) => void
  isSending: boolean
  attachments: File[]
  onAddFiles: (files: File[]) => void
  onRemoveFile: (index: number) => void
  draftStatus?: 'idle' | 'saving' | 'saved'
  onSaveDraft?: () => void
}

function EditorCanvas({
  loadedEditorState,
  quotedHtml,
  quotedLabel,
  onSend,
  isSending,
  attachments,
  onAddFiles,
  onRemoveFile,
  draftStatus,
  onSaveDraft,
}: EditorCanvasProps) {
  const { query } = useEditor()

  const handleSend = useCallback(() => {
    const state = query.serialize()
    const html = renderEmailToHtml(state, {})
    const wrappedHtml = wrapEmailHtml(html)
    onSend(wrappedHtml, state)
  }, [query, onSend])

  function handleAttachFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      onAddFiles(Array.from(e.target.files))
    }
    e.target.value = ''
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* Editor area */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        <EmailToolbox />
        <div className="flex-1 overflow-auto bg-muted/30 p-6">
          <div className="mx-auto" style={{ maxWidth: 620 }}>
            <Frame data={loadedEditorState}>
              <Element
                is={EmailContainer}
                canvas
                padding={24}
                background="#ffffff"
                width="100%"
                direction="column"
                align="stretch"
                justify="flex-start"
                gap={8}
              >
                <EmailText html={quotedHtml
                  ? `<p>Escreva a sua mensagem aqui...</p>
<br/>
<hr style="border:none;border-top:1px solid #d1d5db;margin:8px 0;" />
<p style="color:#6b7280;font-size:13px;">${quotedLabel || ''}</p>
<blockquote style="border-left:3px solid #d1d5db;padding-left:12px;margin:8px 0;color:#374151;background:#f9fafb;padding:12px;">${quotedHtml}</blockquote>`
                  : 'Escreva a sua mensagem aqui...'
                } />
              </Element>
            </Frame>
          </div>
        </div>
        <RightSidebar />
      </div>

      {/* Attachments + Send bar */}
      <div className="shrink-0 border-t bg-background px-4 py-1.5 space-y-1">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {attachments.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 text-xs bg-muted rounded-md px-2 py-1"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate max-w-[150px]">{file.name}</span>
                <span className="text-muted-foreground shrink-0">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
                <button
                  type="button"
                  title="Remover anexo"
                  onClick={() => onRemoveFile(i)}
                  className="shrink-0"
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="cursor-pointer">
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleAttachFiles}
              />
              <Button type="button" variant="outline" size="sm" asChild>
                <span>
                  <Paperclip className="h-4 w-4 mr-1.5" />
                  Anexar
                </span>
              </Button>
            </label>
            {onSaveDraft && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onSaveDraft}
                disabled={draftStatus === 'saving'}
              >
                {draftStatus === 'saving' ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-4 w-4" />
                )}
                {draftStatus === 'saved' ? 'Guardado' : 'Guardar rascunho'}
              </Button>
            )}
          </div>
          <Button onClick={handleSend} disabled={isSending} size="sm">
            {isSending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                A enviar...
              </>
            ) : (
              <>
                <Send className="mr-1.5 h-4 w-4" />
                Enviar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main compose component ─────────────────────────────────────────────────

export function ComposeEmailDialog({
  open,
  onOpenChange,
  replyTo,
  forwardMessage,
  senderEmail,
  senderName,
  accountId,
  processId,
  processType,
  onSent,
  initialSubject,
  initialTo,
  initialAiInstruction,
  initialPathAttachments,
}: ComposeEmailDialogProps) {
  const [isSending, setIsSending] = useState(false)
  const [showCcBcc, setShowCcBcc] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])

  // Email fields
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [subject, setSubject] = useState('')

  // Template selection
  const { templates, isLoading: templatesLoading } = useEmailTemplates()
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [editorState, setEditorState] = useState<string | undefined>(undefined)
  const [editorKey, setEditorKey] = useState(0) // Force re-mount Craft.js

  // Property selection (for populating portal links)
  const [propertySearch, setPropertySearch] = useState('')
  const [propertyResults, setPropertyResults] = useState<Array<{ id: string; title: string; external_ref?: string }>>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('')
  const [selectedPropertyLabel, setSelectedPropertyLabel] = useState('')
  const [isSearchingProperties, setIsSearchingProperties] = useState(false)
  const propertySearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const portalLinksRef = useRef<Array<{ portal: string; name: string; url: string }>>([])

  // Search properties as user types
  useEffect(() => {
    if (propertySearchTimerRef.current) clearTimeout(propertySearchTimerRef.current)
    if (!propertySearch.trim() || propertySearch.length < 2) {
      setPropertyResults([])
      return
    }
    propertySearchTimerRef.current = setTimeout(async () => {
      setIsSearchingProperties(true)
      try {
        const res = await fetch(`/api/properties?search=${encodeURIComponent(propertySearch)}&per_page=8`)
        if (res.ok) {
          const data = await res.json()
          const items = (data.data || data || []) as Array<{ id: string; title: string; external_ref?: string }>
          setPropertyResults(items)
        }
      } catch { /* ignore */ }
      setIsSearchingProperties(false)
    }, 300)
    return () => { if (propertySearchTimerRef.current) clearTimeout(propertySearchTimerRef.current) }
  }, [propertySearch])

  // When property is selected, fetch portal links and populate editor state
  const handleSelectProperty = useCallback(async (prop: { id: string; title: string; external_ref?: string }) => {
    setSelectedPropertyId(prop.id)
    setSelectedPropertyLabel(prop.external_ref ? `${prop.external_ref} — ${prop.title}` : prop.title)
    setPropertySearch('')
    setPropertyResults([])

    const { portalLinks } = await fetchPortalLinks(prop.id)
    portalLinksRef.current = portalLinks

    // If there's already an editor state loaded, populate portal links
    if (editorState) {
      const populated = populatePortalLinksInState(editorState, portalLinks)
      if (populated !== editorState) {
        setEditorState(populated)
        setEditorKey((k) => k + 1)
      }
    }
  }, [editorState])

  const handleClearProperty = useCallback(() => {
    setSelectedPropertyId('')
    setSelectedPropertyLabel('')
    portalLinksRef.current = []
    // Remove portal links from editor state
    if (editorState) {
      const cleared = populatePortalLinksInState(editorState, [])
      if (cleared !== editorState) {
        setEditorState(cleared)
        setEditorKey((k) => k + 1)
      }
    }
  }, [editorState])

  // Auto-save draft
  const [draftUid, setDraftUid] = useState<number | null>(null)
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef('')

  const saveDraft = useCallback(async () => {
    const draftKey = `${to}|${cc}|${bcc}|${subject}`
    // Only save if there's meaningful content
    if (!to.trim() && !subject.trim()) return
    // Skip if nothing changed
    if (draftKey === lastSavedRef.current) return

    setDraftStatus('saving')
    try {
      const res = await fetch('/api/email/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          cc,
          bcc,
          subject,
          body_html: '', // Will be filled from editor state on server
          in_reply_to: replyTo?.messageId,
          existing_draft_uid: draftUid ?? undefined,
          account_id: accountId || undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.uid) setDraftUid(data.uid)
        lastSavedRef.current = draftKey
        setDraftStatus('saved')
      } else {
        setDraftStatus('idle')
      }
    } catch {
      setDraftStatus('idle')
    }
  }, [to, cc, bcc, subject, replyTo, draftUid])

  // Auto-save every 30s when dialog is open
  useEffect(() => {
    if (!open) return
    draftTimerRef.current = setInterval(() => {
      saveDraft()
    }, 30000)
    return () => {
      if (draftTimerRef.current) clearInterval(draftTimerRef.current)
    }
  }, [open, saveDraft])

  // Reset draft status after 3s
  useEffect(() => {
    if (draftStatus === 'saved') {
      const t = setTimeout(() => setDraftStatus('idle'), 3000)
      return () => clearTimeout(t)
    }
  }, [draftStatus])

  // Set defaults when opening (reply/forward)
  useEffect(() => {
    if (!open) return

    setAttachments([])
    setSelectedTemplateId('')
    setEditorState(undefined)
    setShowCcBcc(false)
    setDraftUid(null)
    setDraftStatus('idle')
    lastSavedRef.current = ''
    setSelectedPropertyId('')
    setSelectedPropertyLabel('')
    setPropertySearch('')
    setPropertyResults([])
    portalLinksRef.current = []

    if (replyTo) {
      const replyAddr = replyTo.from[0]?.address || ''
      setTo(replyAddr)
      // Pre-fill CC with original CC recipients (excluding our own sender address)
      const originalCc = (replyTo.cc || [])
        .map((a) => a.address)
        .filter((addr): addr is string => !!addr && addr.toLowerCase() !== senderEmail?.toLowerCase())
      setCc(originalCc.join(', '))
      if (originalCc.length > 0) setShowCcBcc(true)
      setBcc('')
      setSubject(
        replyTo.subject.startsWith('Re:')
          ? replyTo.subject
          : `Re: ${replyTo.subject}`
      )
    } else if (forwardMessage) {
      setTo('')
      setCc('')
      setBcc('')
      setSubject(
        forwardMessage.subject.startsWith('Fwd:')
          ? forwardMessage.subject
          : `Fwd: ${forwardMessage.subject}`
      )
    } else {
      setTo(initialTo || '')
      setCc('')
      setBcc('')
      setSubject(initialSubject || '')
    }

    // Force re-mount editor
    setEditorKey((k) => k + 1)
  }, [open, replyTo, forwardMessage, senderEmail, initialTo, initialSubject])

  // Auto-generate body via AI when initialAiInstruction is provided
  const aiDraftRunRef = useRef(false)
  useEffect(() => {
    if (!open) {
      aiDraftRunRef.current = false
      return
    }
    if (!initialAiInstruction || aiDraftRunRef.current) return
    aiDraftRunRef.current = true

    ;(async () => {
      try {
        const res = await fetch('/api/email/ai-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: initialSubject || 'Documentos do imóvel',
            instruction: initialAiInstruction,
            tone: 'professional',
          }),
        })
        if (!res.ok) return
        const data = await res.json()
        const html = data?.body_html || data?.html || data?.body
        if (html && typeof html === 'string') {
          // Wrap raw HTML inside a Craft.js EmailText node
          const wrappedState = JSON.stringify({
            ROOT: {
              type: { resolvedName: 'EmailContainer' },
              isCanvas: true,
              props: { padding: 24, background: '#ffffff', width: '100%', direction: 'column', align: 'stretch', justify: 'flex-start', gap: 8 },
              displayName: 'EmailContainer',
              custom: {},
              parent: null,
              hidden: false,
              nodes: ['ai-text'],
              linkedNodes: {},
            },
            'ai-text': {
              type: { resolvedName: 'EmailText' },
              isCanvas: false,
              props: { html },
              displayName: 'EmailText',
              custom: {},
              parent: 'ROOT',
              hidden: false,
              nodes: [],
              linkedNodes: {},
            },
          })
          setEditorState(wrappedState)
          setEditorKey((k) => k + 1)
        }
      } catch {
        // ignore — user can write manually
      }
    })()
  }, [open, initialAiInstruction, initialSubject])

  // Load template when selected
  const handleTemplateChange = useCallback(async (templateId: string) => {
    setSelectedTemplateId(templateId)

    if (templateId === '_blank' || !templateId) {
      setEditorState(undefined)
      setEditorKey((k) => k + 1)
      return
    }

    try {
      const res = await fetch(`/api/libraries/emails/${templateId}`)
      if (!res.ok) throw new Error('Erro ao carregar template')
      const data = await res.json()

      if (data.editor_state) {
        let stateStr = typeof data.editor_state === 'string'
          ? data.editor_state
          : JSON.stringify(data.editor_state)
        // If a property is already selected, populate portal links
        if (portalLinksRef.current.length > 0) {
          stateStr = populatePortalLinksInState(stateStr, portalLinksRef.current)
        }
        setEditorState(stateStr)
      }
      if (data.subject && !subject) {
        setSubject(data.subject)
      }
      setEditorKey((k) => k + 1)
    } catch {
      toast.error('Erro ao carregar template')
    }
  }, [subject])

  // Send handler
  async function handleSend(bodyHtml: string, serializedState: string) {
    if (!to.trim()) {
      toast.error('Destinatário é obrigatório')
      return
    }
    if (!subject.trim()) {
      toast.error('Assunto é obrigatório')
      return
    }

    setIsSending(true)
    try {
      const toAddrs = to.split(',').map((e) => e.trim()).filter(Boolean)
      const ccAddrs = cc ? cc.split(',').map((e) => e.trim()).filter(Boolean) : []
      const bccAddrs = bcc ? bcc.split(',').map((e) => e.trim()).filter(Boolean) : []

      // 1. Convert manual file attachments to base64
      const fileAttachments = await Promise.all(
        attachments.map(async (file) => {
          const buffer = await file.arrayBuffer()
          const base64 = btoa(
            new Uint8Array(buffer).reduce(
              (data, byte) => data + String.fromCharCode(byte),
              ''
            )
          )
          return {
            filename: file.name,
            content_type: file.type || 'application/octet-stream',
            data_base64: base64,
          }
        })
      )

      // 2. Extract editor attachments (R2 URLs) as path-based attachments
      const editorAttachments = extractAttachmentsFromState(serializedState).map((a) => ({
        filename: a.filename,
        content_type: 'application/octet-stream',
        path: a.path,
      }))

      // 3. External pre-supplied attachments (e.g. property documents)
      const externalAttachments = (initialPathAttachments || []).map((a) => ({
        filename: a.filename,
        content_type: 'application/octet-stream',
        path: a.url,
      }))

      const allAttachments = [...fileAttachments, ...editorAttachments, ...externalAttachments]

      const payload = {
        to: toAddrs,
        cc: ccAddrs.length > 0 ? ccAddrs : undefined,
        bcc: bccAddrs.length > 0 ? bccAddrs : undefined,
        subject: subject.trim(),
        body_html: bodyHtml,
        in_reply_to: replyTo?.messageId || undefined,
        process_id: processId,
        process_type: processType,
        attachments: allAttachments.length > 0 ? allAttachments : undefined,
        account_id: accountId || undefined,
      }

      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || result.detail || 'Erro ao enviar')
      }

      toast.success('Email enviado com sucesso!')
      onOpenChange(false)
      onSent?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar email')
    } finally {
      setIsSending(false)
    }
  }

  // Build quoted content for reply/forward
  let quotedHtml: string | undefined
  let quotedLabel: string | undefined

  if (replyTo) {
    const quotedDate = replyTo.date
      ? new Date(replyTo.date).toLocaleString('pt-PT')
      : ''
    const quotedFrom = replyTo.from[0]?.name
      ? `${replyTo.from[0].name} &lt;${replyTo.from[0].address}&gt;`
      : replyTo.from[0]?.address || ''
    quotedLabel = `Em ${quotedDate}, ${quotedFrom} escreveu:`
    quotedHtml = replyTo.html || replyTo.text || ''
  } else if (forwardMessage) {
    const fwdDate = forwardMessage.date
      ? new Date(forwardMessage.date).toLocaleString('pt-PT')
      : ''
    const fwdFrom = forwardMessage.from[0]?.name
      ? `${forwardMessage.from[0].name} &lt;${forwardMessage.from[0].address}&gt;`
      : forwardMessage.from[0]?.address || ''
    const fwdTo = forwardMessage.to
      .map((a) => (a.name ? `${a.name} &lt;${a.address}&gt;` : a.address))
      .join(', ')
    quotedLabel = `---------- Mensagem reencaminhada ----------`
    quotedHtml = `<p><strong>De:</strong> ${fwdFrom}<br/><strong>Data:</strong> ${fwdDate}<br/><strong>Assunto:</strong> ${forwardMessage.subject}<br/><strong>Para:</strong> ${fwdTo}</p>${forwardMessage.html || forwardMessage.text || ''}`
  }

  const title = replyTo
    ? 'Responder'
    : forwardMessage
      ? 'Reencaminhar'
      : 'Novo Email'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col p-0 !gap-0 overflow-hidden"
        style={{ position: 'fixed', inset: 0, width: '100vw', maxWidth: '100vw', height: '100dvh' }}
      >
        <SheetHeader className="shrink-0 border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {title}
          </SheetTitle>
        </SheetHeader>

        {/* Metadata area */}
        <div className="shrink-0 border-b px-4 py-3 space-y-2.5">
          {/* Sender (read-only) */}
          {senderEmail && (
            <div className="flex items-center gap-3">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-16 shrink-0">
                De
              </Label>
              <Badge variant="secondary" className="text-xs font-normal">
                {senderName ? `${senderName} <${senderEmail}>` : senderEmail}
              </Badge>
            </div>
          )}

          {/* To */}
          <div className="flex items-center gap-3">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-16 shrink-0">
              Para
            </Label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="email@exemplo.com (separar com vírgula)"
              className="h-8 text-sm flex-1"
            />
          </div>

          {/* CC/BCC toggle */}
          <Collapsible open={showCcBcc} onOpenChange={setShowCcBcc}>
            <div className="flex items-center gap-3">
              <span className="w-16 shrink-0" />
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs text-muted-foreground h-6 px-1"
                >
                  CC / BCC
                  <ChevronDown
                    className={cn(
                      'h-3 w-3 transition-transform',
                      showCcBcc && 'rotate-180'
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="space-y-2 pt-1">
              <div className="flex items-center gap-3">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-16 shrink-0">
                  CC
                </Label>
                <Input
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="h-8 text-sm flex-1"
                />
              </div>
              <div className="flex items-center gap-3">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-16 shrink-0">
                  BCC
                </Label>
                <Input
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="h-8 text-sm flex-1"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Subject + Template selector */}
          <div className="flex items-center gap-3">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-16 shrink-0">
              Assunto
            </Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Assunto do email"
              className="h-8 text-sm flex-1"
            />
          </div>

          <div className="flex items-center gap-3">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-16 shrink-0">
              Template
            </Label>
            {templatesLoading ? (
              <Skeleton className="h-8 flex-1" />
            ) : (
              <Select
                value={selectedTemplateId}
                onValueChange={handleTemplateChange}
              >
                <SelectTrigger className="h-8 text-sm flex-1">
                  <SelectValue placeholder="Em branco (novo email)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_blank">Em branco</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.subject && (
                        <span className="ml-2 text-muted-foreground">
                          — {t.subject}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Property selector for portal links */}
          <div className="flex items-center gap-3">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-16 shrink-0">
              Imóvel
            </Label>
            {selectedPropertyId ? (
              <div className="flex items-center gap-2 flex-1 h-8">
                <Badge variant="secondary" className="text-xs font-normal gap-1.5 h-7">
                  <Building2 className="h-3 w-3" />
                  {selectedPropertyLabel}
                </Badge>
                <button
                  type="button"
                  onClick={handleClearProperty}
                  title="Remover imóvel"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative flex-1">
                <Input
                  value={propertySearch}
                  onChange={(e) => setPropertySearch(e.target.value)}
                  placeholder="Pesquisar imóvel por ref. ou título..."
                  className="h-8 text-sm"
                />
                {(propertyResults.length > 0 || isSearchingProperties) && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border bg-popover shadow-md max-h-48 overflow-auto">
                    {isSearchingProperties && propertyResults.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">A pesquisar...</div>
                    )}
                    {propertyResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
                        onClick={() => handleSelectProperty(p)}
                      >
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {p.external_ref && (
                          <span className="text-xs text-muted-foreground font-mono shrink-0">{p.external_ref}</span>
                        )}
                        <span className="truncate">{p.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Craft.js Editor */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <Editor key={editorKey} resolver={resolver} onRender={RenderNode}>
            <EditorCanvas
              loadedEditorState={editorState}
              quotedHtml={quotedHtml}
              quotedLabel={quotedLabel}
              onSend={handleSend}
              isSending={isSending}
              attachments={attachments}
              onAddFiles={(files) =>
                setAttachments((prev) => [...prev, ...files])
              }
              onRemoveFile={(i) =>
                setAttachments((prev) => prev.filter((_, idx) => idx !== i))
              }
              draftStatus={draftStatus}
              onSaveDraft={saveDraft}
            />
          </Editor>
        </div>
      </SheetContent>
    </Sheet>
  )
}
