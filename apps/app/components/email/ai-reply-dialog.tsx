'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import {
  Sparkles, Send, Paperclip, X, FileText, Mic, MicOff, Loader2,
  FolderOpen, Image as ImageIcon, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FullMessage } from '@/hooks/use-email-inbox'

interface AiReplyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: FullMessage
  accountId?: string | null
  onSent?: () => void
}

interface ErpDocument {
  id: string
  file_name: string
  file_url: string
  folder_name: string
}

interface AttachmentItem {
  type: 'file' | 'erp'
  file?: File
  erp?: ErpDocument
  name: string
}

export function AiReplyDialog({
  open,
  onOpenChange,
  message,
  accountId,
  onSent,
}: AiReplyDialogProps) {
  // Step: 'instruct' → 'edit'
  const [step, setStep] = useState<'instruct' | 'edit'>('instruct')
  const [instruction, setInstruction] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // To / CC / BCC
  const [toField, setToField] = useState('')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [showCcBcc, setShowCcBcc] = useState(false)

  // Signature
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  const [showSignature, setShowSignature] = useState(true)
  const [signatureLoaded, setSignatureLoaded] = useState(false)

  // Attachments (local files + ERP documents)
  const [attachments, setAttachments] = useState<AttachmentItem[]>([])

  // ERP document picker
  const [erpPickerOpen, setErpPickerOpen] = useState(false)
  const [erpDocs, setErpDocs] = useState<ErpDocument[]>([])
  const [erpDocsLoading, setErpDocsLoading] = useState(false)

  // Audio recording
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const fromName = message.from[0]?.name || ''
  const fromEmail = message.from[0]?.address || ''

  // Load signature on open
  useEffect(() => {
    if (!open || signatureLoaded) return
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(me => {
        if (me?.id) {
          return fetch(`/api/consultants/${me.id}`)
        }
        return null
      })
      .then(r => r?.json())
      .then(data => {
        const sig = data?.email_signature_url
          || data?.dev_consultant_profiles?.email_signature_url
          || data?.profile?.email_signature_url
          || null
        setSignatureUrl(sig)
        setSignatureLoaded(true)
      })
      .catch(() => setSignatureLoaded(true))
  }, [open, signatureLoaded])

  // Set To field when dialog opens
  useEffect(() => {
    if (open) setToField(fromEmail)
  }, [open, fromEmail])

  const reset = useCallback(() => {
    setStep('instruct')
    setInstruction('')
    setDraftBody('')
    setAttachments([])
    setGenerating(false)
    setSending(false)
    setShowSignature(true)
    setShowCcBcc(false)
    setCc('')
    setBcc('')
    setErpDocs([])
  }, [])

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) reset()
    onOpenChange(open)
  }, [onOpenChange, reset])

  // ── Voice Recording ───────────────────────────────────────

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setGenerating(true)
        try {
          const fd = new FormData()
          fd.append('audio', blob)
          const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
          if (!res.ok) throw new Error()
          const { text } = await res.json()
          setInstruction(prev => prev ? `${prev}\n${text}` : text)
        } catch {
          toast.error('Erro ao transcrever áudio')
        } finally {
          setGenerating(false)
        }
      }
      recorder.start()
      setIsRecording(true)
    } catch {
      toast.error('Não foi possível aceder ao microfone')
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording])

  // ── Generate Draft ────────────────────────────────────────

  const generateDraft = useCallback(async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/email/ai-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: message.subject,
          from_name: fromName,
          from_email: fromEmail,
          body_text: message.text,
          body_html: message.html,
          instruction: instruction || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setDraftBody(data.draft || '')
      // If the API returns a signature and we haven't loaded one, use it
      if (data.signature_url && !signatureUrl) {
        setSignatureUrl(data.signature_url)
      }
      setStep('edit')
    } catch {
      toast.error('Erro ao gerar rascunho')
    } finally {
      setGenerating(false)
    }
  }, [message, fromName, fromEmail, instruction, signatureUrl])

  // ── ERP Document Picker ───────────────────────────────────

  const loadErpDocs = useCallback(async () => {
    if (erpDocs.length > 0) return // already loaded
    setErpDocsLoading(true)
    try {
      // Fetch user's processes and their documents
      const procRes = await fetch('/api/processes?limit=50')
      const procData = await procRes.json()
      const processes = procData.data || procData || []

      const allDocs: ErpDocument[] = []

      // Load documents from each process (limit to first 10 for performance)
      const toFetch = processes.slice(0, 10)
      await Promise.all(
        toFetch.map(async (proc: { id: string; external_ref?: string; property?: { title?: string } }) => {
          try {
            const res = await fetch(`/api/processes/${proc.id}/documents`)
            const data = await res.json()
            const folders = data.folders || []
            for (const folder of folders) {
              for (const doc of folder.files || []) {
                if (doc.file_url) {
                  allDocs.push({
                    id: doc.id,
                    file_name: doc.file_name || 'Documento',
                    file_url: doc.file_url,
                    folder_name: `${proc.external_ref || 'Processo'} — ${folder.name}`,
                  })
                }
              }
            }
          } catch { /* skip */ }
        })
      )

      setErpDocs(allDocs)
    } catch {
      toast.error('Erro ao carregar documentos')
    } finally {
      setErpDocsLoading(false)
    }
  }, [erpDocs.length])

  const addErpDoc = useCallback((doc: ErpDocument) => {
    if (attachments.some(a => a.erp?.id === doc.id)) return
    setAttachments(prev => [...prev, { type: 'erp', erp: doc, name: doc.file_name }])
    setErpPickerOpen(false)
  }, [attachments])

  // ── Send Email ────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (!draftBody.trim()) return
    setSending(true)
    try {
      const bodyParagraphs = draftBody.split('\n').map(line =>
        `<p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a;">${line || '<br/>'}</p>`
      ).join('')

      const sigHtml = showSignature && signatureUrl
        ? `<br/><img src="${signatureUrl}" alt="Assinatura" style="max-width:300px;height:auto;" />`
        : ''

      const fullHtml = `<!DOCTYPE html><html><body style="margin:0;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
${bodyParagraphs}
${sigHtml}
</body></html>`

      // Build attachments payload
      const attPayload: Array<{ filename: string; content_type: string; data_base64?: string; path?: string }> = []

      for (const att of attachments) {
        if (att.type === 'file' && att.file) {
          const buffer = await att.file.arrayBuffer()
          const bytes = new Uint8Array(buffer)
          let binary = ''
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i])
          }
          attPayload.push({
            filename: att.file.name,
            content_type: att.file.type || 'application/octet-stream',
            data_base64: btoa(binary),
          })
        } else if (att.type === 'erp' && att.erp) {
          attPayload.push({
            filename: att.erp.file_name,
            content_type: 'application/octet-stream',
            path: att.erp.file_url,
          })
        }
      }

      const toAddresses = toField.split(',').map(e => e.trim()).filter(Boolean)
      const ccAddresses = cc ? cc.split(',').map(e => e.trim()).filter(Boolean) : []
      const bccAddresses = bcc ? bcc.split(',').map(e => e.trim()).filter(Boolean) : []

      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toAddresses,
          cc: ccAddresses.length > 0 ? ccAddresses : undefined,
          bcc: bccAddresses.length > 0 ? bccAddresses : undefined,
          subject: message.subject.startsWith('Re:') ? message.subject : `Re: ${message.subject}`,
          body_html: fullHtml,
          body_text: draftBody,
          in_reply_to: message.messageId || undefined,
          account_id: accountId || undefined,
          attachments: attPayload.length > 0 ? attPayload : undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao enviar')
      }

      toast.success('Email enviado com sucesso')
      handleOpenChange(false)
      onSent?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar email')
    } finally {
      setSending(false)
    }
  }, [draftBody, signatureUrl, showSignature, toField, cc, bcc, message, accountId, attachments, handleOpenChange, onSent])

  // ── File Attachments ──────────────────────────────────────

  const handleAddFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: AttachmentItem[] = Array.from(e.target.files).map(f => ({
        type: 'file', file: f, name: f.name,
      }))
      setAttachments(prev => [...prev, ...newFiles])
    }
    e.target.value = ''
  }, [])

  const removeAttachment = useCallback((idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx))
  }, [])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-xl rounded-2xl max-h-[92vh] overflow-hidden flex flex-col p-0">
        {/* Header — Gmail style with To/CC/BCC */}
        <div className="shrink-0 border-b">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30">
            <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
            <DialogTitle className="text-sm font-semibold truncate flex-1">
              {step === 'instruct' ? 'Resposta IA' : `Re: ${message.subject}`}
            </DialogTitle>
          </div>
          <div className="px-4 py-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-10 shrink-0">Para:</span>
              <input
                type="text"
                value={toField}
                onChange={e => setToField(e.target.value)}
                className="flex-1 text-xs bg-transparent outline-none"
                placeholder="email@exemplo.com"
              />
              {!showCcBcc && (
                <button
                  type="button"
                  onClick={() => setShowCcBcc(true)}
                  className="text-[10px] text-muted-foreground hover:text-foreground shrink-0"
                >
                  CC / BCC
                </button>
              )}
            </div>
            {showCcBcc && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-10 shrink-0">CC:</span>
                  <input
                    type="text"
                    value={cc}
                    onChange={e => setCc(e.target.value)}
                    className="flex-1 text-xs bg-transparent outline-none"
                    placeholder="Separar emails por vírgula"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-10 shrink-0">BCC:</span>
                  <input
                    type="text"
                    value={bcc}
                    onChange={e => setBcc(e.target.value)}
                    className="flex-1 text-xs bg-transparent outline-none"
                    placeholder="Separar emails por vírgula"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Step 1: Instruction */}
        {step === 'instruct' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">O que pretende responder?</Label>
              <p className="text-[11px] text-muted-foreground">
                Descreva brevemente e a IA redige por si. Pode também gravar por voz.
              </p>
              <Textarea
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                placeholder="Ex: Dizer que não tenho interesse na proposta, agradecer e desejar boa sorte..."
                rows={4}
                className="rounded-xl text-sm resize-none"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={isRecording ? 'destructive' : 'outline'}
                  size="sm"
                  className="rounded-full gap-2 h-8"
                  disabled={generating}
                  onClick={isRecording ? stopRecording : startRecording}
                >
                  {isRecording ? (
                    <>
                      <MicOff className="h-3.5 w-3.5" />
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                      </span>
                      Parar
                    </>
                  ) : (
                    <><Mic className="h-3.5 w-3.5" /> Gravar</>
                  )}
                </Button>
                {generating && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> A processar...
                  </span>
                )}
              </div>
            </div>

            {/* Original email preview */}
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Email original</p>
              <p className="text-xs font-medium truncate">{message.subject}</p>
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-3">
                {(message.text || '').slice(0, 300)}
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Edit — Gmail-like compose */}
        {step === 'edit' && (
          <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
            {/* Body */}
            <div className="flex-1 p-4">
              <Textarea
                value={draftBody}
                onChange={e => setDraftBody(e.target.value)}
                className="w-full border-0 shadow-none focus-visible:ring-0 text-sm resize-none p-0 min-h-[200px]"
                placeholder="Escreva a sua resposta..."
                autoFocus
              />

              {/* Signature */}
              {signatureUrl && showSignature && (
                <div className="mt-4 pt-4 border-t border-dashed">
                  <img src={signatureUrl} alt="Assinatura" className="max-w-[250px] h-auto opacity-90" />
                </div>
              )}
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="px-4 pb-2">
                <div className="flex flex-wrap gap-1.5">
                  {attachments.map((att, i) => (
                    <div key={i} className="relative rounded-lg border bg-muted/30 px-2.5 py-1.5 pr-6 text-[11px] flex items-center gap-1.5">
                      {att.type === 'erp' ? (
                        <FolderOpen className="h-3 w-3 text-blue-500 shrink-0" />
                      ) : (
                        <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                      <span className="max-w-[140px] truncate">{att.name}</span>
                      {att.type === 'erp' && (
                        <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3.5">ERP</Badge>
                      )}
                      <button
                        onClick={() => removeAttachment(i)}
                        className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer toolbar — Gmail style */}
        <div className="shrink-0 border-t px-4 py-2.5 flex items-center gap-2 bg-muted/20">
          {step === 'instruct' ? (
            <>
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <div className="flex-1" />
              <Button
                size="sm"
                className="rounded-full gap-2"
                disabled={generating}
                onClick={generateDraft}
              >
                {generating ? (
                  <><Spinner variant="infinite" size={14} /> A gerar...</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" /> Gerar Resposta</>
                )}
              </Button>
            </>
          ) : (
            <>
              {/* Send button */}
              <Button
                size="sm"
                className="rounded-full gap-2"
                disabled={!draftBody.trim() || sending}
                onClick={handleSend}
              >
                {sending ? (
                  <><Spinner variant="infinite" size={14} /> A enviar...</>
                ) : (
                  <><Send className="h-3.5 w-3.5" /> Enviar</>
                )}
              </Button>

              <Separator orientation="vertical" className="h-5" />

              {/* Attach file from device */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                title="Anexar ficheiro"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleAddFiles}
              />

              {/* Attach from ERP */}
              <Popover open={erpPickerOpen} onOpenChange={(o) => { setErpPickerOpen(o); if (o) loadErpDocs() }}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    title="Anexar do sistema"
                  >
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start" side="top">
                  <div className="px-3 py-2 border-b">
                    <p className="text-xs font-semibold">Documentos do Sistema</p>
                    <p className="text-[10px] text-muted-foreground">Seleccione documentos dos seus processos</p>
                  </div>
                  <ScrollArea className="max-h-[250px]">
                    {erpDocsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Spinner variant="infinite" size={16} />
                      </div>
                    ) : erpDocs.length === 0 ? (
                      <div className="text-center py-8 text-xs text-muted-foreground">
                        Nenhum documento encontrado
                      </div>
                    ) : (
                      <div className="p-1">
                        {erpDocs.map(doc => {
                          const isAdded = attachments.some(a => a.erp?.id === doc.id)
                          return (
                            <button
                              key={doc.id}
                              disabled={isAdded}
                              onClick={() => addErpDoc(doc)}
                              className={cn(
                                'w-full text-left rounded-lg px-2.5 py-2 text-xs transition-colors flex items-center gap-2',
                                isAdded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted/50'
                              )}
                            >
                              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">{doc.file_name}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{doc.folder_name}</p>
                              </div>
                              {isAdded && <Badge variant="secondary" className="text-[8px] shrink-0">Adicionado</Badge>}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              {/* Signature toggle */}
              {signatureUrl && (
                <>
                  <Separator orientation="vertical" className="h-5" />
                  <button
                    type="button"
                    onClick={() => setShowSignature(v => !v)}
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium transition-colors',
                      showSignature
                        ? 'bg-neutral-900 text-white dark:bg-neutral-200 dark:text-neutral-900'
                        : 'text-muted-foreground hover:bg-muted/50'
                    )}
                    title={showSignature ? 'Remover assinatura' : 'Adicionar assinatura'}
                  >
                    <ImageIcon className="h-3 w-3" />
                    Assinatura
                  </button>
                </>
              )}

              <div className="flex-1" />

              {/* Regenerate */}
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full gap-1 h-8 px-2 sm:px-3"
                title="Regenerar"
                onClick={() => setStep('instruct')}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-[11px]">Regenerar</span>
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
