"use client"

import { memo } from "react"
import type { NodeProps } from "@xyflow/react"
import { Variable } from "lucide-react"
import { NodeWrapper } from "./node-wrapper"
import type { SetVariableNodeData } from "@/lib/types/automation-flow"

function SetVariableNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as SetVariableNodeData

  const assignments = nodeData.assignments || []

  return (
    <NodeWrapper
      id={id}
      nodeType="set_variable"
      selected={selected}
      icon={<Variable />}
      title={nodeData.label || "Definir Variável"}
    >
      {assignments.length > 0 ? (
        <div className="space-y-0.5">
          {assignments.slice(0, 3).map((a, i) => (
            <p key={i} className="truncate font-mono text-[10px]">
              {a.key} = {a.value}
            </p>
          ))}
          {assignments.length > 3 && (
            <p className="text-[10px]">+{assignments.length - 3} mais</p>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground/70">Guardar um valor para usar depois</p>
      )}
    </NodeWrapper>
  )
}

export const SetVariableNode = memo(SetVariableNodeInner)
