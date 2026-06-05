"use client"

import { useMemo } from "react"
import { useNodes } from "@xyflow/react"
import type { VariableItem } from "@/components/automations/variable-picker"

interface WebhookMapping {
  webhookPath: string
  variableKey: string
}

/**
 * Hook that extracts webhook-mapped variables from the trigger_webhook node
 * in the current flow. Reactively updates when nodes change.
 */
export function useWebhookVariables(): VariableItem[] {
  const nodes = useNodes()

  return useMemo(() => {
    const triggerNode = nodes.find((n) => n.type === "trigger_webhook")
    const data = triggerNode?.data as Record<string, unknown> | undefined
    const mappings = data?.webhookMappings as WebhookMapping[] | undefined
    if (!mappings || mappings.length === 0) return []

    const samplePayload = data?.samplePayload as Record<string, unknown> | undefined

    return mappings.map((m) => {
      let sampleValue: string | undefined
      if (samplePayload) {
        const val = getNestedValue(samplePayload, m.webhookPath)
        if (val !== undefined && val !== null) sampleValue = String(val)
      }
      return {
        key: m.variableKey,
        label: m.variableKey,
        category: "webhook",
        color: "#F97316",
        sampleValue,
      }
    })
  }, [nodes])
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((current: unknown, key: string) => {
    if (current === null || current === undefined) return undefined
    return (current as Record<string, unknown>)[key]
  }, obj)
}
