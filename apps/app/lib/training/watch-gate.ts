// Centralised watch-gate threshold + coverage math for training video lessons.
//
// "Coverage" = the fraction of DISTINCT video seconds the learner actually played
// back. Unlike a raw position-percentage it is immune to:
//   • seeking ahead   — skipped ranges stay uncovered, so they never count
//   • playback speed   — buckets are CONTENT-seconds, not wall-clock seconds
// This is what powers the "só conclui quando viu mesmo o vídeo todo" gate.
//
// Watched ranges are stored as merged [start, end) integer-second intervals so
// coverage accumulates correctly across multiple sittings (the server unions the
// new client intervals with the ones already persisted).

/** Minimum coverage (%) required before a video lesson can be marked completed. */
export const WATCH_GATE_PERCENT = 95

/** A watched range, `[startSecond, endSecond)` — start inclusive, end exclusive. */
export type WatchedInterval = [number, number]

/** Normalise, sort and merge overlapping/adjacent intervals into a minimal set. */
export function mergeWatchedIntervals(intervals: WatchedInterval[]): WatchedInterval[] {
  const cleaned = (intervals ?? [])
    .filter((iv): iv is WatchedInterval => Array.isArray(iv) && iv.length === 2)
    .map(([s, e]) => [Math.max(0, Math.floor(s)), Math.max(0, Math.ceil(e))] as WatchedInterval)
    .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && e > s)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])

  const merged: WatchedInterval[] = []
  for (const [s, e] of cleaned) {
    const last = merged[merged.length - 1]
    if (last && s <= last[1]) {
      if (e > last[1]) last[1] = e
    } else {
      merged.push([s, e])
    }
  }
  return merged
}

/** Total distinct seconds covered by a set of (already mergeable) intervals. */
export function coveredSeconds(intervals: WatchedInterval[]): number {
  return mergeWatchedIntervals(intervals).reduce((acc, [s, e]) => acc + Math.max(0, e - s), 0)
}

/** Coverage as an integer percentage of the video duration (0–100). */
export function coveragePercent(intervals: WatchedInterval[], durationSeconds: number): number {
  const dur = Math.floor(durationSeconds)
  if (!dur || dur <= 0) return 0
  const covered = Math.min(coveredSeconds(intervals), dur)
  return Math.min(100, Math.round((covered / dur) * 100))
}

/** Build minimal intervals from a bag of watched second-buckets (floored). */
export function intervalsFromSeconds(seconds: Iterable<number>): WatchedInterval[] {
  const sorted = [...new Set([...seconds].map((s) => Math.floor(s)).filter((s) => s >= 0))].sort(
    (a, b) => a - b
  )
  const out: WatchedInterval[] = []
  for (const s of sorted) {
    const last = out[out.length - 1]
    if (last && s <= last[1]) last[1] = s + 1
    else out.push([s, s + 1])
  }
  return out
}
