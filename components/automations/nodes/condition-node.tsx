"use client"

import { memo } from "react"
import type { NodeProps } from "@xyflow/react"
import { GitBranch } from "lucide-react"
import { Handle, Position, useReactFlow } from "@xyflow/react"
import type { ConditionNodeData } from "@/lib/types/automation-flow"
import { CONDITION_OPERATOR_LABELS } from "@/lib/types/automation-flow"
import { cn } from "@/lib/utils"
import {
  nodeAccentMap,
  nodeColorBgMap,
  nodeColorTextMap,
} from "@/lib/types/automation-flow"
import { Trash2 } from "lucide-react"

function ConditionNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as ConditionNodeData
  const { deleteElements } = useReactFlow()

  const rules = nodeData.rules || []
  const logic = nodeData.logic || "and"

  return (
    <div
      className={cn(
        "relative w-[280px] rounded-lg border-l-[3px] bg-background shadow-sm transition-shadow",
        nodeAccentMap["condition"],
        selected
          ? "ring-2 ring-primary/50 shadow-md"
          : "border border-border/50 hover:shadow-md"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-muted-foreground/40 !border-2 !border-background hover:!bg-primary"
      />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
        <div
          className={cn(
            "flex items-center justify-center w-7 h-7 rounded-md",
            nodeColorBgMap["condition"]
          )}
        >
          <GitBranch className={cn("w-4 h-4", nodeColorTextMap["condition"])} />
        </div>
        <span className="flex-1 text-sm font-medium truncate">
          {nodeData.label || "Condição"}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            deleteElements({ nodes: [{ id }] })
          }}
          className="opacity-0 group-hover:opacity-100 hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="px-3 py-2 text-xs text-muted-foreground">
        {rules.length > 0 ? (
          <div className="space-y-1">
            {rules.map((rule, i) => (
              <div key={i}>
                {i > 0 && (
                  <span className="text-[10px] font-medium text-muted-foreground/60 uppercase">
                    {logic === "and" ? "E" : "OU"}
                  </span>
                )}
                <p className="truncate">
                  <span className="font-medium">{rule.field}</span>{" "}
                  {CONDITION_OPERATOR_LABELS[rule.operator]}
                  {rule.value ? ` "${rule.value}"` : ""}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground/70">Decidir caminho baseado numa condição</p>
        )}
      </div>

      {/* Two handles: Sim (green) and Não (red) */}
      <div className="flex items-center justify-between px-6 py-1.5 border-t border-border/30 text-[10px] font-medium">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Sim</span>
        </div>
        <div className="flex items-center gap-1">
          <span>Não</span>
          <div className="w-2 h-2 rounded-full bg-red-500" />
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background"
        style={{ left: "30%" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-background"
        style={{ left: "70%" }}
      />
    </div>
  )
}

export const ConditionNode = memo(ConditionNodeInner)
