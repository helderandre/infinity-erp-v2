'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Mic,
  Square,
  Check,
  Sparkles,
  ArrowLeft,
  PencilLine,
  AudioLines,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Spinner } from '@/components/kibo-ui/spinner'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { UseFormReturn } from 'react-hook-form'

interface AcquisitionQuickFillProps {
  form: UseFormReturn<any>
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ─── Field labels (used in the preview screen) ────────────────────────────
const fieldLabels: Record<string, string> = {
  title: 'Título',
  property_type: 'Tipo de Imóvel',
  listing_price: 'Preço',
  description: 'Descrição',
  property_condition: 'Estado do Imóvel',
  energy_certificate: 'Certificado Energético',
  city: 'Cidade',
  zone: 'Zona',
  address_street: 'Morada',
  address_parish: 'Freguesia',
  postal_code: 'Código Postal',
  contract_regime: 'Regime Contratual',
  commission_agreed: 'Comissão',
}

const specLabels: Record<string, string> = {
  bedrooms: 'Quartos',
  bathrooms: 'Casas de Banho',
  area_util: 'Área Útil (m²)',
  area_gross: 'Área Bruta (m²)',
  construction_year: 'Ano Construção',
  parking_spaces: 'Estacionamento',
  garage_spaces: 'Garagem',
  typology: 'Tipologia',
  has_elevator: 'Elevador',
  features: 'Características',
}

const NUMBER_FIELDS = new Set([
  'listing_price', 'commission_agreed',
  'bedrooms', 'bathrooms', 'area_util', 'area_gross',
  'construction_year', 'parking_spaces', 'garage_spaces',
])

type Mode = 'chooser' | 'voice' | 'write'

// ─────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────
export function AcquisitionQuickFill({ form, open, onOpenChange }: AcquisitionQuickFillProps) {
  const isMobile = useIsMobile()
  const [mode, setMode] = useState<Mode>('chooser')
  const [text, setText] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractedFields, setExtractedFields] = useState<Record<string, unknown> | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // Reset to chooser sempre que reabre, para o utilizador não cair na última escolha.
  useEffect(() => {
    if (open) {
      setMode('chooser')
      setShowPreview(false)
    } else {
      setText('')
      setExtractedFields(null)
    }
  }, [open])

  const close = () => {
    onOpenChange(false)
  }

  const runExtraction = async (input: string) => {
    const trimmed = input.trim()
    if (!trimmed) return
    setIsExtracting(true)
    try {
      const res = await fetch('/api/acquisitions/fill-from-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro na extracção')
      }
      const data = await res.json()
      setExtractedFields(data)
      setShowPreview(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao extrair dados')
    } finally {
      setIsExtracting(false)
    }
  }

  const updateField = (path: string, value: unknown) => {
    setExtractedFields((prev) => {
      if (!prev) return prev
      if (path.startsWith('specifications.')) {
        const specKey = path.replace('specifications.', '')
        const specs = (prev.specifications || {}) as Record<string, unknown>
        return { ...prev, specifications: { ...specs, [specKey]: value } }
      }
      return { ...prev, [path]: value }
    })
  }

  const handleApply = () => {
    if (!extractedFields) return
    for (const [key, value] of Object.entries(extractedFields)) {
      if (value == null || value === '') continue
      if (key === 'specifications' && typeof value === 'object') {
        for (const [sk, sv] of Object.entries(value as Record<string, unknown>)) {
          if (sv != null && sv !== '') {
            form.setValue(`specifications.${sk}`, sv, { shouldValidate: true })
          }
        }
      } else {
        form.setValue(key, value, { shouldValidate: true })
      }
    }
    setShowPreview(false)
    setText('')
    toast.success('Dados aplicados com sucesso')
    onOpenChange(false)
  }

  // ── Chooser (small dialog) ─────────────────────────────────────────────
  // Rendered when no preview and chooser mode.
  const chooserOpen = open && mode === 'chooser' && !showPreview

  // ── Voice (centered dialog with pulsing orb) ───────────────────────────
  const voiceOpen = open && mode === 'voice' && !showPreview

  // ── Write (small Sheet) ────────────────────────────────────────────────
  const writeOpen = open && mode === 'write' && !showPreview

