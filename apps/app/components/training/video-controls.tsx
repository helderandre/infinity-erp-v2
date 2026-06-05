'use client'

import { useRef, useState } from 'react'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Minimize,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface VideoControlsProps {
  isPlaying: boolean
  currentTime: number
  duration: number
  buffered: number
  volume: number
  isMuted: boolean
  playbackRate: number
  isFullscreen: boolean
  onTogglePlay: () => void
  onSeek: (time: number) => void
  onSkip: (seconds: number) => void
  onVolumeChange: (volume: number) => void
  onToggleMute: () => void
  onPlaybackRateChange: (rate: number) => void
  onToggleFullscreen: () => void
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const PLAYBACK_RATES = [0.5, 1, 1.25, 1.5, 2]

export function VideoControls({
  isPlaying,
  currentTime,
  duration,
  buffered,
  volume,
  isMuted,
  playbackRate,
  isFullscreen,
  onTogglePlay,
  onSeek,
  onSkip,
  onVolumeChange,
  onToggleMute,
  onPlaybackRateChange,
  onToggleFullscreen,
}: VideoControlsProps) {
  const [showVolume, setShowVolume] = useState(false)
  const volumeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  const handleVolumeHover = (entering: boolean) => {
    if (volumeTimeout.current) clearTimeout(volumeTimeout.current)
    if (entering) {
      setShowVolume(true)
    } else {
      volumeTimeout.current = setTimeout(() => setShowVolume(false), 300)
    }
  }

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="relative group/progress">
        {/* Buffer indicator */}
        <div className="absolute inset-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-white/20 pointer-events-none">
          <div
            className="h-full rounded-full bg-white/30 transition-all"
            style={{ width: `${buffered * 100}%` }}
          />
        </div>
        <Slider
          value={[currentTime]}
          min={0}
          max={duration || 1}
          step={0.1}
          onValueChange={([v]) => onSeek(v)}
          className="relative z-10 [&_[data-slot=slider-track]]:h-1.5 [&_[data-slot=slider-track]]:bg-transparent [&_[data-slot=slider-range]]:bg-white [&_[data-slot=slider-thumb]]:h-3.5 [&_[data-slot=slider-thumb]]:w-3.5 [&_[data-slot=slider-thumb]]:opacity-0 group-hover/progress:[&_[data-slot=slider-thumb]]:opacity-100 [&_[data-slot=slider-thumb]]:transition-opacity"
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-1">
        {/* Play/Pause */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white hover:bg-white/20"
          onClick={onTogglePlay}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        {/* Skip -10s */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white hover:bg-white/20"
          onClick={() => onSkip(-10)}
        >
          <SkipBack className="h-4 w-4" />
        </Button>

        {/* Skip +10s */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white hover:bg-white/20"
          onClick={() => onSkip(10)}
        >
          <SkipForward className="h-4 w-4" />
        </Button>

        {/* Volume */}
        <div
          className="relative flex items-center"
          onMouseEnter={() => handleVolumeHover(true)}
          onMouseLeave={() => handleVolumeHover(false)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={onToggleMute}
          >
            <VolumeIcon className="h-4 w-4" />
          </Button>
          <div
            className={cn(
              'overflow-hidden transition-all duration-200',
              showVolume ? 'w-20 opacity-100 ml-1' : 'w-0 opacity-0'
            )}
          >
            <Slider
              value={[isMuted ? 0 : volume]}
              min={0}
              max={1}
              step={0.01}
              onValueChange={([v]) => onVolumeChange(v)}
              className="[&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-range]]:bg-white [&_[data-slot=slider-thumb]]:h-3 [&_[data-slot=slider-thumb]]:w-3"
            />
          </div>
        </div>

        {/* Time display */}
        <span className="text-xs text-white/80 ml-2 tabular-nums">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <div className="flex-1" />

        {/* Playback rate */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-white hover:bg-white/20 font-medium"
            >
              {playbackRate}x
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[80px]">
            {PLAYBACK_RATES.map((rate) => (
              <DropdownMenuItem
                key={rate}
                onClick={() => onPlaybackRateChange(rate)}
                className={cn(playbackRate === rate && 'font-bold')}
              >
                {rate}x
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Fullscreen */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white hover:bg-white/20"
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
