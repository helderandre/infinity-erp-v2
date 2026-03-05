"use client"

import { memo } from "react"
import type { NodeProps } from "@xyflow/react"
import { Clock } from "lucide-react"
import { NodeWrapper } from "./node-wrapper"
import { useReactFlow } from "@xyflow/react"
import type { TriggerScheduleNodeData } from "@/lib/types/automation-flow"
import { Input } from "@/components/ui/input"

function TriggerScheduleNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as TriggerScheduleNodeData
  const { updateNodeData } = useReactFlow()

  return (
    <NodeWrapper
      id={id}
      nodeType="trigger_schedule"
      selected={selected}
      icon={<Clock />}
      title={nodeData.label || "Agendamento"}
      showTargetHandle={false}
    >
      <div className="space-y-1.5">
        <Input
          value={nodeData.cronExpression || ""}
          onChange={(e) =>
            updateNodeData(id, { ...nodeData, cronExpression: e.target.value })
          }
          placeholder="0 9 * * 1-5"
          className="h-7 text-xs font-mono"
        />
        <p className="text-[10px] text-muted-foreground/70">
          {nodeData.cronExpression
            ? `Expressão cron: ${nodeData.cronExpression}`
            : "Executar automaticamente em horários definidos"}
        </p>
        {nodeData.timezone && (
          <p className="text-[10px]">Fuso: {nodeData.timezone}</p>
        )}
      </div>
    </NodeWrapper>
  )
}

export const TriggerScheduleNode = memo(TriggerScheduleNodeInner)
