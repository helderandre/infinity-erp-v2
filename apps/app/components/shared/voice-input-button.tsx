'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, type ButtonProps } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type VoiceInputMode = 'append' | 'replace'

export interface VoiceInputButtonProps {
  onTranscribe: (text: string) => void
  mode?: VoiceInputMode
  endpoint?: string
  disabled?: boolean
  size?: ButtonProps['size']
  variant?: ButtonProps['variant']
  className?: string
  /** Tooltip label when idle. Defaults to "Ditar por voz". */
  label?: string
  /** Called with the raw audio Blob before upload, for callers that want full control. If returned falsy, the default fetch-to-endpoint flow runs. */
  onAudioCaptured?: (blob: Blob) => Promise<string | null | undefined> | string | null | undefined
  /**
   * If set, enables live preview via the browser's SpeechRecognition API
   * (Chrome / Safari). Fires with the cumulative interim+final transcript
   * during recording. The Whisper result still replaces this on stop.
   */
  onInterimText?: (text: string) => void
  /**
   * Locale hint for SpeechRecognition. Defaults to 'pt-PT'.
   */
  liveLang?: string
}

/**
 * Small microphone button that records audio via MediaRecorder and sends it to
 * a transcription endpoint (default `/api/transcribe`). On success, calls
 * `onTranscribe(text)`. States: idle → recording → uploading → idle.
 */
export function VoiceInputButton({
  onTranscribe,
  mode: _mode = 'append',
  endpoint = '/api/transcribe',
  disabled = false,
  size = 'icon',
  variant = 'ghost',
  className,
  label = 'Ditar por voz',
  onAudioCaptured,
  onInterimText,
  liveLang = 'pt-PT',
}: VoiceInputButtonProps) {
  const [state, setState] = useState<'idle' | 'recording' | 'uploading'>('idle')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const cancelledRef = useRef(false)
  // SpeechRecognition (browser-native) for live preview while we record.
  // The Whisper result replaces this on stop — accuracy beats latency.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any | null>(null)
  const liveTextRef = useRef<string>('')

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { mediaRecorderRef.current?.state !== 'inactive' && mediaRecorderRef.current?.stop() } catch {}
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const uploadBlob = useCallback(async (blob: Blob) => {
    setState('uploading')
    try {
      // Caller may intercept the blob (e.g. keep the raw audio for another endpoint)
      if (onAudioCaptured) {
        const maybeText = await onAudioCaptured(blob)
        if (typeof maybeText === 'string' && maybeText.length > 0) {
          onTranscribe(maybeText)
          return
        }
      }

      const formData = new FormData()
      formData.append('audio', blob)

      const res = await fetch(endpoint, { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Erro na transcrição')
      }
      const data = await res.json()
      const text = (data?.text ?? '').toString().trim()
      if (!text) {
        toast.info('Não foi possível transcrever o áudio')
        return
      }
      onTranscribe(text)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao transcrever áudio')
    } finally {
      setState('idle')
    }
  }, [endpoint, onAudioCaptured, onTranscribe])

  const stopLiveRecognition = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec) return
    try {
      rec.onresult = null
      rec.onerror = null
      rec.onend = null
      rec.stop()
    } catch {}
    recognitionRef.current = null
  }, [])

  const maybeStartLiveRecognition = useCallback(() => {
    if (!onInterimText) return
    if (typeof window === 'undefined') return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return // Firefox / unsupported — silent fallback to Whisper-only
    try {
      const rec = new SR()
      rec.lang = liveLang
      rec.continuous = true
      rec.interimResults = true
      liveTextRef.current = ''
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (event: any) => {
        let interim = ''
        let finalChunk = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0]?.transcript ?? ''
          if (event.results[i].isFinal) finalChunk += t
          else interim += t
        }
        if (finalChunk) liveTextRef.current = (liveTextRef.current + finalChunk).replace(/\s+/g, ' ').trim()
        const display = (liveTextRef.current + (interim ? ` ${interim}` : '')).trim()
        onInterimText(display)
      }
      rec.onerror = () => { /* swallow — Whisper will give us the truth */ }
      rec.onend = () => {
        // If we end while still recording (some browsers stop after ~60s),
        // try to restart so live preview keeps flowing.
        if (mediaRecorderRef.current?.state === 'recording' && recognitionRef.current === rec) {
          try { rec.start() } catch {}
        }
      }
      recognitionRef.current = rec
      rec.start()
    } catch {
      recognitionRef.current = null
    }
  }, [onInterimText, liveLang])

  const startRecording = useCallback(async () => {
    if (state !== 'idle' || disabled) return
    cancelledRef.current = false

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stopStream()
        stopLiveRecognition()
        if (cancelledRef.current) {
          chunksRef.current = []
          setState('idle')
          return
        }
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        chunksRef.current = []
        await uploadBlob(blob)
      }

      mediaRecorder.start()
      setState('recording')
      maybeStartLiveRecognition()
    } catch (err) {
      const name = (err as Error & { name?: string })?.name
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        toast.error('Permissão de microfone negada')
      } else if (name === 'NotFoundError') {
        toast.error('Nenhum microfone encontrado')
      } else {
        toast.error('Não foi possível aceder ao microfone')
      }
      setState('idle')
    }
  }, [state, disabled, stopStream, uploadBlob, stopLiveRecognition, maybeStartLiveRecognition])

  const stopRecording = useCallback((cancel = false) => {
    const mr = mediaRecorderRef.current
    if (!mr) return
    cancelledRef.current = cancel
    try {
      if (mr.state !== 'inactive') mr.stop()
    } catch {
      stopStream()
      stopLiveRecognition()
      setState('idle')
    }
  }, [stopStream, stopLiveRecognition])

  const handleClick = useCallback(() => {
    if (state === 'idle') {
      startRecording()
    } else if (state === 'recording') {
      // Second click while recording = stop and submit for transcription.
      stopRecording(false)
    }
    // If uploading, button is disabled; no-op
  }, [state, startRecording, stopRecording])

  const isBusy = state !== 'idle'
  const tooltip =
    state === 'recording' ? 'Clicar para cancelar gravação'
    : state === 'uploading' ? 'A transcrever...'
    : label

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size={size}
          variant={state === 'recording' ? 'destructive' : variant}
          onClick={handleClick}
          disabled={disabled || state === 'uploading'}
          aria-label={tooltip}
          className={cn(
            'relative',
            state === 'recording' && 'animate-pulse',
            className,
          )}
        >
          {state === 'uploading' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : state === 'recording' ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
          {state === 'recording' && (
            <span
              aria-hidden
              className="pointer-events-none absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive animate-ping"
            />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
