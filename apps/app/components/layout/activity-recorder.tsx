'use client'

import { useEffect } from 'react'

const STORAGE_KEY = 'last-activity-recorded-at'
const WINDOW_MS = 4 * 60 * 60 * 1000

function shouldRecord(): boolean {
  try {
    const last = localStorage.getItem(STORAGE_KEY)
    if (!last) return true
    return Date.now() - parseInt(last, 10) >= WINDOW_MS
  } catch {
    return true
  }
}

function markRecorded() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
  } catch {
    // localStorage disabled (private mode, etc.) — server-side dedup is the safety net.
  }
}

export function ActivityRecorder() {
  useEffect(() => {
    const record = () => {
      if (!shouldRecord()) return
      markRecorded()
      fetch('/api/auth/record-login', { method: 'POST' }).catch(() => {})
    }

    record()

    const onVisibility = () => {
      if (document.visibilityState === 'visible') record()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return null
}