  return (
    <>
      {/* Chooser */}
      <Dialog open={chooserOpen} onOpenChange={(v) => { if (!v) close() }}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-300" />
              Preencher com IA
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Como queres descrever o imóvel? Escolhe o método e a IA preenche os campos.
          </p>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <ChoiceCard
              icon={AudioLines}
              title="Falar"
              hint="Dita os detalhes"
              onClick={() => setMode('voice')}
            />
            <ChoiceCard
              icon={PencilLine}
              title="Escrever"
              hint="Cola ou escreve"
              onClick={() => setMode('write')}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Voice */}
      <VoicePulseDialog
        open={voiceOpen}
        onClose={close}
        onBack={() => setMode('chooser')}
        onTranscribed={async (transcript) => {
          // Pipe transcript directly into extraction — no intermediate UI.
          await runExtraction(transcript)
        }}
        isExtracting={isExtracting}
      />

      {/* Write */}
      <Sheet open={writeOpen} onOpenChange={(v) => { if (!v) close() }}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={cn(
            'p-0 gap-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
            'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
            isMobile
              ? 'data-[side=bottom]:h-[70dvh] rounded-t-3xl'
              : 'w-full data-[side=right]:sm:max-w-md sm:rounded-l-3xl',
          )}
        >
          <VisuallyHidden>
            <SheetTitle>Preencher por escrito</SheetTitle>
          </VisuallyHidden>
          {isMobile && (
            <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
          )}

