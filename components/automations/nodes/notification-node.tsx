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
    >
      {nodeData.title ? (
        <div className="space-y-0.5">
          <p className="truncate font-medium">{nodeData.title}</p>
          {nodeData.body && (
            <p className="truncate text-[10px]">{nodeData.body}</p>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground/70">Criar notificação no sistema</p>
      )}
    </NodeWrapper>
  )
}

export const NotificationNode = memo(NotificationNodeInner)
