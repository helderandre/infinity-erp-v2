'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Mic, MicOff, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AIQuickFillBarProps {
  /** Called with the user-provided text (typed or transcribed). Should call
   * the domain `/fill-from-text` endpoint and merge the result into the form. */
  onFill: (text: string) => Promise<void>
  placeholder?: string
  disabled?: boolean
  className?: string
}

/**
 * Reusable AI Quick Fill bar with typed text, auto-growing textarea, live
 * Web Speech API transcription (when available) and a Whisper fallback.
 * Extracted from the calendar event form so every heavy form can plug it in.
 */
export function AIQuickFillBar({
  onFill,
  placeholder = 'Descreve por texto ou voz...',
  disabled = false,
  className,
}: AIQuickFillBarProps) {
  const [text, setText] = useState('')
  const [isFilling, setIsFilling] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<any>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow textarea.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }, [text])

  const runFill = async (value: string) => {
    if (!value.trim()) return
    setIsFilling(true)
    try {
      await onFill(value.trim())
      setText('')
    } finally {
      setIsFilling(false)
    }
  }

  const toggleVoice = async () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      } else if (recorderRef.current) {
        recorderRef.current.stop()
      }
      return
    }

    const SR =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null

    // Prefer live browser transcription.
    if (SR) {
      try {
        const recognition = new SR()
        recognition.lang = 'pt-PT'
        recognition.continuous = true
        recognition.interimResults = true

        let finalText = ''
        setText('')

        recognition.onresult = (e: any) => {
          let interim = ''
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const transcript = e.results[i][0].transcript
            if (e.results[i].isFinal) finalText += transcript
            else interim += transcript
          }
          setText((finalText + interim).trim())
        }
        recognition.onerror = (e: any) => {
          if (e.error && e.error !== 'aborted' && e.error !== 'no-speech') {
            toast.error('Erro na transcrição de voz')
          }
        }
        recognition.onend = async () => {
          recognitionRef.current = null
          setIsRecording(false)
          const final = finalText.trim()
          if (final) await runFill(final)
        }

        recognitionRef.current = recognition
        recognition.start()
        setIsRecording(true)
        return
      } catch {
        recognitionRef.current = null
      }
    }

    // Fallback: MediaRecorder → Whisper.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => chunks.push(e.data)
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setIsRecording(false)
        setIsTranscribing(true)
        try {
          const blob = new Blob(chunks, { type: 'audio/webm' })
          const fd = new FormData()
          fd.append('audio', blob)
          const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
          if (res.ok) {
            const { text: transcribed } = await res.json()
            setText(transcribed)
            await runFill(transcribed)
          } else {
            toast.error('Erro na transcrição')
          }
        } catch {
          toast.error('Erro na transcrição')
        } finally {
          setIsTranscribing(false)
        }
      }
      recorder.start()
      recorderRef.current = recorder
      setIsRecording(true)
    } catch {
      toast.error('Não foi possível aceder ao microfone')
    }
  }

  // Stop recognition on unmount.
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch {}
      }
    }
  }, [])

  const busy = disabled || isFilling || isTranscribing

  return (
    <div
      className={cn(
        'flex items-end gap-0.5 rounded-3xl border border-border/40 bg-background/40 pl-3 pr-0.5 py-0.5 backdrop-blur-sm transition-[border-radius]',
        className,
      )}
    >
      <Sparkles className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0 self-center" />
      <textarea
        ref={inputRef}
        rows={1}
        placeholder={isFilling ? 'A processar...' : placeholder}
        className="flex-1 min-h-7 max-h-[180px] resize-none border-0 bg-transparent text-xs focus-visible:outline-none shadow-none px-2 py-1.5 leading-relaxed overflow-y-auto placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
        value={text}
        disabled={busy}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            runFill(text)
          }
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'h-7 w-7 rounded-full shrink-0 self-center',
          isRecording && 'text-red-500',
        )}
        disabled={busy}
        onClick={toggleVoice}
      >
        {isTranscribing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isRecording ? (
          <MicOff className="h-3.5 w-3.5" />
        ) : (
          <Mic className="h-3.5 w-3.5" />
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-full shrink-0 self-center"
        disabled={busy || !text.trim()}
        onClick={() => runFill(text)}
      >
        {isFilling ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  )
}
