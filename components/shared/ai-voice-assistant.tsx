'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, Award, Briefcase, Building2, Check, ChevronDown, ExternalLink, FileText, Handshake, Image as ImageIcon, Link2, Loader2, Mail, MessageCircle, Mic, Plus, Search, Send, Square, Star, Trash2, User, UserCheck, X } from 'lucide-react'
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
  LEAD_SOURCE_OPTIONS,
  TOOL_CONFIGS,
  buildAngariacaoArgsFromPrefill,
  buildFechoArgsFromNegocio,
  getMissingRequired,
  isRequiredField,
  parseEntityFromPath,
  propertyRowToResult,
  type ContactPickerRequest,
  type DirectMessage,
  type EntityContext,
  type FieldConfig,
  type FollowUp,
  type FollowUpChannel,
  type LeadNote,
  type LeadNoteNegocioOption,
  type AttachDocumentRequest,
  type PropertyBasket,
  type PropertyDescriptionRequest,
  type VoiceSearchRecipient,
  type VoiceSearchResult,
} from '@/lib/voice/tool-configs'
import {
  NegocioPickerDialog,
  type NegocioPickerItem,
} from '@/components/negocios/negocio-picker-dialog'
import { buildAcquisitionPrefillFromNegocio } from '@/lib/negocios/prefill-from-negocio'
import { renderPropertyGrid } from '@/lib/email/property-card-html'
import { wrapEmailHtml } from '@/lib/email-renderer'

// ── Shared consultants cache ──────────────────────────────────────────────
// Module-level so mounting multiple overlays / batch rows reuses the same
// fetch; one-time warm load per session.
type Consultant = { id: string; commercial_name: string }
let consultantsCache: Consultant[] | null = null
let consultantsPromise: Promise<Consultant[]> | null = null

function loadConsultants(): Promise<Consultant[]> {
  if (consultantsCache) return Promise.resolve(consultantsCache)
  if (consultantsPromise) return consultantsPromise
  consultantsPromise = fetch('/api/users/consultants')
    .then((r) => (r.ok ? r.json() : []))
    .then((data) => {
      const list = Array.isArray(data) ? data : data?.data || []
      const normalized: Consultant[] = list.map((c: any) => ({
        id: String(c.id),
        commercial_name: String(c.commercial_name ?? ''),
      }))
      consultantsCache = normalized
      return normalized
    })
    .catch(() => {
      consultantsCache = []
      return [] as Consultant[]
    })
  return consultantsPromise
}

