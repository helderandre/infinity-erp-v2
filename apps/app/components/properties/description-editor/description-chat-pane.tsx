'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import {
  Send, Sparkles, Mic, MicOff, X, RotateCcw, History,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DescriptionMessage } from './use-description-stream'

interface DescriptionChatPaneProps {
  messages: DescriptionMessage[]
  streamingAssistant: string
  sending: boolean
  loading: boolean
  selectionText: string | null
  onClearSelection: () => void
  onSend: (args: { content: string; selectionText?: string | null }) => Promise<void>
  onRevertTo: (m: DescriptionMessage) => void
  onReset: () => Promise<void>
}

const QUICK_PRESETS = [
  {
    label: 'Gerar do imóvel',
    prompt:
      'Escreve uma descrição comercial completa e apelativa do imóvel, em português de Portugal, a partir de todos os dados disponíveis (tipologia, áreas, localização, características e equipamento). Não inventes dados.',
  },
  { label: 'Encurtar', prompt: 'Encurta a descrição mantendo o essencial.' },
  { label: 'Mais formal', prompt: 'Torna o tom mais formal e profissional.' },
  { label: 'Mais acolhedor', prompt: 'Torna o tom mais acolhedor e familiar.' },
  { label: 'Adicionar CTA', prompt: 'Adiciona uma frase final de chamada à acção (visita).' },
] as const

export function DescriptionChatPane({
  messages,
  streamingAssistant,
  sending,
  loading,
  selectionText,
  onClearSelection,
  onSend,
  onRevertTo,
  onReset,
}: DescriptionChatPaneProps) {
  const [input, setInput] = useState('')
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, streamingAssistant])

  // Focus input when selection arrives
  useEffect(() => {
    if (selectionText) inputRef.current?.focus()
  }, [selectionText])

  const handleSend = useCallback(async () => {
    const content = input.trim()
    if (!content || sending) return
    setInput('')
    await onSend({ content, selectionText })
    onClearSelection()
  }, [input, sending, onSend, selectionText, onClearSelection])

  const handlePreset = useCallback(
    (prompt: string) => {
      if (sending) return
      onSend({ content: prompt, selectionText })
      onClearSelection()
    },
    [onSend, sending, selectionText, onClearSelection]
  )

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        if (chunksRef.current.length === 0) return
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setTranscribing(true)
        try {
          const fd = new FormData()
          fd.append('audio', blob, 'audio.webm')
          const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
          if (!res.ok) throw new Error()
          const { text } = await res.json()
          setInput((prev) => (prev ? prev + ' ' + text : text))
          inputRef.current?.focus()
        } catch {
          toast.error('Erro na transcrição')
        } finally {
          setTranscribing(false)
        }
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
    } catch {
      toast.error('Não foi possível aceder ao microfone')
    }
  }, [])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    setRecording(false)
  }, [])

  const visibleMessages = messages

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Assistente
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
          onClick={onReset}
          title="Apagar conversa (mantém descrição)"
        >
          <History className="h-3 w-3" />
          Limpar
        </Button>
      </div>

      {/* Thread */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2.5">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
            <Spinner className="h-3.5 w-3.5" />
            A carregar conversa…
          </div>
        ) : visibleMessages.length === 0 && !streamingAssistant ? (
          <div className="text-center py-12 text-muted-foreground space-y-2">
            <Sparkles className="h-6 w-6 mx-auto text-muted-foreground/40" />
            <p className="text-sm font-medium">Vamos começar</p>
            <p className="text-[11px] max-w-[240px] mx-auto">
              Diz-me como queres que a descrição comece, ou clica num atalho abaixo.
            </p>
          </div>
        ) : (
          visibleMessages.map((m) => (
            <ChatBubble key={m.id} message={m} onRevert={onRevertTo} />
          ))
        )}
        {streamingAssistant && (
          <ChatBubble
            key="streaming"
            message={{
              id: 'streaming',
              role: 'assistant',
              content: streamingAssistant,
              document_snapshot: null,
              selection_text: null,
              created_at: new Date().toISOString(),
            }}
            isStreaming
            onRevert={() => {}}
          />
        )}
      </div>

      {/* Quick presets */}
      <div className="shrink-0 px-3 pb-2 flex flex-wrap gap-1.5">
        {QUICK_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => handlePreset(p.prompt)}
            disabled={sending}
            className={cn(
              'h-6 px-2.5 rounded-full text-[10px] font-medium border transition-colors',
              'bg-background/40 text-muted-foreground border-border/50',
              'hover:border-foreground/40 hover:text-foreground',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Selection chip */}
      {selectionText && (
        <div className="shrink-0 mx-3 mb-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              Selecção
            </span>
            <button
              type="button"
              onClick={onClearSelection}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Remover selecção"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <p className="text-[11px] text-foreground line-clamp-2 leading-snug">
            {selectionText}
          </p>
        </div>
      )}

      {/* Composer */}
      <div className="shrink-0 border-t bg-card">
        <div className="px-3 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={
              selectionText
                ? 'Como queres alterar este trecho?'
                : 'Pede-me para escrever, encurtar, traduzir…'
            }
            rows={3}
            disabled={sending}
            className="w-full text-xs bg-transparent border-0 focus:outline-none resize-none placeholder:text-muted-foreground/50 disabled:opacity-50"
          />
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[9px] text-muted-foreground/70">⌘+Enter</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={recording ? stopRecording : startRecording}
                disabled={transcribing || sending}
                className={cn(
                  'h-7 px-2 text-[11px] gap-1',
                  recording && 'text-red-500 bg-red-50 hover:bg-red-100 animate-pulse'
                )}
                title={recording ? 'Parar gravação' : 'Ditado'}
              >
                {transcribing ? (
                  <Spinner className="h-3 w-3" />
                ) : recording ? (
                  <>
                    <MicOff className="h-3 w-3" /> Parar
                  </>
                ) : (
                  <Mic className="h-3 w-3" />
                )}
              </Button>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="h-7 px-2.5 text-[11px] gap-1 bg-neutral-900 text-white hover:bg-neutral-800"
              >
                {sending ? (
                  <>
                    <Spinner className="h-3 w-3" /> A pensar…
                  </>
                ) : (
                  <>
                    <Send className="h-3 w-3" /> Enviar
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChatBubble({
  message,
  isStreaming,
  onRevert,
}: {
  message: DescriptionMessage
  isStreaming?: boolean
  onRevert: (m: DescriptionMessage) => void
}) {
  const isUser = message.role === 'user'
  const hasSnapshot = !!message.document_snapshot && !isStreaming

  return (
    <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[88%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap break-words',
          isUser
            ? 'bg-neutral-900 text-white rounded-br-sm'
            : 'bg-muted/60 text-foreground rounded-bl-sm',
        )}
      >
        {message.content}
        {isStreaming && (
          <span className="inline-block ml-1 align-middle h-3 w-px bg-current animate-pulse" />
        )}
      </div>
      {hasSnapshot && !isUser && (
        <button
          type="button"
          onClick={() => onRevert(message)}
          className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-1"
          title="Voltar a este estado do documento"
        >
          <RotateCcw className="h-2.5 w-2.5" />
          Voltar a esta versão
        </button>
      )}
    </div>
  )
}
