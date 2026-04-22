'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, Building2, Check, ChevronDown, ExternalLink, FileText, Image as ImageIcon, Loader2, Mail, MessageCircle, Mic, Plus, Search, Send, Square, Trash2, User, UserCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useIsMobile } from '@/hooks/use-mobile'
import { useUser } from '@/hooks/use-user'
import type { VoiceToolName } from '@/lib/voice/tools'
import {
  TOOL_CONFIGS,
  getMissingRequired,
  isRequiredField,
  type FieldConfig,
  type VoiceSearchResult,
} from '@/lib/voice/tool-configs'

type VoiceState =
  | 'idle'
  | 'requesting_mic'
  | 'recording'
  | 'processing'
  | 'reviewing'
  | 'submitting'
  | 'results'
  | 'done'
  | 'error'

interface Intent {
  tool: VoiceToolName
  args: Record<string, any>
  confirmText: string
  confidence: 'alta' | 'media' | 'baixa' | null
}

export function AiVoiceAssistant() {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const [intent, setIntent] = useState<Intent | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [amplitude, setAmplitude] = useState(0)
  const [searchResults, setSearchResults] = useState<VoiceSearchResult[] | null>(null)

  const router = useRouter()
  const pathname = usePathname()
  const { user } = useUser()

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const intentRef = useRef<Intent | null>(null)

  useEffect(() => {
    intentRef.current = intent
  }, [intent])

  const cleanupAudio = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    try { analyserRef.current?.disconnect() } catch {}
    analyserRef.current = null
    try { audioCtxRef.current?.close() } catch {}
    audioCtxRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
    chunksRef.current = []
  }, [])

  const processAudio = useCallback(
    async (blob: Blob) => {
      if (blob.size === 0) {
        setState(intentRef.current ? 'reviewing' : 'error')
        if (!intentRef.current) setErrorMessage('Não captei nenhum som.')
        return
      }
      setState('processing')
      try {
        const fd = new FormData()
        fd.append('audio', blob)
        const tRes = await fetch('/api/transcribe', { method: 'POST', body: fd })
        if (!tRes.ok) throw new Error('transcribe failed')
        const { text } = await tRes.json()
        const t = (text || '').trim()
        setTranscript(t)
        if (!t) {
          setState(intentRef.current ? 'reviewing' : 'error')
          if (!intentRef.current) setErrorMessage('Não consegui perceber. Tenta novamente.')
          return
        }

        const current = intentRef.current
        const context: Record<string, unknown> = { pathname }
        if (current) {
          context.existingTool = current.tool
          context.existingArgs = current.args
        }

        const iRes = await fetch('/api/ai/voice-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: t, context }),
        })
        if (!iRes.ok) throw new Error('intent failed')
        const data = await iRes.json()

        if (!data.tool) {
          if (current) {
            // Refinement returned no tool — keep existing intent visible
            setState('reviewing')
            setErrorMessage(data.message || 'Não percebi o que adicionaste.')
            return
          }
          setState('error')
          setErrorMessage(data.message || 'Não percebi o pedido.')
          return
        }

        const toolName = data.tool as VoiceToolName
        if (!TOOL_CONFIGS[toolName]) {
          setState('error')
          setErrorMessage('Acção não suportada ainda.')
          return
        }

        setIntent({
          tool: toolName,
          args: data.args || {},
          confirmText: data.confirmText || TOOL_CONFIGS[toolName].title,
          confidence: data.confidence ?? null,
        })
        setState('reviewing')
      } catch {
        setState(intentRef.current ? 'reviewing' : 'error')
        if (!intentRef.current) setErrorMessage('Erro ao processar. Tenta novamente.')
      }
    },
    [pathname]
  )

  const startRecording = useCallback(async () => {
    setErrorMessage('')
    setState('requesting_mic')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      try {
        const AudioCtxCtor = window.AudioContext
          || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (AudioCtxCtor) {
          const ctx = new AudioCtxCtor()
          const source = ctx.createMediaStreamSource(stream)
          const analyser = ctx.createAnalyser()
          analyser.fftSize = 256
          source.connect(analyser)
          audioCtxRef.current = ctx
          analyserRef.current = analyser
          const data = new Uint8Array(analyser.frequencyBinCount)
          const tick = () => {
            if (!analyserRef.current) return
            analyserRef.current.getByteTimeDomainData(data)
            let sum = 0
            for (let i = 0; i < data.length; i++) {
              const v = (data[i] - 128) / 128
              sum += v * v
            }
            setAmplitude(Math.min(1, Math.sqrt(sum / data.length) * 4))
            rafRef.current = requestAnimationFrame(tick)
          }
          tick()
        }
      } catch {}

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        cleanupAudio()
        await processAudio(blob)
      }
      recorder.start()
      setState('recording')
    } catch {
      cleanupAudio()
      setState(intentRef.current ? 'reviewing' : 'error')
      if (!intentRef.current) setErrorMessage('Não foi possível aceder ao microfone.')
    }
  }, [cleanupAudio, processAudio])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.stop()
      setState('processing')
    }
  }, [state])

  const reset = useCallback(() => {
    cleanupAudio()
    setState('idle')
    setTranscript('')
    setIntent(null)
    intentRef.current = null
    setErrorMessage('')
    setAmplitude(0)
    setSearchResults(null)
  }, [cleanupAudio])

  const close = useCallback(() => {
    cleanupAudio()
    setOpen(false)
    setTimeout(reset, 150)
  }, [cleanupAudio, reset])

  const handleArgChange = useCallback((key: string, value: unknown) => {
    setIntent((prev) => (prev ? { ...prev, args: { ...prev.args, [key]: value } } : prev))
    setErrorMessage('')
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!intent) return
    const cfg = TOOL_CONFIGS[intent.tool]
    const canSubmit = cfg.canSubmit
      ? cfg.canSubmit(intent.args)
      : getMissingRequired(intent.tool, intent.args).length === 0
    if (!canSubmit) return

    setErrorMessage('')
    setState('submitting')
    try {
      const result = await cfg.submit(intent.args, { router, userId: user?.id })
      if (result.results) {
        setSearchResults(result.results)
        setState('results')
        return
      }
      toast.success(result.message || 'Criado')
      setState('done')
      setTimeout(close, 450)
    } catch (err) {
      setState('reviewing')
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao submeter. Corrige ou continua a falar.')
    }
  }, [intent, router, close, user?.id])

  const handleDraftSave = useCallback(async () => {
    if (!intent) return
    const cfg = TOOL_CONFIGS[intent.tool]
    if (!cfg.draft) return

    setErrorMessage('')
    setState('submitting')
    try {
      const result = await cfg.draft.submit(intent.args, { router, userId: user?.id })
      toast.success(result.message || 'Rascunho guardado')
      setState('done')
      setTimeout(close, 450)
    } catch (err) {
      setState('reviewing')
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao guardar rascunho.')
    }
  }, [intent, router, close, user?.id])

  // Global trigger
  useEffect(() => {
    const handler = () => {
      if (open) return
      setOpen(true)
    }
    window.addEventListener('open-voice-assistant', handler)
    return () => window.removeEventListener('open-voice-assistant', handler)
  }, [open])

  // Auto-start recording when opened
  useEffect(() => {
    if (open && state === 'idle') {
      startRecording()
    }
  }, [open, state, startRecording])

  // Escape closes
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  useEffect(() => () => cleanupAudio(), [cleanupAudio])

  if (!open) return null

  const showResults = state === 'results' && searchResults !== null
  const showReview = !showResults && intent !== null
  const showFullMic = !intent && !showResults
  const isRecording = state === 'recording'
  const isBusy = state === 'processing' || state === 'requesting_mic' || state === 'submitting'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start md:items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-150"
      data-no-long-press
    >
      <button
        type="button"
        onClick={close}
        className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white flex items-center justify-center transition-colors z-10"
        aria-label="Fechar"
      >
        <X className="h-5 w-5" />
      </button>

      <div className={cn(
        'w-full max-w-md md:max-w-2xl px-6 py-8 md:py-10 text-center text-white',
        'max-h-[calc(100vh-1rem)] md:max-h-[calc(100vh-4rem)] overflow-y-auto',
        showReview && 'pt-16'
      )}>
        {showFullMic ? (
          <>
            <MicVisual
              state={state}
              amplitude={amplitude}
              onClick={isRecording ? stopRecording : undefined}
            />
            <div className="mt-8 min-h-[3rem]">
              <StateLabel state={state} errorMessage={errorMessage} />
            </div>
            {transcript && (
              <p className="mt-4 text-sm text-white/70 italic">"{transcript}"</p>
            )}
          </>
        ) : showResults ? (
          <>
            <SmallStatus
              state={state}
              amplitude={amplitude}
              onStop={undefined}
              errorMessage={errorMessage}
              transcript={transcript}
            />
            <ResultsPanel
              query={String(intent?.args?.query ?? '')}
              results={searchResults!}
              onNewSearch={() => {
                setSearchResults(null)
                setState('reviewing')
              }}
              onClose={close}
            />
          </>
        ) : (
          <>
            <SmallStatus
              state={state}
              amplitude={amplitude}
              onStop={isRecording ? stopRecording : undefined}
              errorMessage={errorMessage}
              transcript={transcript}
            />
            <ReviewPanel
              intent={intent!}
              isRecording={isRecording}
              isBusy={isBusy}
              errorMessage={errorMessage}
              onContinue={startRecording}
              onSubmit={handleSubmit}
              onDraftSave={handleDraftSave}
              onArgChange={handleArgChange}
            />
          </>
        )}

        {state === 'error' && !intent && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <Button variant="secondary" onClick={reset}>Tentar de novo</Button>
            <Button variant="ghost" onClick={close} className="text-white hover:bg-white/10">Fechar</Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function MicVisual({
  state,
  amplitude,
  onClick,
}: {
  state: VoiceState
  amplitude: number
  onClick?: () => void
}) {
  const isRecording = state === 'recording'
  const isBusy = state === 'processing' || state === 'submitting' || state === 'requesting_mic'
  const isDone = state === 'done'
  const isError = state === 'error'

  const scale = 1 + amplitude * 0.35

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'relative mx-auto flex h-36 w-36 items-center justify-center rounded-full transition-colors',
        isRecording ? 'bg-primary/20 cursor-pointer' : 'bg-white/10',
        isDone && 'bg-emerald-500/30',
        isError && 'bg-red-500/20'
      )}
      aria-label={isRecording ? 'Parar gravação' : 'Microfone'}
    >
      {isRecording && (
        <>
          <span
            className="absolute inset-0 rounded-full bg-primary/40 animate-ping"
            style={{ animationDuration: '1.6s' }}
          />
          <span
            className="absolute inset-0 rounded-full border-2 border-primary/60 transition-transform duration-75"
            style={{ transform: `scale(${scale})` }}
          />
        </>
      )}
      <span
        className={cn(
          'relative flex h-20 w-20 items-center justify-center rounded-full shadow-xl',
          isRecording ? 'bg-primary text-primary-foreground' : 'bg-white text-neutral-900',
          isDone && 'bg-emerald-500 text-white',
          isError && 'bg-red-500 text-white'
        )}
      >
        {isBusy ? (
          <Loader2 className="h-8 w-8 animate-spin" />
        ) : isDone ? (
          <Check className="h-8 w-8" />
        ) : isRecording ? (
          <Square className="h-7 w-7 fill-current" />
        ) : (
          <Mic className="h-8 w-8" />
        )}
      </span>
    </button>
  )
}

