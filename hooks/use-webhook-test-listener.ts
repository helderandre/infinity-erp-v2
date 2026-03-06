"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

const LISTEN_TIMEOUT = 120 // seconds

type ListenerState = "idle" | "listening" | "received" | "timeout"

interface WebhookCapture {
  source_id: string
  flow_name: string | null
  payload: Record<string, unknown>
  received_at: string
}

export function useWebhookTestListener() {
  const [state, setState] = useState<ListenerState>("idle")
  const [countdown, setCountdown] = useState(LISTEN_TIMEOUT)
  const [capture, setCapture] = useState<WebhookCapture | null>(null)
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (channelRef.current) {
      const supabase = createClient()
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [])

  const startListening = useCallback(
    (webhookKey: string) => {
      cleanup()
      setState("listening")
      setCountdown(LISTEN_TIMEOUT)
      setCapture(null)

      const supabase = createClient()
      const channel = supabase
        .channel(`webhook-listen-${webhookKey}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "auto_webhook_captures",
            filter: `source_id=eq.${webhookKey}`,
          },
          (payload) => {
            const data = payload.new as WebhookCapture
            if (data?.payload) {
              setCapture(data)
              setState("received")
              if (timerRef.current) {
                clearInterval(timerRef.current)
                timerRef.current = null
              }
            }
          }
        )
        .subscribe()

      channelRef.current = channel

      // Countdown timer
      let remaining = LISTEN_TIMEOUT
      timerRef.current = setInterval(() => {
        remaining -= 1
        setCountdown(remaining)
        if (remaining <= 0) {
          cleanup()
          setState("timeout")
        }
      }, 1000)
    },
    [cleanup]
  )

  const stopListening = useCallback(() => {
    cleanup()
    setState("idle")
  }, [cleanup])

  const reset = useCallback(() => {
    cleanup()
    setState("idle")
    setCapture(null)
    setCountdown(LISTEN_TIMEOUT)
  }, [cleanup])

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup])

  return {
    state,
    countdown,
    capture,
    startListening,
    stopListening,
    reset,
  }
}
