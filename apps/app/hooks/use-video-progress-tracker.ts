'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  WATCH_GATE_PERCENT,
  intervalsFromSeconds,
  type WatchedInterval,
} from '@/lib/training/watch-gate'
import type { TrainingLessonProgress } from '@/types/training'

export interface HeartbeatPayload {
  delta_seconds: number
  position_seconds: number
  percent: number
  duration_seconds?: number
  watched_segments?: WatchedInterval[]
}

export interface HeartbeatResult {
  video_watch_percent?: number
  status?: 'in_progress' | 'completed'
  last_video_position_seconds?: number
}

interface ProgressUpdate {
  status?: 'in_progress' | 'completed'
  video_watched_seconds?: number
  video_watch_percent?: number
  time_spent_seconds?: number
}

interface UseVideoProgressTrackerParams {
  progress?: TrainingLessonProgress | null
  enabled: boolean
  onProgressUpdate: (data: ProgressUpdate) => void
  onWatchPercentChange?: (percent: number) => void
  onHeartbeat?: (data: HeartbeatPayload) => Promise<HeartbeatResult | null | void> | void
}

const HEARTBEAT_INTERVAL_MS = 10000
const SAVE_THROTTLE_MS = 10000

/**
 * Shared playback-tracking engine for every training video player (native HLS/mp4
 * and the custom YouTube player). It owns the anti-cheat coverage model:
 *
 *  • `sample()` is called from each player's time loop with the live currentTime,
 *    duration and isPlaying flag. While playing, the floored second is added to a
 *    "watched buckets" set — distinct content actually played.
 *  • Coverage % = max(persisted coverage, this session's buckets, server echo).
 *    Seeking ahead leaves gaps; 2x speed still fills one bucket per content-second.
 *  • A 10s heartbeat ships the session's merged intervals + duration so the server
 *    unions them with prior sittings and returns the authoritative coverage.
 *  • Completion is gated on coverage ≥ WATCH_GATE_PERCENT — reaching the end by
 *    skipping does NOT complete the lesson.
 */
export function useVideoProgressTracker({
  progress,
  enabled,
  onProgressUpdate,
  onWatchPercentChange,
  onHeartbeat,
}: UseVideoProgressTrackerParams) {
  const baseCoverage = progress?.video_watch_percent ?? 0
  const startedCompleted = progress?.status === 'completed'

  const watchedRef = useRef<Set<number>>(new Set())
  const liveTimeRef = useRef(0)
  const liveDurationRef = useRef(0)
  const livePlayingRef = useRef(false)
  const timeSpentRef = useRef(progress?.time_spent_seconds ?? 0)
  const serverCoverageRef = useRef(baseCoverage)
  const lastSaveRef = useRef(0)
  const lastHeartbeatAtRef = useRef(0)
  const completedRef = useRef(startedCompleted)

  const [coverage, setCoverage] = useState(baseCoverage)
  const [isCompleted, setIsCompleted] = useState(startedCompleted)

  // ─── Coverage computation ──────────────────────────────────────────────
  const computeCoverage = useCallback((): number => {
    const dur = Math.floor(liveDurationRef.current)
    const sessionPct = dur > 0 ? Math.round((watchedRef.current.size / dur) * 100) : 0
    return Math.min(100, Math.max(baseCoverage, serverCoverageRef.current, sessionPct))
  }, [baseCoverage])

  const markCompletedLocal = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    setIsCompleted(true)
    setCoverage(100)
    onWatchPercentChange?.(100)
    onProgressUpdate({
      status: 'completed',
      video_watch_percent: 100,
      video_watched_seconds: Math.floor(liveTimeRef.current),
      time_spent_seconds: timeSpentRef.current,
    })
  }, [onProgressUpdate, onWatchPercentChange])

  // ─── Throttled progress save (every 10s while playing) ─────────────────
  const maybeSaveProgress = useCallback(
    (pct: number) => {
      const now = Date.now()
      if (now - lastSaveRef.current < SAVE_THROTTLE_MS) return
      lastSaveRef.current = now
      onProgressUpdate({
        status: 'in_progress',
        video_watched_seconds: Math.floor(liveTimeRef.current),
        video_watch_percent: pct,
        time_spent_seconds: timeSpentRef.current,
      })
    },
    [onProgressUpdate]
  )

  // ─── Called by each player on every time tick ──────────────────────────
  const sample = useCallback(
    ({
      currentTime,
      duration,
      isPlaying,
    }: {
      currentTime: number
      duration: number
      isPlaying: boolean
    }) => {
      if (Number.isFinite(currentTime)) liveTimeRef.current = currentTime
      if (Number.isFinite(duration) && duration > 0) liveDurationRef.current = duration
      livePlayingRef.current = isPlaying

      if (isPlaying && Number.isFinite(currentTime) && currentTime >= 0) {
        watchedRef.current.add(Math.floor(currentTime))
      }

      const pct = computeCoverage()
      setCoverage((prev) => (pct > prev ? pct : prev))
      onWatchPercentChange?.(pct)

      if (!completedRef.current) {
        maybeSaveProgress(pct)
        if (pct >= WATCH_GATE_PERCENT) markCompletedLocal()
      }
    },
    [computeCoverage, maybeSaveProgress, markCompletedLocal, onWatchPercentChange]
  )

  // Reaching the very end does NOT auto-complete unless coverage cleared the gate
  // (anti-skip). It just flushes a final progress save.
  const markEnded = useCallback(() => {
    const pct = computeCoverage()
    lastSaveRef.current = 0
    maybeSaveProgress(pct)
    if (pct >= WATCH_GATE_PERCENT) markCompletedLocal()
  }, [computeCoverage, maybeSaveProgress, markCompletedLocal])

  // ─── time_spent accumulation (real wall-clock seconds of playback) ─────
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => {
      if (livePlayingRef.current) timeSpentRef.current += 1
    }, 1000)
    return () => clearInterval(id)
  }, [enabled])

  // ─── Heartbeat: ship merged intervals + duration, apply server coverage ─
  useEffect(() => {
    if (!enabled || !onHeartbeat) return
    lastHeartbeatAtRef.current = Date.now()
    const id = setInterval(() => {
      if (completedRef.current) return
      const dur = liveDurationRef.current
      const pos = liveTimeRef.current
      if (dur <= 0 || pos < 0) return
      if (!livePlayingRef.current) return

      const now = Date.now()
      const delta = Math.max(1, Math.min(20, Math.round((now - lastHeartbeatAtRef.current) / 1000)))
      lastHeartbeatAtRef.current = now

      const pct = computeCoverage()
      const result = onHeartbeat({
        delta_seconds: delta,
        position_seconds: pos,
        percent: pct,
        duration_seconds: dur,
        watched_segments: intervalsFromSeconds(watchedRef.current),
      })

      Promise.resolve(result)
        .then((res) => {
          if (!res) return
          if (typeof res.video_watch_percent === 'number') {
            serverCoverageRef.current = Math.max(serverCoverageRef.current, res.video_watch_percent)
            const next = computeCoverage()
            setCoverage((prev) => (next > prev ? next : prev))
            onWatchPercentChange?.(next)
          }
          if (res.status === 'completed') markCompletedLocal()
        })
        .catch(() => {})
    }, HEARTBEAT_INTERVAL_MS)

    return () => clearInterval(id)
  }, [enabled, onHeartbeat, computeCoverage, markCompletedLocal, onWatchPercentChange])

  return { sample, markEnded, coverage, isCompleted }
}