function SmallStatus({
  state,
  amplitude,
  onStop,
  errorMessage,
  transcript,
}: {
  state: VoiceState
  amplitude: number
  onStop?: () => void
  errorMessage: string
  transcript: string
}) {
  const isRecording = state === 'recording'
  const isBusy = state === 'processing' || state === 'submitting' || state === 'requesting_mic'
  const scale = 1 + amplitude * 0.25

  const pill = (() => {
    if (state === 'submitting') return { label: 'A criar…', icon: <Loader2 className="h-4 w-4 animate-spin" />, tone: 'bg-white/15' }
    if (state === 'processing') return { label: 'A pensar…', icon: <Loader2 className="h-4 w-4 animate-spin" />, tone: 'bg-white/15' }
    if (state === 'requesting_mic') return { label: 'A abrir microfone…', icon: <Loader2 className="h-4 w-4 animate-spin" />, tone: 'bg-white/15' }
    if (isRecording) return { label: 'A ouvir… (toca para parar)', icon: <Square className="h-3.5 w-3.5 fill-current" />, tone: 'bg-red-500/30' }
    if (state === 'done') return { label: 'Pronto', icon: <Check className="h-4 w-4" />, tone: 'bg-emerald-500/30' }
    return null
  })()

  return (
    <div className="flex flex-col items-center gap-3">
      {pill && (
        <button
          type="button"
          onClick={onStop}
          disabled={!onStop}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur transition-transform',
            pill.tone,
            isRecording && 'cursor-pointer hover:ring-white/40'
          )}
          style={isRecording ? { transform: `scale(${scale})` } : undefined}
        >
          {pill.icon}
          <span>{pill.label}</span>
        </button>
      )}

      {errorMessage && !isBusy && !isRecording && (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-1 text-xs text-red-200 ring-1 ring-red-500/40">
          <AlertCircle className="h-3.5 w-3.5" />
          {errorMessage}
        </div>
      )}

      {transcript && (isRecording || isBusy) && (
        <p className="text-xs text-white/60 italic max-w-sm">"{transcript}"</p>
      )}
    </div>
  )
}

