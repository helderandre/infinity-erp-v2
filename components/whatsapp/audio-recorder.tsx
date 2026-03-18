'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, Square, Play, Pause, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AudioRecorderProps {
  onSend: (file: File) => void
  onStateChange?: (active: boolean) => void
  disabled?: boolean
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

type RecorderState = 'idle' | 'recording' | 'preview'

export function AudioRecorder({ onSend, onStateChange, disabled }: AudioRecorderProps) {
  const [state, _setState] = useState<RecorderState>('idle')
  const setState = useCallback((newState: RecorderState) => {
    _setState(newState)
    onStateChange?.(newState !== 'idle')
  }, [onStateChange])
  const [elapsed, setElapsed] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0)
  const [playbackDuration, setPlaybackDuration] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording(true)
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const drawWaveform = useCallback(() => {
    const analyser = analyserRef.current
    const canvas = canvasRef.current
    if (!analyser || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw)
      analyser.getByteTimeDomainData(dataArray)

      ctx.fillStyle = 'transparent'
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      ctx.lineWidth = 2
      ctx.strokeStyle = '#10b981'
      ctx.beginPath()

      const sliceWidth = canvas.width / bufferLength
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = (v * canvas.height) / 2

        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        x += sliceWidth
      }

      ctx.lineTo(canvas.width, canvas.height / 2)
      ctx.stroke()
    }

    draw()
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Audio analyser for waveform
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' })
        setAudioBlob(blob)
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        setState('preview')

        // Clean up stream
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(() => {})
          audioContextRef.current = null
        }
      }

      mediaRecorder.start(100)
      setState('recording')
      setElapsed(0)

      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1)
      }, 1000)

      drawWaveform()
    } catch {
      // Permission denied or no microphone
    }
  }, [drawWaveform, setState])

  const stopRecording = useCallback((cleanup = false) => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }

    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      if (cleanup) {
        // Discard — prevent onstop from setting preview
        recorder.ondataavailable = null
        recorder.onstop = null
        recorder.stop()
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      } else {
        recorder.stop()
      }
    }
    mediaRecorderRef.current = null

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
  }, [])

  const handleDiscard = useCallback(() => {
    if (state === 'recording') {
      stopRecording(true)
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioBlob(null)
    setAudioUrl(null)
    setIsPlaying(false)
    setPlaybackTime(0)
    setPlaybackDuration(0)
    setElapsed(0)
    setState('idle')
  }, [state, audioUrl, stopRecording, setState])

  const handleStop = useCallback(() => {
    stopRecording(false)
  }, [stopRecording])

  const togglePreviewPlay = useCallback(() => {
    if (!audioUrl) return

    if (!audioRef.current) {
      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.addEventListener('loadedmetadata', () => {
        if (audio.duration && isFinite(audio.duration)) {
          setPlaybackDuration(audio.duration)
        }
      })
      audio.addEventListener('timeupdate', () => {
        setPlaybackTime(audio.currentTime)
      })
      audio.addEventListener('ended', () => {
        setIsPlaying(false)
        setPlaybackTime(0)
      })
    }

    const audio = audioRef.current
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play()
      setIsPlaying(true)
    }
  }, [audioUrl, isPlaying])

  const handleSend = useCallback(() => {
    if (!audioBlob) return
    const file = new File([audioBlob], `audio-${Date.now()}.webm`, {
      type: 'audio/webm;codecs=opus',
    })
    onSend(file)
    // Reset
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioBlob(null)
    setAudioUrl(null)
    setIsPlaying(false)
    setPlaybackTime(0)
    setPlaybackDuration(0)
    setElapsed(0)
    setState('idle')
  }, [audioBlob, audioUrl, onSend, setState])

  // ── IDLE: just the mic button ──
  if (state === 'idle') {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 flex-shrink-0 text-muted-foreground hover:text-emerald-600"
        onClick={startRecording}
        disabled={disabled}
        title="Gravar áudio"
      >
        <Mic className="h-4.5 w-4.5" />
      </Button>
    )
  }

  // ── RECORDING: waveform + timer + stop/discard ──
  if (state === 'recording') {
    return (
      <div className="flex items-center gap-2 flex-1">
        {/* Discard */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 flex-shrink-0 text-destructive hover:text-destructive"
          onClick={handleDiscard}
          title="Descartar"
        >
          <Trash2 className="h-4 w-4" />
        </Button>

        {/* Recording indicator + waveform */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>

          <canvas
            ref={canvasRef}
            width={200}
            height={32}
            className="flex-1 h-8"
          />

          <span className="text-sm tabular-nums text-muted-foreground flex-shrink-0 w-10 text-right">
            {formatTime(elapsed)}
          </span>
        </div>

        {/* Stop */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 flex-shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50"
          onClick={handleStop}
          title="Parar gravação"
        >
          <Square className="h-4 w-4 fill-current" />
        </Button>
      </div>
    )
  }

  // ── PREVIEW: play/pause + progress + duration + discard/send ──
  const progress = playbackDuration > 0 ? (playbackTime / playbackDuration) * 100 : 0

  return (
    <div className="flex items-center gap-2 flex-1">
      {/* Discard */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 flex-shrink-0 text-destructive hover:text-destructive"
        onClick={handleDiscard}
        title="Descartar"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      {/* Play/Pause */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0"
        onClick={togglePreviewPlay}
      >
        {isPlaying
          ? <Pause className="h-3.5 w-3.5" />
          : <Play className="h-3.5 w-3.5 ml-0.5" />
        }
      </Button>

      {/* Progress bar */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground flex-shrink-0 w-8 text-right">
          {formatTime(isPlaying ? playbackTime : (playbackDuration || elapsed))}
        </span>
      </div>

      {/* Send */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 flex-shrink-0 text-emerald-600 hover:text-emerald-700"
        onClick={handleSend}
        disabled={disabled}
        title="Enviar áudio"
      >
        <Send className="h-4.5 w-4.5" />
      </Button>
    </div>
  )
}
