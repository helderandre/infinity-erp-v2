"use client"

import { memo } from "react"
import type { NodeProps } from "@xyflow/react"
import { Activity } from "lucide-react"
import { NodeWrapper } from "./node-wrapper"
import { useReactFlow } from "@xyflow/react"
import type { TriggerStatusNodeData } from "@/lib/types/automation-flow"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ENTITY_OPTIONS = [
  { value: "leads", label: "Lead" },
  { value: "negocios", label: "Negócio" },
  { value: "proc_instances", label: "Processo" },
]

function TriggerStatusNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as TriggerStatusNodeData
  const { updateNodeData } = useReactFlow()
  const condition = nodeData.triggerCondition

  return (
    <NodeWrapper
      id={id}
      nodeType="trigger_status"
      selected={selected}
      icon={<Activity />}
      title={nodeData.label || "Mudança de Estado"}
      showTargetHandle={false}
    >
      <div className="space-y-1.5">
        <Select
          value={condition?.entity_type || ""}
          onValueChange={(v) =>
            updateNodeData(id, {
              ...nodeData,
              triggerCondition: { ...condition, entity_type: v, field: "", values: [] },
            })
          }
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Entidade..." />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {condition?.entity_type && (
          <p className="text-[10px] text-muted-foreground/70">
            Quando o estado de {ENTITY_OPTIONS.find(o => o.value === condition.entity_type)?.label || "..."} muda
            {condition.values?.length > 0 && ` para: ${condition.values.join(", ")}`}
          </p>
        )}
      </div>
    </NodeWrapper>
  )
}

export const TriggerStatusNode = memo(TriggerStatusNodeInner)