function StateLabel({ state, errorMessage }: { state: VoiceState; errorMessage: string }) {
  const map: Record<VoiceState, { title: string; hint?: string }> = {
    idle: { title: 'A preparar…' },
    requesting_mic: { title: 'A pedir acesso ao microfone…' },
    recording: { title: 'A ouvir…', hint: 'Toca no microfone para parar' },
    processing: { title: 'A pensar…' },
    reviewing: { title: 'Confirma os dados' },
    submitting: { title: 'A criar…' },
    results: { title: 'Resultados' },
    done: { title: 'Pronto!' },
    error: { title: errorMessage || 'Erro' },
  }
  const entry = map[state]
  return (
    <>
      <p className="text-lg font-medium">{entry.title}</p>
      {entry.hint && <p className="mt-1 text-xs text-white/60">{entry.hint}</p>}
    </>
  )
}

function ReviewPanel({
  intent,
  isRecording,
  isBusy,
  errorMessage,
  onContinue,
  onSubmit,
  onDraftSave,
  onArgChange,
}: {
  intent: Intent
  isRecording: boolean
  isBusy: boolean
  errorMessage: string
  onContinue: () => void
  onSubmit: () => void
  onDraftSave: () => void
  onArgChange: (key: string, value: unknown) => void
}) {
  const cfg = TOOL_CONFIGS[intent.tool]
  const isMobile = useIsMobile()
  const baseCanSubmit = cfg.canSubmit
    ? cfg.canSubmit(intent.args)
    : getMissingRequired(intent.tool, intent.args).length === 0
  const canSubmit = baseCanSubmit && !isRecording && !isBusy

  // While dictating on a small screen, hide already-filled fields so the
  // user only sees what's still left to say.
  const hideFilled = isRecording && isMobile
  const visibleFields = hideFilled
    ? cfg.fields.filter((f) => isEmpty(intent.args[f.key]))
    : cfg.fields
  const hiddenCount = cfg.fields.length - visibleFields.length

  const confidenceBadge = intent.confidence
    ? {
        alta: { label: 'Alta confiança', cls: 'bg-emerald-500/20 text-emerald-200' },
        media: { label: 'Confiança média', cls: 'bg-amber-500/20 text-amber-200' },
        baixa: { label: 'Baixa confiança', cls: 'bg-red-500/20 text-red-200' },
      }[intent.confidence]
    : null

  return (
    <div className="mt-6 rounded-2xl bg-white/10 border border-white/20 p-5 text-left backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-white">{cfg.title}</p>
        {confidenceBadge && (
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', confidenceBadge.cls)}>
            {confidenceBadge.label}
          </span>
        )}
      </div>

      {errorMessage && (
        <div className="mt-4 rounded-lg bg-red-500/20 ring-1 ring-red-500/40 px-3 py-2.5 text-xs text-red-100 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium">{errorMessage}</p>
            <p className="mt-0.5 text-red-200/80">
              Edita os campos ou continua a falar e tenta novamente.
            </p>
          </div>
        </div>
      )}

      {intent.tool === 'create_leads_batch' ? (
        <div className="mt-4">
          <BatchLeadsList args={intent.args} onArgChange={onArgChange} />
        </div>
      ) : (
        <>
          {hideFilled && hiddenCount > 0 && (
            <p className="mt-3 text-[11px] text-white/50 text-left">
              {visibleFields.length === 0
                ? 'Todos os campos preenchidos.'
                : `${hiddenCount} campo${hiddenCount !== 1 ? 's' : ''} já preenchido${hiddenCount !== 1 ? 's' : ''} (escondido${hiddenCount !== 1 ? 's' : ''}). Falta${visibleFields.length === 1 ? '' : 'm'} ${visibleFields.length}.`}
            </p>
          )}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
            {visibleFields.map((field) => {
              const isWide = field.inputType === 'textarea'
              return (
                <div key={field.key} className={cn('min-w-0', isWide && 'md:col-span-2')}>
                  <EditableFieldRow
                    field={field}
                    value={intent.args[field.key]}
                    onChange={(v) => onArgChange(field.key, v)}
                    isRequired={isRequiredField(field, cfg.fields, intent.args)}
                  />
                  {intent.tool === 'create_angariacao' && field.key === 'main_owner_name' && (
                    <OwnerMatchHint
                      name={String(intent.args.main_owner_name ?? '')}
                      onAdopt={(match) => {
                        onArgChange('main_owner_name', match.nome)
                        if (match.telemovel) onArgChange('main_owner_phone', match.telemovel)
                        if (match.email) onArgChange('main_owner_email', match.email)
                        if (match.nif) onArgChange('main_owner_nif', match.nif)
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="ghost"
          onClick={onContinue}
          disabled={isRecording || isBusy}
          className="text-white hover:bg-white/10"
        >
          <Mic className="h-4 w-4 mr-1.5" />
          {isRecording ? 'A ouvir…' : 'Continuar a falar'}
        </Button>
        {cfg.draft && (
          <Button
            variant="secondary"
            onClick={onDraftSave}
            disabled={isRecording || isBusy}
          >
            {cfg.draft.label || 'Guardar rascunho'}
          </Button>
        )}
        <Button onClick={onSubmit} disabled={!canSubmit}>
          {cfg.submitLabel}
        </Button>
      </div>
    </div>
  )
}

// ── Batch leads list ──────────────────────────────────────────────────────

function BatchLeadsList({
  args,
  onArgChange,
}: {
  args: Record<string, any>
  onArgChange: (key: string, value: unknown) => void
}) {
  const leads: Array<{ nome?: string; telemovel?: string; email?: string }> =
    Array.isArray(args.leads) ? args.leads : []

  const [consultants, setConsultants] = useState<Array<{ id: string; commercial_name: string }>>([])
  const consultantsLoadedRef = useRef(false)

  // Fetch consultants once on mount
  useEffect(() => {
    fetch('/api/users/consultants')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.data || []
        setConsultants(
          list.map((c: any) => ({ id: String(c.id), commercial_name: String(c.commercial_name ?? '') }))
        )
      })
      .catch(() => {})
      .finally(() => {
        consultantsLoadedRef.current = true
      })
  }, [])

  // Fuzzy-match the voice-provided consultant name to a real consultant ID once
  // the consultant list loads.
  useEffect(() => {
    if (args.assigned_consultant_id) return
    if (!args.assigned_consultant_name) return
    if (consultants.length === 0) return
    const needle = String(args.assigned_consultant_name).toLowerCase().trim()
    if (!needle) return
    const match =
      consultants.find((c) => c.commercial_name.toLowerCase() === needle) ||
      consultants.find((c) => c.commercial_name.toLowerCase().includes(needle)) ||
      consultants.find((c) => needle.includes(c.commercial_name.toLowerCase().split(' ')[0] || ''))
    if (match) {
      onArgChange('assigned_consultant_id', match.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultants, args.assigned_consultant_name])

  const update = (idx: number, field: 'nome' | 'telemovel' | 'email', value: string) => {
    const next = leads.map((l, i) => (i === idx ? { ...l, [field]: value } : l))
    onArgChange('leads', next)
  }
  const remove = (idx: number) => {
    onArgChange('leads', leads.filter((_, i) => i !== idx))
  }
  const add = () => {
    onArgChange('leads', [...leads, { nome: '' }])
  }

  const inputCls =
    'bg-white/5 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/40 h-8 text-sm'

  const assignedId = args.assigned_consultant_id ? String(args.assigned_consultant_id) : ''

  return (
    <div className="space-y-3">
      {/* Shared assignee for the whole batch */}
      <div className="flex items-center gap-3 rounded-lg bg-white/5 ring-1 ring-white/10 px-3 py-2">
        <label className="w-[110px] shrink-0 text-xs text-white/60">Atribuir a</label>
        <div className="flex-1 min-w-0" data-no-long-press>
          <Select
            value={assignedId}
            onValueChange={(v) => onArgChange('assigned_consultant_id', v)}
          >
            <SelectTrigger className={cn(inputCls, 'w-full')} data-no-long-press>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent
              position="popper"
              sideOffset={4}
              className="z-[300] max-h-[min(18rem,60vh)]"
              data-no-long-press
            >
              {consultants.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.commercial_name || c.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {leads.length === 0 && (
        <div className="rounded-lg bg-amber-500/10 ring-1 ring-amber-500/25 px-3 py-3 text-xs text-amber-200/80">
          Fala os nomes dos leads — ou adiciona uma linha manualmente.
        </div>
      )}

      {leads.map((lead, i) => {
        const missing = !lead.nome || !String(lead.nome).trim()
        return (
          <div
            key={i}
            className={cn(
              'flex items-start gap-2 rounded-lg px-2 py-2',
              missing ? 'bg-red-500/15 ring-1 ring-red-500/40' : 'bg-white/5 ring-1 ring-white/10'
            )}
          >
            <span className="w-5 shrink-0 pt-2 text-center text-xs text-white/40">{i + 1}</span>
            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <Input
                value={lead.nome ?? ''}
                onChange={(e) => update(i, 'nome', e.target.value)}
                placeholder="Nome *"
                className={inputCls}
              />
              <Input
                value={lead.telemovel ?? ''}
                onChange={(e) => update(i, 'telemovel', e.target.value)}
                placeholder="Telemóvel"
                inputMode="tel"
                className={inputCls}
              />
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              className="p-1.5 text-white/40 hover:text-white/80 transition-colors shrink-0 mt-0.5"
              aria-label="Remover"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )
      })}

      <button
        type="button"
        onClick={add}
        className="w-full rounded-lg border border-dashed border-white/20 py-2 text-xs text-white/60 hover:bg-white/5 hover:text-white/80 transition-colors flex items-center justify-center gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar linha
      </button>
    </div>
  )
}

// ── Search results panel ──────────────────────────────────────────────────

type ComposeState = {
  result: VoiceSearchResult
  channel: 'email' | 'whatsapp'
} | null

function ResultsPanel({
  query,
  results,
  onNewSearch,
  onClose,
}: {
  query: string
  results: VoiceSearchResult[]
  onNewSearch: () => void
  onClose: () => void
}) {
  const [showOthers, setShowOthers] = useState(false)
  const [compose, setCompose] = useState<ComposeState>(null)
  const top = results[0]
  const others = results.slice(1)

  if (compose) {
    return (
      <ComposePanel
        result={compose.result}
        channel={compose.channel}
        onBack={() => setCompose(null)}
        onSent={() => {
          setCompose(null)
          onClose()
        }}
      />
    )
  }

  const startSend = (r: VoiceSearchResult, channel: 'email' | 'whatsapp') => {
    setCompose({ result: r, channel })
  }

  return (
    <div className="mt-6 space-y-3 text-left">
      <div className="flex items-center justify-between gap-3 px-1 text-xs text-white/60">
        <span className="inline-flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5" />
          <span>"{query}"</span>
        </span>
        <span>{results.length} resultado{results.length !== 1 ? 's' : ''}</span>
      </div>

      {!top ? (
        <div className="rounded-2xl bg-white/10 border border-white/20 p-5 text-sm text-white/80 text-center">
          Sem resultados encontrados.
        </div>
      ) : (
        <>
          <ResultCard result={top} variant="featured" onSend={startSend} />

          {others.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowOthers((v) => !v)}
                className="flex w-full items-center justify-between rounded-lg bg-white/5 hover:bg-white/10 px-3 py-2 text-xs text-white/80 transition-colors"
              >
                <span>Ver outros {others.length} resultado{others.length !== 1 ? 's' : ''} parecidos</span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', showOthers && 'rotate-180')} />
              </button>
              {showOthers && (
                <div className="mt-2 space-y-2">
                  {others.map((r) => (
                    <ResultCard key={r.id} result={r} variant="compact" onSend={startSend} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onNewSearch} className="text-white hover:bg-white/10">
          Nova pesquisa
        </Button>
        <Button onClick={onClose}>Fechar</Button>
      </div>
    </div>
  )
}

function ResultCard({
  result,
  variant,
  onSend,
}: {
  result: VoiceSearchResult
  variant: 'featured' | 'compact'
  onSend: (r: VoiceSearchResult, channel: 'email' | 'whatsapp') => void
}) {
  const Icon =
    result.kind === 'property'
      ? Building2
      : result.kind === 'design'
        ? ImageIcon
        : FileText

  if (variant === 'compact') {
    return (
      <div className="rounded-lg bg-white/5 ring-1 ring-white/10 px-3 py-2.5">
        <div className="flex items-start gap-3">
          <Icon className="h-4 w-4 shrink-0 mt-0.5 text-white/50" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{result.title}</p>
            {result.meta && <p className="text-[11px] text-white/50">{result.meta}</p>}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <CardAction href={result.url} icon={<ExternalLink className="h-3.5 w-3.5" />} label="Abrir" />
          <CardAction onClick={() => onSend(result, 'email')} icon={<Mail className="h-3.5 w-3.5" />} label="Email" />
          <CardAction onClick={() => onSend(result, 'whatsapp')} icon={<MessageCircle className="h-3.5 w-3.5" />} label="WhatsApp" />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white text-neutral-900 p-4 shadow-xl">
      <a
        href={result.url}
        target="_blank"
        rel="noreferrer"
        className="flex items-start gap-3 group"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100">
          <Icon className="h-5 w-5 text-neutral-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate group-hover:underline">{result.title}</p>
          {result.subtitle && (
            <p className="mt-0.5 text-xs text-neutral-600 line-clamp-2">{result.subtitle}</p>
          )}
          {result.meta && (
            <p className="mt-1 text-[11px] uppercase tracking-wide text-neutral-500">{result.meta}</p>
          )}
        </div>
        <ExternalLink className="h-4 w-4 shrink-0 text-neutral-400 mt-1" />
      </a>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
        <Button size="sm" variant="outline" onClick={() => onSend(result, 'email')} className="gap-1.5">
          <Mail className="h-3.5 w-3.5" /> Enviar por email
        </Button>
        <Button size="sm" variant="outline" onClick={() => onSend(result, 'whatsapp')} className="gap-1.5">
          <MessageCircle className="h-3.5 w-3.5" /> Enviar por WhatsApp
        </Button>
      </div>
    </div>
  )
}

function CardAction({
  href,
  onClick,
  icon,
  label,
}: {
  href?: string
  onClick?: () => void
  icon: React.ReactNode
  label: string
}) {
  const cls =
    'inline-flex items-center gap-1 rounded-md bg-white/10 hover:bg-white/20 px-2 py-1 text-[11px] text-white transition-colors'
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {icon}
        {label}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {icon}
      {label}
    </button>
  )
}

// ── Compose panel (email / WhatsApp send) ────────────────────────────────
//
// Flow:
//  - Opens with N suggested contacts (recent leads) as chips
//  - User can add/remove recipients, type to search, or mic to dictate
//    ("envia ao João e à Maria", "muda o assunto para X", "manda")
//  - Multiple recipients → individual messages (one per recipient)
//  - WhatsApp goes via /api/voice/whatsapp-send (uazapi, not wa.me)
//  - Email goes via /api/email/send, looped per recipient

function ComposePanel({
  result,
  channel,
  onBack,
  onSent,
}: {
  result: VoiceSearchResult
  channel: 'email' | 'whatsapp'
  onBack: () => void
  onSent: () => void
}) {
  const initialRecipients = (result.initialRecipients ?? []) as ContactMatch[]
  const [recipients, setRecipients] = useState<ContactMatch[]>(initialRecipients)
  const [recipientQuery, setRecipientQuery] = useState('')
  const [matches, setMatches] = useState<ContactMatch[]>([])
  const [searching, setSearching] = useState(false)
  const [defaultContacts, setDefaultContacts] = useState<ContactMatch[]>([])
  const [subject, setSubject] = useState(result.title)
  const [message, setMessage] = useState(
    result.defaultMessage || defaultMessage(result, channel)
  )
  const [sending, setSending] = useState(false)
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'processing'>('idle')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  // Load a handful of recent contacts on mount so the user has one-tap access.
  useEffect(() => {
    let cancelled = false
    fetch('/api/leads?limit=8')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || cancelled) return
        const raw = Array.isArray(data) ? data : data?.data || []
        setDefaultContacts(
          raw
            .map((r: any): ContactMatch => ({
              id: String(r.id),
              nome: String(r.nome ?? ''),
              telemovel: r.telemovel ? String(r.telemovel) : undefined,
              email: r.email ? String(r.email) : undefined,
              nif: r.nif ? String(r.nif) : undefined,
            }))
            .filter((c: ContactMatch) =>
              channel === 'email' ? Boolean(c.email) : Boolean(c.telemovel)
            )
            .slice(0, 6)
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [channel])

  // Debounced recipient search
  useEffect(() => {
    const q = recipientQuery.trim()
    if (q.length < 2) {
      setMatches([])
      return
    }
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/leads?nome=${encodeURIComponent(q)}&limit=5`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        const raw = Array.isArray(data) ? data : data?.data || []
        if (cancelled) return
        setMatches(
          raw.slice(0, 5).map((r: any) => ({
            id: String(r.id),
            nome: String(r.nome ?? ''),
            telemovel: r.telemovel ? String(r.telemovel) : undefined,
            email: r.email ? String(r.email) : undefined,
            nif: r.nif ? String(r.nif) : undefined,
          }))
        )
      } catch {
        if (!cancelled) setMatches([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [recipientQuery])

  const channelLabel = channel === 'email' ? 'Email' : 'WhatsApp'
  const ChannelIcon = channel === 'email' ? Mail : MessageCircle

  const addRecipient = (c: ContactMatch) => {
    setRecipients((prev) => (prev.some((p) => p.id === c.id) ? prev : [...prev, c]))
    setRecipientQuery('')
    setMatches([])
  }
  const removeRecipient = (id: string) => {
    setRecipients((prev) => prev.filter((p) => p.id !== id))
  }

  const validRecipients = recipients.filter((r) =>
    channel === 'email' ? Boolean(r.email) : Boolean(r.telemovel)
  )
  const canSend = validRecipients.length > 0 && message.trim().length > 0 && !sending

  const doSend = useCallback(async () => {
    if (!canSend) return
    setSending(true)
    try {
      if (channel === 'email') {
        // Individual emails — one POST per recipient.
        let ok = 0
        let fail = 0
        for (const r of validRecipients) {
          try {
            const res = await fetch('/api/email/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: [r.email],
                subject,
                body_html: message.replace(/\n/g, '<br>'),
                body_text: message,
              }),
            })
            if (res.ok) ok += 1
            else fail += 1
          } catch {
            fail += 1
          }
        }
        toast.success(
          fail === 0
            ? `${ok} email${ok !== 1 ? 's' : ''} enviado${ok !== 1 ? 's' : ''}`
            : `${ok} enviados, ${fail} com erro`
        )
      } else {
        const phones = validRecipients.map((r) => r.telemovel!).filter(Boolean)
        const res = await fetch('/api/voice/whatsapp-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phones, text: message }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error || 'Falha ao enviar WhatsApp')
        }
        const out = await res.json()
        toast.success(
          out.failed === 0
            ? `${out.sent} WhatsApp enviado${out.sent !== 1 ? 's' : ''}`
            : `${out.sent} enviados, ${out.failed} com erro`
        )
      }
      onSent()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar')
    } finally {
      setSending(false)
    }
  }, [canSend, channel, validRecipients, subject, message, onSent])

  // Voice refinement (mic inside compose panel) — transcribes + parses
  // recipients/subject/body/send_now via /api/ai/compose-refine.
  const cleanupVoice = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
    chunksRef.current = []
  }, [])

  const startVoice = useCallback(async () => {
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
        cleanupVoice()
        if (blob.size === 0) {
          setVoiceState('idle')
          return
        }
        setVoiceState('processing')
        try {
          // 1) Transcribe
          const fd = new FormData()
          fd.append('audio', blob)
          const tRes = await fetch('/api/transcribe', { method: 'POST', body: fd })
          if (!tRes.ok) throw new Error('transcribe failed')
          const { text } = await tRes.json()
          if (!text) {
            setVoiceState('idle')
            return
          }

          // 2) Parse compose delta
          const rRes = await fetch('/api/ai/compose-refine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transcript: text,
              channel,
              current: { subject, body: message },
            }),
          })
          if (!rRes.ok) throw new Error('refine failed')
          const delta = await rRes.json()

          // Apply delta
          if (Array.isArray(delta.recipients_added) && delta.recipients_added.length > 0) {
            setRecipients((prev) => {
              const existing = new Set(prev.map((p) => p.id))
              const additions: ContactMatch[] = delta.recipients_added
                .map((r: any) => ({
                  id: String(r.id),
                  nome: String(r.nome ?? ''),
                  telemovel: r.telemovel ? String(r.telemovel) : undefined,
                  email: r.email ? String(r.email) : undefined,
                  nif: r.nif ? String(r.nif) : undefined,
                }))
                .filter((c: ContactMatch) => !existing.has(c.id))
              return [...prev, ...additions]
            })
          }
          if (Array.isArray(delta.recipients_not_found) && delta.recipients_not_found.length > 0) {
            toast.warning(
              `Não encontrei: ${delta.recipients_not_found.join(', ')}`
            )
          }
          if (typeof delta.subject === 'string' && delta.subject.trim()) {
            setSubject(delta.subject.trim())
          }
          if (typeof delta.body === 'string' && delta.body.trim()) {
            if (delta.body_action === 'append') {
              setMessage((prev) => (prev ? `${prev}\n${delta.body}` : delta.body))
            } else {
              setMessage(delta.body)
            }
          }

          setVoiceState('idle')

          // Send now? Defer to doSend via latest state (next tick).
          if (delta.send_now) {
            setTimeout(() => {
              // Re-check conditions with potentially-updated state
              // (doSend is stable-ish via deps; we still need latest state)
              void doSend()
            }, 0)
          }
        } catch {
          toast.error('Não consegui perceber. Tenta outra vez.')
          setVoiceState('idle')
        }
      }
      recorder.start()
      setVoiceState('recording')
    } catch {
      toast.error('Não foi possível aceder ao microfone.')
      setVoiceState('idle')
    }
  }, [channel, subject, message, cleanupVoice, doSend])

  const stopVoice = useCallback(() => {
    if (mediaRecorderRef.current && voiceState === 'recording') {
      mediaRecorderRef.current.stop()
      setVoiceState('processing')
    }
  }, [voiceState])

  useEffect(() => () => cleanupVoice(), [cleanupVoice])

  const inputCls =
    'bg-white/5 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/40 h-9 text-sm'

  const visibleDefaults = defaultContacts.filter((c) => !recipients.some((r) => r.id === c.id))

  return (
    <div className="mt-6 text-left">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar aos resultados
      </button>

      <div className="rounded-2xl bg-white/10 border border-white/20 p-5 space-y-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <ChannelIcon className="h-4 w-4" />
            Enviar por {channelLabel}
          </div>
          <VoiceMicButton
            state={voiceState}
            onStart={startVoice}
            onStop={stopVoice}
          />
        </div>

        <div className="rounded-lg bg-white/5 ring-1 ring-white/10 px-3 py-2 text-xs">
          <p className="text-white/50 mb-0.5">A enviar:</p>
          <p className="text-white font-medium truncate">{result.title}</p>
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">
            Destinatários {recipients.length > 0 && <span className="text-white/40">({recipients.length})</span>}
          </label>

          {recipients.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {recipients.map((r) => {
                const hasChannel = channel === 'email' ? Boolean(r.email) : Boolean(r.telemovel)
                return (
                  <span
                    key={r.id}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]',
                      hasChannel
                        ? 'bg-emerald-500/15 ring-1 ring-emerald-500/30 text-white'
                        : 'bg-red-500/15 ring-1 ring-red-500/40 text-red-100'
                    )}
                  >
                    <User className="h-3 w-3" />
                    <span className="font-medium">{r.nome}</span>
                    {!hasChannel && (
                      <span className="text-red-200/80">
                        sem {channel === 'email' ? 'email' : 'telemóvel'}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeRecipient(r.id)}
                      className="text-white/50 hover:text-white ml-0.5"
                      aria-label="Remover"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              })}
            </div>
          )}

          <Input
            value={recipientQuery}
            onChange={(e) => setRecipientQuery(e.target.value)}
            placeholder="Escreve um nome para procurar…"
            className={inputCls}
          />

          {searching && (
            <p className="mt-1 text-[11px] text-white/40 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              A procurar…
            </p>
          )}

          {matches.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {matches
                .filter((m) => !recipients.some((r) => r.id === m.id))
                .map((m) => (
                  <ContactChip key={m.id} contact={m} channel={channel} onPick={addRecipient} />
                ))}
            </div>
          ) : recipientQuery.trim().length < 2 && visibleDefaults.length > 0 ? (
            <div className="mt-2">
              <p className="text-[11px] text-white/40 mb-1">Sugestões:</p>
              <div className="flex flex-wrap gap-1.5">
                {visibleDefaults.map((m) => (
                  <ContactChip key={m.id} contact={m} channel={channel} onPick={addRecipient} />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {channel === 'email' && (
          <div>
            <label className="text-xs text-white/60 mb-1 block">Assunto</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={inputCls}
            />
          </div>
        )}

        <div>
          <label className="text-xs text-white/60 mb-1 block">Mensagem</label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="bg-white/5 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/40 text-sm resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onBack} className="text-white hover:bg-white/10">
            Cancelar
          </Button>
          <Button onClick={doSend} disabled={!canSend}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                A enviar…
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-1.5" />
                Enviar{validRecipients.length > 1 ? ` (${validRecipients.length})` : ''}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ContactChip({
  contact,
  channel,
  onPick,
}: {
  contact: ContactMatch
  channel: 'email' | 'whatsapp'
  onPick: (c: ContactMatch) => void
}) {
  const hasChannel = channel === 'email' ? Boolean(contact.email) : Boolean(contact.telemovel)
  return (
    <button
      type="button"
      onClick={() => onPick(contact)}
      disabled={!hasChannel}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition-colors',
        hasChannel
          ? 'bg-white/10 hover:bg-white/20 text-white'
          : 'bg-white/5 text-white/40 cursor-not-allowed'
      )}
    >
      <Plus className="h-3 w-3" />
      <span className="font-medium">{contact.nome}</span>
      <span className="text-white/50">
        {channel === 'email' ? contact.email ?? 'sem email' : contact.telemovel ?? 'sem tel.'}
      </span>
    </button>
  )
}

function VoiceMicButton({
  state,
  onStart,
  onStop,
}: {
  state: 'idle' | 'recording' | 'processing'
  onStart: () => void
  onStop: () => void
}) {
  const handleClick = state === 'recording' ? onStop : state === 'idle' ? onStart : undefined
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === 'processing'}
      data-no-long-press
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-colors',
        state === 'recording'
          ? 'bg-red-500/40 text-white ring-1 ring-red-500/60'
          : 'bg-white/10 text-white hover:bg-white/20'
      )}
      title={state === 'recording' ? 'Parar' : 'Falar para adicionar ou mudar'}
    >
      {state === 'processing' ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : state === 'recording' ? (
        <Square className="h-3 w-3 fill-current" />
      ) : (
        <Mic className="h-3.5 w-3.5" />
      )}
      <span>{state === 'recording' ? 'A ouvir…' : state === 'processing' ? 'A pensar…' : 'Falar'}</span>
    </button>
  )
}

function defaultMessage(result: VoiceSearchResult, channel: 'email' | 'whatsapp'): string {
  if (result.kind === 'property') {
    const metaLine = result.meta ? `\n${result.meta}` : ''
    if (channel === 'email') {
      return `Olá,\n\nPartilho contigo um imóvel que pode interessar:\n\n${result.title}${metaLine}\n\nVê aqui: ${result.url}\n\nCumprimentos`
    }
    return `Olá! Partilho este imóvel:\n${result.title}${metaLine}\n${result.url}`
  }
  if (channel === 'email') {
    return `Olá,\n\nSegue o ficheiro que pediste: "${result.title}".\n\n${result.url}\n\nCumprimentos`
  }
  return `Olá! Segue o ficheiro: ${result.title}\n${result.url}`
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === ''
}

function EditableFieldRow({
  field,
  value,
  onChange,
  isRequired,
}: {
  field: FieldConfig
  value: unknown
  onChange: (value: unknown) => void
  isRequired: boolean
}) {
  const empty = isEmpty(value)
  const rowCls = empty
    ? isRequired
      ? 'bg-red-500/15 ring-1 ring-red-500/40'
      : 'bg-amber-500/10 ring-1 ring-amber-500/25'
    : 'bg-white/5 ring-1 ring-white/10'

  const labelCls = empty
    ? isRequired
      ? 'text-red-200/90'
      : 'text-amber-200/80'
    : 'text-white/60'

  return (
    <div className={cn('flex items-start gap-3 rounded-lg px-3 py-2', rowCls)}>
      <label className={cn('w-[110px] shrink-0 pt-1.5 text-xs', labelCls)}>
        {field.label}
        {isRequired && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      <div className="flex-1 min-w-0">
        <FieldInput field={field} value={value} onChange={onChange} />
        {empty && (
          <p className={cn(
            'mt-1 text-[11px] flex items-center gap-1',
            isRequired ? 'text-red-200/80' : 'text-amber-200/60'
          )}>
            <AlertCircle className="h-3 w-3" />
            {isRequired ? 'em falta' : 'opcional'}
          </p>
        )}
      </div>
    </div>
  )
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldConfig
  value: unknown
  onChange: (value: unknown) => void
}) {
  const type = field.inputType || 'text'
  const inputCls =
    'bg-white/5 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/40 h-8 text-sm'

  if (type === 'textarea') {
    return (
      <Textarea
        value={value == null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={field.placeholder}
        className="bg-white/5 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/40 text-sm resize-none"
      />
    )
  }

  if (type === 'select') {
    const str = value == null ? '' : String(value)
    return (
      <Select value={str} onValueChange={(v) => onChange(v)}>
        <SelectTrigger
          className={cn(inputCls, 'w-full')}
          // Stop clicks from being mistaken for long-press trigger
          data-no-long-press
        >
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent
          position="popper"
          sideOffset={4}
          className="z-[300] max-h-[min(18rem,60vh)]"
          data-no-long-press
        >
          {field.options?.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <Input
      type={type}
      value={value == null ? '' : String(value)}
      onChange={(e) => {
        const raw = e.target.value
        if (type === 'number') {
          onChange(raw === '' ? '' : Number(raw))
        } else {
          onChange(raw)
        }
      }}
      placeholder={field.placeholder}
      inputMode={type === 'number' ? 'decimal' : type === 'tel' ? 'tel' : undefined}
      className={inputCls}
    />
  )
}

// ── Proprietário match hint ──────────────────────────────────────────────
// Shown below the main_owner_name row: debounced search against /api/leads
// so the user can adopt an existing contacto (pre-fills phone/email).

interface ContactMatch {
  id: string
  nome: string
  telemovel?: string
  email?: string
  nif?: string
}

function OwnerMatchHint({
  name,
  onAdopt,
}: {
  name: string
  onAdopt: (match: ContactMatch) => void
}) {
  const [matches, setMatches] = useState<ContactMatch[]>([])
  const [adopted, setAdopted] = useState<ContactMatch | null>(null)
  const trimmed = (name ?? '').trim()

  // Unlink if the user edits the name so it no longer matches the adopted contact.
  useEffect(() => {
    if (adopted && adopted.nome.trim().toLowerCase() !== trimmed.toLowerCase()) {
      setAdopted(null)
    }
  }, [trimmed, adopted])

  useEffect(() => {
    if (adopted) return // skip fetching while a contact is already linked
    if (trimmed.length < 3) {
      setMatches([])
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/leads?nome=${encodeURIComponent(trimmed)}&limit=5`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (cancelled) return
        const raw = Array.isArray(data) ? data : data?.data || []
        setMatches(
          raw.slice(0, 4).map((r: any) => ({
            id: String(r.id),
            nome: String(r.nome ?? ''),
            telemovel: r.telemovel ? String(r.telemovel) : undefined,
            email: r.email ? String(r.email) : undefined,
            nif: r.nif ? String(r.nif) : undefined,
          }))
        )
      } catch {
        if (!cancelled) setMatches([])
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [trimmed, adopted])

  const handlePick = (m: ContactMatch) => {
    onAdopt(m)
    setAdopted(m)
  }

  if (adopted) {
    return (
      <div className="mt-1.5 rounded-md bg-emerald-500/15 ring-1 ring-emerald-500/30 px-2.5 py-2 text-xs text-left flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-emerald-100 min-w-0">
          <UserCheck className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            Ligado a contacto <span className="font-medium">{adopted.nome}</span>
          </span>
        </span>
        <button
          type="button"
          onClick={() => setAdopted(null)}
          className="text-emerald-200/80 hover:text-white text-[11px] shrink-0"
        >
          Mudar
        </button>
      </div>
    )
  }

  if (!trimmed || matches.length === 0) return null

  return (
    <div className="mt-1.5 rounded-md bg-sky-500/15 ring-1 ring-sky-500/30 px-2.5 py-2 text-xs text-left">
      <p className="flex items-center gap-1.5 text-sky-200/90 mb-1.5">
        <UserCheck className="h-3.5 w-3.5" />
        Contacto existente? Toca para pré-preencher:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {matches.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => handlePick(m)}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-2.5 py-1 text-white transition-colors text-[11px]"
          >
            <User className="h-3 w-3" />
            <span className="font-medium">{m.nome}</span>
            {m.telemovel && <span className="text-white/50">· {m.telemovel}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
