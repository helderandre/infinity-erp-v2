'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type Hls from 'hls.js'
import { VideoControls } from './video-controls'
import {
  useVideoProgressTracker,
  type HeartbeatPayload,
  type HeartbeatResult,
} from '@/hooks/use-video-progress-tracker'
import type { TrainingLessonProgress } from '@/types/training'

interface NativeVideoPlayerProps {
  videoUrl: string
  /** Adaptive HLS source (Cloudflare Stream / .m3u8) — attached via hls.js. */
  isHls: boolean
  title?: string
  progress?: TrainingLessonProgress | null
  /** Resume position in seconds (last_video_position_seconds | video_watched_seconds). */
  startAt?: number
  onProgressUpdate: (data: {
    status?: 'in_progress' | 'completed'
    video_watched_seconds?: number
    video_watch_percent?: number
    time_spent_seconds?: number
  }) => void
  onWatchPercentChange?: (percent: number) => void
  onHeartbeat?: (data: HeartbeatPayload) => Promise<HeartbeatResult | null | void> | void
}

/**
 * The custom-skinned player for uploaded videos (R2 mp4 + Cloudflare Stream HLS).
 * Replaces the browser's default chrome with the liquid-glass <VideoControls>
 * overlay, and routes every time tick through the shared coverage tracker so the
 * completion gate is anti-skip + speed-proof and resume works from where it stopped.
 */
