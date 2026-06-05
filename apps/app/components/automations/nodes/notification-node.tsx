"use client"

import { memo } from "react"
import type { NodeProps } from "@xyflow/react"
import { Bell } from "lucide-react"
import { NodeWrapper } from "./node-wrapper"
import type { NotificationNodeData } from "@/lib/types/automation-flow"

function NotificationNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as NotificationNodeData

  return (
    <NodeWrapper
      id={id}
      nodeType="notification"
      selected={selected}
      icon={<Bell />}
      title={nodeData.label || "Notificação"}
      description={!nodeData.title ? "Criar notificação no sistema" : undefined}
    >
      {nodeData.title && (
        <div className="rounded-lg bg-muted/60 px-2.5 py-1.5 space-y-0.5">
          <p className="truncate text-[10px] font-medium text-foreground">{nodeData.title}</p>
          {nodeData.body && (
            <p className="truncate text-[10px]">{nodeData.body}</p>
          )}
        </div>
      )}
    </NodeWrapper>
  )
}

export const NotificationNode = memo(NotificationNodeInner)
