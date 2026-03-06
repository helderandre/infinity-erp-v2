"use client"

import { memo } from "react"
import type { NodeProps } from "@xyflow/react"
import { Globe } from "lucide-react"
import { NodeWrapper } from "./node-wrapper"
import type { HttpRequestNodeData } from "@/lib/types/automation-flow"

function HttpRequestNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as HttpRequestNodeData

  return (
    <NodeWrapper
      id={id}
      nodeType="http_request"
      selected={selected}
      icon={<Globe />}
      title={nodeData.label || "HTTP Request"}
      description={!nodeData.url ? "Chamar uma API externa" : undefined}
    >
      {nodeData.url && (
        <div className="flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5">
          <span className="shrink-0 rounded bg-background px-1.5 py-0.5 text-[10px] font-mono font-semibold border">
            {nodeData.method || "GET"}
          </span>
          <span className="truncate font-mono text-[10px]">{nodeData.url}</span>
        </div>
      )}
    </NodeWrapper>
  )
}

export const HttpRequestNode = memo(HttpRequestNodeInner)
