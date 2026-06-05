"use client"

import { useCallback, useRef } from "react"

/**
 * Hook to find the closest Sheet/Dialog container for portaling popover/select
 * content inside it, preventing the Sheet overlay from blocking pointer events.
 *
 * Usage:
 *   const { triggerRef, getContainer } = usePortalContainer()
 *   <Button ref={triggerRef} />
 *   <PopoverContent container={getContainer()} />
 */
export function usePortalContainer<T extends HTMLElement = HTMLElement>() {
  const triggerRef = useRef<T>(null)

  const getContainer = useCallback((): HTMLElement | undefined => {
    if (!triggerRef.current) return undefined
    const dialog =
      triggerRef.current.closest("[data-slot='sheet-content']") ??
      triggerRef.current.closest("[data-radix-dialog-content]") ??
      triggerRef.current.closest("[role='dialog']")
    return (dialog as HTMLElement) ?? undefined
  }, [])

  return { triggerRef, getContainer }
}
