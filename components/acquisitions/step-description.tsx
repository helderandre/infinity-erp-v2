'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Mic,
  Square,
  Sparkles,
  Loader2,
  Trash2,
  Copy,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import type { UseFormReturn } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface StepDescriptionProps {
  form: UseFormReturn<any>
}

// One-stop description editor for the angariação flow.
//
// Two stacked surfaces:
//  1) AI assistant — voice / text notes + "Gerar descrição".
//  2) Final description textarea (the value that ends up in form.description).
//
// Surfaces share the same visual language as the rest of the form (rounded-2xl,
// border-border/40, soft gradient on the AI panel for affordance) but with
// generous spacing to feel like a writing tool, not a fragmented widget.
export function StepDescription({ form }: StepDescriptionProps) {
  const description: string = form.watch('description') || ''
  const charCount = description.length

  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    if (!description.trim()) return
    try {
      await navigator.clipboard.writeText(description)
      setCopied(true)
      toast.success('Descrição copiada')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Não foi possível copiar')
    }
  }
  const handleClear = () => {
    if (!description) return
    form.setValue('description', '', { shouldDirty: true })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center text-center gap-2 pt-1 pb-2">
        <h3 className="text-2xl font-semibold tracking-tight">Descrição</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Espaço, vivência, localização — dita ou escreve, e a IA prepara a descrição pronta a publicar.
        </p>
      </div>

      <AiAssistant form={form} />

      <div className="relative">
        <div className="absolute inset-y-0 left-0 right-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-dashed border-border/40" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-card px-3 text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
            ou escreve directamente
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-background/60 p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="acq-description"
            className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Descrição
          </label>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground/80">
            <span className="tabular-nums">
              {charCount.toLocaleString('pt-PT')} caractere{charCount === 1 ? '' : 's'}
            </span>
            {charCount > 0 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors"
                  aria-label="Copiar descrição"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Limpar descrição"
                >
                  <Trash2 className="h-3 w-3" />
                  Limpar
                </button>
              </div>
            )}
          </div>
        </div>

        <Textarea
          id="acq-description"
          value={description}
          onChange={(e) => form.setValue('description', e.target.value, { shouldDirty: true })}
          placeholder="Espaço, vivência, localização, vistas, melhorias recentes... A descrição final aparece aqui."
          rows={12}
          className="resize-y border-0 bg-transparent p-0 text-[14px] leading-relaxed shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/55"
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// AI Assistant — voice notes + "Gerar descrição".
//
// Recording state is local; once transcribed it appends to a notes textarea
// the agent can edit. "Gerar" sends the notes + a property snapshot to
// /api/acquisitions/generate-description and pipes the result into
// form.description.
// ─────────────────────────────────────────────────────────────────────────
function AiAssistant({ form }: { form: UseFormReturn<any> }) {
  const [notes, setNotes] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isRecording])

  useEffect(() => {
    return () => {
      try {
        mediaRecorderRef.current?.stop()
      } catch {}
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

  const busy = isTranscribing || isGenerating
  const canGenerate = notes.trim().length > 0 && !isRecording && !busy

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 sm:p-5 space-y-3 transition-colors',
        'border-violet-200/70 from-violet-50/70 via-violet-50/30 to-transparent',
        'dark:border-violet-800/40 dark:from-violet-950/30 dark:via-violet-950/10 dark:to-transparent',
      )}
    >
      <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-violet-400/10 blur-3xl pointer-events-none" />

      <div className="relative flex items-start gap-3">
        <div className="shrink-0 h-9 w-9 rounded-xl bg-violet-500/15 ring-1 ring-violet-300/40 dark:ring-violet-700/40 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-foreground tracking-tight">
            Assistente de descrição
          </p>
          <p className="text-[12px] text-muted-foreground leading-snug">
            Dita as características, vivência e detalhes — a IA gera uma descrição pronta a publicar.
          </p>
        </div>
      </div>

      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas (transcritas por voz ou escritas)..."
        rows={4}
        className="text-sm bg-background/70 border-border/40 rounded-xl focus-visible:ring-1 resize-none"
        disabled={isRecording}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          size="sm"
          variant={isRecording ? 'destructive' : 'outline'}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isTranscribing || isGenerating}
          className={cn(
            'rounded-full h-9 px-3.5 gap-1.5 transition-all',
            isRecording && 'shadow-[0_0_0_4px_rgba(239,68,68,0.15)]',
          )}
        >
          {isTranscribing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              A transcrever…
            </>
          ) : isRecording ? (
            <>
              <Square className="h-3 w-3 fill-current" />
              Parar
              <span className="font-mono tabular-nums text-[11px] opacity-90">
                {formatElapsed(elapsed)}
              </span>
            </>
          ) : (
            <>
              <Mic className="h-3.5 w-3.5" />
              Gravar
            </>
          )}
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={generateDescription}
          disabled={!canGenerate}
          className={cn(
            'rounded-full h-9 px-3.5 gap-1.5 transition-all',
            'bg-violet-600 text-white hover:bg-violet-700',
            'dark:bg-violet-500 dark:hover:bg-violet-400',
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              A gerar…
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Gerar descrição
            </>
          )}
        </Button>

        {isRecording && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-destructive">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
            </span>
            A gravar
          </span>
        )}
      </div>
    </div>
  )
}
