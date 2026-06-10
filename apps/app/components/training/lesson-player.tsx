'use client'

import { Badge } from '@/components/ui/badge'
import { CheckCircle2 } from 'lucide-react'
import { YouTubeCustomPlayer } from './youtube-custom-player'
import { NativeVideoPlayer } from './native-video-player'
import type { HeartbeatPayload, HeartbeatResult } from '@/hooks/use-video-progress-tracker'
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
  onHeartbeat?: (data: HeartbeatPayload) => Promise<HeartbeatResult | null | void> | void
}

function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  return match ? match[1] : null
}

/**
 * Thin provider switch for a training video lesson. Each branch owns its own
 * playback chrome + the shared coverage tracker:
 *   • YouTube → <YouTubeCustomPlayer> (custom glass overlay)
 *   • R2 mp4 / Cloudflare Stream HLS → <NativeVideoPlayer> (custom glass overlay)
 *   • Vimeo → native iframe (no custom tracking)
 */
export function LessonPlayer({
  lesson,
  progress,
  onProgressUpdate,
  onWatchPercentChange,
  onHeartbeat,
}: LessonPlayerProps) {
  const videoUrl = lesson.video_url ?? ''
  const isYouTube =
    lesson.video_provider === 'youtube' || videoUrl.includes('youtube') || videoUrl.includes('youtu.be')
  const isVimeo = lesson.video_provider === 'vimeo' || videoUrl.includes('vimeo.com')
  const isNative = !isYouTube && !isVimeo
  const isHls = isNative && (lesson.video_provider === 'cloudflare_stream' || videoUrl.includes('.m3u8'))

  // Preferred resume position: explicit last_video_position_seconds OR legacy video_watched_seconds
  const resumeSeconds =
    progress?.last_video_position_seconds && progress.last_video_position_seconds > 0
      ? progress.last_video_position_seconds
      : progress?.video_watched_seconds ?? 0

  const isCompleted = progress?.status === 'completed'

  return (
    <div className="relative">
      {isYouTube && (
        <YouTubeCustomPlayer
          videoUrl={videoUrl}
          lesson={lesson}
          progress={progress}
          startAt={resumeSeconds}
          onProgressUpdate={onProgressUpdate}
          onWatchPercentChange={onWatchPercentChange}
          onHeartbeat={onHeartbeat}
        />
      )}

      {isVimeo && (
        <div className="aspect-video w-full">
          <iframe
            src={`https://player.vimeo.com/video/${extractVimeoId(videoUrl)}`}
            className="h-full w-full rounded-2xl"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title={lesson.title}
          />
        </div>
      )}

      {isNative && (
        <NativeVideoPlayer
          videoUrl={videoUrl}
          isHls={isHls}
          title={lesson.title}
          progress={progress}
          startAt={resumeSeconds}
          onProgressUpdate={onProgressUpdate}
          onWatchPercentChange={onWatchPercentChange}
          onHeartbeat={onHeartbeat}
        />
      )}

      {isCompleted && (
        <div className="absolute right-3 top-3 z-40">
          <Badge className="gap-1 bg-emerald-600">
            <CheckCircle2 className="h-3 w-3" />
            Concluído
          </Badge>
        </div>
      )}
    </div>
  )
}
