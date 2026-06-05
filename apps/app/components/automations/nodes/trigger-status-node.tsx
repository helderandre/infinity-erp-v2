"use client"

import { memo, useMemo } from "react"
import type { NodeProps } from "@xyflow/react"
import { Activity } from "lucide-react"
import { NodeWrapper } from "./node-wrapper"
import { useReactFlow } from "@xyflow/react"
import type { TriggerStatusNodeData } from "@/lib/types/automation-flow"
import {
  ENTITY_OPTIONS,
  STATUS_VALUES,
} from "@/lib/constants-automations"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

function TriggerStatusNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as TriggerStatusNodeData
  const { updateNodeData } = useReactFlow()
  const condition = nodeData.triggerCondition

  // Find the selected entity option
  const selectedEntity = useMemo(
    () => ENTITY_OPTIONS.find((o) => o.value === condition?.entity_type),
    [condition?.entity_type]
  )

  // Get possible status values for the selected entity
  const statusOptions = useMemo(() => {
    if (!selectedEntity) return []
    const key = `${selectedEntity.table}.${selectedEntity.statusField}`
    return STATUS_VALUES[key] || []
  }, [selectedEntity])

  return (
    <NodeWrapper
      id={id}
      nodeType="trigger_status"
      selected={selected}
      icon={<Activity />}
      title={nodeData.label || "Mudança de Estado"}
      showTargetHandle={false}
    >
      <div className="space-y-2">
        {/* Entity selection */}
        <div>
          <Label className="text-[10px] text-muted-foreground mb-1 block">
            Quando um(a)
          </Label>
          <Select
            value={condition?.entity_type || ""}
            onValueChange={(v) =>
              updateNodeData(id, {
                ...nodeData,
                triggerCondition: {
                  ...condition,
                  entity_type: v,
                  field: ENTITY_OPTIONS.find((o) => o.value === v)?.statusField || "",
                  values: [],
                },
              })
            }
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Escolher entidade..." />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status value selection */}
        {selectedEntity && statusOptions.length > 0 && (
          <div>
            <Label className="text-[10px] text-muted-foreground mb-1 block">
              muda o estado para
            </Label>
            <Select
              value={condition?.values?.[0] || ""}
              onValueChange={(v) =>
                updateNodeData(id, {
                  ...nodeData,
                  triggerCondition: {
                    ...condition,
                    entity_type: condition?.entity_type || "",
                    field: selectedEntity.statusField,
                    values: [v],
                  },
                })
              }
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Qualquer valor..." />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Summary description */}
        {selectedEntity && (
          <p className="text-[10px] text-muted-foreground/70 pt-0.5">
            Quando o estado de {selectedEntity.label} muda
            {condition?.values && condition.values.length > 0 && (
              <>
                {" para "}
                <Badge variant="secondary" className="text-[9px] px-1 py-0">
                  {statusOptions.find((s) => s.value === condition.values[0])?.label || condition.values[0]}
                </Badge>
              </>
            )}
          </p>
        )}
      </div>
    </NodeWrapper>
  )
}

export const TriggerStatusNode = memo(TriggerStatusNodeInner)
