'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2 } from 'lucide-react'
import { YouTubeCustomPlayer } from './youtube-custom-player'
import { cn } from '@/lib/utils'
import type { TrainingLesson, TrainingLessonProgress } from '@/types/training'

interface LessonPlayerProps {
  lesson: TrainingLesson
  progress?: TrainingLessonProgress | null
  onProgressUpdate: (data: {
    video_watched_seconds?: number
    video_watch_percent?: number
    time_spent_seconds?: number
    status?: 'in_progress' | 'completed'
  }) => void
  onWatchPercentChange?: (percent: number) => void
}

function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  return match ? match[1] : null
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function LessonPlayer({ lesson, progress, onProgressUpdate, onWatchPercentChange }: LessonPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastSaveRef = useRef<number>(0)
  const timeSpentRef = useRef<number>(progress?.time_spent_seconds ?? 0)
  const timeSpentIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nativeTimeRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [watchPercent, setWatchPercent] = useState(progress?.video_watch_percent ?? 0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isCompleted, setIsCompleted] = useState(progress?.status === 'completed')
  const hasSetInitialTime = useRef(false)

  const videoUrl = lesson.video_url ?? ''
  const isYouTube = lesson.video_provider === 'youtube' || videoUrl.includes('youtube') || videoUrl.includes('youtu.be')
  const isVimeo = lesson.video_provider === 'vimeo' || videoUrl.includes('vimeo.com')
  const isNative = !isYouTube && !isVimeo
  const hasVideo = isYouTube || isNative

  const saveProgress = useCallback(
    (time: number, dur: number, force = false) => {
      if (dur <= 0) return
      const now = Date.now()
      if (!force && now - lastSaveRef.current < 10000) return
      lastSaveRef.current = now

      const percent = Math.round((time / dur) * 100)
      setWatchPercent(percent)

      const updateData: Parameters<typeof onProgressUpdate>[0] = {
        video_watched_seconds: Math.floor(time),
        video_watch_percent: percent,
        time_spent_seconds: timeSpentRef.current,
        status: 'in_progress',
      }

      if (percent >= 90 && !isCompleted) {
        updateData.status = 'completed'
        updateData.video_watch_percent = 100
        setIsCompleted(true)
        setWatchPercent(100)
      }

      onProgressUpdate(updateData)
    },
    [onProgressUpdate, isCompleted]
  )

  // ─── YouTube time update callback ───
  const handleYouTubeTimeUpdate = useCallback((time: number, dur: number) => {
    setCurrentTime(time)
    setDuration(dur)
    if (dur > 0) {
      const pct = Math.round((time / dur) * 100)
      setWatchPercent(pct)
      onWatchPercentChange?.(pct)
    }
  }, [onWatchPercentChange])

  // ─── Native video: track time spent ───
  useEffect(() => {
    if (!isNative) return
    timeSpentIntervalRef.current = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        timeSpentRef.current += 1
      }
    }, 1000)
    return () => {
      if (timeSpentIntervalRef.current) clearInterval(timeSpentIntervalRef.current)
    }
  }, [isNative])

  // ─── Native video: set initial position ───
  useEffect(() => {
    const video = videoRef.current
    if (!video || !isNative || hasSetInitialTime.current) return
    const handleLoaded = () => {
      if (progress?.video_watched_seconds && progress.video_watched_seconds > 0 && !hasSetInitialTime.current) {
        video.currentTime = progress.video_watched_seconds
        hasSetInitialTime.current = true
      }
    }
    video.addEventListener('loadedmetadata', handleLoaded)
    return () => video.removeEventListener('loadedmetadata', handleLoaded)
  }, [isNative, progress?.video_watched_seconds])

  // ─── Native video: timeupdate + ended + live time tracking ───
  useEffect(() => {
    const video = videoRef.current
    if (!video || !isNative) return

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      setDuration(video.duration)
      saveProgress(video.currentTime, video.duration)
    }
    const handleEnded = () => {
      saveProgress(video.duration, video.duration, true)
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)

    // Poll for smoother UI updates
    nativeTimeRef.current = setInterval(() => {
      if (!video.paused && video.duration > 0) {
        setCurrentTime(video.currentTime)
        setDuration(video.duration)
        const pct = Math.round((video.currentTime / video.duration) * 100)
        setWatchPercent(pct)
        onWatchPercentChange?.(pct)
      }
    }, 250)

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
      if (nativeTimeRef.current) clearInterval(nativeTimeRef.current)
    }
  }, [isNative, saveProgress, onWatchPercentChange])

  return (
    <div className="relative">
      {isYouTube && (
        <YouTubeCustomPlayer
          videoUrl={videoUrl}
          lesson={lesson}
          progress={progress}
          onProgressUpdate={onProgressUpdate}
          onTimeUpdate={handleYouTubeTimeUpdate}
        />
      )}

      {isVimeo && (
        <div className="aspect-video w-full">
          <iframe
            src={`https://player.vimeo.com/video/${extractVimeoId(videoUrl)}`}
            className="h-full w-full rounded-lg"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title={lesson.title}
          />
        </div>
      )}

      {isNative && (
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          className="aspect-video w-full rounded-lg bg-black"
          preload="metadata"
        >
          O seu navegador não suporta o elemento de vídeo.
        </video>
      )}

      {isCompleted && (
        <div className="absolute right-3 top-3">
          <Badge className="gap-1 bg-emerald-600">
            <CheckCircle2 className="h-3 w-3" />
            Concluído
          </Badge>
        </div>
      )}
    </div>
  )
}
