'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Mic, Square, Play, Pause, Trash2, Send, X } from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { cn } from '@/lib/utils'
import { VOICE_LABELS } from '@/lib/constants'
import { toast } from 'sonner'

interface VoiceRecorderProps {
  onSend: (audioBlob: Blob, durationMs: number) => Promise<void>
  onCancel: () => void
  autoStart?: boolean
  disabled?: boolean
}

type RecorderState = 'idle' | 'recording' | 'preview'

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Number of bars in the waveform visualizer
const BAR_COUNT = 40

export function VoiceRecorder({ onSend, onCancel, autoStart, disabled }: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle')
  const [durationMs, setDurationMs] = useState(0)
  const [isSending, setIsSending] = useState(false)
  const [liveWaveform, setLiveWaveform] = useState<number[]>(new Array(BAR_COUNT).fill(4))
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackProgress, setPlaybackProgress] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioBlobRef = useRef<Blob | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)
  const playbackAnimRef = useRef<number | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      if (playbackAnimRef.current) cancelAnimationFrame(playbackAnimRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause()
        audioPlayerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Live waveform visualization from microphone
  const startVisualization = useCallback((stream: MediaStream) => {
    const audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 128
    analyser.smoothingTimeConstant = 0.7
    source.connect(analyser)
    analyserRef.current = analyser

    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    const draw = () => {
      analyser.getByteFrequencyData(dataArray)

      // Map frequency data to bar heights (4-40px range)
      const bars: number[] = []
      const step = Math.floor(dataArray.length / BAR_COUNT)
      for (let i = 0; i < BAR_COUNT; i++) {
        const idx = Math.min(i * step, dataArray.length - 1)
        const value = dataArray[idx]
        // Normalize to 4-40 range
        const height = Math.max(4, Math.round((value / 255) * 40))
        bars.push(height)
      }
      setLiveWaveform(bars)
      animationFrameRef.current = requestAnimationFrame(draw)
    }

    draw()
  }, [])

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('API de microfone não disponível. Verifique se está em HTTPS.')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      audioChunksRef.current = []

      const mimeOptions = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', '']
      let selectedMime = ''
      for (const mime of mimeOptions) {
        if (!mime || MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime
          break
        }
      }

      const recorderOptions: MediaRecorderOptions = selectedMime ? { mimeType: selectedMime } : {}
      const mediaRecorder = new MediaRecorder(stream, recorderOptions)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType })
        audioBlobRef.current = blob
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        setState('preview')

        // Stop mic stream
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }

      mediaRecorder.start(200) // collect data every 200ms
      startTimeRef.current = Date.now()
      setState('recording')

      // Timer
      timerRef.current = setInterval(() => {
        setDurationMs(Date.now() - startTimeRef.current)
      }, 100)

      // Start live visualization
      startVisualization(stream)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        toast.error(VOICE_LABELS.mic_denied)
      } else {
        toast.error(`Erro ao gravar: ${msg}`)
      }
      // If autoStart failed, go back to parent
      if (autoStart) onCancel()
    }
  }, [startVisualization, autoStart, onCancel])

  // Auto-start recording on mount if requested
  const autoStartedRef = useRef(false)
  useEffect(() => {
    if (autoStart && !autoStartedRef.current) {
      autoStartedRef.current = true
      startRecording()
    }
  }, [autoStart, startRecording])

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    setDurationMs(Date.now() - startTimeRef.current)
  }, [])

  // Discard recording and notify parent
  const discardRecording = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause()
      audioPlayerRef.current = null
    }
    if (playbackAnimRef.current) cancelAnimationFrame(playbackAnimRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    audioBlobRef.current = null
    setAudioUrl(null)
    setDurationMs(0)
    setIsPlaying(false)
    setPlaybackProgress(0)
    setLiveWaveform(new Array(BAR_COUNT).fill(4))
    setState('idle')
    onCancel()
  }, [audioUrl, onCancel])

  // Playback preview
  const togglePlayback = useCallback(() => {
    if (!audioUrl) return

    if (isPlaying && audioPlayerRef.current) {
      audioPlayerRef.current.pause()
      if (playbackAnimRef.current) cancelAnimationFrame(playbackAnimRef.current)
      setIsPlaying(false)
      return
    }

    const audio = audioPlayerRef.current || new Audio(audioUrl)
    audioPlayerRef.current = audio

    if (playbackProgress >= 1) {
      audio.currentTime = 0
      setPlaybackProgress(0)
    }

    audio.play()
    setIsPlaying(true)

    const updateProgress = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setPlaybackProgress(audio.currentTime / audio.duration)
      }
      if (!audio.paused) {
        playbackAnimRef.current = requestAnimationFrame(updateProgress)
      }
    }
    playbackAnimRef.current = requestAnimationFrame(updateProgress)

    audio.onended = () => {
      setIsPlaying(false)
      setPlaybackProgress(1)
      if (playbackAnimRef.current) cancelAnimationFrame(playbackAnimRef.current)
    }
  }, [audioUrl, isPlaying, playbackProgress])

  // Seek in preview
  const handleSeek = useCallback((values: number[]) => {
    const val = values[0] / 100
    setPlaybackProgress(val)
    if (audioPlayerRef.current && audioPlayerRef.current.duration) {
      audioPlayerRef.current.currentTime = val * audioPlayerRef.current.duration
    }
  }, [])

  // Send
  const handleSend = useCallback(async () => {
    if (!audioBlobRef.current) return
    setIsSending(true)
    try {
      await onSend(audioBlobRef.current, durationMs)
      discardRecording()
    } finally {
      setIsSending(false)
    }
  }, [onSend, durationMs, discardRecording])

  // --- IDLE: just a mic icon ---
  if (state === 'idle') {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 text-muted-foreground"
        onClick={startRecording}
        disabled={disabled}
        title={VOICE_LABELS.record}
      >
        <Mic className="h-4 w-4" />
      </Button>
    )
  }

  // --- RECORDING: live waveform + timer + stop ---
  if (state === 'recording') {
    return (
      <div className="flex items-center gap-3 w-full animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
        {/* Cancel */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => {
            stopRecording()
            // Wait for onstop to set preview, then discard
            setTimeout(discardRecording, 100)
          }}
          title={VOICE_LABELS.cancel}
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Recording indicator */}
        <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />

        {/* Live waveform */}
        <div className="flex-1 flex items-center justify-center gap-[2px] h-10 overflow-hidden">
          {liveWaveform.map((height, i) => (
            <div
              key={i}
              className="w-[3px] rounded-full bg-primary/70 transition-[height] duration-75"
              style={{ height: `${height}px` }}
            />
          ))}
        </div>

        {/* Timer */}
        <span className="text-sm font-mono tabular-nums text-muted-foreground w-12 text-right shrink-0">
          {formatDuration(durationMs)}
        </span>

        {/* Stop */}
        <Button
          size="sm"
          variant="destructive"
          className="h-8 w-8 p-0 rounded-full shrink-0"
          onClick={stopRecording}
          title={VOICE_LABELS.stop}
        >
          <Square className="h-3.5 w-3.5 fill-current" />
        </Button>
      </div>
    )
  }

  // --- PREVIEW: playback + waveform slider + send/discard ---
  return (
    <div className="flex items-center gap-2 w-full animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
      {/* Discard */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={discardRecording}
        disabled={isSending}
        title={VOICE_LABELS.discard}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      {/* Play/Pause */}
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-full"
        onClick={togglePlayback}
        disabled={isSending}
        title={isPlaying ? VOICE_LABELS.pause : VOICE_LABELS.play}
      >
        {isPlaying ? (
          <Pause className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
        )}
      </Button>

      {/* Waveform-style progress bar */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div className="flex-1 relative">
          <Slider
            value={[playbackProgress * 100]}
            min={0}
            max={100}
            step={0.5}
            onValueChange={handleSeek}
            className={cn(
              '[&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-track]]:bg-primary/15',
              '[&_[data-slot=slider-range]]:bg-primary/60',
              '[&_[data-slot=slider-thumb]]:h-3 [&_[data-slot=slider-thumb]]:w-3',
              '[&_[data-slot=slider-thumb]]:border-primary',
            )}
            disabled={isSending}
          />
        </div>
        <span className="text-xs font-mono tabular-nums text-muted-foreground shrink-0 w-10 text-right">
          {formatDuration(durationMs)}
        </span>
      </div>

      {/* Send */}
      <Button
        size="sm"
        className="h-8 gap-1.5 shrink-0 rounded-full"
        onClick={handleSend}
        disabled={isSending || disabled}
      >
        {isSending ? (
          <Spinner variant="infinite" size={14} />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
        <span className="text-xs">{VOICE_LABELS.send}</span>
      </Button>
    </div>
  )
}

// --- Playback component for received voice messages ---

interface VoiceMessagePlayerProps {
  src: string
  duration?: number
  fileName?: string
  /** 'own' = dark bg (primary), 'other' = light bg (muted) */
  variant?: 'own' | 'other'
}

/**
 * Gera alturas determinísticas para as barras do waveform a partir do
 * `src`. Decode real do áudio é caro (precisa Web Audio API + fetch +
 * AudioContext.decodeAudioData) — para o nosso caso, um waveform
 * "natural-looking" estável serve. WhatsApp Web faz decode real;
 * aqui geramos pseudo-amplitudes a partir de um hash do src.
 */
function getWaveformBars(src: string, count = 24): number[] {
  let hash = 0
  for (let i = 0; i < src.length; i++) {
    hash = ((hash << 5) - hash) + src.charCodeAt(i)
    hash |= 0
  }
  const bars: number[] = []
  for (let i = 0; i < count; i++) {
    // Mistura linear congruential com sin/cos para evitar barras lineares.
    const seed = Math.abs((hash + i * 2654435761) | 0)
    const r = (seed % 1000) / 1000
    const wave = (Math.sin(i * 0.5) + 1) / 2
    const mix = (r * 0.65 + wave * 0.35) // 0..1
    // Floor 0.2 para barras curtas continuarem visíveis.
    bars.push(0.2 + mix * 0.8)
  }
  return bars
}

export function VoiceMessagePlayer({ src, duration, variant = 'own' }: VoiceMessagePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(duration ? duration / 1000 : 0)
  const [resolvedDuration, setResolvedDuration] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const animRef = useRef<number | null>(null)
  const playStartRef = useRef<number>(0)
  const elapsedBeforePauseRef = useRef<number>(0)
  // Ref síncrono para o update loop ler a duração sempre actualizada,
  // sem depender do closure do togglePlay (que pode ficar stale).
  const totalDurationRef = useRef(totalDuration)
  useEffect(() => { totalDurationRef.current = totalDuration }, [totalDuration])

  // Pré-carrega o áudio (metadata + handlers) no mount. Permite mostrar
  // a duração total antes de play (estilo WhatsApp) e centraliza toda
  // a configuração — togglePlay limita-se a play/pause sem ter de
  // re-criar o elemento.
  //
  // ⚠️ webm-Infinity-fix: ficheiros webm gravados pelo MediaRecorder
  // (todas as voice messages no nosso chat) reportam
  // `audio.duration === Infinity` mesmo depois do metadata carregar. O
  // truque clássico para obter a duração real: seek para o fim
  // (`currentTime = 1e10`), esperar pelo `timeupdate`, ler o
  // `currentTime` (que agora é a duração real), e reset para 0. Sem
  // este fix nem o label da direita nem a barra de progresso funcionam.
  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.src = src

    const resolveDuration = (realDuration: number) => {
      if (isFinite(realDuration) && realDuration > 0) {
        setTotalDuration(realDuration)
        setResolvedDuration(true)
      }
    }

    audio.onloadedmetadata = () => {
      // Caso normal: duration finita imediatamente.
      if (isFinite(audio.duration) && audio.duration > 0) {
        resolveDuration(audio.duration)
        return
      }
      // webm Infinity: aplica seek-trick em background para resolver
      // duration ANTES do primeiro play — assim o label da direita já
      // mostra a duração total na carga inicial. Caso o user clique
      // play antes disto terminar, togglePlay tem o seu próprio guard.
      const onTimeUpdate = () => {
        const real = audio.currentTime
        audio.removeEventListener('timeupdate', onTimeUpdate)
        audio.currentTime = 0
        resolveDuration(real)
      }
      audio.addEventListener('timeupdate', onTimeUpdate)
      audio.currentTime = 1e10
    }
    audio.onerror = () => {
      toast.error('Erro ao reproduzir áudio')
      setIsPlaying(false)
    }
    audio.onended = () => {
      setIsPlaying(false)
      setProgress(1)
      const elapsed = elapsedBeforePauseRef.current + (Date.now() - playStartRef.current) / 1000
      if (audioRef.current && (!isFinite(audioRef.current.duration) || audioRef.current.duration <= 0)) {
        // Fallback final caso o seek-trick também tenha falhado.
        resolveDuration(elapsed)
        setCurrentTime(elapsed)
      } else if (audioRef.current) {
        setCurrentTime(audioRef.current.duration)
      }
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
    audioRef.current = audio
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      audio.pause()
      audioRef.current = null
    }
  }, [src])

  // Helper: check if we have a finite duration (from metadata or from ended event)
  const hasDuration = totalDuration > 0 && resolvedDuration

  const togglePlay = useCallback(async () => {
    if (!audioRef.current) return // useEffect ainda não criou (não devia acontecer)
    const audio = audioRef.current

    // webm-Infinity-fix: resolve a duração antes do primeiro play. O
    // MediaRecorder do browser produz webm com `duration === Infinity`
    // e a única forma de obter o valor real é seek-to-end + ler
    // currentTime no `timeupdate`. Fazemos isto antes de play para
    // evitar UX ruidoso (currentTime saltar durante a reprodução).
    if (!resolvedDuration && (!isFinite(audio.duration) || audio.duration <= 0)) {
      await new Promise<void>((resolve) => {
        const cleanup = () => {
          audio.removeEventListener('timeupdate', onUpdate)
          audio.removeEventListener('seeked', onSeeked)
          if (timeoutId) clearTimeout(timeoutId)
        }
        const finish = (real: number) => {
          cleanup()
          audio.currentTime = 0
          if (isFinite(real) && real > 0) {
            setTotalDuration(real)
            setResolvedDuration(true)
          }
          resolve()
        }
        const onUpdate = () => finish(audio.currentTime)
        const onSeeked = () => finish(audio.currentTime)
        // Safety net se nem `timeupdate` nem `seeked` dispararem
        // (ex.: browser sem suporte) — não bloqueia o user.
        const timeoutId = setTimeout(() => { cleanup(); resolve() }, 1500)
        audio.addEventListener('timeupdate', onUpdate)
        audio.addEventListener('seeked', onSeeked)
        audio.currentTime = 1e10
      })
    }

    if (isPlaying) {
      audioRef.current.pause()
      elapsedBeforePauseRef.current += (Date.now() - playStartRef.current) / 1000
      if (animRef.current) cancelAnimationFrame(animRef.current)
      setIsPlaying(false)
      return
    }

    if (progress >= 1) {
      audioRef.current.currentTime = 0
      setProgress(0)
      setCurrentTime(0)
      elapsedBeforePauseRef.current = 0
    }

    try {
      playStartRef.current = Date.now()
      await audioRef.current.play()
      setIsPlaying(true)

      const update = () => {
        if (audioRef.current && !audioRef.current.paused) {
          const dur = audioRef.current.duration
          const elapsed = elapsedBeforePauseRef.current + (Date.now() - playStartRef.current) / 1000
          // Lê via ref para apanhar updates posteriores ao closure
          // (ex: seek-trick que resolveu totalDuration entretanto).
          const tdur = totalDurationRef.current

          if (dur && isFinite(dur) && dur > 0) {
            // Caso normal: browser conhece a duração.
            setProgress(audioRef.current.currentTime / dur)
            setCurrentTime(audioRef.current.currentTime)
            if (!resolvedDuration) {
              setTotalDuration(dur)
              setResolvedDuration(true)
            }
          } else if (tdur > 0) {
            // webm Infinity mas com duration resolvida via seek-trick.
            setProgress(Math.min(elapsed / tdur, 0.99))
            setCurrentTime(elapsed)
          } else {
            // Sem duração ainda — só conta tempo. Progress não avança.
            setCurrentTime(elapsed)
          }
          animRef.current = requestAnimationFrame(update)
        }
      }
      animRef.current = requestAnimationFrame(update)
    } catch {
      toast.error('Erro ao reproduzir áudio')
      setIsPlaying(false)
    }
  }, [src, isPlaying, progress, totalDuration, resolvedDuration])

  const handleSeek = useCallback((values: number[]) => {
    const val = values[0] / 100
    setProgress(val)
    if (audioRef.current) {
      const dur = audioRef.current.duration
      if (dur && isFinite(dur)) {
        audioRef.current.currentTime = val * dur
        setCurrentTime(audioRef.current.currentTime)
      } else if (totalDuration > 0) {
        // For Infinity duration webm, seek is not reliable — update display only
        setCurrentTime(val * totalDuration)
      }
    }
  }, [totalDuration])

  // Time display: durante reprodução mostra current; em pausa/início
  // mostra total (estilo WhatsApp). Se não houver duration resolvida,
  // fallback ao currentTime.
  const currentDisplay = formatDuration(currentTime * 1000)
  const totalDisplay = hasDuration ? formatDuration(totalDuration * 1000) : null
  const timeLabel = isPlaying && totalDisplay ? currentDisplay : (totalDisplay ?? currentDisplay)

  const isOther = variant === 'other'

  // Bars determinísticas por src — mesma mensagem rende sempre o
  // mesmo waveform.
  const bars = useMemo(() => getWaveformBars(src), [src])

  // Click-to-seek: mapeia X do click para 0..1 e seeka.
  const handleWaveformClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    handleSeek([ratio * 100])
  }, [handleSeek])

  return (
    <div className="flex items-center gap-2.5 w-full max-w-[280px] min-w-0">
      {/* Play/Pause */}
      <button
        onClick={togglePlay}
        className={cn(
          'h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-colors',
          isOther
            ? 'bg-foreground/10 hover:bg-foreground/20'
            : 'bg-primary-foreground/20 hover:bg-primary-foreground/30'
        )}
      >
        {isPlaying ? (
          <Pause className={cn('h-3.5 w-3.5 fill-current', isOther ? 'text-foreground' : 'text-primary-foreground')} />
        ) : (
          <Play className={cn('h-3.5 w-3.5 fill-current ml-0.5', isOther ? 'text-foreground' : 'text-primary-foreground')} />
        )}
      </button>

      {/* Waveform (estilo WhatsApp) — barras com altura determinística
          a partir do src; renderizado em duplo layer para que a
          progressão seja pixel-perfect (não salta barra-a-barra).
          Camada 1: barras translúcidas, full width.
          Camada 2: cópia em cor sólida, clipped por `width: progress%`
          via overflow:hidden no wrapper. À medida que `progress` muda,
          a camada 2 estende-se para a direita revelando barras "tocadas"
          com transição suave. Click seeka. */}
      <div
        onClick={handleWaveformClick}
        className="relative flex-1 min-w-0 h-6 cursor-pointer overflow-hidden"
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        {/* Layer 1 — barras unfilled (background). `min-w-[2px]` evita que
            cada barra colapse para sub-pixel quando o bubble é estreito;
            o `overflow-hidden` no parent corta as últimas barras se o total
            exceder a largura disponível, mas mantém as visíveis legíveis. */}
        <div className="absolute inset-0 flex items-center gap-[2px]">
          {bars.map((h, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 min-w-[2px] rounded-full',
                isOther ? 'bg-foreground/30' : 'bg-primary-foreground/35',
              )}
              style={{ height: `${Math.round(h * 100)}%` }}
            />
          ))}
        </div>
        {/* Layer 2 — barras filled (clipped por width). Usa
            top/bottom/left (não `inset-0`!) para que `width` em pixels
            funcione — `inset-0` forçaria `right: 0` e `width:100%`,
            impedindo a animação. */}
        <div
          className="absolute top-0 bottom-0 left-0 overflow-hidden"
          style={{ width: `${progress * 100}%` }}
          aria-hidden="true"
        >
          <div
            className="h-full flex items-center gap-[2px]"
            style={{ width: `${(100 / Math.max(progress, 0.0001))}%` }}
          >
            {bars.map((h, i) => (
              <div
                key={i}
                className={cn(
                  'flex-1 min-w-[2px] rounded-full',
                  isOther ? 'bg-foreground' : 'bg-primary-foreground',
                )}
                style={{ height: `${Math.round(h * 100)}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Total time à direita (estilo WhatsApp — mostra duração total
          em pausa/início, currentTime durante reprodução). */}
      <span className={cn(
        'text-[10px] font-mono tabular-nums shrink-0',
        isOther ? 'text-muted-foreground' : 'text-primary-foreground/70'
      )}>
        {timeLabel}
      </span>
    </div>
  )
}
