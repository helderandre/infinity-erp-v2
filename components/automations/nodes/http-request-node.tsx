"use client"

import { memo } from "react"
import type { NodeProps } from "@xyflow/react"
import { Globe } from "lucide-react"
import { NodeWrapper } from "./node-wrapper"
import type { HttpRequestNodeData } from "@/lib/types/automation-flow"
import { Badge } from "@/components/ui/badge"

function HttpRequestNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as HttpRequestNodeData

  return (
    <NodeWrapper
      id={id}
      nodeType="http_request"
      selected={selected}
      icon={<Globe />}
      title={nodeData.label || "HTTP Request"}
    >
      {nodeData.url ? (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[10px] font-mono">
              {nodeData.method || "GET"}
            </Badge>
          </div>
          <p className="truncate font-mono text-[10px]">{nodeData.url}</p>
          {nodeData.outputVariable && (
            <p className="text-[10px]">Resultado → {nodeData.outputVariable}</p>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground/70">Chamar uma API externa</p>
      )}
    </NodeWrapper>
  )
}

export const HttpRequestNode = memo(HttpRequestNodeInner)
