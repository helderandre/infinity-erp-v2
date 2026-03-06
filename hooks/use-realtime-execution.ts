"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

export interface RealtimeStep {
  id: string
  node_id: string
  node_type: string
  node_label: string | null
  status: "pending" | "running" | "completed" | "failed" | "cancelled"
  input_data: SA
  output_data: SA
  error_message: string | null
  duration_ms: number | null
  started_at: string | null
  completed_at: string | null
  scheduled_for: string | null
  created_at: string
}

export interface RealtimeRunStatus {
  id: string
  status: "pending" | "running" | "completed" | "failed" | "cancelled"
  completed_at: string | null
  error_message: string | null
  total_steps: number
  completed_steps: number
  failed_steps: number
}

export function useRealtimeExecution() {
  const [runId, setRunId] = useState<string | null>(null)
  const [steps, setSteps] = useState<RealtimeStep[]>([])
  const [runStatus, setRunStatus] = useState<RealtimeRunStatus | null>(null)
  const channelRef = useRef<SA>(null)
  const supabaseRef = useRef<SA>(null)

  // Derived state
  const totalSteps = steps.length
  const completedSteps = steps.filter((s) => s.status === "completed").length
  const failedSteps = steps.filter((s) => s.status === "failed").length
  const isRunning = steps.some((s) => s.status === "running" || s.status === "pending")
  const isFinished = totalSteps > 0 && !isRunning
  const overallStatus: "idle" | "running" | "completed" | "failed" =
    !runId
      ? "idle"
      : failedSteps > 0 && isFinished
        ? "failed"
        : isFinished
          ? "completed"
          : "running"

  const stopMonitoring = useCallback(() => {
    if (channelRef.current && supabaseRef.current) {
      supabaseRef.current.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [])

  const startMonitoring = useCallback(async (newRunId: string) => {
    // Clean up previous
    stopMonitoring()

    setRunId(newRunId)
    setSteps([])
    setRunStatus(null)

    const supabase = createClient() as SA
    supabaseRef.current = supabase

    // Fetch existing steps
    const { data: existingSteps } = await supabase
      .from("auto_step_runs")
      .select("*")
      .eq("run_id", newRunId)
      .order("created_at", { ascending: true })

    if (existingSteps) {
      setSteps(existingSteps)
    }

    // Subscribe to realtime changes on steps AND run
    const channel = supabase
      .channel(`auto-run-${newRunId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "auto_step_runs",
          filter: `run_id=eq.${newRunId}`,
        },
        (payload: SA) => {
          setSteps((prev) => {
            const exists = prev.some((s) => s.id === payload.new.id)
            if (exists) return prev
            return [...prev, payload.new as RealtimeStep]
          })
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "auto_step_runs",
          filter: `run_id=eq.${newRunId}`,
        },
        (payload: SA) => {
          setSteps((prev) =>
            prev.map((s) =>
              s.id === payload.new.id ? (payload.new as RealtimeStep) : s
            )
          )
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "auto_runs",
          filter: `id=eq.${newRunId}`,
        },
        (payload: SA) => {
          setRunStatus({
            id: payload.new.id,
            status: payload.new.status,
            completed_at: payload.new.completed_at,
            error_message: payload.new.error_message,
            total_steps: payload.new.total_steps,
            completed_steps: payload.new.completed_steps,
            failed_steps: payload.new.failed_steps,
          })
        }
      )
      .subscribe()

    channelRef.current = channel
  }, [stopMonitoring])

  // Cleanup on unmount
  useEffect(() => {
    return () => stopMonitoring()
  }, [stopMonitoring])

  return {
    runId,
    steps,
    runStatus,
    totalSteps,
    completedSteps,
    failedSteps,
    isRunning,
    isFinished,
    overallStatus,
    startMonitoring,
    stopMonitoring,
  }
}
