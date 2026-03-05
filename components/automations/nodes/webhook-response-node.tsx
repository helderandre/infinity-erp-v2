"use client"

import { memo } from "react"
import type { NodeProps } from "@xyflow/react"
import { Reply } from "lucide-react"
import { NodeWrapper } from "./node-wrapper"
import type { WebhookResponseNodeData } from "@/lib/types/automation-flow"
import { Badge } from "@/components/ui/badge"

function WebhookResponseNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as WebhookResponseNodeData

  return (
    <NodeWrapper
      id={id}
      nodeType="webhook_response"
      selected={selected}
      icon={<Reply />}
      title={nodeData.label || "Responder Webhook"}
      showSourceHandle={nodeData.continueAfterResponse === true}
    >
      <div className="space-y-1">
        <Badge variant="outline" className="text-[10px] font-mono">
          HTTP {nodeData.statusCode || 200}
        </Badge>
        {nodeData.responseBody && (
          <pre className="text-[10px] font-mono truncate bg-muted px-1 py-0.5 rounded max-h-12 overflow-hidden">
            {nodeData.responseBody.slice(0, 80)}
          </pre>
        )}
        {nodeData.continueAfterResponse && (
          <p className="text-[10px] text-emerald-600">Continua após responder</p>
        )}
      </div>
    </NodeWrapper>
  )
}

export const WebhookResponseNode = memo(WebhookResponseNodeInner)
