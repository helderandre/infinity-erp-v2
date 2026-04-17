'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
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

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // Helper: check if we have a finite duration (from metadata or from ended event)
  const hasDuration = totalDuration > 0 && resolvedDuration

  const togglePlay = useCallback(async () => {
    if (!audioRef.current) {
      const audio = new Audio()
      audio.preload = 'auto'
      audio.src = src

      audio.onloadedmetadata = () => {
        if (isFinite(audio.duration) && audio.duration > 0) {
          setTotalDuration(audio.duration)
          setResolvedDuration(true)
        }
      }
      audio.onerror = () => {
        toast.error('Erro ao reproduzir áudio')
        setIsPlaying(false)
      }
      audio.onended = () => {
        setIsPlaying(false)
        setProgress(1)
        // Capture real duration from elapsed time if metadata was Infinity
        const elapsed = elapsedBeforePauseRef.current + (Date.now() - playStartRef.current) / 1000
        if (!resolvedDuration || totalDuration <= 0) {
          setTotalDuration(elapsed)
          setResolvedDuration(true)
        }
        setCurrentTime(totalDuration > 0 ? totalDuration : elapsed)
        if (animRef.current) cancelAnimationFrame(animRef.current)
      }

      audioRef.current = audio
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

          if (dur && isFinite(dur) && dur > 0) {
            // Normal case: browser knows the duration
            setProgress(audioRef.current.currentTime / dur)
            setCurrentTime(audioRef.current.currentTime)
            if (!resolvedDuration) {
              setTotalDuration(dur)
              setResolvedDuration(true)
            }
          } else if (totalDuration > 0) {
            // We know duration from a previous play or prop — estimate progress
            setProgress(Math.min(elapsed / totalDuration, 0.99))
            setCurrentTime(elapsed)
          } else {
            // Unknown duration — just count up, no progress bar advancement
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

  // Time display: "current / total" or just elapsed if total unknown
  const currentDisplay = formatDuration(currentTime * 1000)
  const totalDisplay = hasDuration ? formatDuration(totalDuration * 1000) : null

  const isOther = variant === 'other'

  return (
    <div className="flex items-center gap-2.5 w-[280px]">
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

      {/* Slider */}
      <div className="flex-1 min-w-0">
        <Slider
          value={[progress * 100]}
          min={0}
          max={100}
          step={0.5}
          onValueChange={handleSeek}
          className={cn(
            '[&_[data-slot=slider-track]]:h-1',
            '[&_[data-slot=slider-thumb]]:size-2.5',
            isOther
              ? [
                  '[&_[data-slot=slider-track]]:!bg-foreground/15',
                  '[&_[data-slot=slider-range]]:!bg-foreground/50',
                  '[&_[data-slot=slider-thumb]]:!border-foreground [&_[data-slot=slider-thumb]]:!bg-foreground',
                ]
              : [
                  '[&_[data-slot=slider-track]]:!bg-primary-foreground/25',
                  '[&_[data-slot=slider-range]]:!bg-primary-foreground/70',
                  '[&_[data-slot=slider-thumb]]:!border-primary-foreground [&_[data-slot=slider-thumb]]:!bg-primary-foreground',
                ]
          )}
        />
      </div>

      {/* Time */}
      <span className={cn(
        'text-[10px] font-mono tabular-nums shrink-0',
        isOther ? 'text-muted-foreground' : 'text-primary-foreground/70'
      )}>
        {totalDisplay ? `${currentDisplay} / ${totalDisplay}` : currentDisplay}
      </span>
    </div>
  )
}
