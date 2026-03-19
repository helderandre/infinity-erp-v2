"use client"

import { useState, useEffect, useCallback } from "react"
import type { WhatsAppInstance } from "@/lib/types/whatsapp-template"

interface ConnectResult {
  instance_id: string
  mode: "qrcode" | "paircode"
  qrcode?: string | null
  paircode?: string | null
  connected: boolean
  logged_in: boolean
}

interface StatusResult {
  instance_id: string
  connection_status: string
  phone: string | null
  profile_name: string | null
  connected: boolean
  logged_in: boolean
}

const API_URL = "/api/automacao/instancias"

async function postAction(action: string, params: Record<string, unknown> = {}) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...params }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Erro na operação")
  return data
}

export function useWhatsAppInstances() {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInstances = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(API_URL)
      if (!res.ok) throw new Error("Erro ao carregar instâncias")
      const data = await res.json()
      setInstances(data.instances ?? [])
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido"
      setError(msg)
      setInstances([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInstances()
  }, [fetchInstances])

  const syncInstances = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await postAction("sync")
      setInstances(data.instances ?? [])
      return data
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao sincronizar"
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const createInstance = useCallback(
    async (params: { name: string; user_id?: string }) => {
      const data = await postAction("create", params)
      await fetchInstances()
      return data.instance as WhatsAppInstance
    },
    [fetchInstances]
  )

  const connectInstance = useCallback(
    async (instanceId: string, phone?: string): Promise<ConnectResult> => {
      return await postAction("connect", { instance_id: instanceId, phone })
    },
    []
  )

  const disconnectInstance = useCallback(
    async (instanceId: string) => {
      await postAction("disconnect", { instance_id: instanceId })
      await fetchInstances()
    },
    [fetchInstances]
  )

  const checkStatus = useCallback(async (instanceId: string): Promise<StatusResult> => {
    return await postAction("status", { instance_id: instanceId })
  }, [])

  const assignUser = useCallback(
    async (instanceId: string, userId: string | null) => {
      await postAction("assign_user", { instance_id: instanceId, user_id: userId })
      await fetchInstances()
    },
    [fetchInstances]
  )

  const renameInstance = useCallback(
    async (instanceId: string, name: string) => {
      await postAction("rename", { instance_id: instanceId, name })
      await fetchInstances()
    },
    [fetchInstances]
  )

  const deleteInstance = useCallback(
    async (instanceId: string) => {
      await postAction("delete", { instance_id: instanceId })
      await fetchInstances()
    },
    [fetchInstances]
  )

  return {
    instances,
    loading,
    error,
    refetch: fetchInstances,
    syncInstances,
    createInstance,
    connectInstance,
    disconnectInstance,
    checkStatus,
    assignUser,
    renameInstance,
    deleteInstance,
  }
}
