'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimatedNumberProps {
  value: number
  format?: (n: number) => string
  durationMs?: number
  className?: string
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Animates a numeric value from its previous render to the new one with an
 * ease-out cubic curve. Used in the dashboard cards to show "counters rising"
 * when data lands instead of a static value pop-in. If the parent passes the
 * final value on first render (e.g. cached), there is no animation — the
 * effect fires only when the target actually changes.
 */
export function AnimatedNumber({
  value,
  format,
  durationMs = 800,
  className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value)
  const lastTargetRef = useRef(value)
  const fromRef = useRef(value)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!Number.isFinite(value)) return
    if (value === lastTargetRef.current) return

    fromRef.current = lastTargetRef.current
    lastTargetRef.current = value
    startRef.current = null

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now
      const progress = Math.min(1, (now - startRef.current) / durationMs)
      const eased = easeOutCubic(progress)
      const next = fromRef.current + (value - fromRef.current) * eased
      setDisplay(next)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [value, durationMs])

  return (
    <span className={className}>
      {format ? format(display) : Math.round(display).toString()}
    </span>
  )
}
