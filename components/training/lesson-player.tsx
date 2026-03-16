'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Play } from 'lucide-react'
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
}

function extractYouTubeId(url: string): string | null {
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

function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  return match ? match[1] : null
}

export function LessonPlayer({ lesson, progress, onProgressUpdate }: LessonPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastSaveRef = useRef<number>(0)
  const timeSpentRef = useRef<number>(progress?.time_spent_seconds ?? 0)
  const timeSpentIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [watchPercent, setWatchPercent] = useState(progress?.video_watch_percent ?? 0)
  const [isCompleted, setIsCompleted] = useState(progress?.status === 'completed')
  const hasSetInitialTime = useRef(false)

  const videoUrl = lesson.video_url ?? ''
  const isYouTube = lesson.video_provider === 'youtube' || videoUrl.includes('youtube') || videoUrl.includes('youtu.be')
  const isVimeo = lesson.video_provider === 'vimeo' || videoUrl.includes('vimeo.com')
  const isNative = !isYouTube && !isVimeo

  const saveProgress = useCallback(
    (currentTime: number, duration: number, force = false) => {
      if (duration <= 0) return
      const now = Date.now()
      if (!force && now - lastSaveRef.current < 10000) return
      lastSaveRef.current = now

      const percent = Math.round((currentTime / duration) * 100)
      setWatchPercent(percent)

      const updateData: Parameters<typeof onProgressUpdate>[0] = {
        video_watched_seconds: Math.floor(currentTime),
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

  // Track time spent for native video
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

  // Set initial playback position for native video
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

  // Handle timeupdate for native video
  useEffect(() => {
    const video = videoRef.current
    if (!video || !isNative) return

    const handleTimeUpdate = () => {
      saveProgress(video.currentTime, video.duration)
    }

    const handleEnded = () => {
      saveProgress(video.duration, video.duration, true)
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
    }
  }, [isNative, saveProgress])

  return (
    <Card>
      <CardContent className="p-0">
        <div className="relative">
          {isYouTube && (
            <div className="aspect-video w-full">
              <iframe
                src={`https://www.youtube.com/embed/${extractYouTubeId(videoUrl)}?rel=0`}
                className="h-full w-full rounded-t-lg"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={lesson.title}
              />
            </div>
          )}

          {isVimeo && (
            <div className="aspect-video w-full">
              <iframe
                src={`https://player.vimeo.com/video/${extractVimeoId(videoUrl)}`}
                className="h-full w-full rounded-t-lg"
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
              className="aspect-video w-full rounded-t-lg bg-black"
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

        <div className="space-y-2 p-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Play className="h-4 w-4" />
              <span>Progresso do vídeo</span>
            </div>
            <span className="font-medium">{watchPercent}%</span>
          </div>
          <Progress value={watchPercent} className="h-2" />
          {lesson.video_duration_seconds && (
            <p className="text-xs text-muted-foreground">
              Duração: {Math.floor(lesson.video_duration_seconds / 60)} min{' '}
              {lesson.video_duration_seconds % 60 > 0 && `${lesson.video_duration_seconds % 60} seg`}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
