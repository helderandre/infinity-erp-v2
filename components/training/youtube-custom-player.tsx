'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import YouTube, { type YouTubeProps, type YouTubePlayer } from 'react-youtube'
import { VideoControls } from './video-controls'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TrainingLesson, TrainingLessonProgress } from '@/types/training'

interface YouTubeCustomPlayerProps {
  videoUrl: string
  lesson: TrainingLesson
  progress?: TrainingLessonProgress | null
  onProgressUpdate: (data: {
    video_watched_seconds?: number
    video_watch_percent?: number
    time_spent_seconds?: number
    status?: 'in_progress' | 'completed'
  }) => void
  onTimeUpdate?: (currentTime: number, duration: number) => void
}

export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export function YouTubeCustomPlayer({
  videoUrl,
  progress,
  onProgressUpdate,
  onTimeUpdate,
}: YouTubeCustomPlayerProps) {
  const playerRef = useRef<YouTubePlayer | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeSpentIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeSpentRef = useRef<number>(progress?.time_spent_seconds ?? 0)
  const lastSaveRef = useRef<number>(0)
  const hideControlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasCompletedRef = useRef(progress?.status === 'completed')

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

  const videoId = extractYouTubeId(videoUrl)

  // ─── Save progress (throttled 10s) ───
  const saveProgress = useCallback(
    (time: number, dur: number) => {
      if (dur <= 0) return
      const now = Date.now()
      if (now - lastSaveRef.current < 10000) return
      lastSaveRef.current = now

      const percent = Math.round((time / dur) * 100)
      const updateData: Parameters<typeof onProgressUpdate>[0] = {
        video_watched_seconds: Math.floor(time),
        video_watch_percent: percent,
        time_spent_seconds: timeSpentRef.current,
        status: 'in_progress',
      }

      if (percent >= 90 && !hasCompletedRef.current) {
        updateData.status = 'completed'
        updateData.video_watch_percent = 100
        hasCompletedRef.current = true
      }

      onProgressUpdate(updateData)
    },
    [onProgressUpdate]
  )

  // ─── Progress tracking interval ───
  const startProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) return
    progressIntervalRef.current = setInterval(() => {
      const player = playerRef.current
      if (!player) return
      try {
        const time = player.getCurrentTime()
        const dur = player.getDuration()
        if (dur > 0) {
          setCurrentTime(time)
          setBuffered(player.getVideoLoadedFraction())
          saveProgress(time, dur)
          onTimeUpdate?.(time, dur)
        }
      } catch {
        // player may be destroyed
      }
    }, 250)
  }, [saveProgress, onTimeUpdate])

  const stopProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
  }, [])

  // ─── Time spent tracking ───
  useEffect(() => {
    timeSpentIntervalRef.current = setInterval(() => {
      if (isPlaying) timeSpentRef.current += 1
    }, 1000)
    return () => {
      if (timeSpentIntervalRef.current) clearInterval(timeSpentIntervalRef.current)
    }
  }, [isPlaying])

  // ─── YouTube callbacks ───
  const onReady: YouTubeProps['onReady'] = (event) => {
    playerRef.current = event.target
    setDuration(event.target.getDuration())
    // Restore previous position
    if (progress?.video_watched_seconds && progress.video_watched_seconds > 0) {
      event.target.seekTo(progress.video_watched_seconds, true)
    }
  }

  const onStateChange: YouTubeProps['onStateChange'] = (event) => {
    const state = event.data
    if (state === 1) {
      // PLAYING
      setIsPlaying(true)
      setHasEnded(false)
      startProgressTracking()
    } else if (state === 2) {
      // PAUSED
      setIsPlaying(false)
      stopProgressTracking()
    } else if (state === 0) {
      // ENDED
      setIsPlaying(false)
      setHasEnded(true)
      stopProgressTracking()
      if (!hasCompletedRef.current) {
        hasCompletedRef.current = true
        onProgressUpdate({
          status: 'completed',
          video_watch_percent: 100,
          video_watched_seconds: Math.floor(playerRef.current?.getDuration() || 0),
          time_spent_seconds: timeSpentRef.current,
        })
      }
    } else if (state === 3) {
      // BUFFERING
      stopProgressTracking()
    }
  }

  // ─── Controls auto-hide ───
  const resetHideTimer = useCallback(() => {
    setShowControls(true)
    if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current)
    hideControlsTimeout.current = setTimeout(() => {
      if (isPlaying) setShowControls(false)
    }, 3000)
  }, [isPlaying])

  useEffect(() => {
    return () => {
      if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current)
      stopProgressTracking()
    }
  }, [stopProgressTracking])

  // ─── Player actions ───
  const togglePlay = () => {
    const player = playerRef.current
    if (!player) return
    try {
      const state = player.getPlayerState()
      if (state === 1) {
        player.pauseVideo()
      } else {
        player.playVideo()
      }
    } catch {
      // ignore
    }
  }

  const handleSeek = (time: number) => {
    const player = playerRef.current
    if (!player) return
    player.seekTo(time, true)
    setCurrentTime(time)
  }

  const handleSkip = (seconds: number) => {
    const player = playerRef.current
    if (!player) return
    const newTime = Math.max(0, Math.min(player.getCurrentTime() + seconds, duration))
    player.seekTo(newTime, true)
    setCurrentTime(newTime)
  }

  const handleVolumeChange = (v: number) => {
    const player = playerRef.current
    if (!player) return
    setVolume(v)
    setIsMuted(v === 0)
    player.setVolume(v * 100)
    if (v > 0) player.unMute()
  }

  const handleToggleMute = () => {
    const player = playerRef.current
    if (!player) return
    if (isMuted) {
      player.unMute()
      player.setVolume(volume * 100)
      setIsMuted(false)
    } else {
      player.mute()
      setIsMuted(true)
    }
  }

  const handlePlaybackRateChange = (rate: number) => {
    const player = playerRef.current
    if (!player) return
    player.setPlaybackRate(rate)
    setPlaybackRate(rate)
  }

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  // Listen for fullscreen changes (e.g. Escape key)
  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  if (!videoId) return null

  const opts: YouTubeProps['opts'] = {
    height: '100%',
    width: '100%',
    playerVars: {
      controls: 0,
      modestbranding: 1,
      rel: 0,
      disablekb: 1,
      iv_load_policy: 3,
      fs: 0,
      playsinline: 1,
    },
  }

  return (
    <div
      ref={containerRef}
      className="group relative aspect-video w-full bg-black rounded-lg overflow-hidden"
      onMouseMove={resetHideTimer}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false)
      }}
    >
      {/* YouTube Player — no direct interaction */}
      <YouTube
        videoId={videoId}
        opts={opts}
        onReady={onReady}
        onStateChange={onStateChange}
        className="pointer-events-none absolute inset-0"
        iframeClassName="w-full h-full"
      />

      {/* End screen overlay — covers YouTube suggestions */}
      {hasEnded && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80">
          <Button
            variant="ghost"
            size="lg"
            className="text-white hover:bg-white/20 gap-2"
            onClick={() => {
              const player = playerRef.current
              if (!player) return
              player.seekTo(0, true)
              player.playVideo()
              setHasEnded(false)
            }}
          >
            <RotateCcw className="h-5 w-5" />
            Rever vídeo
          </Button>
        </div>
      )}

      {/* Click-to-play overlay */}
      {!hasEnded && (
        <div
          className="absolute inset-0 z-10 cursor-pointer"
          onClick={togglePlay}
        />
      )}

      {/* Custom controls — auto-hide after 3s */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 to-transparent',
          'px-4 pb-3 pt-8 transition-opacity duration-300',
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
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
    </div>
  )
}
