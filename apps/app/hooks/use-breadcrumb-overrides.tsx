'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'

type Overrides = Record<string, string>
type Listener = () => void

function createOverrideStore() {
  let overrides: Overrides = {}
  const listeners = new Set<Listener>()

  return {
    getSnapshot: () => overrides,
    subscribe: (listener: Listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set: (next: Overrides) => {
      overrides = next
      listeners.forEach((l) => l())
    },
  }
}

type Store = ReturnType<typeof createOverrideStore>

const EMPTY: Overrides = {}
const noopSubscribe = () => () => {}
const getEmpty = () => EMPTY

const BreadcrumbOverrideContext = createContext<Store | null>(null)

export function BreadcrumbOverrideProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<Store | null>(null)
  if (!storeRef.current) storeRef.current = createOverrideStore()
  return (
    <BreadcrumbOverrideContext.Provider value={storeRef.current}>
      {children}
    </BreadcrumbOverrideContext.Provider>
  )
}

/**
 * Set breadcrumb overrides from a page.
 * Keys are URL segments (e.g. "cursos", "licoes"), values are display labels.
 */
export function useBreadcrumbSet(overrides: Overrides) {
  const store = useContext(BreadcrumbOverrideContext)
  // Stabilise reference — only update when values actually change
  const serialised = JSON.stringify(overrides)
  const stableOverrides = useMemo(() => overrides, [serialised]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    store?.set(stableOverrides)
    return () => store?.set({})
  }, [store, stableOverrides])
}

/** Read current overrides (used by Breadcrumbs component). */
export function useBreadcrumbOverrides(): Overrides {
  const store = useContext(BreadcrumbOverrideContext)
  return useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store?.getSnapshot ?? getEmpty,
    getEmpty
  )
}
