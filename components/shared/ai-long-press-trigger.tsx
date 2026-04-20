'use client'

import { useEffect } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'

const LONG_PRESS_MS = 2000
const MOVE_THRESHOLD_PX = 10
const EDITABLE_SELECTOR =
  'input, textarea, select, [contenteditable="true"], [contenteditable=""], [data-no-long-press]'

export function AiLongPressTrigger() {
  const isMobile = useIsMobile()

  useEffect(() => {
    if (!isMobile) return

    let timer: ReturnType<typeof setTimeout> | null = null
    let startX = 0
    let startY = 0

    const clear = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }

    const onTouchStart = (e: TouchEvent) => {
      clear()
      if (e.touches.length !== 1) return

      const target = e.target as HTMLElement | null
      if (target?.closest(EDITABLE_SELECTOR)) return

      const touch = e.touches[0]
      startX = touch.clientX
      startY = touch.clientY

      timer = setTimeout(() => {
        timer = null
        try { navigator.vibrate?.(30) } catch {}
        window.dispatchEvent(new Event('open-ai-assistant'))
      }, LONG_PRESS_MS)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!timer || e.touches.length === 0) return
      const touch = e.touches[0]
      if (
        Math.abs(touch.clientX - startX) > MOVE_THRESHOLD_PX ||
        Math.abs(touch.clientY - startY) > MOVE_THRESHOLD_PX
      ) {
        clear()
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', clear, { passive: true })
    document.addEventListener('touchcancel', clear, { passive: true })

    return () => {
      clear()
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', clear)
      document.removeEventListener('touchcancel', clear)
    }
  }, [isMobile])

  return null
}
