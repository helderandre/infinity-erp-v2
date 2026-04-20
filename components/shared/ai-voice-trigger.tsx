'use client'

import { useEffect } from 'react'

const LONG_PRESS_MS = 2000
const MOVE_THRESHOLD_PX = 6
const EDITABLE_SELECTOR =
  'input, textarea, select, [contenteditable="true"], [contenteditable=""], [data-no-long-press]'

function dispatchOpen() {
  window.dispatchEvent(new Event('open-voice-assistant'))
}

/**
 * Global trigger: holding the primary pointer (mouse click or finger) on any
 * non-editable area for 2 seconds opens the voice assistant.
 *
 * Uses Pointer Events so the same code path handles mouse, touch and pen
 * without duplicate event wiring.
 */
export function AiVoiceTrigger() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let activePointerId: number | null = null
    let startX = 0
    let startY = 0

    const clear = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      activePointerId = null
    }

    const onPointerDown = (e: PointerEvent) => {
      clear()

      // Only primary pointer: left mouse button, first finger, or pen tip.
      if (!e.isPrimary) return
      if (e.pointerType === 'mouse' && e.button !== 0) return

      const target = e.target as HTMLElement | null
      if (target?.closest(EDITABLE_SELECTOR)) return

      activePointerId = e.pointerId
      startX = e.clientX
      startY = e.clientY

      timer = setTimeout(() => {
        timer = null
        activePointerId = null
        try { navigator.vibrate?.(30) } catch {}
        dispatchOpen()
      }, LONG_PRESS_MS)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!timer || e.pointerId !== activePointerId) return
      if (
        Math.abs(e.clientX - startX) > MOVE_THRESHOLD_PX ||
        Math.abs(e.clientY - startY) > MOVE_THRESHOLD_PX
      ) {
        clear()
      }
    }

    const onPointerEnd = (e: PointerEvent) => {
      if (e.pointerId === activePointerId) clear()
    }

    // Any scroll OR any finger drag cancels the long-press — prevents the
    // voice overlay from opening while the user is scrolling a page or a
    // nested container (e.g. a long list, a sheet, a detail pane).
    const cancelOnMotion = () => clear()

    document.addEventListener('pointerdown', onPointerDown, { passive: true })
    document.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('pointerup', onPointerEnd, { passive: true })
    document.addEventListener('pointercancel', onPointerEnd, { passive: true })
    // `capture: true` so nested scroll containers also trigger the cancel.
    document.addEventListener('scroll', cancelOnMotion, { passive: true, capture: true })
    document.addEventListener('touchmove', cancelOnMotion, { passive: true })
    document.addEventListener('wheel', cancelOnMotion, { passive: true })

    return () => {
      clear()
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerEnd)
      document.removeEventListener('pointercancel', onPointerEnd)
      document.removeEventListener('scroll', cancelOnMotion, true)
      document.removeEventListener('touchmove', cancelOnMotion)
      document.removeEventListener('wheel', cancelOnMotion)
    }
  }, [])

  return null
}
