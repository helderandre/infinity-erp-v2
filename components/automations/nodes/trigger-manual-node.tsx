"use client"

import { memo } from "react"
import type { NodeProps } from "@xyflow/react"
import { Play } from "lucide-react"
import { NodeWrapper } from "./node-wrapper"
import type { TriggerManualNodeData } from "@/lib/types/automation-flow"

function TriggerManualNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as TriggerManualNodeData

  return (
    <NodeWrapper
      id={id}
      nodeType="trigger_manual"
      selected={selected}
      icon={<Play />}
      title={nodeData.label || "Manual"}
      description="Este fluxo será iniciado manualmente"
      showTargetHandle={false}
    />
  )
}

export const TriggerManualNode = memo(TriggerManualNodeInner)
