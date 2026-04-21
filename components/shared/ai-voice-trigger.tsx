'use client'

import { useEffect } from 'react'

const LONG_PRESS_MS = 1500
const MOVE_THRESHOLD_PX = 6
// Elements (and their descendants) where the long-press trigger must not
// fire. Covers native form controls, explicit opt-outs via `data-no-long-press`
// (e.g. select dropdowns, action buttons inside the voice overlay), and
// `data-allow-selection` — an escape hatch to preserve iOS's native
// long-press-to-select behaviour for specific blocks (addresses, long
// descriptions, codes, etc.) where users need to copy text.
const EDITABLE_SELECTOR =
  'input, textarea, select, [contenteditable="true"], [contenteditable=""], [data-no-long-press], [data-allow-selection]'

function dispatchOpen() {
  window.dispatchEvent(new Event('open-voice-assistant'))
}

/**
 * Global trigger: holding the primary pointer (mouse click or finger) on any
 * non-editable area for 2 seconds opens the voice assistant.
 *
 * While the hold is in progress we set `data-voice-holding="true"` on `<body>`
 * and inject a scoped stylesheet that disables text selection and iOS's native
 * callout menu on every element *except* form controls. This prevents iPhone
 * Safari from popping the text-selection magnifier or the "Copy / Look Up"
 * menu during the hold. Selection and callouts are restored the moment the
 * timer fires, the finger lifts, or the gesture is cancelled.
 */
export function AiVoiceTrigger() {
  useEffect(() => {
    // ── 1) Inject the selection-suppression stylesheet once ──────────────
    const style = document.createElement('style')
    style.setAttribute('data-voice-trigger-styles', 'true')
    style.textContent = `
      body[data-voice-holding="true"],
      body[data-voice-holding="true"] *:not(input):not(textarea):not([contenteditable="true"]):not([contenteditable=""]) {
        -webkit-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
      }
    `
    document.head.appendChild(style)

    // ── 2) Pointer long-press + motion/scroll cancels ───────────────────
    let timer: ReturnType<typeof setTimeout> | null = null
    let activePointerId: number | null = null
    let startX = 0
    let startY = 0

    const setHolding = (yes: boolean) => {
      if (yes) document.body.setAttribute('data-voice-holding', 'true')
      else document.body.removeAttribute('data-voice-holding')
    }

    const clear = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      activePointerId = null
      setHolding(false)
    }

    const onPointerDown = (e: PointerEvent) => {
      clear()

      if (!e.isPrimary) return
      if (e.pointerType === 'mouse' && e.button !== 0) return

      const target = e.target as HTMLElement | null
      if (target?.closest(EDITABLE_SELECTOR)) return

      activePointerId = e.pointerId
      startX = e.clientX
      startY = e.clientY

      setHolding(true)

      timer = setTimeout(() => {
        timer = null
        activePointerId = null
        setHolding(false)
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

    // Kill timer on any kind of motion that implies the user is doing
    // something else (scroll / drag / wheel).
    const cancelOnMotion = () => clear()

    // Block iOS Safari's callout menu while the hold is active — by this
    // point `data-voice-holding` is set, so we know the user is mid-press.
    const onContextMenu = (e: Event) => {
      if (document.body.getAttribute('data-voice-holding') === 'true') {
        e.preventDefault()
      }
    }

    document.addEventListener('pointerdown', onPointerDown, { passive: true })
    document.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('pointerup', onPointerEnd, { passive: true })
    document.addEventListener('pointercancel', onPointerEnd, { passive: true })
    document.addEventListener('scroll', cancelOnMotion, { passive: true, capture: true })
    document.addEventListener('touchmove', cancelOnMotion, { passive: true })
    document.addEventListener('wheel', cancelOnMotion, { passive: true })
    document.addEventListener('contextmenu', onContextMenu)

    return () => {
      clear()
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerEnd)
      document.removeEventListener('pointercancel', onPointerEnd)
      document.removeEventListener('scroll', cancelOnMotion, true)
      document.removeEventListener('touchmove', cancelOnMotion)
      document.removeEventListener('wheel', cancelOnMotion)
      document.removeEventListener('contextmenu', onContextMenu)
      if (style.parentNode) style.parentNode.removeChild(style)
      document.body.removeAttribute('data-voice-holding')
    }
  }, [])

  return null
}
