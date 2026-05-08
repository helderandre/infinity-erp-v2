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

/**
 * Editor de descrição unificado — uma só superfície.
 *
 * O textarea é a fonte única de verdade (form.description). O ditado por
 * voz transcreve directamente para dentro do textarea (não há um campo de
 * "notas" separado). O botão "Gerar com IA" usa o conteúdo actual do
 * textarea como seed e substitui pela descrição polida.
 */
export function StepDescription({ form }: StepDescriptionProps) {
  const description: string = form.watch('description') || ''
  const charCount = description.length

  const [copied, setCopied] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Timer ao gravar
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

  // Cleanup ao desmontar — pára o recorder/stream se ainda activo
  useEffect(() => {
    return () => {
      try {
        mediaRecorderRef.current?.stop()
      } catch {}
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

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
      const current = form.getValues('description') || ''
      const next = current.trim() ? `${current.trim()}\n${trimmed}` : trimmed
      form.setValue('description', next, { shouldDirty: true })
      toast.success('Transcrição adicionada à descrição.')
    } catch {
      toast.error('Erro na transcrição.')
    } finally {
      setIsTranscribing(false)
    }
  }

  const generateDescription = async () => {
    const seed = (form.getValues('description') || '').trim()
    if (!seed) {
      toast.error('Escreva ou dite algumas notas antes de gerar.')
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
        body: JSON.stringify({ voice_notes: seed, snapshot }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao gerar descrição.')
      }
      const { description: generated } = await res.json()
      form.setValue('description', generated, { shouldDirty: true })
      toast.success('Descrição gerada.')
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
  const canGenerate = description.trim().length > 0 && !isRecording && !busy

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center text-center gap-2 pt-1 pb-2">
        <h3 className="text-2xl font-semibold tracking-tight">Descrição</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Escreve directamente, dita por voz, ou pede à IA para polir o que já está aqui.
        </p>
      </div>

      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border bg-gradient-to-br transition-colors',
          'border-violet-200/70 from-violet-50/40 via-violet-50/15 to-transparent',
          'dark:border-violet-800/40 dark:from-violet-950/20 dark:via-violet-950/5 dark:to-transparent',
        )}
      >
        {/* Subtle glow */}
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-violet-400/10 blur-3xl pointer-events-none" />

        {/* Header — assistente IA */}
        <div className="relative flex items-start gap-3 px-4 sm:px-5 pt-4">
          <div className="shrink-0 h-8 w-8 rounded-xl bg-violet-500/15 ring-1 ring-violet-300/40 dark:ring-violet-700/40 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-violet-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-foreground tracking-tight">
              Assistente de descrição
            </p>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Tudo aqui — escreve, dita, ou pede para gerar. A IA usa o que está em baixo como ponto de partida.
            </p>
          </div>
          {charCount > 0 && (
            <div className="shrink-0 hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground/80">
              <span className="tabular-nums">{charCount.toLocaleString('pt-PT')}</span>
              <span>caractere{charCount === 1 ? '' : 's'}</span>
            </div>
          )}
        </div>

        {/* Textarea — fonte única (form.description) */}
        <div className="relative px-4 sm:px-5 pt-3">
          <Textarea
            id="acq-description"
            value={description}
            onChange={(e) => form.setValue('description', e.target.value, { shouldDirty: true })}
            placeholder={
              isRecording
                ? 'A gravar… podes continuar a escrever; a transcrição é adicionada quando parares.'
                : 'Notas, características, vivência, vistas, melhorias recentes… A IA polirá isto numa descrição publicável.'
            }
            rows={12}
            disabled={isRecording || isGenerating}
            className="resize-y border-0 bg-transparent p-0 text-[14px] leading-relaxed shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/55 disabled:opacity-60"
          />
          {isGenerating && (
            <div className="absolute inset-x-5 top-3 bottom-3 rounded-xl bg-background/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-violet-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                A gerar descrição com IA…
              </span>
            </div>
          )}
        </div>

        {/* Footer toolbar */}
        <div className="relative flex items-center gap-2 flex-wrap px-4 sm:px-5 py-3 border-t border-violet-200/40 dark:border-violet-800/30 bg-background/30 backdrop-blur-sm">
          <Button
            type="button"
            size="sm"
            variant={isRecording ? 'destructive' : 'outline'}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isTranscribing || isGenerating}
            className={cn(
              'rounded-full h-8 px-3 gap-1.5 transition-all',
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
                Ditar
              </>
            )}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={generateDescription}
            disabled={!canGenerate}
            className={cn(
              'rounded-full h-8 px-3 gap-1.5 transition-all',
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
                Gerar com IA
              </>
            )}
          </Button>

          {/* Spacer */}
          <div className="ml-auto flex items-center gap-1">
            {charCount > 0 && (
              <>
                <span className="sm:hidden text-[11px] text-muted-foreground/80 tabular-nums mr-1">
                  {charCount.toLocaleString('pt-PT')}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors"
                  aria-label="Copiar descrição"
                  disabled={busy || isRecording}
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span className="hidden sm:inline">{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Limpar descrição"
                  disabled={busy || isRecording}
                >
                  <Trash2 className="h-3 w-3" />
                  <span className="hidden sm:inline">Limpar</span>
                </button>
              </>
            )}
          </div>

          {isRecording && (
            <span className="w-full sm:w-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-destructive">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
              </span>
              A gravar
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
