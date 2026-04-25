'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import type { UseFormReturn } from 'react-hook-form'

interface PropertyVoiceDescriptionProps {
  form: UseFormReturn<any>
}

// Captures voice notes about the property and turns them into a polished
// portal-ready description via /api/acquisitions/generate-description.
//
// Flow:
//   Record (mic) → /api/transcribe → append to local notes textarea
//   Generate (sparkles) → POST {voice_notes, snapshot} → fill form.description
//
// Notes are kept local (not persisted in the form) — they are scratch input,
// not part of the angariação payload.
export function PropertyVoiceDescription({ form }: PropertyVoiceDescriptionProps) {
  const [notes, setNotes] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Tick the recording timer.
  useEffect(() => {
    if (isRecording) {
      const start = Date.now()
      setElapsed(0)
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000))
      }, 250)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isRecording])

  // Cleanup on unmount: stop the mic if the user navigates away mid-recording.
  useEffect(() => {
    return () => {
      try { mediaRecorderRef.current?.stop() } catch {}
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        if (blob.size > 0) await transcribe(blob)
      }
      recorder.start()
      setIsRecording(true)
    } catch {
      toast.error('Não foi possível aceder ao microfone.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const transcribe = async (blob: Blob) => {
    setIsTranscribing(true)
    try {
      const fd = new FormData()
      fd.append('audio', blob)
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      const { text } = await res.json()
      const trimmed = String(text ?? '').trim()
      if (!trimmed) {
        toast.error('Não foi possível transcrever o áudio.')
        return
      }
      setNotes((prev) => (prev ? `${prev.trim()}\n${trimmed}` : trimmed))
      toast.success('Notas transcritas.')
    } catch {
      toast.error('Erro na transcrição.')
    } finally {
      setIsTranscribing(false)
    }
  }

  const generateDescription = async () => {
    const trimmed = notes.trim()
    if (!trimmed) {
      toast.error('Grave ou escreva algumas notas antes de gerar.')
      return
    }
    setIsGenerating(true)
    try {
      const values = form.getValues()
      const snapshot = {
        title: values.title,
        property_type: values.property_type,
        business_type: values.business_type,
        listing_price: values.listing_price,
        property_condition: values.property_condition,
        energy_certificate: values.energy_certificate,
        city: values.city,
        zone: values.zone,
        address_parish: values.address_parish,
        address_street: values.address_street,
        specifications: values.specifications,
      }
      const res = await fetch('/api/acquisitions/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_notes: trimmed, snapshot }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao gerar descrição.')
      }
      const { description } = await res.json()
      form.setValue('description', description, { shouldDirty: true })
      toast.success('Descrição gerada com sucesso.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar descrição.')
    } finally {
      setIsGenerating(false)
    }
  }

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  }

  return (
    <div className="col-span-full rounded-xl border border-violet-200 bg-violet-50/40 dark:border-violet-800 dark:bg-violet-950/20 px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Descrever por voz com IA
          </p>
          <p className="text-[11px] text-muted-foreground">
            Dite as características, vivência e detalhes do imóvel — a IA gera a descrição completa pronta para portais.
          </p>
        </div>
      </div>

      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas (transcritas ou escritas)..."
        rows={3}
        className="text-sm bg-background/60"
      />

      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          size="sm"
          variant={isRecording ? 'destructive' : 'outline'}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isTranscribing || isGenerating}
        >
          {isTranscribing ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              A transcrever...
            </>
          ) : isRecording ? (
            <>
              <MicOff className="mr-1.5 h-3.5 w-3.5" />
              Parar ({formatElapsed(elapsed)})
            </>
          ) : (
            <>
              <Mic className="mr-1.5 h-3.5 w-3.5" />
              Gravar
            </>
          )}
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={generateDescription}
          disabled={!notes.trim() || isRecording || isTranscribing || isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              A gerar...
            </>
          ) : (
            <>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Gerar descrição
            </>
          )}
        </Button>

        {isRecording && (
          <span className="flex items-center gap-1.5 text-xs text-destructive">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
            A gravar
          </span>
        )}
      </div>
    </div>
  )
}