export function NativeVideoPlayer({
  videoUrl,
  isHls,
  title,
  progress,
  startAt = 0,
  onProgressUpdate,
  onWatchPercentChange,
  onHeartbeat,
}: NativeVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hideControlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasSeekedRef = useRef(false)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [hasEnded, setHasEnded] = useState(false)
  const [playbackError, setPlaybackError] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)

  const { sample, markEnded } = useVideoProgressTracker({
    progress,
    enabled: true,
    onProgressUpdate,
    onWatchPercentChange,
    onHeartbeat,
  })

  // ─── Attach source (plain mp4 or adaptive HLS via hls.js / native Safari) ─
  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoUrl) return
    setPlaybackError(false)
    hasSeekedRef.current = false

    if (!isHls) {
      video.src = videoUrl
      return
    }
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = videoUrl
      return
    }

    let hls: Hls | null = null
    let cancelled = false
    import('hls.js')
      .then(({ default: HlsCtor }) => {
        if (cancelled || !videoRef.current) return
        if (HlsCtor.isSupported()) {
          hls = new HlsCtor({ enableWorker: true })
          hls.loadSource(videoUrl)
          hls.attachMedia(videoRef.current)
          hls.on(HlsCtor.Events.ERROR, (_evt, data) => {
            if (data?.fatal) setPlaybackError(true)
          })
        } else {
          videoRef.current.src = videoUrl
        }
      })
      .catch(() => setPlaybackError(true))

    return () => {
      cancelled = true
      if (hls) {
        hls.destroy()
        hls = null
      }
    }
  }, [videoUrl, isHls])

  // ─── Resume to last position once metadata is known ──────────────────────
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    setDuration(video.duration || 0)
    if (!hasSeekedRef.current && startAt > 0) {
      const dur = video.duration
      if (!dur || !isFinite(dur) || startAt < dur - 5) {
        video.currentTime = startAt
      }
      hasSeekedRef.current = true
    }
  }, [startAt])

  // ─── Time / buffer polling + event wiring ────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const syncBuffer = () => {
      try {
        if (video.buffered.length > 0 && video.duration > 0) {
          setBuffered(video.buffered.end(video.buffered.length - 1) / video.duration)
        }
      } catch {
        /* noop */
      }
    }
    const onPlay = () => {
      setIsPlaying(true)
      setHasEnded(false)
      setHasStarted(true)
    }
    const onPause = () => {
      setIsPlaying(false)
      sample({ currentTime: video.currentTime, duration: video.duration, isPlaying: false })
    }
    const onEnded = () => {
      setIsPlaying(false)
      setHasEnded(true)
      sample({ currentTime: video.currentTime, duration: video.duration, isPlaying: false })
      markEnded()
    }
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      if (video.duration > 0) setDuration(video.duration)
      syncBuffer()
    }
    const onVolume = () => {
      setVolume(video.volume)
      setIsMuted(video.muted)
    }

    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('ended', onEnded)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('volumechange', onVolume)
    video.addEventListener('progress', syncBuffer)

    // Smooth 250ms poll → drives the coverage tracker
    const poll = setInterval(() => {
      if (!video.paused && video.duration > 0) {
        setCurrentTime(video.currentTime)
        setDuration(video.duration)
        sample({ currentTime: video.currentTime, duration: video.duration, isPlaying: true })
      }
    }, 250)

    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('ended', onEnded)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('volumechange', onVolume)
      video.removeEventListener('progress', syncBuffer)
      clearInterval(poll)
    }
  }, [sample, markEnded])

  // ─── Controls auto-hide ──────────────────────────────────────────────────
  const resetHideTimer = useCallback(() => {
    setShowControls(true)
    if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current)
    hideControlsTimeout.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false)
    }, 3000)
  }, [])

  useEffect(() => {
    return () => {
      if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current)
    }
  }, [])

  // ─── Control actions ─────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) video.play().catch(() => {})
    else video.pause()
  }, [])

  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = time
    setCurrentTime(time)
  }, [])

  const handleSkip = useCallback(
    (seconds: number) => {
      const video = videoRef.current
      if (!video) return
      const next = Math.max(0, Math.min(video.currentTime + seconds, duration || video.duration || 0))
      video.currentTime = next
      setCurrentTime(next)
    },
    [duration]
  )

  const handleVolumeChange = useCallback((v: number) => {
    const video = videoRef.current
    if (!video) return
    video.volume = v
    video.muted = v === 0
  }, [])

  const handleToggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
  }, [])

  const handlePlaybackRateChange = useCallback((rate: number) => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = rate
    setPlaybackRate(rate)
  }, [])

  const handleToggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [])

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const replay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = 0
    setHasEnded(false)
    video.play().catch(() => {})
  }, [])

  return (
    <div
      ref={containerRef}
      className="group relative aspect-video w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/10"
      onMouseMove={resetHideTimer}
      onMouseLeave={() => {
        if (videoRef.current && !videoRef.current.paused) setShowControls(false)
      }}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full bg-black"
        preload="metadata"
        playsInline
        onLoadedMetadata={handleLoadedMetadata}
        onClick={togglePlay}
        onError={() => {
          if (isHls) setPlaybackError(true)
        }}
      />

      {/* Center play / replay affordance */}
      {!playbackError && (!isPlaying || hasEnded) && (
        <button
          type="button"
          aria-label={hasEnded ? 'Rever vídeo' : 'Reproduzir'}
          onClick={hasEnded ? replay : togglePlay}
          className={cn(
            'absolute inset-0 z-10 flex items-center justify-center',
            hasEnded && 'bg-black/50'
          )}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-transform duration-200 hover:scale-105">
            {hasEnded ? <RotateCcw className="h-7 w-7" /> : <Play className="ml-0.5 h-7 w-7" />}
          </span>
        </button>
      )}

      {/* Processing / unavailable overlay (HLS still transcoding) */}
      {playbackError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 bg-black/80 px-4 text-center text-sm text-white">
          <span className="font-medium">Vídeo a processar ou indisponível</span>
          <span className="text-xs text-white/70">
            Se acabou de ser enviado, a qualidade adaptativa pode demorar alguns minutos. Tenta
            novamente daqui a pouco.
          </span>
        </div>
      )}

      {/* Glass controls — auto-hide after 3s of playback */}
      {!playbackError && (
        <div
          className={cn(
            'absolute inset-x-0 bottom-0 z-30 px-3 pb-3 pt-10',
            'bg-gradient-to-t from-black/60 via-black/10 to-transparent',
            'transition-opacity duration-300',
            showControls || !hasStarted ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <VideoControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            buffered={buffered}
            volume={volume}
            isMuted={isMuted}
            playbackRate={playbackRate}
            isFullscreen={isFullscreen}
            onTogglePlay={togglePlay}
            onSeek={handleSeek}
            onSkip={handleSkip}
            onVolumeChange={handleVolumeChange}
            onToggleMute={handleToggleMute}
            onPlaybackRateChange={handlePlaybackRateChange}
            onToggleFullscreen={handleToggleFullscreen}
          />
        </div>
      )}

      {title ? <span className="sr-only">{title}</span> : null}
    </div>
  )
}