          <SheetHeader className="shrink-0 px-5 pt-6 pb-3 gap-0 flex-row items-start justify-between">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => setMode('chooser')}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors mb-1"
              >
                <ArrowLeft className="h-3 w-3" />
                Voltar
              </button>
              <p className="text-base font-semibold tracking-tight flex items-center gap-1.5">
                <PencilLine className="h-4 w-4" />
                Descreve por escrito
              </p>
            </div>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 space-y-3">
            <p className="text-xs text-muted-foreground leading-snug">
              Cola um anúncio existente ou descreve livremente. A IA extrai os campos.
            </p>
            <Textarea
              autoFocus
              rows={isMobile ? 8 : 10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ex: 'Apartamento T3 em Cascais, 450mil, com garagem e piscina, 120m² úteis, certificado B, condição usado'..."
              className="text-sm rounded-xl bg-background/70 border-border/50 focus-visible:ring-1 resize-none min-h-[160px]"
            />
            <p className="text-[11px] text-muted-foreground/80">
              Dica: quanto mais detalhe (áreas, tipologia, zona, condição) melhor o preenchimento.
            </p>
          </div>

          <div className="shrink-0 border-t border-border/40 px-5 py-3 flex items-center justify-end gap-2 bg-background/60">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full h-9"
              onClick={close}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => runExtraction(text)}
              disabled={!text.trim() || isExtracting}
              className="rounded-full h-9 px-4 gap-1.5 bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-400"
            >
              {isExtracting ? (
                <>
                  <Spinner variant="infinite" size={14} />
                  A extrair…
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Extrair com IA
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Preview */}
      <Dialog open={showPreview} onOpenChange={(v) => { setShowPreview(v); if (!v) close() }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" />
              Dados Extraídos
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1">
            {extractedFields && (
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(extractedFields)
                  .filter(([, v]) => v != null)
                  .map(([key, value]) => {
                    if (key === 'specifications' && typeof value === 'object') {
                      return Object.entries(value as Record<string, unknown>)
                        .filter(([, sv]) => sv != null)
                        .map(([sk, sv]) => (
                          <EditableRow
                            key={`spec-${sk}`}
                            fieldKey={sk}
                            label={specLabels[sk] || sk}
                            value={sv}
                            onChange={(v) => updateField(`specifications.${sk}`, v)}
                          />
                        ))
                    }
                    return (
                      <EditableRow
                        key={key}
                        fieldKey={key}
                        label={fieldLabels[key] || key}
                        value={value}
                        onChange={(v) => updateField(key, v)}
                      />
                    )
                  })
                  .flat()}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => { setShowPreview(false); close() }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleApply}
              className="rounded-full bg-violet-600 text-white hover:bg-violet-700"
            >
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Aplicar Dados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Choice card — used in chooser dialog
// ─────────────────────────────────────────────────────────────────────────
function ChoiceCard({
  icon: Icon,
  title,
  hint,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative rounded-2xl border border-border/50 bg-card/60 p-4 text-left transition-all',
        'hover:border-violet-300 hover:shadow-[0_0_0_3px_rgba(139,92,246,0.10)]',
        'dark:hover:border-violet-700',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400',
      )}
    >
      <div className="h-9 w-9 rounded-xl bg-violet-500/15 ring-1 ring-violet-300/40 dark:ring-violet-700/40 flex items-center justify-center mb-2.5 group-hover:bg-violet-500/25 transition-colors">
        <Icon className="h-4 w-4 text-violet-600 dark:text-violet-300" />
      </div>
      <p className="text-sm font-semibold tracking-tight">{title}</p>
      <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// VoicePulseDialog — centered dialog with pulsing orb that responds to mic
// input level. Once stop is pressed, the audio is transcribed and handed
// back via onTranscribed.
// ─────────────────────────────────────────────────────────────────────────
function VoicePulseDialog({
  open,
  onClose,
  onBack,
  onTranscribed,
  isExtracting,
}: {
  open: boolean
  onClose: () => void
  onBack: () => void
  onTranscribed: (transcript: string) => Promise<void> | void
  isExtracting: boolean
}) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [level, setLevel] = useState(0) // 0..1 mic amplitude
  // Texto transcrito mostrado ao utilizador para revisão antes de submeter.
  // Só é enviado para extracção quando o utilizador clica "Extrair com IA".
  const [transcript, setTranscript] = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Garante auto-start uma única vez por abertura do diálogo. Sem isto,
  // re-renders do ciclo de gravação fariam start() em loop.
  const autoStartedRef = useRef(false)

  const stopAll = () => {
    try { mediaRecorderRef.current?.stop() } catch {}
    mediaRecorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    analyserRef.current = null
    setLevel(0)
    setElapsed(0)
  }

  // Cleanup quando o diálogo fecha ou desmonta. Também reseta o transcript
  // para que uma nova abertura volte a um estado limpo.
  useEffect(() => {
    if (!open) {
      stopAll()
      setTranscript('')
      autoStartedRef.current = false
    }
    return () => stopAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Auto-start a gravação assim que o diálogo abre — uma única vez.
  useEffect(() => {
    if (open && !autoStartedRef.current) {
      autoStartedRef.current = true
      void start()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Audio analyser para o pulse — RMS sobre o frequency data dá um nível
      // suave em [0,1] que mapeamos para o scale do orb.
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext
      const ctx = new AudioCtx()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.85
      source.connect(analyser)
      analyserRef.current = analyser

      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteFrequencyData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
        const rms = Math.sqrt(sum / data.length) / 255
        // Limpa o ruído de fundo e empurra o range para cima.
        const cleaned = Math.max(0, rms - 0.03)
        const norm = Math.min(1, cleaned * 3)
        setLevel((prev) => prev * 0.6 + norm * 0.4)
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)

      // MediaRecorder
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (blob.size === 0) return
        await transcribe(blob)
      }
      recorder.start()
      setIsRecording(true)

      // Timer
      const startedAt = Date.now()
      setElapsed(0)
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAt) / 1000))
      }, 250)
    } catch {
      toast.error('Não foi possível aceder ao microfone.')
    }
  }

  const stop = () => {
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
      if (!res.ok) throw new Error('Erro na transcrição')
      const data = await res.json()
      const text = String(data.text ?? '').trim()
      if (!text) {
        toast.error('Não foi possível transcrever o áudio.')
        return
      }
      // Anexa ao transcript existente — permite que o utilizador re-grave
      // várias vezes para acumular detalhes antes de submeter.
      setTranscript((prev) => (prev ? `${prev.trim()}\n${text}` : text))
    } catch {
      toast.error('Erro ao transcrever áudio.')
    } finally {
      setIsTranscribing(false)
    }
  }

  // Re-gravar — limpa o transcript e arranca nova gravação.
  const handleRerecord = () => {
    setTranscript('')
    void start()
  }

  // Submeter — só agora dispara a extracção dos campos.
  const handleSubmit = async () => {
    const text = transcript.trim()
    if (!text) return
    await onTranscribed(text)
  }

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  }

  // Visual scale derivado do nível do mic. Base 1.0; pico ~1.18.
  const scale = 1 + level * 0.18

  // Estados visuais distintos: review (com transcript) vs gravação/idle.
  const isReviewing = !isRecording && !isTranscribing && transcript.length > 0
  const showSpinner = isTranscribing || isExtracting

  // ── Estado da label central (modo gravação/transcrição) ──────────────
  let centerLabel = 'A iniciar...'
  if (isExtracting) centerLabel = 'A preencher os campos…'
  else if (isTranscribing) centerLabel = 'A transcrever…'
  else if (isRecording) centerLabel = 'Estou a ouvir'

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden bg-background/80 backdrop-blur-2xl border-border/40">
        <VisuallyHidden>
          <DialogTitle>Preencher por voz</DialogTitle>
        </VisuallyHidden>

        {/* Top bar */}
        <div className="flex items-center justify-between px-5 pt-5">
          <button
            type="button"
            onClick={onBack}
            disabled={isTranscribing || isExtracting}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            <ArrowLeft className="h-3 w-3" />
            Voltar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground"
            aria-label="Fechar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {isReviewing ? (
          // ── Review mode — mostra o texto transcrito + acções ─────────
          <div className="px-5 pb-5 pt-3 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-violet-500/15 ring-1 ring-violet-300/40 dark:ring-violet-700/40 flex items-center justify-center">
                <Mic className="h-4 w-4 text-violet-600 dark:text-violet-300" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-tight">Transcrição</p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Revê o texto e edita se for preciso. Só extraímos quando submeteres.
                </p>
              </div>
            </div>

            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={8}
              disabled={isExtracting}
              className="text-sm rounded-xl bg-background/70 border-border/50 focus-visible:ring-1 resize-none min-h-[160px]"
            />

            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleRerecord}
                disabled={isExtracting}
                className="rounded-full h-9 gap-1.5"
              >
                <Mic className="h-3.5 w-3.5" />
                Re-gravar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSubmit}
                disabled={!transcript.trim() || isExtracting}
                className="rounded-full h-9 px-4 gap-1.5 bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-400"
              >
                {isExtracting ? (
                  <>
                    <Spinner variant="infinite" size={14} />
                    A extrair…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Extrair com IA
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          // ── Recording / transcribing / idle — orb visual ─────────────
          <div className="px-6 pb-6 pt-3 flex flex-col items-center gap-5">
            <div className="relative h-44 w-44 flex items-center justify-center">
              {/* outermost halo */}
              <div
                className={cn(
                  'absolute inset-0 rounded-full bg-violet-500/15 blur-2xl transition-opacity duration-300',
                  isRecording ? 'opacity-100' : 'opacity-40',
                )}
                style={{ transform: `scale(${0.9 + level * 0.6})` }}
              />
              {/* mid ring */}
              <div
                className={cn(
                  'absolute h-32 w-32 rounded-full bg-gradient-to-br from-violet-500/30 to-violet-400/10',
                  'transition-transform duration-150 ease-out',
                )}
                style={{ transform: `scale(${scale})` }}
              />
              {/* inner orb */}
              <div
                className={cn(
                  'relative h-20 w-20 rounded-full flex items-center justify-center',
                  'bg-gradient-to-br from-violet-500 to-violet-600 shadow-lg shadow-violet-500/40',
                  'transition-transform duration-100 ease-out',
                )}
                style={{ transform: `scale(${1 + level * 0.08})` }}
              >
                {showSpinner ? (
                  <Spinner variant="infinite" size={26} className="text-white" />
                ) : (
                  <Mic className="h-7 w-7 text-white" />
                )}
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm font-semibold tracking-tight">{centerLabel}</p>
              {isRecording && (
                <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                  {formatElapsed(elapsed)}
                </p>
              )}
              {!isRecording && !isTranscribing && !isExtracting && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Toca em Falar para começar
                </p>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 w-full">
              {isRecording ? (
                <Button
                  type="button"
                  onClick={stop}
                  variant="destructive"
                  className="rounded-full h-10 px-5 gap-2 shadow-[0_0_0_4px_rgba(239,68,68,0.15)]"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  Parar
                </Button>
              ) : !isTranscribing && !isExtracting ? (
                <Button
                  type="button"
                  onClick={start}
                  className="rounded-full h-10 px-5 gap-2 bg-violet-600 text-white hover:bg-violet-700"
                >
                  <Mic className="h-3.5 w-3.5" />
                  Falar
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// EditableRow — preview row helper
// ─────────────────────────────────────────────────────────────────────────
function EditableRow({
  fieldKey,
  label,
  value,
  onChange,
}: {
  fieldKey: string
  label: string
  value: unknown
  onChange: (v: unknown) => void
}) {
  if (fieldKey === 'features' && Array.isArray(value)) {
    return (
      <div className="space-y-1 col-span-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Input
          value={(value as string[]).join(', ')}
          onChange={(e) => onChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          className="h-8 text-sm"
          placeholder="Ex: Piscina, Varanda, Jardim"
        />
      </div>
    )
  }

  if (fieldKey === 'description') {
    return (
      <div className="space-y-1 col-span-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Textarea
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || null)}
          rows={3}
          className="text-sm"
        />
      </div>
    )
  }

  if (NUMBER_FIELDS.has(fieldKey)) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Input
          type="number"
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          className="h-8 text-sm"
        />
      </div>
    )
  }

  if (fieldKey === 'has_elevator') {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Input
          value={value ? 'Sim' : 'Não'}
          onChange={(e) => onChange(e.target.value.toLowerCase().startsWith('s'))}
          className="h-8 text-sm"
        />
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <Input
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-8 text-sm"
      />
    </div>
  )
}
