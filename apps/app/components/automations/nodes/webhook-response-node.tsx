"use client"

import { memo } from "react"
import type { NodeProps } from "@xyflow/react"
import { Reply } from "lucide-react"
import { NodeWrapper } from "./node-wrapper"
import type { WebhookResponseNodeData } from "@/lib/types/automation-flow"

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
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5">
          <span className="shrink-0 rounded bg-background px-1.5 py-0.5 text-[10px] font-mono font-semibold border">
            HTTP {nodeData.statusCode || 200}
          </span>
          {nodeData.responseBody && (
            <span className="truncate font-mono text-[10px]">
              {nodeData.responseBody.slice(0, 50)}
            </span>
          )}
        </div>
        {nodeData.continueAfterResponse && (
          <p className="text-[10px] text-emerald-600">Continua após responder</p>
        )}
      </div>
    </NodeWrapper>
  )
}

export const WebhookResponseNode = memo(WebhookResponseNodeInner)
