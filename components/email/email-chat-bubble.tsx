'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  X, Minus, Send, Sparkles, Loader2, ChevronDown, ChevronUp,
  Paperclip, Reply, ExternalLink, Mail, Mic, MicOff,
} from 'lucide-react'
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useEmailAccount } from '@/hooks/use-email-account'
import type { ImapMessageEnvelope } from '@/types/email'

interface EmailChatBubbleProps {
  contactEmail: string | null
  contactName: string
}

type ThreadMessage = ImapMessageEnvelope & { _folder: 'INBOX' | 'Sent' }

interface FullMessage {
  uid: number
  folder: string
  from: { name?: string; address?: string }[]
  to: { name?: string; address?: string }[]
  subject: string
  date: string | null
  html: string | null
  text: string | null
  messageId: string | null
  inReplyTo: string | null
  references: string[]
}

function formatEmailDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isToday(d)) return format(d, 'HH:mm')
  if (isYesterday(d)) return 'Ontem ' + format(d, 'HH:mm')
  return format(d, "d MMM HH:mm", { locale: pt })
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

export function EmailChatBubble({ contactEmail, contactName }: EmailChatBubbleProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [thread, setThread] = useState<ThreadMessage[]>([])
  const [isLoadingThread, setIsLoadingThread] = useState(false)
  const [expandedUid, setExpandedUid] = useState<number | null>(null)
  const [expandedContent, setExpandedContent] = useState<FullMessage | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)

  // Compose state
  const [showCompose, setShowCompose] = useState(false)
  const [replyTo, setReplyTo] = useState<FullMessage | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isSending, setIsSending] = useState(false)

  // AI state
  const [aiLoading, setAiLoading] = useState(false)
  // Voice-to-email state
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  // Web Speech API recognition (free, live — no OpenAI tokens)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const speechFinalRef = useRef('')

  const { account } = useEmailAccount()
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Fetch thread on open
  useEffect(() => {
    if (!isOpen || !contactEmail || !account) return
    if (thread.length > 0) return // already loaded

    setIsLoadingThread(true)
    fetch(`/api/email/contact-thread?email=${encodeURIComponent(contactEmail)}&limit=40`)
      .then((r) => r.json())
      .then((data) => {
        if (data.messages) setThread(data.messages)
      })
      .catch(() => toast.error('Erro ao carregar emails'))
      .finally(() => setIsLoadingThread(false))
  }, [isOpen, contactEmail, account, thread.length])

  // Scroll to bottom when thread loads
  useEffect(() => {
    if (!isLoadingThread && thread.length > 0 && bottomRef.current) {
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView())
    }
  }, [isLoadingThread, thread.length])

  // Expand a message to see full content
  const expandMessage = useCallback(async (msg: ThreadMessage) => {
    if (expandedUid === msg.uid) {
      setExpandedUid(null)
      setExpandedContent(null)
      return
    }

    setExpandedUid(msg.uid)
    setLoadingContent(true)
    try {
      const res = await fetch(`/api/email/inbox/${msg.uid}?folder=${encodeURIComponent(msg._folder)}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setExpandedContent(data)
    } catch {
      toast.error('Erro ao carregar email')
      setExpandedUid(null)
    } finally {
      setLoadingContent(false)
    }
  }, [expandedUid])

  // Start reply to a specific message
  const startReply = useCallback((msg: FullMessage) => {
    setReplyTo(msg)
    setSubject(msg.subject?.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`)
    setBody('')
    setShowCompose(true)
  }, [])

  // Start new email
  const startNew = useCallback(() => {
    setReplyTo(null)
    setSubject('')
    setBody('')
    setShowCompose(true)
  }, [])

  // AI draft — fills BOTH subject and body from the instruction/context
  const generateAiDraft = useCallback(async (instructionOverride?: string) => {
    const instruction = (instructionOverride ?? body).trim()

    if (!replyTo && !instruction && !subject.trim()) {
      toast.error('Escreva uma instrução (ou um assunto) ou grave uma nota de voz primeiro')
      return
    }

    setAiLoading(true)
    try {
      const payload: Record<string, string> = {
        contact_name: contactName || '',
        contact_email: contactEmail || '',
      }
      if (subject.trim()) payload.subject = subject.trim()
      if (replyTo) {
        payload.subject = replyTo.subject || payload.subject || ''
        payload.from_name = replyTo.from?.[0]?.name || ''
        payload.from_email = replyTo.from?.[0]?.address || ''
        payload.body_text = replyTo.text || (replyTo.html ? stripHtml(replyTo.html) : '')
      }
      if (instruction) payload.instruction = instruction

      const res = await fetch('/api/email/ai-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()

      // Apply both subject and body — overwrite the instruction prompt that was in body
      if (data.subject) setSubject(data.subject)
      setBody(data.body || data.draft || '')
    } catch {
      toast.error('Erro ao gerar rascunho IA')
    } finally {
      setAiLoading(false)
    }
  }, [replyTo, subject, body, contactName, contactEmail])

  // ── Strategy 1: Web Speech API (free, live transcription) ────────────
  // Writes text to the body in real time as the user speaks. No tokens used.
  // Chrome / Edge / Safari desktop all support it; Firefox and iOS Safari don't.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getSpeechRecognition = () =>
    (typeof window !== 'undefined' &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) || null

  const startLiveRecognition = useCallback(() => {
    const SR = getSpeechRecognition()
    if (!SR) return false

    try {
      const r = new SR()
      r.lang = 'pt-PT'
      r.continuous = true
      r.interimResults = true
      speechFinalRef.current = ''

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      r.onresult = (ev: any) => {
        let interim = ''
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const t = ev.results[i][0].transcript
          if (ev.results[i].isFinal) speechFinalRef.current += t
          else interim += t
        }
        setBody((speechFinalRef.current + interim).trimStart())
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      r.onerror = (ev: any) => {
        const err = ev?.error
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          toast.error('Permissão do microfone negada', {
            description: 'Clica no cadeado 🔒 ao lado do URL e permite o microfone.',
            duration: 8000,
          })
        } else if (err === 'no-speech') {
          // User didn't say anything — no toast, just stop quietly
        } else if (err !== 'aborted') {
          toast.error('Erro no reconhecimento de voz', { description: err })
        }
        setIsRecording(false)
      }

      r.onend = () => {
        setIsRecording(false)
        const finalText = speechFinalRef.current.trim()
        speechFinalRef.current = ''
        recognitionRef.current = null
        if (finalText) {
          // Feed the transcription into the AI draft (subject + body)
          generateAiDraft(finalText)
        }
      }

      recognitionRef.current = r
      r.start()
      setIsRecording(true)
      return true
    } catch {
      return false
    }
  }, [generateAiDraft])

  // ── Strategy 2: MediaRecorder → Whisper fallback (paid, non-live) ────
  const startRecording = useCallback(async () => {
    // Prefer the free, live Web Speech API whenever available
    if (startLiveRecognition()) return

    // Browser capability check
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error('O navegador não suporta gravação de áudio')
      return
    }
    if (typeof MediaRecorder === 'undefined') {
      toast.error('O navegador não suporta MediaRecorder')
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        toast.error('Permissão do microfone negada', {
          description: 'Clica no cadeado 🔒 ao lado do URL e permite o microfone, depois recarrega a página.',
          duration: 8000,
        })
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        toast.error('Nenhum microfone detectado', {
          description: 'Verifica se o microfone está ligado e tenta de novo.',
        })
      } else {
        toast.error('Não foi possível aceder ao microfone', {
          description: name ? `Erro: ${name}` : undefined,
        })
      }
      return
    }

    // Pick a supported mime type
    const mime = (() => {
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
      for (const m of candidates) {
        if (MediaRecorder.isTypeSupported?.(m)) return m
      }
      return ''
    })()

    let mr: MediaRecorder
    try {
      mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
    } catch {
      stream.getTracks().forEach((t) => t.stop())
      toast.error('Formato de áudio não suportado pelo navegador')
      return
    }

    mediaRecorderRef.current = mr
    chunksRef.current = []
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' })

      if (blob.size === 0) {
        toast.error('Gravação vazia — tenta falar mais alto ou mais tempo')
        return
      }

      setIsTranscribing(true)
      try {
        const ext = mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : 'webm'
        const fd = new FormData()
        fd.append('audio', blob, `recording.${ext}`)
        const trRes = await fetch('/api/transcribe', { method: 'POST', body: fd })
        if (!trRes.ok) {
          const err = await trRes.json().catch(() => ({}))
          throw new Error(err.error || `Transcrição falhou (${trRes.status})`)
        }
        const { text } = await trRes.json()
        if (!text?.trim()) {
          toast.error('Não consegui transcrever o áudio')
          return
        }
        await generateAiDraft(text.trim())
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Erro na transcrição')
      } finally {
        setIsTranscribing(false)
      }
    }
    mr.start()
    setIsRecording(true)
  }, [generateAiDraft])

  const stopRecording = useCallback(() => {
    // Stop Web Speech API if active (fires `onend` which kicks off AI draft).
    // Don't null the ref here — let `onend` clean up after firing.
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      return
    }
    // Otherwise stop the MediaRecorder fallback
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }, [])

  // Send email
  const handleSend = useCallback(async () => {
    if (!contactEmail || !subject.trim() || !body.trim()) {
      toast.error('Preencha o assunto e o corpo do email')
      return
    }

    setIsSending(true)
    try {
      // Convert plain text to simple HTML
      const bodyHtml = body.split('\n').map((line) => `<p>${line || '&nbsp;'}</p>`).join('')

      const payload: Record<string, unknown> = {
        to: [contactEmail],
        subject,
        body_html: bodyHtml,
        body_text: body,
      }
      if (replyTo?.messageId) {
        payload.in_reply_to = replyTo.messageId
      }

      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao enviar')
      }

      toast.success('Email enviado')
      setShowCompose(false)
      setBody('')
      setSubject('')
      setReplyTo(null)

      // Refresh thread
      setThread([])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar email')
    } finally {
      setIsSending(false)
    }
  }, [contactEmail, subject, body, replyTo])

  if (!contactEmail) return null

  const isFromMe = (msg: ThreadMessage) => {
    return msg._folder === 'Sent' || msg.from?.some((f) => f.address === account?.email_address)
  }

  return (
    <>
      {/* Email Panel */}
      <div
        className={cn(
          'fixed bottom-28 sm:bottom-20 right-20 sm:right-24 left-4 z-50 sm:left-auto sm:w-[420px] rounded-2xl border bg-background shadow-2xl transition-all duration-300 ease-out overflow-hidden',
          isOpen
            ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
            : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
        )}
        style={{ height: 'min(550px, calc(100vh - 140px))' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-4 py-2.5 bg-neutral-900 text-white rounded-t-2xl">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-neutral-700 text-white text-xs">
              {contactName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{contactName}</div>
            <div className="text-xs text-white/60 truncate">{contactEmail}</div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-neutral-800 hover:text-white"
              onClick={() => window.open('/dashboard/email', '_blank')}
              title="Abrir caixa de email"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-neutral-800 hover:text-white"
              onClick={() => setIsOpen(false)}
              title="Minimizar"
            >
              <Minus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        {isOpen && (
          <div className="flex flex-col" style={{ height: 'calc(100% - 53px)' }}>
            {!account ? (
              <div className="flex-1 flex items-center justify-center px-6">
                <div className="text-center space-y-2">
                  <Mail className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm font-medium">Email não configurado</p>
                  <p className="text-xs text-muted-foreground">
                    Configure a sua conta de email em Definições.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('/dashboard/definicoes/email', '_blank')}
                  >
                    Configurar
                  </Button>
                </div>
              </div>
            ) : showCompose ? (
              /* ── Compose View ── */
              <div className="flex-1 flex flex-col">
                {/* Compose header */}
                <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowCompose(false)}
                  >
                    ← Voltar
                  </Button>
                  <span className="text-xs text-muted-foreground flex-1 truncate">
                    {replyTo ? `Resposta a: ${replyTo.subject}` : 'Novo email'}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                  {/* To */}
                  <div>
                    <label className="text-[10px] text-muted-foreground font-medium uppercase">Para</label>
                    <div className="text-sm mt-0.5 text-muted-foreground">{contactEmail}</div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="text-[10px] text-muted-foreground font-medium uppercase">Assunto</label>
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Assunto do email..."
                      className="h-8 text-sm mt-0.5"
                    />
                  </div>

                  {/* Body */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="text-[10px] text-muted-foreground font-medium uppercase">Mensagem</label>
                      <div className="flex items-center gap-1.5">
                        {/* Voice recording */}
                        {isRecording ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-6 text-[10px] gap-1 rounded-full"
                            onClick={stopRecording}
                          >
                            <MicOff className="h-3 w-3" />
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                            </span>
                            Parar
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] gap-1 text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                            onClick={startRecording}
                            disabled={aiLoading || isTranscribing}
                            title="Falar → IA redige o email"
                          >
                            {isTranscribing ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Mic className="h-3 w-3" />
                            )}
                            {isTranscribing ? 'A transcrever...' : 'Falar'}
                          </Button>
                        )}
                        {/* AI draft */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] gap-1 text-neutral-600 hover:text-neutral-700"
                          onClick={() => generateAiDraft()}
                          disabled={aiLoading || isTranscribing || isRecording}
                        >
                          {aiLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3" />
                          )}
                          {aiLoading ? 'A gerar...' : 'IA'}
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder={replyTo
                        ? 'Escreva a resposta, ou uma instrução para a IA (ex: "recusar educadamente"), ou clique Falar...'
                        : 'Escreva o email, ou uma instrução para a IA (ex: "confirmar visita dia 20 às 15h"), ou clique Falar...'
                      }
                      className="text-sm min-h-[150px] resize-none"
                      disabled={aiLoading || isTranscribing}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Fala ou escreve uma instrução → a IA redige assunto e corpo.
                    </p>
                  </div>
                </div>

                {/* Send bar */}
                <div className="border-t px-3 py-2 flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    className="gap-1.5 bg-neutral-900 hover:bg-neutral-800"
                    onClick={handleSend}
                    disabled={isSending || !subject.trim() || !body.trim()}
                  >
                    {isSending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Enviar
                  </Button>
                </div>
              </div>
            ) : (
              /* ── Thread View ── */
              <>
                <div
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto px-3 py-2 bg-muted/30"
                >
                  {isLoadingThread ? (
                    <div className="space-y-3 py-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                          <Skeleton className="h-16 w-52 rounded-lg" />
                        </div>
                      ))}
                    </div>
                  ) : thread.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center space-y-2">
                        <Mail className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                        <p className="text-sm text-muted-foreground">Sem emails com {contactName}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {thread.map((msg) => {
                        const mine = isFromMe(msg)
                        const isExpanded = expandedUid === msg.uid
                        const preview = msg.subject || '(sem assunto)'

                        return (
                          <div key={`${msg._folder}-${msg.uid}`} className={`flex ${mine ? 'justify-end' : 'justify-start'} mb-2`}>
                            <div
                              className={cn(
                                'max-w-[85%] rounded-xl px-3 py-2 cursor-pointer transition-colors',
                                mine
                                  ? 'bg-neutral-900 text-white'
                                  : 'bg-white dark:bg-zinc-800 shadow-sm border'
                              )}
                              onClick={() => expandMessage(msg)}
                            >
                              {/* Subject + time */}
                              <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className={cn(
                                    'text-xs font-medium truncate',
                                    mine ? 'text-white/60' : 'text-muted-foreground'
                                  )}>
                                    {mine ? `Para: ${contactName}` : (msg.from?.[0]?.name || msg.from?.[0]?.address || contactName)}
                                  </div>
                                  <div className={cn(
                                    'text-sm font-medium mt-0.5',
                                    mine ? 'text-white' : ''
                                  )}>
                                    {preview}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <span className={cn(
                                    'text-[10px]',
                                    mine ? 'text-white/50' : 'text-muted-foreground'
                                  )}>
                                    {formatEmailDate(msg.date)}
                                  </span>
                                  {isExpanded ? (
                                    <ChevronUp className={cn('h-3 w-3', mine ? 'text-white/50' : 'text-muted-foreground')} />
                                  ) : (
                                    <ChevronDown className={cn('h-3 w-3', mine ? 'text-white/50' : 'text-muted-foreground')} />
                                  )}
                                </div>
                              </div>

                              {/* Expanded content */}
                              {isExpanded && (
                                <div className="mt-2 pt-2 border-t border-white/20">
                                  {loadingContent ? (
                                    <div className="flex items-center gap-2 py-2">
                                      <Loader2 className={cn('h-3 w-3 animate-spin', mine ? 'text-white/50' : 'text-muted-foreground')} />
                                      <span className={cn('text-xs', mine ? 'text-white/50' : 'text-muted-foreground')}>
                                        A carregar...
                                      </span>
                                    </div>
                                  ) : expandedContent ? (
                                    <>
                                      <div className={cn(
                                        'text-xs leading-relaxed whitespace-pre-wrap',
                                        mine ? 'text-white/90' : 'text-foreground'
                                      )}>
                                        {expandedContent.text
                                          ? expandedContent.text.slice(0, 1000)
                                          : expandedContent.html
                                            ? stripHtml(expandedContent.html).slice(0, 1000)
                                            : '(sem conteúdo)'}
                                      </div>
                                      {/* Reply button */}
                                      <div className="flex items-center gap-1.5 mt-2 pt-1.5">
                                        <Button
                                          variant={mine ? 'secondary' : 'outline'}
                                          size="sm"
                                          className="h-6 text-[10px] gap-1"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            startReply(expandedContent)
                                          }}
                                        >
                                          <Reply className="h-2.5 w-2.5" />
                                          Responder
                                        </Button>
                                      </div>
                                    </>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      <div ref={bottomRef} />
                    </>
                  )}
                </div>

                {/* Bottom bar */}
                <div className="border-t px-3 py-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5 bg-neutral-900 hover:bg-neutral-800"
                    onClick={startNew}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Novo email
                  </Button>
                  {thread.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={async () => {
                        // Reply to the latest email
                        const latest = thread[thread.length - 1]
                        if (!latest) return
                        setLoadingContent(true)
                        try {
                          const res = await fetch(`/api/email/inbox/${latest.uid}?folder=${encodeURIComponent(latest._folder)}`)
                          if (!res.ok) throw new Error()
                          const data = await res.json()
                          startReply(data)
                        } catch {
                          toast.error('Erro ao carregar email')
                        } finally {
                          setLoadingContent(false)
                        }
                      }}
                    >
                      <Reply className="h-3.5 w-3.5" />
                      Responder
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'fixed bottom-20 sm:bottom-6 right-20 sm:right-24 z-50 flex items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-105 active:scale-95',
          'h-14 w-14',
          isOpen
            ? 'bg-muted text-muted-foreground hover:bg-muted/90'
            : 'bg-neutral-900 text-white hover:bg-neutral-800'
        )}
        title={isOpen ? 'Fechar email' : `Email para ${contactName}`}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Mail className="h-6 w-6" />
        )}
      </button>
    </>
  )
}
