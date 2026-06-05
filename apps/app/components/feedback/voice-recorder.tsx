'use client'

import { useCallback, useRef, useState } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface VoiceRecorderProps {
  onTranscription: (text: string) => void
  disabled?: boolean
}

export function VoiceRecorder({ onTranscription, disabled }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

        if (blob.size < 100) return // Too short

        setIsTranscribing(true)
        try {
          const formData = new FormData()
          formData.append('audio', blob)
          const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
          if (!res.ok) throw new Error()
          const { text } = await res.json()
          if (text) onTranscription(text)
        } catch {
          // Silently fail — user can type instead
        } finally {
          setIsTranscribing(false)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch {
      // Microphone permission denied
    }
  }, [onTranscription])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }, [])

  if (isTranscribing) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        A transcrever...
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant={isRecording ? 'destructive' : 'outline'}
      size="sm"
      onClick={isRecording ? stopRecording : startRecording}
      disabled={disabled}
      className={cn('gap-2', isRecording && 'animate-pulse')}
    >
      {isRecording ? (
        <>
          <Square className="h-3.5 w-3.5" />
          Parar
        </>
      ) : (
        <>
          <Mic className="h-3.5 w-3.5" />
          Gravar
        </>
      )}
    </Button>
  )
}
