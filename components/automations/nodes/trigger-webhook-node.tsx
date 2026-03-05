"use client"

import { memo } from "react"
import type { NodeProps } from "@xyflow/react"
import { Webhook, Copy, Check } from "lucide-react"
import { NodeWrapper } from "./node-wrapper"
import type { TriggerWebhookNodeData } from "@/lib/types/automation-flow"
import { useState } from "react"

function TriggerWebhookNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as TriggerWebhookNodeData
  const [copied, setCopied] = useState(false)

  const webhookUrl = nodeData.webhookKey
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/webhook/${nodeData.webhookKey}`
    : null

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <NodeWrapper
      id={id}
      nodeType="trigger_webhook"
      selected={selected}
      icon={<Webhook />}
      title={nodeData.label || "Webhook"}
      showTargetHandle={false}
    >
      {webhookUrl ? (
        <div className="flex items-center gap-1">
          <code className="flex-1 truncate text-[10px] bg-muted px-1.5 py-0.5 rounded">
            {webhookUrl}
          </code>
          <button onClick={handleCopy} className="shrink-0 p-0.5 hover:text-foreground">
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      ) : (
        <p className="text-muted-foreground/70">Recebe dados de uma fonte externa</p>
      )}
      {nodeData.webhookMappings && nodeData.webhookMappings.length > 0 && (
        <p className="mt-1">{nodeData.webhookMappings.length} campos mapeados</p>
      )}
    </NodeWrapper>
  )
}

export const TriggerWebhookNode = memo(TriggerWebhookNodeInner)