function useConsultants(): { consultants: Consultant[]; loaded: boolean } {
  const [consultants, setConsultants] = useState<Consultant[]>(consultantsCache ?? [])
  const [loaded, setLoaded] = useState<boolean>(consultantsCache !== null)
  useEffect(() => {
    if (consultantsCache) return
    let cancelled = false
    loadConsultants().then((list) => {
      if (cancelled) return
      setConsultants(list)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return { consultants, loaded }
}

/** Fuzzy-match a free-form consultant name (from voice) to a known consultant. */
function resolveConsultantByName(
  name: string | undefined | null,
  list: Consultant[]
): Consultant | null {
  const needle = String(name ?? '').toLowerCase().trim()
  if (!needle || list.length === 0) return null
  return (
    list.find((c) => c.commercial_name.toLowerCase() === needle) ||
    list.find((c) => c.commercial_name.toLowerCase().includes(needle)) ||
    list.find((c) => {
      const first = c.commercial_name.toLowerCase().split(' ')[0]
      return first ? needle.includes(first) : false
    }) ||
    null
  )
}

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
  const [basket, setBasket] = useState<PropertyBasket | null>(null)
  const [directMessage, setDirectMessage] = useState<DirectMessage | null>(null)
  const [leadNote, setLeadNote] = useState<LeadNote | null>(null)
  const [followUp, setFollowUp] = useState<FollowUp | null>(null)
  const [propertyDescription, setPropertyDescription] =
    useState<PropertyDescriptionRequest | null>(null)
  const [attachDocument, setAttachDocument] = useState<AttachDocumentRequest | null>(null)
  const [contactPicker, setContactPicker] = useState<ContactPickerRequest | null>(null)

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
  const autoSubmitFiredRef = useRef(false)

  useEffect(() => {
    intentRef.current = intent
  }, [intent])

  // Reset the auto-submit guard whenever the intent identity changes (a
  // brand new voice capture). Keeps us from re-firing on every args edit.
  useEffect(() => {
    if (!intent) autoSubmitFiredRef.current = false
  }, [intent?.tool])

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

        // Normalise tool-specific shortcuts the model may use. The textarea
        // expects a newline-joined string — voice returns an array.
        const rawArgs = { ...(data.args || {}) }
        if (toolName === 'send_property') {
          const existingText = String(rawArgs.property_queries_text ?? '').trim()
          const queries = Array.isArray(rawArgs.property_queries)
            ? rawArgs.property_queries.map((q: unknown) => String(q).trim()).filter(Boolean)
            : []
          if (!existingText && queries.length > 0) {
            rawArgs.property_queries_text = queries.join('\n')
          }
          // Keep legacy property_query working: fold it into queries_text.
          if (!existingText && queries.length === 0 && rawArgs.property_query) {
            rawArgs.property_queries_text = String(rawArgs.property_query)
          }
        }

        setIntent({
          tool: toolName,
          args: rawArgs,
          confirmText: data.confirmText || TOOL_CONFIGS[toolName].title,
          confidence: data.confidence ?? null,
        })
        // Auto-submit tools (search_document, open_link, search_partner)
        // skip the review screen entirely — jump straight to 'submitting'
        // so the review panel never paints for a frame.
        const cfg = TOOL_CONFIGS[toolName]
        const canSubmitInitial = cfg.canSubmit
          ? cfg.canSubmit(rawArgs)
          : getMissingRequired(toolName, rawArgs).length === 0
        const willAutoSubmit = cfg.autoSubmit && canSubmitInitial
        setState(willAutoSubmit ? 'submitting' : 'reviewing')
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
    setBasket(null)
    setDirectMessage(null)
    setLeadNote(null)
    setFollowUp(null)
    setPropertyDescription(null)
    setAttachDocument(null)
    setContactPicker(null)
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

  const handleArgsMerge = useCallback((delta: Record<string, unknown>) => {
    setIntent((prev) => (prev ? { ...prev, args: { ...prev.args, ...delta } } : prev))
    setErrorMessage('')
  }, [])

  // Resolve a voice-captured consultant name to an id for create_lead once
  // the consultants list is warm. Batch-row resolution happens inside
  // BatchLeadsList itself, close to where the rows live.
  useEffect(() => {
    if (!intent || intent.tool !== 'create_lead') return
    const name = intent.args.assigned_consultant_name
    const id = intent.args.assigned_consultant_id
    if (!name || id) return
    let cancelled = false
    loadConsultants().then((list) => {
      if (cancelled) return
      const match = resolveConsultantByName(String(name), list)
      if (match) handleArgChange('assigned_consultant_id', match.id)
    })
    return () => {
      cancelled = true
    }
  }, [intent, handleArgChange])

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
      const entity = parseEntityFromPath(pathname)
      const result = await cfg.submit(intent.args, {
        router,
        userId: user?.id,
        entity,
      })
      if (result.basket) {
        setBasket(result.basket)
        setState('results')
        return
      }
      if (result.contactPicker) {
        setContactPicker(result.contactPicker)
        setState('results')
        return
      }
      if (result.directMessage) {
        setDirectMessage(result.directMessage)
        setState('results')
        return
      }
      if (result.leadNote) {
        setLeadNote(result.leadNote)
        setState('results')
        return
      }
      if (result.followUp) {
        setFollowUp(result.followUp)
        setState('results')
        return
      }
      if (result.propertyDescription) {
        setPropertyDescription(result.propertyDescription)
        setState('results')
        return
      }
      if (result.attachDocument) {
        setAttachDocument(result.attachDocument)
        setState('results')
        return
      }
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
  }, [intent, router, close, user?.id, pathname])

  // Auto-submit for pure search tools (search_document, open_link,
  // search_partner): skip the review screen and run submit immediately so
  // the user lands straight in the results with an editable search input.
  useEffect(() => {
    if (!intent) return
    if (autoSubmitFiredRef.current) return
    // processAudio primes state to 'submitting' for autoSubmit tools; accept
    // both 'submitting' (fresh voice capture) and 'reviewing' (edge cases).
    if (state !== 'reviewing' && state !== 'submitting') return
    const cfg = TOOL_CONFIGS[intent.tool]
    if (!cfg.autoSubmit) return
    const canSubmit = cfg.canSubmit
      ? cfg.canSubmit(intent.args)
      : getMissingRequired(intent.tool, intent.args).length === 0
    if (!canSubmit) return
    autoSubmitFiredRef.current = true
    void handleSubmit()
  }, [intent, state, handleSubmit])

  // Inline search refinement from the ResultsPanel — re-runs submit with
  // the new query value without leaving the results view.
  const handleInlineSearch = useCallback(
    async (value: string) => {
      if (!intent) return
      const cfg = TOOL_CONFIGS[intent.tool]
      const key = cfg.searchFieldKey
      if (!key) return
      const nextArgs = { ...intent.args, [key]: value }
      setIntent({ ...intent, args: nextArgs })
      try {
        const entity = parseEntityFromPath(pathname)
        const result = await cfg.submit(nextArgs, {
          router,
          userId: user?.id,
          entity,
        })
        if (result.results) {
          setSearchResults(result.results)
        }
      } catch (err) {
        console.error('[voice inline search]', err)
      }
    },
    [intent, pathname, router, user?.id]
  )

  const handleDraftSave = useCallback(async () => {
    if (!intent) return
    const cfg = TOOL_CONFIGS[intent.tool]
    if (!cfg.draft) return

    setErrorMessage('')
    setState('submitting')
    try {
      const entity = parseEntityFromPath(pathname)
      const result = await cfg.draft.submit(intent.args, {
        router,
        userId: user?.id,
        entity,
      })
      toast.success(result.message || 'Rascunho guardado')
      setState('done')
      setTimeout(close, 450)
    } catch (err) {
      setState('reviewing')
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao guardar rascunho.')
    }
  }, [intent, router, close, user?.id, pathname])

  // Global trigger
  useEffect(() => {
    const handler = () => {
      if (open) return
      setOpen(true)
    }
    window.addEventListener('open-voice-assistant', handler)
    return () => window.removeEventListener('open-voice-assistant', handler)
  }, [open])

  // Long-press 3s anywhere → abre o assistente.
  //
  // Modelo simples: a janela de 3 s é maior do que qualquer gesto nativo
  // de cópia (lupa ~500 ms + context-menu ~700 ms–1 s + tap em "Copiar").
  // Se o utilizador copiar, solta o dedo dentro desse intervalo e o
  // pointerup cancela. Se mantiver os 3 s todos, queremos abrir a voz —
  // limpamos qualquer selecção que tenha sido feita, em vez de cancelar.
  //
  // IMPORTANTE: NÃO cancelamos em `pointercancel` porque o iOS Safari
  // dispara esse evento quando o sistema mostra o context-menu nativo
  // de selecção de texto (~1 s no press), o que matava o temporizador
  // antes dos 3 s e fazia o long-press parecer "morto" em zonas de
  // texto. Ficamos só com:
  //   - pointerup — gesto terminou (dedo saiu).
  //   - pointer move > 8 px — scroll ou drag de selection handle.
  // O opt-out por elemento (input/textarea/etc + data-no-long-press)
  // continua porque pressionar um botão/input nunca deve abrir a voz.
  useEffect(() => {
    if (open) return
    let timer: number | null = null
    let startX = 0
    let startY = 0

    const cancel = () => {
      if (timer != null) {
        window.clearTimeout(timer)
        timer = null
      }
    }

    const isOptOut = (target: EventTarget | null): boolean => {
      const el = target as HTMLElement | null
      if (!el || !(el instanceof Element)) return false
      const tag = el.tagName?.toUpperCase()
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        tag === 'BUTTON' ||
        tag === 'A' ||
        tag === 'LABEL' ||
        tag === 'VIDEO' ||
        tag === 'AUDIO' ||
        tag === 'IFRAME' ||
        tag === 'CANVAS'
      )
        return true
      if ((el as HTMLElement).isContentEditable) return true
      if (el.closest('[data-no-long-press]')) return true
      if (el.closest('input, textarea, select, button, a, label, [contenteditable="true"]'))
        return true
      return false
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      if (isOptOut(e.target)) return
      startX = e.clientX
      startY = e.clientY
      cancel()
      timer = window.setTimeout(() => {
        timer = null
        // Se o utilizador chegou aos 3 s, é porque quer voz — limpa
        // qualquer selecção residual antes de abrir o overlay.
        try {
          window.getSelection?.()?.removeAllRanges()
        } catch {}
        try {
          ;(navigator as Navigator & { vibrate?: (v: number) => void }).vibrate?.(15)
        } catch {}
        window.dispatchEvent(new Event('open-voice-assistant'))
      }, 3000)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (timer == null) return
      const dx = Math.abs(e.clientX - startX)
      const dy = Math.abs(e.clientY - startY)
      if (dx > 8 || dy > 8) cancel()
    }

    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('pointermove', onPointerMove, true)
    window.addEventListener('pointerup', cancel, true)
    return () => {
      cancel()
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('pointermove', onPointerMove, true)
      window.removeEventListener('pointerup', cancel, true)
    }
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

  const showBasket = state === 'results' && basket !== null
  const showDirectMessage = state === 'results' && directMessage !== null && !showBasket
  const showLeadNote =
    state === 'results' && leadNote !== null && !showBasket && !showDirectMessage
  const showFollowUp =
    state === 'results' &&
    followUp !== null &&
    !showBasket &&
    !showDirectMessage &&
    !showLeadNote
  const showPropertyDescription =
    state === 'results' &&
    propertyDescription !== null &&
    !showBasket &&
    !showDirectMessage &&
    !showLeadNote &&
    !showFollowUp
  const showAttachDocument =
    state === 'results' &&
    attachDocument !== null &&
    !showBasket &&
    !showDirectMessage &&
    !showLeadNote &&
    !showFollowUp &&
    !showPropertyDescription
  const showContactPicker =
    state === 'results' &&
    contactPicker !== null &&
    !showBasket &&
    !showDirectMessage &&
    !showLeadNote &&
    !showFollowUp &&
    !showPropertyDescription &&
    !showAttachDocument
  const showResults =
    state === 'results' &&
    searchResults !== null &&
    !showBasket &&
    !showDirectMessage &&
    !showLeadNote &&
    !showFollowUp &&
    !showPropertyDescription &&
    !showAttachDocument &&
    !showContactPicker
  // Suppress the review screen entirely while an auto-submit tool is racing
  // to produce results — prevents the old confirmation panel from flashing.
  const isAutoSubmitting =
    intent !== null &&
    TOOL_CONFIGS[intent.tool].autoSubmit === true &&
    (state === 'submitting' || state === 'processing')
  const showReview =
    !showResults &&
    !showBasket &&
    !showDirectMessage &&
    !showLeadNote &&
    !showFollowUp &&
    !showPropertyDescription &&
    !showAttachDocument &&
    !showContactPicker &&
    intent !== null &&
    !isAutoSubmitting
  const showFullMic =
    !intent &&
    !showResults &&
    !showBasket &&
    !showDirectMessage &&
    !showLeadNote &&
    !showFollowUp &&
    !showPropertyDescription &&
    !showAttachDocument &&
    !showContactPicker &&
    !isAutoSubmitting
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
        onPointerDown={(e) => e.stopPropagation()}
        data-no-long-press
        style={{
          // Garante 1) que o X fica sempre ABAIXO da status bar do iOS
          // (~44 px sem env, ~47 px com entalhe) e 2) que tem espaço de
          // respiração mesmo em PWAs onde env() devolve 0. O `max()`
          // toma o maior entre o safe-area + 12 px e 56 px hard floor.
          top: 'max(calc(env(safe-area-inset-top, 0px) + 0.75rem), 3.5rem)',
          right: 'max(calc(env(safe-area-inset-right, 0px) + 0.75rem), 0.75rem)',
        }}
        className="absolute h-12 w-12 md:h-10 md:w-10 rounded-full bg-white/15 text-white hover:bg-white/25 active:bg-white/35 flex items-center justify-center transition-colors z-[110] touch-manipulation ring-1 ring-white/15"
        aria-label="Fechar"
      >
        <X className="h-5 w-5" />
      </button>

      <div className={cn(
        'w-full max-w-md md:max-w-2xl px-6 pb-8 md:pb-10 text-center text-white',
        'max-h-[calc(100vh-1rem)] md:max-h-[calc(100vh-4rem)] overflow-y-auto',
        // Sempre reservamos espaço suficiente no topo para o X (que em
        // mobile fica ao nível ~56–104 px). Vale para o ecrã do mic (
        // "A ouvir…") e para o painel de revisão — em ambos o conteúdo
        // não pode entrar por baixo do botão de fechar.
        'pt-28 md:pt-10'
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
        ) : showBasket ? (
          <>
            <SmallStatus
              state={state}
              amplitude={amplitude}
              onStop={undefined}
              errorMessage={errorMessage}
              transcript={transcript}
            />
            <BasketPanel
              basket={basket!}
              defaultMessage={basket!.defaultMessage ?? ''}
              onBack={() => {
                setBasket(null)
                setState('reviewing')
              }}
              onClose={close}
            />
          </>
        ) : showContactPicker ? (
          <>
            <SmallStatus
              state={state}
              amplitude={amplitude}
              onStop={undefined}
              errorMessage={errorMessage}
              transcript={transcript}
            />
            <ContactPickerPanel
              request={contactPicker!}
              onPicked={async (recipient) => {
                // Resume the follow-up action with the picked contact.
                const req = contactPicker!
                if (req.follow.kind === 'directMessage') {
                  const partial = req.follow.partial
                  // Re-derive channel preference using the picked recipient
                  // so "manda ao João por email" still routes correctly
                  // even if the original voice didn't specify a channel.
                  const ch: 'whatsapp' | 'email' = partial.initialChannel
                    ? partial.initialChannel
                    : recipient.telemovel
                      ? 'whatsapp'
                      : 'email'
                  setDirectMessage({ ...partial, recipient, initialChannel: ch })
                } else if (req.follow.kind === 'leadNote' || req.follow.kind === 'followUp') {
                  // Fetch the picked contact's negócios so the scope
                  // selector is pre-populated.
                  let negocios: LeadNoteNegocioOption[] = []
                  try {
                    const r = await fetch(
                      `/api/negocios?lead_id=${encodeURIComponent(recipient.id)}&limit=20`
                    )
                    if (r.ok) {
                      const d = await r.json()
                      const list: any[] = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []
                      negocios = list.map((n: any) => {
                        const tipo = n.tipo ? String(n.tipo) : undefined
                        const loc = n.localizacao ? String(n.localizacao) : undefined
                        const tipoImovel = n.tipo_imovel ? String(n.tipo_imovel) : undefined
                        const parts = [tipoImovel || tipo, loc].filter(Boolean)
                        return {
                          id: String(n.id),
                          label: parts.join(' · ') || 'Negócio',
                          tipo,
                          localizacao: loc,
                        }
                      })
                    }
                  } catch {
                    // ignore — panel will render without the scope selector
                  }
                  if (req.follow.kind === 'leadNote') {
                    setLeadNote({
                      contact: recipient,
                      negocios,
                      initialNote: req.follow.partial.initialNote,
                    })
                  } else {
                    setFollowUp({
                      contact: recipient,
                      negocios,
                      ...req.follow.partial,
                    })
                  }
                }
                setContactPicker(null)
              }}
              onBack={() => {
                setContactPicker(null)
                setState('reviewing')
              }}
              onClose={close}
            />
          </>
        ) : showDirectMessage ? (
          <>
            <SmallStatus
              state={state}
              amplitude={amplitude}
              onStop={undefined}
              errorMessage={errorMessage}
              transcript={transcript}
            />
            <DirectMessagePanel
              data={directMessage!}
              onBack={() => {
                setDirectMessage(null)
                setState('reviewing')
              }}
              onSent={close}
              onChangeRecipient={(fields) => {
                // Swap to the picker while keeping whatever the user already
                // typed/edited in the direct-message panel. On pick, the
                // existing contactPicker handler restores the panel with
                // the new recipient + preserved fields.
                setContactPicker({
                  query: directMessage!.recipient.nome,
                  candidates: [directMessage!.recipient],
                  follow: {
                    kind: 'directMessage',
                    partial: {
                      initialChannel: fields.channel,
                      initialMessage: fields.message,
                      initialSubject: fields.subject || undefined,
                      initialScheduledAt: fields.scheduledAt || undefined,
                    },
                  },
                })
                setDirectMessage(null)
              }}
            />
          </>
        ) : showLeadNote ? (
          <>
            <SmallStatus
              state={state}
              amplitude={amplitude}
              onStop={undefined}
              errorMessage={errorMessage}
              transcript={transcript}
            />
            <AddNotePanel
              data={leadNote!}
              onBack={() => {
                setLeadNote(null)
                setState('reviewing')
              }}
              // After saving, jump to the contact's detail page so the user
              // can SEE the note in the timeline — avoids the perceived
              // "saved nowhere" problem when multiple leads share a name.
              onSaved={() => {
                const id = leadNote?.contact.id
                if (id) router.push(`/dashboard/leads/${id}?tab=historico`)
                close()
              }}
              onChangeRecipient={(currentNote) => {
                // Preserve typed note; user re-picks contact.
                setContactPicker({
                  query: leadNote!.contact.nome,
                  candidates: [leadNote!.contact],
                  follow: {
                    kind: 'leadNote',
                    partial: { initialNote: currentNote },
                  },
                })
                setLeadNote(null)
              }}
            />
          </>
        ) : showPropertyDescription ? (
          <>
            <SmallStatus
              state={state}
              amplitude={amplitude}
              onStop={undefined}
              errorMessage={errorMessage}
              transcript={transcript}
            />
            <PropertyDescriptionPanel
              data={propertyDescription!}
              onBack={() => {
                setPropertyDescription(null)
                setState('reviewing')
              }}
              onSaved={close}
            />
          </>
        ) : showAttachDocument ? (
          <>
            <SmallStatus
              state={state}
              amplitude={amplitude}
              onStop={undefined}
              errorMessage={errorMessage}
              transcript={transcript}
            />
            <AttachDocumentPanel
              data={attachDocument!}
              onBack={() => {
                setAttachDocument(null)
                setState('reviewing')
              }}
              onSaved={close}
            />
          </>
        ) : showFollowUp ? (
          <>
            <SmallStatus
              state={state}
              amplitude={amplitude}
              onStop={undefined}
              errorMessage={errorMessage}
              transcript={transcript}
            />
            <FollowUpPanel
              data={followUp!}
              onBack={() => {
                setFollowUp(null)
                setState('reviewing')
              }}
              onSaved={close}
              onChangeRecipient={(current) => {
                setContactPicker({
                  query: followUp!.contact.nome,
                  candidates: [followUp!.contact],
                  follow: {
                    kind: 'followUp',
                    partial: {
                      initialDueDate: current.dueDate,
                      initialChannel: current.channel,
                      initialNotes: current.notes || undefined,
                    },
                  },
                })
                setFollowUp(null)
              }}
            />
          </>
        ) : isAutoSubmitting ? (
          <>
            <SmallStatus
              state={state}
              amplitude={amplitude}
              onStop={undefined}
              errorMessage={errorMessage}
              transcript={transcript}
            />
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-white/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              A procurar…
            </div>
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
              query={(() => {
                if (!intent) return ''
                const cfg = TOOL_CONFIGS[intent.tool]
                const key = cfg.searchFieldKey || 'query'
                return String(intent.args?.[key] ?? '')
              })()}
              results={searchResults!}
              inlineEditable={
                intent
                  ? Boolean(TOOL_CONFIGS[intent.tool].autoSubmit)
                  : false
              }
              onInlineChange={handleInlineSearch}
              onRestartVoice={() => {
                // Full restart: drop results + intent, hop back to mic state
                // so the user can dictate a completely different action.
                setSearchResults(null)
                setIntent(null)
                intentRef.current = null
                autoSubmitFiredRef.current = false
                setTranscript('')
                setErrorMessage('')
                setState('idle')
                startRecording()
              }}
              onNewSearch={() => {
                setSearchResults(null)
                setState('reviewing')
              }}
              onClose={close}
              isRecording={isRecording}
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
              entity={parseEntityFromPath(pathname)}
              isRecording={isRecording}
              isBusy={isBusy}
              errorMessage={errorMessage}
              onContinue={startRecording}
              onSubmit={handleSubmit}
              onDraftSave={handleDraftSave}
              onArgChange={handleArgChange}
              onArgsMerge={handleArgsMerge}
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

const ENTITY_LINKED_TOOLS: VoiceToolName[] = [
  'create_todo',
  'create_reminder',
  'create_call_log',
]

function ReviewPanel({
  intent,
  entity,
  isRecording,
  isBusy,
  errorMessage,
  onContinue,
  onSubmit,
  onDraftSave,
  onArgChange,
  onArgsMerge,
}: {
  intent: Intent
  entity: EntityContext | null
  isRecording: boolean
  isBusy: boolean
  errorMessage: string
  onContinue: () => void
  onSubmit: () => void
  onDraftSave: () => void
  onArgChange: (key: string, value: unknown) => void
  onArgsMerge: (delta: Record<string, unknown>) => void
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

  const showEntityHint = entity && ENTITY_LINKED_TOOLS.includes(intent.tool)
  const entityTypeLabel: Record<EntityContext['type'], string> = {
    lead: 'este contacto',
    negocio: 'este negócio',
    property: 'este imóvel',
    process: 'este processo',
  }

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

      {showEntityHint && entity && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 ring-1 ring-sky-500/30 px-2.5 py-1 text-[11px] text-sky-100">
          <User className="h-3 w-3" />
          Será associado a {entityTypeLabel[entity.type]}
        </div>
      )}

      {(intent.tool === 'create_angariacao' || intent.tool === 'create_fecho') && (
        <NegocioLinkBanner
          tool={intent.tool}
          args={intent.args}
          onApply={(n) => {
            if (intent.tool === 'create_angariacao') {
              const prefill = buildAcquisitionPrefillFromNegocio(n as any)
              const delta = buildAngariacaoArgsFromPrefill(prefill)
              onArgsMerge({
                ...delta,
                negocio_id: n.id,
                negocio_label:
                  `${n.lead?.full_name || n.lead?.nome || 'Lead'} · ${n.tipo}`,
              })
              toast.success('Pré-preenchido a partir do negócio')
            } else {
              const delta = buildFechoArgsFromNegocio(n as any)
              onArgsMerge({
                ...delta,
                negocio_id: n.id,
                negocio_label:
                  `${n.lead?.full_name || n.lead?.nome || 'Lead'} · ${n.tipo}`,
              })
              toast.success('Pré-preenchido a partir do negócio')
            }
          }}
          onClear={() =>
            onArgsMerge({ negocio_id: '', negocio_label: '' })
          }
        />
      )}

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
                  {(intent.tool === 'create_visit' || intent.tool === 'create_lead') && field.key === 'property_query' && (
                    <PropertyMatchHint
                      query={String(intent.args.property_query ?? '')}
                      adoptedId={
                        intent.args.resolved_property_id
                          ? String(intent.args.resolved_property_id)
                          : undefined
                      }
                      onAdopt={(match) => {
                        // Replace the free-text query with the real title so
                        // the green banner is stable even if the user keeps
                        // speaking and the matches list changes.
                        onArgChange('property_query', match.title)
                        onArgChange('resolved_property_id', match.id)
                      }}
                      onUnlink={() => onArgChange('resolved_property_id', '')}
                    />
                  )}
                  {intent.tool === 'create_visit' && field.key === 'contact_name' && (
                    <OwnerMatchHint
                      name={String(intent.args.contact_name ?? '')}
                      onAdopt={(match) => {
                        onArgChange('contact_name', match.nome)
                        onArgChange('resolved_lead_id', match.id)
                        if (match.telemovel) onArgChange('client_phone', match.telemovel)
                        if (match.email) onArgChange('client_email', match.email)
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

// ── Negocio link banner (create_angariacao / create_fecho) ────────────────
// Espelha o banner "É de um negócio existente?" do AcquisitionFormV2 e do
// DealForm — restringe `filterTipos` consoante a tool, abre o picker comum,
// e ao escolher chama `onApply` para pré-preencher os args.

function NegocioLinkBanner({
  tool,
  args,
  onApply,
  onClear,
}: {
  tool: 'create_angariacao' | 'create_fecho'
  args: Record<string, any>
  onApply: (n: NegocioPickerItem) => void
  onClear: () => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const linkedId = args.negocio_id ? String(args.negocio_id) : ''
  const linkedLabel = args.negocio_label ? String(args.negocio_label) : ''
  const initialQuery =
    !linkedId && typeof args.existing_negocio_query === 'string'
      ? args.existing_negocio_query
      : ''
  const filterTipos: Array<'Compra' | 'Venda' | 'Arrendatário' | 'Arrendador'> =
    tool === 'create_angariacao'
      ? ['Venda', 'Arrendador']
      : ['Compra', 'Venda', 'Arrendatário', 'Arrendador']
  const description =
    tool === 'create_angariacao'
      ? 'Pré-preenche tipo, valor e tipo de imóvel a partir do negócio.'
      : 'Pré-preenche o cliente, valor e tipo. Podes ajustar depois.'
  return (
    <>
      <div className="mt-3 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 flex items-center gap-2 flex-wrap">
        <Briefcase className="h-3.5 w-3.5 text-white/60 shrink-0" />
        {linkedId ? (
          <>
            <span className="text-xs text-white/60">Vinculado a</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 ring-1 ring-white/15 px-2.5 py-1 text-xs font-medium text-white">
              <Link2 className="h-3 w-3 text-white/60" />
              {linkedLabel || 'Negócio'}
            </span>
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-white/60 hover:text-white underline-offset-4 hover:underline ml-auto"
            >
              Limpar
            </button>
          </>
        ) : initialQuery ? (
          <>
            <span className="text-xs text-white/70">
              Mencionaste um negócio existente:{' '}
              <span className="text-white">"{initialQuery}"</span>
            </span>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="text-xs font-medium text-sky-300 hover:text-sky-200 hover:underline ml-auto"
            >
              Escolher
            </button>
          </>
        ) : (
          <>
            <span className="text-xs text-white/70">É de um negócio existente?</span>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="text-xs font-medium text-sky-300 hover:text-sky-200 hover:underline ml-auto"
            >
              Escolher negócio
            </button>
          </>
        )}
      </div>
      <NegocioPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Escolher negócio existente"
        description={description}
        filterTipos={filterTipos}
        initialQuery={initialQuery}
        onSelect={onApply}
      />
    </>
  )
}

// ── Batch leads list ──────────────────────────────────────────────────────

type BatchLeadRow = {
  nome?: string
  telemovel?: string
  email?: string
  source?: string
  assigned_consultant_id?: string
  assigned_consultant_name?: string
}

function BatchLeadsList({
  args,
  onArgChange,
}: {
  args: Record<string, any>
  onArgChange: (key: string, value: unknown) => void
}) {
  const leads: BatchLeadRow[] = Array.isArray(args.leads) ? args.leads : []
  const { consultants } = useConsultants()

  // Fuzzy-match the batch-level consultant name → id once the list loads.
  useEffect(() => {
    if (args.assigned_consultant_id) return
    if (!args.assigned_consultant_name) return
    if (consultants.length === 0) return
    const match = resolveConsultantByName(args.assigned_consultant_name, consultants)
    if (match) onArgChange('assigned_consultant_id', match.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultants, args.assigned_consultant_name])

  // Fuzzy-match per-row consultant names → ids (for when GPT placed the
  // name directly on the lead entry rather than at the batch level).
  useEffect(() => {
    if (consultants.length === 0) return
    let changed = false
    const next = leads.map((l) => {
      if (l.assigned_consultant_id || !l.assigned_consultant_name) return l
      const match = resolveConsultantByName(l.assigned_consultant_name, consultants)
      if (!match) return l
      changed = true
      return { ...l, assigned_consultant_id: match.id }
    })
    if (changed) onArgChange('leads', next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultants, leads.length])

  const update = (
    idx: number,
    field: keyof BatchLeadRow,
    value: string | undefined
  ) => {
    const next = leads.map((l, i) =>
      i === idx ? { ...l, [field]: value === '' ? undefined : value } : l
    )
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
  const defaultSource = args.default_source ? String(args.default_source) : ''
  const defaultSourceLabel =
    LEAD_SOURCE_OPTIONS.find((o) => o.value === defaultSource)?.label || 'igual ao grupo'
  const defaultAssigneeLabel = assignedId
    ? consultants.find((c) => c.id === assignedId)?.commercial_name || 'igual ao grupo'
    : 'igual ao grupo'

  return (
    <div className="space-y-3">
      {/* Shared defaults for the whole batch */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="flex items-center gap-3 rounded-lg bg-white/5 ring-1 ring-white/10 px-3 py-2">
          <label className="w-[72px] shrink-0 text-xs text-white/60">Atribuir a</label>
          <div className="flex-1 min-w-0" data-no-long-press>
            <ConsultantSelect
              value={assignedId}
              onChange={(v) => onArgChange('assigned_consultant_id', v)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg bg-white/5 ring-1 ring-white/10 px-3 py-2">
          <label className="w-[72px] shrink-0 text-xs text-white/60">Origem</label>
          <div className="flex-1 min-w-0" data-no-long-press>
            <Select
              value={defaultSource}
              onValueChange={(v) => onArgChange('default_source', v)}
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
                {LEAD_SOURCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-white/40 px-1">
        Os valores acima aplicam-se a todos os leads. Podes sobrepor individualmente em cada linha abaixo.
      </p>

      {leads.length === 0 && (
        <div className="rounded-lg bg-amber-500/10 ring-1 ring-amber-500/25 px-3 py-3 text-xs text-amber-200/80">
          Fala os nomes dos leads — ou adiciona uma linha manualmente.
        </div>
      )}

      {leads.map((lead, i) => {
        const missing = !lead.nome || !String(lead.nome).trim()
        const rowSource = lead.source ? String(lead.source) : ''
        const rowAssignee = lead.assigned_consultant_id
          ? String(lead.assigned_consultant_id)
          : ''
        return (
          <div
            key={i}
            className={cn(
              'flex items-start gap-2 rounded-lg px-2 py-2',
              missing ? 'bg-red-500/15 ring-1 ring-red-500/40' : 'bg-white/5 ring-1 ring-white/10'
            )}
          >
            <span className="w-5 shrink-0 pt-2 text-center text-xs text-white/40">{i + 1}</span>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <div data-no-long-press>
                  <Select
                    value={rowSource}
                    onValueChange={(v) => update(i, 'source', v)}
                  >
                    <SelectTrigger className={cn(inputCls, 'w-full')} data-no-long-press>
                      <SelectValue placeholder={`Origem (${defaultSourceLabel})`} />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      sideOffset={4}
                      className="z-[300] max-h-[min(18rem,60vh)]"
                      data-no-long-press
                    >
                      {LEAD_SOURCE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div data-no-long-press>
                  <Select
                    value={rowAssignee}
                    onValueChange={(v) => update(i, 'assigned_consultant_id', v)}
                  >
                    <SelectTrigger className={cn(inputCls, 'w-full')} data-no-long-press>
                      <SelectValue placeholder={`Consultor (${defaultAssigneeLabel})`} />
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
  inlineEditable,
  onInlineChange,
  onRestartVoice,
  isRecording,
}: {
  query: string
  results: VoiceSearchResult[]
  onNewSearch: () => void
  onClose: () => void
  /** When true, the query at the top becomes an editable input that debounces
   *  back to the parent so the search can be refined without leaving the view. */
  inlineEditable?: boolean
  onInlineChange?: (value: string) => void | Promise<void>
  /** Drops the current intent + results and restarts voice capture so the
   *  user can dictate a new search or a completely different action. */
  onRestartVoice?: () => void
  /** Mic state from the parent — used to disable the mic button while a
   *  capture is already in progress. */
  isRecording?: boolean
}) {
  const [showOthers, setShowOthers] = useState(false)
  const [compose, setCompose] = useState<ComposeState>(null)
  const [inlineValue, setInlineValue] = useState(query)
  const [refining, setRefining] = useState(false)
  const top = results[0]
  const others = results.slice(1)

  // Sync the input when the parent query changes (e.g. fresh voice capture).
  useEffect(() => {
    setInlineValue(query)
  }, [query])

  // Debounced refine — re-runs submit via the callback 350ms after the user
  // stops typing, but only when the value actually differs from `query`.
  useEffect(() => {
    if (!inlineEditable || !onInlineChange) return
    if (inlineValue === query) return
    const trimmed = inlineValue.trim()
    if (!trimmed) return
    setRefining(true)
    const t = setTimeout(async () => {
      try {
        await onInlineChange(trimmed)
      } finally {
        setRefining(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [inlineValue, query, inlineEditable, onInlineChange])

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
      {inlineEditable ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40 pointer-events-none" />
            <Input
              value={inlineValue}
              onChange={(e) => setInlineValue(e.target.value)}
              placeholder="Refinar pesquisa…"
              className="h-9 pl-8 pr-20 bg-white/5 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/40 text-sm"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] text-white/50">
              {refining ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <span className="tabular-nums">
                  {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
                </span>
              )}
            </div>
          </div>
          {onRestartVoice && (
            <button
              type="button"
              onClick={onRestartVoice}
              disabled={isRecording}
              aria-label="Falar de novo"
              title="Falar de novo"
              className={cn(
                'h-9 w-9 shrink-0 rounded-full inline-flex items-center justify-center transition-colors',
                'bg-white/10 hover:bg-white/20 text-white disabled:opacity-40 disabled:cursor-not-allowed'
              )}
            >
              <Mic className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 px-1 text-xs text-white/60">
          <span className="inline-flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5" />
            <span>"{query}"</span>
          </span>
          <span>{results.length} resultado{results.length !== 1 ? 's' : ''}</span>
        </div>
      )}

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
        : result.kind === 'partner'
          ? Handshake
          : result.kind === 'link'
            ? ExternalLink
            : FileText
  const openOnly = result.openOnly === true

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
          {!openOnly && (
            <>
              <CardAction onClick={() => onSend(result, 'email')} icon={<Mail className="h-3.5 w-3.5" />} label="Email" />
              <CardAction onClick={() => onSend(result, 'whatsapp')} icon={<MessageCircle className="h-3.5 w-3.5" />} label="WhatsApp" />
            </>
          )}
        </div>
      </div>
    )
  }

  // Specialised featured render for partners — mirrors /dashboard/parceiros
  // grid cards: hero (cover image or category-colored bg + icon), Recomendado
  // badge, name, contact, category dot + city + rating, action row.
  if (result.kind === 'partner' && result.partnerCard) {
    const pc = result.partnerCard
    const hasCover = Boolean(pc.coverImageUrl)
    const rating = typeof pc.ratingAvg === 'number' ? pc.ratingAvg : null
    return (
      <div className="rounded-2xl bg-white text-neutral-900 overflow-hidden shadow-xl">
        <a href={result.url} target="_blank" rel="noreferrer" className="block">
          <div className={cn('relative aspect-[16/9]', hasCover ? 'bg-muted' : pc.categoryColor.bg)}>
            {hasCover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pc.coverImageUrl!}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Handshake className={cn('h-14 w-14 opacity-80', pc.categoryColor.text)} />
              </div>
            )}
            {pc.isRecommended && (
              <div className="absolute top-2 left-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-black/40 text-white border border-white/15 backdrop-blur-md px-2 h-5 text-[10px]">
                  <Award className="h-2.5 w-2.5" />
                  Recomendado
                </span>
              </div>
            )}
          </div>
        </a>
        <div className="px-4 pt-3">
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="block group"
          >
            <p className="font-semibold text-sm tracking-tight truncate group-hover:underline">
              {result.title}
            </p>
            {pc.contactPerson && (
              <p className="text-xs text-neutral-600 truncate mt-0.5">{pc.contactPerson}</p>
            )}
          </a>
          <div className="mt-2 flex items-center gap-x-2 gap-y-1 text-[11px] text-neutral-500 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <span className={cn('h-1.5 w-1.5 rounded-full', pc.categoryColor.dot)} />
              {pc.categoryLabel}
            </span>
            {pc.city && (
              <>
                <span className="text-neutral-400">·</span>
                <span>{pc.city}</span>
              </>
            )}
            {rating !== null && rating > 0 && (
              <>
                <span className="text-neutral-400">·</span>
                <span className="inline-flex items-center gap-0.5">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="tabular-nums">{rating.toFixed(1)}</span>
                </span>
              </>
            )}
          </div>
        </div>
        <div className="px-4 py-3 flex flex-wrap gap-2 mt-1">
          <Button size="sm" variant="outline" asChild className="gap-1.5">
            <a href={result.url} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" /> Abrir
            </a>
          </Button>
          {!openOnly && (
            <>
              <Button size="sm" variant="outline" onClick={() => onSend(result, 'email')} className="gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Email
              </Button>
              <Button size="sm" variant="outline" onClick={() => onSend(result, 'whatsapp')} className="gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </Button>
            </>
          )}
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
      {!openOnly && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
          <Button size="sm" variant="outline" onClick={() => onSend(result, 'email')} className="gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Enviar por email
          </Button>
          <Button size="sm" variant="outline" onClick={() => onSend(result, 'whatsapp')} className="gap-1.5">
            <MessageCircle className="h-3.5 w-3.5" /> Enviar por WhatsApp
          </Button>
        </div>
      )}
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

// ── Basket panel (multi-property send) ───────────────────────────────────
//
// Opens after send_property returns with a list of properties already
// pre-selected (best match per voice query). User can:
//  - remove properties from the basket
//  - add more via text search or voice (mic → transcribe → best match)
//  - pick suggestions surfaced from the initial searches
//  - manage recipients (chips)
//  - hit "Enviar por WhatsApp" → one text per property per recipient, so
//    each URL gets its own OG preview in WhatsApp
//  - hit "Enviar por Email" → single email per recipient with the Outlook-
//    safe grid rendered by renderPropertyGrid()

function BasketPanel({
  basket,
  defaultMessage,
  onBack,
  onClose,
}: {
  basket: PropertyBasket
  defaultMessage: string
  onBack: () => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<VoiceSearchResult[]>(basket.selected)
  const [suggestions, setSuggestions] = useState<VoiceSearchResult[]>(basket.suggestions)
  const [recipients, setRecipients] = useState<ContactMatch[]>(
    (basket.recipients as ContactMatch[]) ?? []
  )
  const [recipientQuery, setRecipientQuery] = useState('')
  const [recipientMatches, setRecipientMatches] = useState<ContactMatch[]>([])
  const [propertyQuery, setPropertyQuery] = useState('')
  const [propertyMatches, setPropertyMatches] = useState<VoiceSearchResult[]>([])
  const [searchingProps, setSearchingProps] = useState(false)
  const [message, setMessage] = useState(defaultMessage)
  const [subject, setSubject] = useState('Imóveis que podem interessar')
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp')
  const [sending, setSending] = useState(false)

  // Voice refinement inside the basket.
  const [voiceState, setVoiceState] = useState<
    'idle' | 'recording' | 'processing'
  >('idle')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  // Recipient autocomplete (debounced).
  useEffect(() => {
    const q = recipientQuery.trim()
    if (q.length < 2) {
      setRecipientMatches([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/leads?nome=${encodeURIComponent(q)}&limit=8`)
        if (!r.ok) return
        const d = await r.json()
        const arr: any[] = Array.isArray(d) ? d : d?.data || []
        setRecipientMatches(
          arr.map((l: any) => ({
            id: String(l.id),
            nome: String(l.nome ?? ''),
            telemovel: l.telemovel ? String(l.telemovel) : undefined,
            email: l.email ? String(l.email) : undefined,
            nif: l.nif ? String(l.nif) : undefined,
          }))
        )
      } catch {
        // ignore
      }
    }, 250)
    return () => clearTimeout(t)
  }, [recipientQuery])

  // Property search (debounced).
  useEffect(() => {
    const q = propertyQuery.trim()
    if (q.length < 2) {
      setPropertyMatches([])
      return
    }
    setSearchingProps(true)
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/properties?search=${encodeURIComponent(q)}&per_page=5`
        )
        if (!r.ok) return
        const d = await r.json()
        const arr: any[] = Array.isArray(d?.data) ? d.data : []
        setPropertyMatches(arr.map(propertyRowToResult))
      } catch {
        // ignore
      } finally {
        setSearchingProps(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [propertyQuery])

  const addProperty = (r: VoiceSearchResult) => {
    setSelected((prev) => (prev.some((p) => p.id === r.id) ? prev : [...prev, r]))
    setSuggestions((prev) => prev.filter((p) => p.id !== r.id))
    setPropertyQuery('')
    setPropertyMatches([])
  }
  const removeProperty = (id: string) => {
    setSelected((prev) => prev.filter((p) => p.id !== id))
  }
  const addRecipient = (c: ContactMatch) => {
    setRecipients((prev) => (prev.some((p) => p.id === c.id) ? prev : [...prev, c]))
    setRecipientQuery('')
    setRecipientMatches([])
  }
  const removeRecipient = (id: string) => {
    setRecipients((prev) => prev.filter((p) => p.id !== id))
  }

  const cleanupVoice = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    recorderRef.current = null
    chunksRef.current = []
  }, [])

  const startVoice = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        cleanupVoice()
        setVoiceState('processing')
        try {
          const fd = new FormData()
          fd.append('audio', blob, 'voice.webm')
          const tRes = await fetch('/api/transcribe', { method: 'POST', body: fd })
          if (!tRes.ok) throw new Error('Falha na transcrição')
          const { transcript: t } = await tRes.json()
          const phrase = (t as string).trim()
          if (phrase) {
            // Use the transcript as a search query. Add the best match.
            const r = await fetch(
              `/api/properties?search=${encodeURIComponent(phrase)}&per_page=1`
            )
            if (r.ok) {
              const d = await r.json()
              const arr: any[] = Array.isArray(d?.data) ? d.data : []
              if (arr.length > 0) {
                addProperty(propertyRowToResult(arr[0]))
              } else {
                toast.warning(`Nenhum imóvel para "${phrase}"`)
              }
            }
          }
        } catch {
          toast.error('Não consegui perceber. Tenta de novo.')
        } finally {
          setVoiceState('idle')
        }
      }
      recorder.start()
      setVoiceState('recording')
    } catch {
      toast.error('Não foi possível aceder ao microfone.')
      setVoiceState('idle')
    }
  }, [cleanupVoice])

  const stopVoice = useCallback(() => {
    if (recorderRef.current && voiceState === 'recording') {
      recorderRef.current.stop()
      setVoiceState('processing')
    }
  }, [voiceState])

  useEffect(() => () => cleanupVoice(), [cleanupVoice])

  const inputCls =
    'bg-white/5 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/40 h-9 text-sm'

  const validRecipients = recipients.filter((r) =>
    channel === 'email' ? Boolean(r.email) : Boolean(r.telemovel)
  )
  const canSend =
    selected.length > 0 && validRecipients.length > 0 && !sending

  const doSend = useCallback(async () => {
    if (!canSend) return
    setSending(true)
    try {
      if (channel === 'whatsapp') {
        const phones = validRecipients.map((r) => r.telemovel!).filter(Boolean)
        // Optional intro as first message, then one message per property so
        // each URL yields its own OG preview in WhatsApp.
        const intro = message.trim()
        const sequence: string[] = []
        if (intro) sequence.push(intro)
        for (const p of selected) {
          const line = [p.title, p.meta, p.url].filter(Boolean).join('\n')
          sequence.push(line)
        }
        let totalSent = 0
        let firstErr = ''
        for (const text of sequence) {
          const res = await fetch('/api/voice/whatsapp-send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phones, text }),
          })
          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            if (!firstErr) firstErr = body?.error || `HTTP ${res.status}`
            continue
          }
          const out = await res.json()
          totalSent += out.sent || 0
          if (!firstErr && Array.isArray(out.details)) {
            const d = out.details.find((d: any) => !d.ok)
            if (d?.error) firstErr = d.error
          }
        }
        if (totalSent === 0) throw new Error(firstErr || 'Nenhuma mensagem enviada')
        if (firstErr) {
          toast.warning(`${totalSent} mensagens enviadas, alguns erros: ${firstErr}`)
        } else {
          toast.success(
            `${selected.length} imóv${selected.length !== 1 ? 'eis' : 'el'} enviado${selected.length !== 1 ? 's' : ''} por WhatsApp`
          )
        }
      } else {
        // Email: one per recipient with full HTML grid.
        const cards = selected.map((s) => s.card).filter(Boolean) as NonNullable<VoiceSearchResult['card']>[]
        const intro = message.trim()
        const introHtml = intro
          ? `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#262626;">${intro.replace(/\n/g, '<br>')}</p>`
          : ''
        const gridHtml = cards.length > 0 ? renderPropertyGrid(cards) : ''
        const fullHtml = wrapEmailHtml(`${introHtml}${gridHtml}`)
        const textFallback = [intro, ...selected.map((s) => `• ${s.title}\n  ${s.url}`)]
          .filter(Boolean)
          .join('\n\n')

        let ok = 0
        let fail = 0
        let lastError = ''
        for (const r of validRecipients) {
          try {
            const res = await fetch('/api/email/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: [r.email],
                subject,
                body_html: fullHtml,
                body_text: textFallback,
              }),
            })
            if (res.ok) ok += 1
            else {
              fail += 1
              const body = await res.json().catch(() => ({}))
              if (!lastError) lastError = body?.error || `HTTP ${res.status}`
            }
          } catch (e) {
            fail += 1
            if (!lastError) lastError = e instanceof Error ? e.message : 'Erro de rede'
          }
        }
        if (ok === 0) throw new Error(lastError || 'Nenhum email enviado')
        if (fail === 0) {
          toast.success(
            `${ok} email${ok !== 1 ? 's' : ''} com ${selected.length} imóv${selected.length !== 1 ? 'eis' : 'el'} enviado${ok !== 1 ? 's' : ''}`
          )
        } else {
          toast.warning(`${ok} enviado${ok !== 1 ? 's' : ''}, ${fail} com erro: ${lastError}`)
        }
      }
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar')
      console.error('[voice basket] send failed:', err)
    } finally {
      setSending(false)
    }
  }, [canSend, channel, validRecipients, selected, message, subject, onClose])

  return (
    <div className="mt-6 text-left">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </button>

      <div className="rounded-2xl bg-white/10 border border-white/20 p-5 space-y-4 backdrop-blur">
        {/* Selected properties */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-white/60">
              Imóveis seleccionados ({selected.length})
            </label>
            <VoiceMicButton
              state={voiceState === 'recording' ? 'recording' : voiceState === 'processing' ? 'processing' : 'idle'}
              onStart={startVoice}
              onStop={stopVoice}
            />
          </div>
          {selected.length === 0 ? (
            <p className="rounded-lg bg-amber-500/10 ring-1 ring-amber-500/25 px-3 py-2.5 text-xs text-amber-200/80">
              Nenhum imóvel. Procura abaixo ou fala para adicionar.
            </p>
          ) : (
            <div className="space-y-1.5">
              {selected.map((p) => (
                <BasketPropertyRow
                  key={p.id}
                  result={p}
                  onRemove={() => removeProperty(p.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Add more (search) */}
        <div>
          <label className="text-xs text-white/60 mb-1 block">Adicionar imóvel</label>
          <Input
            value={propertyQuery}
            onChange={(e) => setPropertyQuery(e.target.value)}
            placeholder="Procurar por título, referência, zona…"
            className={inputCls}
          />
          {searchingProps && (
            <p className="mt-1 text-[11px] text-white/40 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              A procurar…
            </p>
          )}
          {propertyMatches.length > 0 && (
            <div className="mt-1.5 space-y-1.5">
              {propertyMatches
                .filter((m) => !selected.some((s) => s.id === m.id))
                .map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => addProperty(m)}
                    className="w-full text-left rounded-lg bg-white/5 ring-1 ring-white/10 hover:bg-white/10 px-3 py-2 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-sm text-white">
                      <Plus className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                      <span className="truncate font-medium">{m.title}</span>
                    </div>
                    {m.meta && <p className="ml-5 text-[11px] text-white/50">{m.meta}</p>}
                  </button>
                ))}
            </div>
          )}
          {suggestions.length > 0 && propertyQuery.trim().length < 2 && (
            <div className="mt-2">
              <p className="text-[11px] text-white/40 mb-1">Sugestões das tuas pesquisas:</p>
              <div className="space-y-1.5">
                {suggestions.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => addProperty(m)}
                    className="w-full text-left rounded-lg bg-white/5 ring-1 ring-white/10 hover:bg-white/10 px-3 py-2 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-sm text-white">
                      <Plus className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                      <span className="truncate font-medium">{m.title}</span>
                    </div>
                    {m.meta && <p className="ml-5 text-[11px] text-white/50">{m.meta}</p>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recipients */}
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
            placeholder="Procurar contacto…"
            className={inputCls}
          />
          {recipientMatches.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {recipientMatches
                .filter((m) => !recipients.some((r) => r.id === m.id))
                .map((m) => (
                  <ContactChip key={m.id} contact={m} channel={channel} onPick={addRecipient} />
                ))}
            </div>
          )}
        </div>

        {/* Channel toggle */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/60">Canal:</label>
          <div className="inline-flex rounded-lg bg-white/5 ring-1 ring-white/10 p-0.5" data-no-long-press>
            <button
              type="button"
              onClick={() => setChannel('whatsapp')}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5',
                channel === 'whatsapp'
                  ? 'bg-white/20 text-white'
                  : 'text-white/60 hover:text-white'
              )}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setChannel('email')}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5',
                channel === 'email'
                  ? 'bg-white/20 text-white'
                  : 'text-white/60 hover:text-white'
              )}
            >
              <Mail className="h-3.5 w-3.5" />
              Email
            </button>
          </div>
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
          <label className="text-xs text-white/60 mb-1 block">
            Mensagem {channel === 'whatsapp' ? '(enviada como primeira mensagem)' : '(antes dos cartões)'}
          </label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Olá, partilho alguns imóveis que podem interessar."
            className="bg-white/5 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/40 text-sm resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          {!canSend && !sending && (
            <span className="mr-auto text-[11px] text-amber-200/80 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {selected.length === 0
                ? 'Basket vazio.'
                : recipients.length === 0
                  ? 'Adiciona um destinatário.'
                  : validRecipients.length === 0
                    ? `Nenhum destinatário tem ${channel === 'email' ? 'email' : 'telemóvel'}.`
                    : 'Preenche os campos em falta.'}
            </span>
          )}
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
                Enviar {selected.length > 0 && `${selected.length} imóv${selected.length !== 1 ? 'eis' : 'el'}`}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

function BasketPropertyRow({
  result,
  onRemove,
}: {
  result: VoiceSearchResult
  onRemove: () => void
}) {
  const image = result.card?.imageUrl
  return (
    <div className="flex items-center gap-3 rounded-lg bg-white/5 ring-1 ring-white/10 px-2 py-2">
      <div className="h-10 w-14 shrink-0 rounded bg-white/10 overflow-hidden flex items-center justify-center">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <Building2 className="h-4 w-4 text-white/40" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{result.title}</p>
        {result.meta && <p className="text-[11px] text-white/50 truncate">{result.meta}</p>}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="p-1.5 text-white/40 hover:text-red-300 transition-colors shrink-0"
        aria-label="Remover"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

// ── Contact picker (when voice can't pin the recipient) ─────────────────
//
// Opens when send_message (and future contact-bound tools) can't decide on
// a single recipient. Shows the original voice term, any fuzzy candidates
// we pre-fetched, and a search input to find someone else entirely.
// Typing against /api/leads is debounced at 300ms.

function ContactPickerPanel({
  request,
  onPicked,
  onBack,
  onClose,
}: {
  request: ContactPickerRequest
  onPicked: (recipient: VoiceSearchRecipient) => void
  onBack: () => void
  onClose: () => void
}) {
  const [query, setQuery] = useState(request.query)
  const [results, setResults] = useState<VoiceSearchRecipient[]>(request.candidates)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    // Skip refetch if the user hasn't changed the seeded query — the
    // `request.candidates` already covers that initial state.
    if (query.trim() === request.query.trim()) {
      setResults(request.candidates)
      return
    }
    const needle = query.trim()
    if (needle.length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/leads?nome=${encodeURIComponent(needle)}&limit=10`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        const list: any[] = Array.isArray(data) ? data : data?.data || []
        setResults(
          list.map((l: any) => ({
            id: String(l.id),
            nome: String(l.nome ?? ''),
            email: l.email ? String(l.email) : undefined,
            telemovel: l.telemovel ? String(l.telemovel) : undefined,
            nif: l.nif ? String(l.nif) : undefined,
          }))
        )
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query, request.query, request.candidates])

  const inputCls =
    'bg-white/5 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/40 h-9 text-sm'

  return (
    <div className="mt-6 text-left">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </button>

      <div className="rounded-2xl bg-white/10 border border-white/20 p-5 space-y-4 backdrop-blur">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <UserCheck className="h-4 w-4" />
            Escolhe o destinatário
          </div>
          <p className="mt-1 text-xs text-white/60">
            {request.candidates.length === 0
              ? `Não encontrei ninguém para "${request.query}". Pesquisa outro nome ou termo.`
              : `Encontrei ${request.candidates.length} possíveis para "${request.query}". Escolhe um ou pesquisa outro.`}
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40 pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar por nome…"
            className={cn(inputCls, 'pl-8 pr-10')}
            autoFocus
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40 animate-spin" />
          )}
        </div>

        <div className="space-y-1.5 max-h-[50dvh] overflow-y-auto -mx-1 px-1">
          {results.length === 0 && !searching && (
            <div className="rounded-lg bg-amber-500/10 ring-1 ring-amber-500/25 px-3 py-3 text-xs text-amber-200/80 text-center">
              Sem resultados.
            </div>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onPicked(r)}
              className="w-full text-left rounded-lg bg-white/5 ring-1 ring-white/10 hover:bg-white/15 px-3 py-2 transition-colors"
            >
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 shrink-0 mt-0.5 text-white/60" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate font-medium">{r.nome}</p>
                  <div className="flex flex-wrap gap-x-2 text-[11px] text-white/50 mt-0.5">
                    {r.telemovel && <span>📱 {r.telemovel}</span>}
                    {r.email && <span>✉ {r.email}</span>}
                    {!r.telemovel && !r.email && <span>sem contactos</span>}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} className="text-white hover:bg-white/10">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Add-note panel (add_lead_note tool) ─────────────────────────────────
//
// Confirms the contact + scope (Contacto vs Negócio X) + note body before
// POST /api/crm/contacts/[id]/activities. Includes the same mic-refine
// flow as DirectMessagePanel so the user can tweak the note by voice.

function AddNotePanel({
  data,
  onBack,
  onSaved,
  onChangeRecipient,
}: {
  data: LeadNote
  onBack: () => void
  onSaved: () => void
  onChangeRecipient?: (currentNote: string) => void
}) {
  const [contact, setContact] = useState<VoiceSearchRecipient>(data.contact)
  const [negocios, setNegocios] = useState<LeadNoteNegocioOption[]>(data.negocios)
  const [note, setNote] = useState(data.initialNote ?? '')
  // Scope: '' = contacto-level; otherwise a negócio id.
  const [scopeNegocioId, setScopeNegocioId] = useState<string>('')
  const [saving, setSaving] = useState(false)

  // Voice refinement state (mirrors DirectMessagePanel pattern)
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'processing'>('idle')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const cleanupVoice = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    recorderRef.current = null
    chunksRef.current = []
  }, [])

  const applyRefine = useCallback(
    async (args: Record<string, any>) => {
      if (typeof args.note === 'string' && args.note.trim()) {
        setNote(args.note)
      }
      const nextName =
        typeof args.contact_name === 'string' ? args.contact_name.trim() : ''
      if (nextName && nextName.toLowerCase() !== contact.nome.toLowerCase()) {
        try {
          const r = await fetch(`/api/leads?nome=${encodeURIComponent(nextName)}&limit=3`)
          if (r.ok) {
            const d = await r.json()
            const list: any[] = Array.isArray(d) ? d : d?.data || []
            if (list.length > 0) {
              const p = list[0]
              const newContact: VoiceSearchRecipient = {
                id: String(p.id),
                nome: String(p.nome ?? ''),
                email: p.email ? String(p.email) : undefined,
                telemovel: p.telemovel ? String(p.telemovel) : undefined,
                nif: p.nif ? String(p.nif) : undefined,
              }
              setContact(newContact)
              setScopeNegocioId('') // reset scope to contact-level for the new lead
              // Reload the new contact's negócios
              try {
                const nr = await fetch(`/api/negocios?lead_id=${encodeURIComponent(newContact.id)}&limit=20`)
                if (nr.ok) {
                  const nd = await nr.json()
                  const nlist: any[] = Array.isArray(nd?.data) ? nd.data : Array.isArray(nd) ? nd : []
                  setNegocios(
                    nlist.map((n: any) => {
                      const tipo = n.tipo ? String(n.tipo) : undefined
                      const loc = n.localizacao ? String(n.localizacao) : undefined
                      const tipoImovel = n.tipo_imovel ? String(n.tipo_imovel) : undefined
                      const parts = [tipoImovel || tipo, loc].filter(Boolean)
                      return {
                        id: String(n.id),
                        label: parts.join(' · ') || 'Negócio',
                        tipo,
                        localizacao: loc,
                      }
                    })
                  )
                }
              } catch {
                setNegocios([])
              }
            } else {
              toast.warning(`Não encontrei "${nextName}" — usa Mudar para procurar.`)
            }
          }
        } catch {
          // ignore
        }
      }
    },
    [contact.nome]
  )

  const startVoice = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        cleanupVoice()
        setVoiceState('processing')
        try {
          const fd = new FormData()
          fd.append('audio', blob)
          const tRes = await fetch('/api/transcribe', { method: 'POST', body: fd })
          if (!tRes.ok) throw new Error('Falha na transcrição')
          const { text } = await tRes.json()
          const t = (text || '').trim()
          if (!t) throw new Error('Não captei nenhum som')

          const existingArgs = {
            contact_name: contact.nome,
            note,
          }
          const iRes = await fetch('/api/ai/voice-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transcript: t,
              context: {
                existingTool: 'add_lead_note',
                existingArgs,
              },
            }),
          })
          if (!iRes.ok) throw new Error('Falha ao refinar')
          const d = await iRes.json()
          if (!d?.args) {
            toast.warning(d?.message || 'Não consegui perceber.')
            return
          }
          await applyRefine(d.args)
          toast.success('Actualizado.')
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Erro ao refinar.')
        } finally {
          setVoiceState('idle')
        }
      }
      recorder.start()
      setVoiceState('recording')
    } catch {
      toast.error('Não foi possível aceder ao microfone.')
      setVoiceState('idle')
    }
  }, [cleanupVoice, contact.nome, note, applyRefine])

  const stopVoice = useCallback(() => {
    if (recorderRef.current && voiceState === 'recording') {
      recorderRef.current.stop()
      setVoiceState('processing')
    }
  }, [voiceState])

  useEffect(() => () => cleanupVoice(), [cleanupVoice])

  const canSave = note.trim().length > 0 && !saving

  const doSave = useCallback(async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const res = await fetch(`/api/crm/contacts/${contact.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_type: 'note',
          description: note.trim(),
          negocio_id: scopeNegocioId || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || `Falha ao guardar (HTTP ${res.status})`)
      }
      toast.success('Nota guardada.')
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar')
      console.error('[voice add-note] save failed:', err)
    } finally {
      setSaving(false)
    }
  }, [canSave, contact.id, note, scopeNegocioId, onSaved])

  const inputCls =
    'bg-white/5 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/40 h-9 text-sm'

  return (
    <div className="mt-6 text-left">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </button>

      <div className="rounded-2xl bg-white/10 border border-white/20 p-5 space-y-4 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <FileText className="h-4 w-4" />
            Adicionar nota
          </div>
          <VoiceMicButton
            state={voiceState}
            onStart={startVoice}
            onStop={stopVoice}
          />
        </div>

        {/* Contact chip — clickable to swap */}
        <div>
          <label className="text-xs text-white/60 mb-1 block">Contacto</label>
          <button
            type="button"
            onClick={() => onChangeRecipient?.(note)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition-colors',
              'cursor-pointer hover:ring-2 hover:ring-white/30',
              'bg-emerald-500/15 ring-1 ring-emerald-500/30 text-white'
            )}
            title="Mudar contacto"
          >
            <User className="h-3 w-3" />
            <span className="font-medium">{contact.nome}</span>
            {contact.telemovel && <span className="text-white/60">· {contact.telemovel}</span>}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
        </div>

        {/* Scope selector — only when lead has at least one negócio */}
        {negocios.length > 0 && (
          <div>
            <label className="text-xs text-white/60 mb-1 block">Associar a</label>
            <div className="flex flex-wrap gap-1.5" data-no-long-press>
              <button
                type="button"
                onClick={() => setScopeNegocioId('')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition-colors',
                  scopeNegocioId === ''
                    ? 'bg-white/20 ring-1 ring-white/40 text-white'
                    : 'bg-white/5 ring-1 ring-white/10 text-white/70 hover:bg-white/10'
                )}
              >
                <User className="h-3 w-3" />
                Contacto
              </button>
              {negocios.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setScopeNegocioId(n.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition-colors',
                    scopeNegocioId === n.id
                      ? 'bg-white/20 ring-1 ring-white/40 text-white'
                      : 'bg-white/5 ring-1 ring-white/10 text-white/70 hover:bg-white/10'
                  )}
                >
                  <Building2 className="h-3 w-3" />
                  {n.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-white/40">
              {scopeNegocioId
                ? 'A nota fica ligada ao negócio escolhido.'
                : 'A nota fica ao contacto (aplica-se a todos os negócios).'}
            </p>
          </div>
        )}

        <div>
          <label className="text-xs text-white/60 mb-1 block">Nota</label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            placeholder="O que queres registar?"
            className="bg-white/5 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/40 text-sm resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          {!canSave && !saving && (
            <span className="mr-auto text-[11px] text-amber-200/80 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Escreve uma nota.
            </span>
          )}
          <Button variant="ghost" onClick={onBack} className="text-white hover:bg-white/10">
            Cancelar
          </Button>
          <Button onClick={doSave} disabled={!canSave}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                A guardar…
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1.5" />
                Guardar nota
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Attach document panel (attach_document tool) ─────────────────────────
//
// Uploads a file (photo from camera on mobile, file picker on desktop) to
// a resolved imóvel via POST /api/documents/upload (FormData with file +
// doc_type_id + property_id + valid_until + notes).

function AttachDocumentPanel({
  data,
  onBack,
  onSaved,
}: {
  data: AttachDocumentRequest
  onBack: () => void
  onSaved: () => void
}) {
  const [docTypeId, setDocTypeId] = useState(data.initialDocTypeId ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState(data.initialNotes ?? '')
  const [uploading, setUploading] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Object URL cleanup when a new file is chosen or component unmounts.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const isImage = file.type.startsWith('image/')
    if (!isImage) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const selectedType = data.docTypes.find((t) => t.id === docTypeId)
  const acceptAttr = selectedType
    ? selectedType.allowedExtensions.map((e) => `.${e}`).join(',')
    : undefined

  const canUpload = Boolean(docTypeId) && Boolean(file) && !uploading

  const doUpload = useCallback(async () => {
    if (!canUpload || !file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('doc_type_id', docTypeId)
      fd.append('property_id', data.propertyId)
      if (validUntil.trim()) fd.append('valid_until', validUntil)
      if (notes.trim()) fd.append('notes', notes.trim())

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || `Falha (HTTP ${res.status})`)
      }
      toast.success('Documento anexado.')
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao anexar')
      console.error('[voice attach-document] upload failed:', err)
    } finally {
      setUploading(false)
    }
  }, [canUpload, file, docTypeId, data.propertyId, validUntil, notes, onSaved])

  const inputCls =
    'bg-white/5 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/40 h-9 text-sm'

  return (
    <div className="mt-6 text-left">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </button>

      <div className="rounded-2xl bg-white/10 border border-white/20 p-5 space-y-4 backdrop-blur">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <FileText className="h-4 w-4" />
          Anexar documento
        </div>

        {/* Property card */}
        <div className="rounded-lg bg-white/5 ring-1 ring-white/10 px-3 py-2">
          <div className="flex items-start gap-2">
            <Building2 className="h-4 w-4 shrink-0 mt-0.5 text-white/60" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">{data.propertyTitle}</p>
              {data.propertyMeta && (
                <p className="text-[11px] text-white/50 truncate">{data.propertyMeta}</p>
              )}
            </div>
          </div>
        </div>

        {/* Doc type selector */}
        <div>
          <label className="text-xs text-white/60 mb-1 block">Tipo de documento</label>
          <Select value={docTypeId} onValueChange={setDocTypeId}>
            <SelectTrigger className={cn(inputCls, 'w-full')} data-no-long-press>
              <SelectValue placeholder="Escolhe o tipo…" />
            </SelectTrigger>
            <SelectContent
              position="popper"
              sideOffset={4}
              className="z-[300] max-h-[50vh]"
              data-no-long-press
            >
              {data.docTypes.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* File picker — camera on mobile / file picker for everything */}
        <div>
          <label className="text-xs text-white/60 mb-2 block">Ficheiro</label>
          {file ? (
            <div className="rounded-lg bg-white/5 ring-1 ring-white/10 px-3 py-3 space-y-2">
              <div className="flex items-start gap-3">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="preview"
                    className="h-14 w-14 rounded object-cover bg-white/10 shrink-0"
                  />
                ) : (
                  <div className="h-14 w-14 rounded bg-white/10 flex items-center justify-center shrink-0">
                    <FileText className="h-6 w-6 text-white/50" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{file.name}</p>
                  <p className="text-[11px] text-white/50">
                    {(file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="p-1.5 text-white/40 hover:text-red-300 transition-colors shrink-0"
                  aria-label="Remover"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-3 text-sm text-white transition-colors"
              >
                <ImageIcon className="h-4 w-4" />
                Fotografar
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-3 text-sm text-white transition-colors"
              >
                <FileText className="h-4 w-4" />
                Escolher ficheiro
              </button>
            </div>
          )}
          {/* Two hidden inputs so capture=environment targets the back camera
              on mobile without blocking gallery/file picker on desktop. */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setFile(f)
              e.target.value = ''
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptAttr}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setFile(f)
              e.target.value = ''
            }}
          />
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">
            Validade <span className="text-white/40">(opcional)</span>
          </label>
          <Input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">
            Notas <span className="text-white/40">(opcional)</span>
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Ex: versão assinada, original com o cliente…"
            className="bg-white/5 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/40 text-sm resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          {!canUpload && !uploading && (
            <span className="mr-auto text-[11px] text-amber-200/80 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {!docTypeId ? 'Escolhe o tipo.' : 'Adiciona um ficheiro.'}
            </span>
          )}
          <Button variant="ghost" onClick={onBack} className="text-white hover:bg-white/10">
            Cancelar
          </Button>
          <Button onClick={doUpload} disabled={!canUpload}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                A enviar…
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1.5" />
                Anexar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Property description panel (generate_property_description tool) ─────
//
// Streams the generated description from
// /api/properties/[id]/generate-description (SSE) and lets the user edit
// before saving via PUT /api/properties/[id].

function PropertyDescriptionPanel({
  data,
  onBack,
  onSaved,
}: {
  data: PropertyDescriptionRequest
  onBack: () => void
  onSaved: () => void
}) {
  const [description, setDescription] = useState('')
  const [generating, setGenerating] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tone, setTone] = useState<'professional' | 'premium' | 'cozy'>(data.tone ?? 'professional')
  // Notes accumulate — voice refinements append here and trigger a fresh
  // generation. Seeded with whatever voice captured on the way in.
  const [additionalNotes, setAdditionalNotes] = useState(data.additionalNotes ?? '')
  const abortRef = useRef<AbortController | null>(null)
  // Track whether the stream has completed at least once to allow regenerate.
  const startedOnceRef = useRef(false)

  // Voice refine — same recording/transcribe pattern as the other panels.
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'processing'>('idle')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const cleanupVoice = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    recorderRef.current = null
    chunksRef.current = []
  }, [])

  const generate = useCallback(async (overrideNotes?: string) => {
    // Cancel any in-flight stream.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setGenerating(true)
    setDescription('')
    try {
      const res = await fetch(`/api/properties/${data.propertyId}/generate-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: 'pt',
          tone,
          additional_notes: overrideNotes ?? additionalNotes,
        }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) {
        throw new Error(`Falha ao gerar (HTTP ${res.status})`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        // SSE events separated by blank line.
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''
        for (const raw of events) {
          const line = raw.trim()
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (!payload || payload === '[DONE]') continue
          try {
            const j = JSON.parse(payload)
            if (typeof j?.text === 'string') {
              setDescription((prev) => prev + j.text)
            }
          } catch {
            // ignore malformed chunk
          }
        }
      }
      startedOnceRef.current = true
    } catch (err) {
      if ((err as any)?.name === 'AbortError') return
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar descrição')
    } finally {
      setGenerating(false)
    }
  }, [data.propertyId, additionalNotes, tone])

  const startVoice = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        cleanupVoice()
        setVoiceState('processing')
        try {
          const fd = new FormData()
          fd.append('audio', blob)
          const tRes = await fetch('/api/transcribe', { method: 'POST', body: fd })
          if (!tRes.ok) throw new Error('Falha na transcrição')
          const { text } = await tRes.json()
          const t = (text || '').trim()
          if (!t) throw new Error('Não captei nenhum som')

          // Append the transcript to additional_notes + regenerate. GPT will
          // incorporate the instruction in the next description.
          const merged = additionalNotes
            ? `${additionalNotes}\n${t}`
            : t
          setAdditionalNotes(merged)
          toast.success('A regenerar com as tuas notas…')
          // Pass the merged notes directly — React state update is async and
          // generate() reads additionalNotes from the outer closure.
          await generate(merged)
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Erro ao refinar.')
        } finally {
          setVoiceState('idle')
        }
      }
      recorder.start()
      setVoiceState('recording')
    } catch {
      toast.error('Não foi possível aceder ao microfone.')
      setVoiceState('idle')
    }
  }, [cleanupVoice, additionalNotes, generate])

  const stopVoice = useCallback(() => {
    if (recorderRef.current && voiceState === 'recording') {
      recorderRef.current.stop()
      setVoiceState('processing')
    }
  }, [voiceState])

  useEffect(() => () => cleanupVoice(), [cleanupVoice])

  useEffect(() => {
    if (startedOnceRef.current) return
    void generate()
    return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canSave = description.trim().length > 0 && !saving && !generating

  const doSave = useCallback(async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const res = await fetch(`/api/properties/${data.propertyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // The PUT handler expects the wrapped shape { property, specifications,
        // internal }; sending description flat silently no-ops because the
        // `if (property && …)` gate fails.
        body: JSON.stringify({ property: { description: description.trim() } }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || `Falha ao guardar (HTTP ${res.status})`)
      }
      toast.success('Descrição guardada.')
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }, [canSave, description, data.propertyId, onSaved])

  return (
    <div className="mt-6 text-left">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </button>

      <div className="rounded-2xl bg-white/10 border border-white/20 p-5 space-y-4 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Building2 className="h-4 w-4" />
            Descrição do imóvel
          </div>
          <VoiceMicButton
            state={voiceState}
            onStart={startVoice}
            onStop={stopVoice}
          />
        </div>

        {/* Property card */}
        <div className="rounded-lg bg-white/5 ring-1 ring-white/10 px-3 py-2">
          <p className="text-sm text-white font-medium truncate">{data.title}</p>
          {data.meta && <p className="text-[11px] text-white/50 truncate">{data.meta}</p>}
        </div>

        {/* Voice-captured notes — shown when there's something to display. */}
        {additionalNotes.trim() && (
          <div className="rounded-lg bg-sky-500/10 ring-1 ring-sky-500/25 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-sky-200/80 mb-1">
              Notas para a IA
            </p>
            <p className="text-[11px] text-sky-100/90 whitespace-pre-wrap break-words">
              {additionalNotes}
            </p>
          </div>
        )}

        {/* Tone toggle */}
        <div>
          <label className="text-xs text-white/60 mb-1 block">Tom</label>
          <div className="inline-flex flex-wrap gap-1.5" data-no-long-press>
            {(['professional', 'premium', 'cozy'] as const).map((t) => {
              const labels = { professional: 'Profissional', premium: 'Premium', cozy: 'Acolhedor' }
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  disabled={generating}
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] transition-colors',
                    tone === t
                      ? 'bg-white/20 ring-1 ring-white/40 text-white'
                      : 'bg-white/5 ring-1 ring-white/10 text-white/70 hover:bg-white/10',
                    generating && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {labels[t]}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 flex items-center gap-1.5">
            Descrição gerada
            {generating && <Loader2 className="h-3 w-3 animate-spin" />}
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={10}
            placeholder={generating ? 'A gerar…' : 'Descrição aparece aqui.'}
            className="bg-white/5 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/40 text-sm resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => void generate()}
            disabled={generating || saving}
            className="text-white hover:bg-white/10"
            title="Gerar nova versão"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-1.5 opacity-0" />
            )}
            Regenerar
          </Button>
          <Button variant="ghost" onClick={onBack} className="text-white hover:bg-white/10">
            Cancelar
          </Button>
          <Button onClick={doSave} disabled={!canSave}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                A guardar…
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1.5" />
                Guardar no imóvel
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Follow-up panel (schedule_follow_up tool) ────────────────────────────
//
// Writes to /api/tasks with entity_type='lead'|'negocio' + title prefixed by
// the channel emoji/label so the task list shows the intent at a glance.
// Same scope + mic-refine pattern as AddNotePanel.

const FOLLOW_UP_CHANNEL_META: Record<FollowUpChannel, { label: string; icon: string }> = {
  call: { label: 'Chamada', icon: '📞' },
  whatsapp: { label: 'WhatsApp', icon: '💬' },
  email: { label: 'Email', icon: '✉' },
  meeting: { label: 'Reunião', icon: '🤝' },
}

function FollowUpPanel({
  data,
  onBack,
  onSaved,
  onChangeRecipient,
}: {
  data: FollowUp
  onBack: () => void
  onSaved: () => void
  onChangeRecipient?: (current: {
    dueDate: string
    channel: FollowUpChannel
    notes: string
  }) => void
}) {
  const [contact, setContact] = useState<VoiceSearchRecipient>(data.contact)
  const [negocios, setNegocios] = useState<LeadNoteNegocioOption[]>(data.negocios)
  const [channel, setChannel] = useState<FollowUpChannel>(data.initialChannel ?? 'call')
  const [dueDate, setDueDate] = useState(data.initialDueDate ?? '')
  const [notes, setNotes] = useState(data.initialNotes ?? '')
  const [scopeNegocioId, setScopeNegocioId] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'processing'>('idle')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const cleanupVoice = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    recorderRef.current = null
    chunksRef.current = []
  }, [])

  const applyRefine = useCallback(
    async (args: Record<string, any>) => {
      if (typeof args.due_date === 'string' && args.due_date.trim()) {
        setDueDate(args.due_date)
      }
      if (args.channel === 'call' || args.channel === 'whatsapp' || args.channel === 'email' || args.channel === 'meeting') {
        setChannel(args.channel)
      }
      if (typeof args.notes === 'string' && args.notes.trim()) {
        setNotes(args.notes)
      }
      const nextName =
        typeof args.contact_name === 'string' ? args.contact_name.trim() : ''
      if (nextName && nextName.toLowerCase() !== contact.nome.toLowerCase()) {
        try {
          const r = await fetch(`/api/leads?nome=${encodeURIComponent(nextName)}&limit=3`)
          if (r.ok) {
            const d = await r.json()
            const list: any[] = Array.isArray(d) ? d : d?.data || []
            if (list.length > 0) {
              const p = list[0]
              const newContact: VoiceSearchRecipient = {
                id: String(p.id),
                nome: String(p.nome ?? ''),
                email: p.email ? String(p.email) : undefined,
                telemovel: p.telemovel ? String(p.telemovel) : undefined,
                nif: p.nif ? String(p.nif) : undefined,
              }
              setContact(newContact)
              setScopeNegocioId('')
              try {
                const nr = await fetch(`/api/negocios?lead_id=${encodeURIComponent(newContact.id)}&limit=20`)
                if (nr.ok) {
                  const nd = await nr.json()
                  const nlist: any[] = Array.isArray(nd?.data) ? nd.data : Array.isArray(nd) ? nd : []
                  setNegocios(
                    nlist.map((n: any) => {
                      const tipo = n.tipo ? String(n.tipo) : undefined
                      const loc = n.localizacao ? String(n.localizacao) : undefined
                      const tipoImovel = n.tipo_imovel ? String(n.tipo_imovel) : undefined
                      const parts = [tipoImovel || tipo, loc].filter(Boolean)
                      return {
                        id: String(n.id),
                        label: parts.join(' · ') || 'Negócio',
                        tipo,
                        localizacao: loc,
                      }
                    })
                  )
                }
              } catch {
                setNegocios([])
              }
            } else {
              toast.warning(`Não encontrei "${nextName}" — usa Mudar para procurar.`)
            }
          }
        } catch {}
      }
    },
    [contact.nome]
  )

  const startVoice = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        cleanupVoice()
        setVoiceState('processing')
        try {
          const fd = new FormData()
          fd.append('audio', blob)
          const tRes = await fetch('/api/transcribe', { method: 'POST', body: fd })
          if (!tRes.ok) throw new Error('Falha na transcrição')
          const { text } = await tRes.json()
          const t = (text || '').trim()
          if (!t) throw new Error('Não captei nenhum som')

          const existingArgs: Record<string, any> = {
            contact_name: contact.nome,
            channel,
          }
          if (dueDate.trim()) existingArgs.due_date = dueDate
          if (notes.trim()) existingArgs.notes = notes

          const iRes = await fetch('/api/ai/voice-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transcript: t,
              context: {
                existingTool: 'schedule_follow_up',
                existingArgs,
              },
            }),
          })
          if (!iRes.ok) throw new Error('Falha ao refinar')
          const d = await iRes.json()
          if (!d?.args) {
            toast.warning(d?.message || 'Não consegui perceber.')
            return
          }
          await applyRefine(d.args)
          toast.success('Actualizado.')
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Erro ao refinar.')
        } finally {
          setVoiceState('idle')
        }
      }
      recorder.start()
      setVoiceState('recording')
    } catch {
      toast.error('Não foi possível aceder ao microfone.')
      setVoiceState('idle')
    }
  }, [cleanupVoice, contact.nome, channel, dueDate, notes, applyRefine])

  const stopVoice = useCallback(() => {
    if (recorderRef.current && voiceState === 'recording') {
      recorderRef.current.stop()
      setVoiceState('processing')
    }
  }, [voiceState])

  useEffect(() => () => cleanupVoice(), [cleanupVoice])

  const canSave = Boolean(dueDate.trim()) && !saving

  const doSave = useCallback(async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const meta = FOLLOW_UP_CHANNEL_META[channel]
      const actionVerb =
        channel === 'call' ? 'Ligar' : channel === 'email' ? 'Email' : channel === 'meeting' ? 'Reunir' : 'WhatsApp'
      const title = `${meta.icon} ${actionVerb} a ${contact.nome}`

      const payload: Record<string, unknown> = {
        title,
        due_date: dueDate,
        entity_type: scopeNegocioId ? 'negocio' : 'lead',
        entity_id: scopeNegocioId || contact.id,
      }
      if (notes.trim()) payload.description = notes.trim()

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || `Falha (HTTP ${res.status})`)
      }
      toast.success('Follow-up agendado.')
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao agendar')
      console.error('[voice follow-up] save failed:', err)
    } finally {
      setSaving(false)
    }
  }, [canSave, channel, contact.id, contact.nome, dueDate, notes, scopeNegocioId, onSaved])

  const inputCls =
    'bg-white/5 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/40 h-9 text-sm'

  return (
    <div className="mt-6 text-left">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </button>

      <div className="rounded-2xl bg-white/10 border border-white/20 p-5 space-y-4 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Check className="h-4 w-4" />
            Agendar follow-up
          </div>
          <VoiceMicButton
            state={voiceState}
            onStart={startVoice}
            onStop={stopVoice}
          />
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">Contacto</label>
          <button
            type="button"
            onClick={() =>
              onChangeRecipient?.({ dueDate, channel, notes })
            }
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition-colors',
              'cursor-pointer hover:ring-2 hover:ring-white/30',
              'bg-emerald-500/15 ring-1 ring-emerald-500/30 text-white'
            )}
            title="Mudar contacto"
          >
            <User className="h-3 w-3" />
            <span className="font-medium">{contact.nome}</span>
            {contact.telemovel && <span className="text-white/60">· {contact.telemovel}</span>}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
        </div>

        {negocios.length > 0 && (
          <div>
            <label className="text-xs text-white/60 mb-1 block">Associar a</label>
            <div className="flex flex-wrap gap-1.5" data-no-long-press>
              <button
                type="button"
                onClick={() => setScopeNegocioId('')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition-colors',
                  scopeNegocioId === ''
                    ? 'bg-white/20 ring-1 ring-white/40 text-white'
                    : 'bg-white/5 ring-1 ring-white/10 text-white/70 hover:bg-white/10'
                )}
              >
                <User className="h-3 w-3" />
                Contacto
              </button>
              {negocios.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setScopeNegocioId(n.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition-colors',
                    scopeNegocioId === n.id
                      ? 'bg-white/20 ring-1 ring-white/40 text-white'
                      : 'bg-white/5 ring-1 ring-white/10 text-white/70 hover:bg-white/10'
                  )}
                >
                  <Building2 className="h-3 w-3" />
                  {n.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-white/60 mb-1 block">Canal</label>
          <div className="inline-flex flex-wrap gap-1.5" data-no-long-press>
            {(['call', 'whatsapp', 'email', 'meeting'] as FollowUpChannel[]).map((c) => {
              const meta = FOLLOW_UP_CHANNEL_META[c]
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setChannel(c)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition-colors',
                    channel === c
                      ? 'bg-white/20 ring-1 ring-white/40 text-white'
                      : 'bg-white/5 ring-1 ring-white/10 text-white/70 hover:bg-white/10'
                  )}
                >
                  <span>{meta.icon}</span>
                  {meta.label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">Quando</label>
          <Input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">
            Notas <span className="text-white/40">(opcional)</span>
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Contexto do follow-up…"
            className="bg-white/5 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/40 text-sm resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          {!canSave && !saving && (
            <span className="mr-auto text-[11px] text-amber-200/80 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Escolhe uma data.
            </span>
          )}
          <Button variant="ghost" onClick={onBack} className="text-white hover:bg-white/10">
            Cancelar
          </Button>
          <Button onClick={doSave} disabled={!canSave}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                A agendar…
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1.5" />
                Agendar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Direct message panel (send_message tool) ────────────────────────────
//
// Minimal compose surface for a single recipient: channel toggle, message,
// optional subject (email only), optional scheduled_at. Handles both
// immediate send and WhatsApp scheduling via /api/voice/whatsapp-send
// (which branches internally when scheduled_at is set). Email scheduling
// is not yet supported server-side — the panel disables send + shows a
// hint when the user tries to combine email + a future datetime.

function DirectMessagePanel({
  data,
  onBack,
  onSent,
  onChangeRecipient,
}: {
  data: DirectMessage
  onBack: () => void
  onSent: () => void
  /** Opens the ContactPickerPanel so the user can swap out the recipient.
   *  The parent is responsible for restoring the DirectMessagePanel with
   *  the picked recipient + the current panel state preserved. */
  onChangeRecipient?: (currentFields: {
    channel: 'whatsapp' | 'email'
    message: string
    subject: string
    scheduledAt: string
  }) => void
}) {
  const [channel, setChannel] = useState<'whatsapp' | 'email'>(data.initialChannel)
  const [subject, setSubject] = useState(data.initialSubject ?? '')
  const [message, setMessage] = useState(data.initialMessage ?? '')
  const [scheduledAt, setScheduledAt] = useState(data.initialScheduledAt ?? '')
  const [sending, setSending] = useState(false)
  const [recipient, setRecipient] = useState<VoiceSearchRecipient>(data.recipient)
  // Mode dropdown — decoupled from scheduledAt so the user can toggle even
  // if GPT misread "às 18h" from the message body as an agendamento.
  const [mode, setMode] = useState<'now' | 'schedule'>(
    data.initialScheduledAt ? 'schedule' : 'now'
  )

  // Voice refinement — lets the user keep dictating adjustments against
  // the current state (append to message, switch channel, add schedule,
  // swap recipient). State hooked straight to GPT via voice-intent's
  // existingTool/existingArgs refine mode.
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'processing'>('idle')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const cleanupVoice = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    recorderRef.current = null
    chunksRef.current = []
  }, [])

  const applyRefine = useCallback(
    async (refinedArgs: Record<string, any>) => {
      // Merge fields the model surfaced. Empty/missing values are ignored —
      // we never overwrite existing state with ""; the assistant is
      // instructed to only include fields the user explicitly changed.
      if (typeof refinedArgs.message === 'string' && refinedArgs.message.trim()) {
        setMessage(refinedArgs.message)
      }
      if (refinedArgs.channel === 'email' || refinedArgs.channel === 'whatsapp') {
        setChannel(refinedArgs.channel)
      }
      if (typeof refinedArgs.subject === 'string' && refinedArgs.subject.trim()) {
        setSubject(refinedArgs.subject)
      }
      if (typeof refinedArgs.scheduled_at === 'string' && refinedArgs.scheduled_at.trim()) {
        setScheduledAt(refinedArgs.scheduled_at)
        setMode('schedule')
      }
      // Recipient swap — only when the name actually changed. Resolves via
      // the same /api/leads lookup and adopts the first hit silently; if
      // ambiguous the user can still hit "Mudar" to open the picker.
      const nextName =
        typeof refinedArgs.contact_name === 'string' ? refinedArgs.contact_name.trim() : ''
      if (nextName && nextName.toLowerCase() !== recipient.nome.toLowerCase()) {
        try {
          const r = await fetch(`/api/leads?nome=${encodeURIComponent(nextName)}&limit=3`)
          if (r.ok) {
            const d = await r.json()
            const list: any[] = Array.isArray(d) ? d : d?.data || []
            if (list.length > 0) {
              const p = list[0]
              setRecipient({
                id: String(p.id),
                nome: String(p.nome ?? ''),
                email: p.email ? String(p.email) : undefined,
                telemovel: p.telemovel ? String(p.telemovel) : undefined,
                nif: p.nif ? String(p.nif) : undefined,
              })
            } else {
              toast.warning(`Não encontrei "${nextName}" — usa Mudar para procurar.`)
            }
          }
        } catch {
          // ignore — user can still hit Mudar
        }
      }
    },
    [recipient.nome]
  )

  const startVoice = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        cleanupVoice()
        setVoiceState('processing')
        try {
          const fd = new FormData()
          fd.append('audio', blob)
          const tRes = await fetch('/api/transcribe', { method: 'POST', body: fd })
          if (!tRes.ok) throw new Error('Falha na transcrição')
          const { text } = await tRes.json()
          const t = (text || '').trim()
          if (!t) throw new Error('Não captei nenhum som')

          // Reconstruct the current state as send_message args so GPT can
          // diff against them in refine mode.
          const existingArgs: Record<string, any> = {
            contact_name: recipient.nome,
            channel,
            message,
          }
          if (subject.trim()) existingArgs.subject = subject
          if (mode === 'schedule' && scheduledAt.trim()) {
            existingArgs.scheduled_at = scheduledAt
          }

          const iRes = await fetch('/api/ai/voice-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transcript: t,
              context: {
                existingTool: 'send_message',
                existingArgs,
              },
            }),
          })
          if (!iRes.ok) throw new Error('Falha ao refinar')
          const data = await iRes.json()
          if (!data?.args) {
            toast.warning(data?.message || 'Não consegui perceber.')
            return
          }
          await applyRefine(data.args)
          toast.success('Actualizado.')
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Erro ao refinar.')
        } finally {
          setVoiceState('idle')
        }
      }
      recorder.start()
      setVoiceState('recording')
    } catch {
      toast.error('Não foi possível aceder ao microfone.')
      setVoiceState('idle')
    }
  }, [cleanupVoice, recipient.nome, channel, message, subject, mode, scheduledAt, applyRefine])

  const stopVoice = useCallback(() => {
    if (recorderRef.current && voiceState === 'recording') {
      recorderRef.current.stop()
      setVoiceState('processing')
    }
  }, [voiceState])

  useEffect(() => () => cleanupVoice(), [cleanupVoice])

  // Keep mode ↔ scheduledAt in sync: entering "schedule" without a value
  // defaults to "now + 1h"; switching back to "now" clears the field.
  const handleModeChange = (next: 'now' | 'schedule') => {
    setMode(next)
    if (next === 'now') {
      setScheduledAt('')
    } else if (!scheduledAt.trim()) {
      const d = new Date(Date.now() + 60 * 60 * 1000)
      // datetime-local format: YYYY-MM-DDTHH:MM (no seconds, no TZ)
      const pad = (n: number) => String(n).padStart(2, '0')
      const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      setScheduledAt(local)
    }
  }

  const channelAvailable = channel === 'email' ? Boolean(recipient.email) : Boolean(recipient.telemovel)
  const scheduleActive = mode === 'schedule' && Boolean(scheduledAt.trim())
  const emailScheduleAttempt = channel === 'email' && scheduleActive

  const canSend =
    channelAvailable &&
    message.trim().length > 0 &&
    !emailScheduleAttempt &&
    // In schedule mode the datetime must be filled; "now" mode doesn't care.
    (mode === 'now' || Boolean(scheduledAt.trim())) &&
    !sending

  const doSend = useCallback(async () => {
    if (!canSend) return
    setSending(true)
    try {
      if (channel === 'whatsapp') {
        const body: Record<string, unknown> = {
          phones: [recipient.telemovel],
          text: message.trim(),
        }
        if (scheduleActive) body.scheduled_at = scheduledAt
        const res = await fetch('/api/voice/whatsapp-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error || `Falha ao enviar (HTTP ${res.status})`)
        }
        const out = await res.json()
        if ((out.sent ?? 0) === 0) {
          const firstErr: string | undefined = Array.isArray(out.details)
            ? out.details.find((d: any) => !d.ok)?.error
            : undefined
          throw new Error(firstErr || 'Mensagem não entregue')
        }
        toast.success(out.scheduled ? 'Mensagem agendada' : 'Mensagem enviada')
      } else {
        // Email — immediate only (scheduling not yet supported)
        const res = await fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: [recipient.email],
            subject: subject.trim() || 'Mensagem',
            body_html: message.trim().replace(/\n/g, '<br>'),
            body_text: message.trim(),
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error || err?.message || `Falha ao enviar (HTTP ${res.status})`)
        }
        toast.success('Email enviado')
      }
      onSent()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar')
      console.error('[voice direct message] send failed:', err)
    } finally {
      setSending(false)
    }
  }, [canSend, channel, message, subject, scheduledAt, recipient, onSent])

  const inputCls =
    'bg-white/5 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/40 h-9 text-sm'

  return (
    <div className="mt-6 text-left">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </button>

      <div className="rounded-2xl bg-white/10 border border-white/20 p-5 space-y-4 backdrop-blur">
        <div className="flex items-center justify-between gap-2" data-no-long-press>
          <div className="flex items-center gap-2">
            {channel === 'email' ? <Mail className="h-4 w-4 text-white" /> : <MessageCircle className="h-4 w-4 text-white" />}
            <Select value={mode} onValueChange={(v) => handleModeChange(v as 'now' | 'schedule')}>
              <SelectTrigger
                className="h-auto border-0 bg-transparent hover:bg-white/10 text-sm font-semibold text-white gap-1.5 px-2 py-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 w-auto"
                data-no-long-press
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                position="popper"
                sideOffset={4}
                align="start"
                className="z-[300]"
                data-no-long-press
              >
                <SelectItem value="now">Enviar agora</SelectItem>
                <SelectItem value="schedule">Agendar para…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <VoiceMicButton
            state={voiceState}
            onStart={startVoice}
            onStop={stopVoice}
          />
        </div>

        {/* Recipient — clickable chip opens the picker for a swap */}
        <div>
          <label className="text-xs text-white/60 mb-1 block">Destinatário</label>
          <button
            type="button"
            onClick={() =>
              onChangeRecipient?.({ channel, message, subject, scheduledAt })
            }
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition-colors',
              'cursor-pointer hover:ring-2 hover:ring-white/30',
              channelAvailable
                ? 'bg-emerald-500/15 ring-1 ring-emerald-500/30 text-white'
                : 'bg-red-500/15 ring-1 ring-red-500/40 text-red-100'
            )}
            title="Mudar destinatário"
          >
            <User className="h-3 w-3" />
            <span className="font-medium">{recipient.nome}</span>
            {channel === 'email' && recipient.email && (
              <span className="text-white/60">· {recipient.email}</span>
            )}
            {channel === 'whatsapp' && recipient.telemovel && (
              <span className="text-white/60">· {recipient.telemovel}</span>
            )}
            {!channelAvailable && (
              <span className="text-red-200/80">
                sem {channel === 'email' ? 'email' : 'telemóvel'}
              </span>
            )}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
        </div>

        {/* Channel toggle */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/60">Canal:</label>
          <div className="inline-flex rounded-lg bg-white/5 ring-1 ring-white/10 p-0.5" data-no-long-press>
            <button
              type="button"
              onClick={() => setChannel('whatsapp')}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5',
                channel === 'whatsapp'
                  ? 'bg-white/20 text-white'
                  : 'text-white/60 hover:text-white'
              )}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setChannel('email')}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5',
                channel === 'email'
                  ? 'bg-white/20 text-white'
                  : 'text-white/60 hover:text-white'
              )}
            >
              <Mail className="h-3.5 w-3.5" />
              Email
            </button>
          </div>
        </div>

        {channel === 'email' && (
          <div>
            <label className="text-xs text-white/60 mb-1 block">Assunto</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="(opcional)"
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
            placeholder="Escreve a tua mensagem…"
            className="bg-white/5 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/40 text-sm resize-none"
          />
        </div>

        {mode === 'schedule' && (
          <div>
            <label className="text-xs text-white/60 mb-1 block">Agendar para</label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className={inputCls}
            />
            {emailScheduleAttempt && (
              <p className="mt-1 text-[11px] text-amber-200/80 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Agendamento de email ainda não disponível. Muda para "Enviar agora" ou escolhe WhatsApp.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          {!canSend && !sending && !emailScheduleAttempt && (
            <span className="mr-auto text-[11px] text-amber-200/80 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {!channelAvailable
                ? `Sem ${channel === 'email' ? 'email' : 'telemóvel'} para este contacto.`
                : message.trim().length === 0
                  ? 'Escreve uma mensagem.'
                  : 'Preenche os campos em falta.'}
            </span>
          )}
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
                {scheduleActive ? 'Agendar' : 'Enviar'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
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
        // Individual emails — one POST per recipient. Capture the first real
        // error so the user can tell WHY a send failed (e.g. no SMTP account
        // configured, invalid recipient, etc.).
        let ok = 0
        let fail = 0
        let lastError = ''
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
            if (res.ok) {
              ok += 1
            } else {
              fail += 1
              const body = await res.json().catch(() => ({}))
              if (!lastError) lastError = body?.error || body?.message || `HTTP ${res.status}`
            }
          } catch (e) {
            fail += 1
            if (!lastError) lastError = e instanceof Error ? e.message : 'Erro de rede'
          }
        }
        if (ok === 0) {
          throw new Error(lastError || 'Não foi possível enviar o email.')
        }
        if (fail === 0) {
          toast.success(`${ok} email${ok !== 1 ? 's' : ''} enviado${ok !== 1 ? 's' : ''}`)
        } else {
          toast.warning(`${ok} enviado${ok !== 1 ? 's' : ''}, ${fail} com erro: ${lastError}`)
        }
      } else {
        const phones = validRecipients.map((r) => r.telemovel!).filter(Boolean)
        const res = await fetch('/api/voice/whatsapp-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phones, text: message }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error || `Falha ao enviar WhatsApp (HTTP ${res.status})`)
        }
        const out = await res.json()
        if (out.failed === 0) {
          toast.success(`${out.sent} WhatsApp enviado${out.sent !== 1 ? 's' : ''}`)
        } else {
          const firstErr: string | undefined = Array.isArray(out.details)
            ? out.details.find((d: any) => !d.ok)?.error
            : undefined
          toast.warning(
            `${out.sent} enviado${out.sent !== 1 ? 's' : ''}, ${out.failed} com erro${firstErr ? `: ${firstErr}` : ''}`
          )
        }
      }
      onSent()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar')
      console.error('[voice compose] send failed:', err)
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
          {!canSend && !sending && (
            <span className="mr-auto text-[11px] text-amber-200/80 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {message.trim().length === 0
                ? 'Mensagem vazia.'
                : recipients.length === 0
                  ? 'Adiciona pelo menos um destinatário.'
                  : validRecipients.length === 0
                    ? `Nenhum destinatário tem ${channel === 'email' ? 'email' : 'telemóvel'}.`
                    : 'Preenche os campos em falta.'}
            </span>
          )}
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
  if (result.kind === 'partner') {
    const pc = result.partnerCard
    const catLabel = pc?.categoryLabel || 'parceiro'
    const contactLines = [
      `Nome: ${result.title}`,
      pc?.contactPerson ? `Contacto: ${pc.contactPerson}` : null,
      pc?.phone ? `Telemóvel: ${pc.phone}` : null,
      pc?.phoneSecondary ? `Telemóvel alternativo: ${pc.phoneSecondary}` : null,
      pc?.email ? `Email: ${pc.email}` : null,
      pc?.city ? `Cidade: ${pc.city}` : null,
      pc?.website ? `Website: ${pc.website}` : null,
    ]
      .filter(Boolean)
      .join('\n')
    if (channel === 'email') {
      return `Olá,\n\nSegue o contacto do nosso parceiro de ${catLabel}:\n\n${contactLines}\n\nCumprimentos`
    }
    return `Olá! Segue o contacto do nosso parceiro de ${catLabel}:\n\n${contactLines}`
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

  if (type === 'consultant-select') {
    return (
      <ConsultantSelect
        value={value == null ? '' : String(value)}
        onChange={(v) => onChange(v)}
        placeholder="—"
      />
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

// ── Consultant select (shared) ────────────────────────────────────────────

function ConsultantSelect({
  value,
  onChange,
  placeholder = '—',
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const { consultants } = useConsultants()
  const inputCls =
    'bg-white/5 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/40 h-8 text-sm'
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn(inputCls, 'w-full', className)} data-no-long-press>
        <SelectValue placeholder={placeholder} />
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

// ── Property match hint ──────────────────────────────────────────────────
// Debounced search against /api/properties so the user adopts a real
// imóvel during the review step instead of having the submit resolve it
// blindly. Used by create_visit (mirrors OwnerMatchHint for leads).

interface PropertyMatch {
  id: string
  title: string
  city?: string
  zone?: string
  external_ref?: string
  listing_price?: number | null
}

function PropertyMatchHint({
  query,
  adoptedId,
  onAdopt,
  onUnlink,
}: {
  query: string
  adoptedId?: string
  onAdopt: (match: PropertyMatch) => void
  onUnlink: () => void
}) {
  const [matches, setMatches] = useState<PropertyMatch[]>([])
  const trimmed = (query ?? '').trim()
  const adopted = adoptedId
    ? matches.find((m) => m.id === adoptedId) ?? null
    : null

  useEffect(() => {
    if (adoptedId) return // already linked — stop searching
    if (trimmed.length < 2) {
      setMatches([])
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/properties?search=${encodeURIComponent(trimmed)}&per_page=5`
        )
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (cancelled) return
        const raw: any[] = Array.isArray(data?.data) ? data.data : []
        setMatches(
          raw.slice(0, 4).map((r: any) => ({
            id: String(r.id),
            title: String(r.title || 'Imóvel'),
            city: r.city ? String(r.city) : undefined,
            zone: r.zone ? String(r.zone) : undefined,
            external_ref: r.external_ref ? String(r.external_ref) : undefined,
            listing_price: r.listing_price ?? null,
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
  }, [trimmed, adoptedId])

  if (adoptedId) {
    // The matches list may have been cleared after adoption — still show the
    // banner using the raw query when we can't find the full record.
    const label = adopted?.title || trimmed
    return (
      <div className="mt-1.5 rounded-md bg-emerald-500/15 ring-1 ring-emerald-500/30 px-2.5 py-2 text-xs text-left flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-emerald-100 min-w-0">
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            Ligado ao imóvel <span className="font-medium">{label}</span>
          </span>
        </span>
        <button
          type="button"
          onClick={onUnlink}
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
        <Building2 className="h-3.5 w-3.5" />
        Imóveis encontrados — toca para escolher:
      </p>
      <div className="flex flex-col gap-1.5">
        {matches.map((m) => {
          const meta = [m.city, m.external_ref].filter(Boolean).join(' · ')
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onAdopt(m)}
              className="text-left rounded-md bg-white/10 hover:bg-white/20 px-2.5 py-1.5 text-white transition-colors"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-medium truncate">
                <Building2 className="h-3 w-3 shrink-0" />
                {m.title}
              </div>
              {meta && <p className="ml-4 text-[10px] text-white/50 truncate">{meta}</p>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
