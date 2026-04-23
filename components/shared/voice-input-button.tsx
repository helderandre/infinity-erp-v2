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
}: VoiceInputButtonProps) {
  const [state, setState] = useState<'idle' | 'recording' | 'uploading'>('idle')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const cancelledRef = useRef(false)

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
  }, [state, disabled, stopStream, uploadBlob])

  const stopRecording = useCallback((cancel = false) => {
    const mr = mediaRecorderRef.current
    if (!mr) return
    cancelledRef.current = cancel
    try {
      if (mr.state !== 'inactive') mr.stop()
    } catch {
      stopStream()
      setState('idle')
    }
  }, [stopStream])

  const handleClick = useCallback(() => {
    if (state === 'idle') {
      startRecording()
    } else if (state === 'recording') {
      // Second click while recording = cancel & discard
      stopRecording(true)
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
