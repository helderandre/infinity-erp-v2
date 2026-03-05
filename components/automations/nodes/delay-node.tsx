"use client"

import { memo } from "react"
import type { NodeProps } from "@xyflow/react"
import { Timer } from "lucide-react"
import { NodeWrapper } from "./node-wrapper"
import { useReactFlow } from "@xyflow/react"
import type { DelayNodeData, DelayUnit } from "@/lib/types/automation-flow"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const UNIT_LABELS: Record<DelayUnit, string> = {
  minutes: "Minutos",
  hours: "Horas",
  days: "Dias",
}

function DelayNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as DelayNodeData
  const { updateNodeData } = useReactFlow()

  return (
    <NodeWrapper
      id={id}
      nodeType="delay"
      selected={selected}
      icon={<Timer />}
      title={nodeData.label || "Aguardar"}
    >
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min={1}
          value={nodeData.value || ""}
          onChange={(e) =>
            updateNodeData(id, { ...nodeData, value: parseInt(e.target.value) || 1 })
          }
          className="h-7 w-16 text-xs"
        />
        <Select
          value={nodeData.unit || "minutes"}
          onValueChange={(v) =>
            updateNodeData(id, { ...nodeData, unit: v as DelayUnit })
          }
        >
          <SelectTrigger className="h-7 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(UNIT_LABELS) as [DelayUnit, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>
    </NodeWrapper>
  )
}

export const DelayNode = memo(DelayNodeInner)
