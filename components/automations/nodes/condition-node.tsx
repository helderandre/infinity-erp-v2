"use client"

import { memo } from "react"
import type { NodeProps } from "@xyflow/react"
import { GitBranch, MoreVertical, Trash2, Copy } from "lucide-react"
import { Handle, Position, useReactFlow } from "@xyflow/react"
import type { ConditionNodeData, ConditionRule } from "@/lib/types/automation-flow"
import { CONDITION_OPERATOR_LABELS, VALUE_LESS_OPERATORS } from "@/lib/types/automation-flow"
import { cn } from "@/lib/utils"
import {
  getNodeCategory,
  nodeCategoryConfig,
  nodeColorBgMap,
  nodeColorTextMap,
} from "@/lib/types/automation-flow"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// ── Helper: descrever condição em linguagem natural ──

function describeCondition(rules: ConditionRule[], logic: "and" | "or"): string {
  if (rules.length === 0) return "Sem condições definidas"

  const first = rules[0]
  const fieldLabel = first.field || "campo"
  const opLabel = CONDITION_OPERATOR_LABELS[first.operator] || first.operator
  const suffix = rules.length > 1
    ? ` (+${rules.length - 1} ${rules.length - 1 === 1 ? "condição" : "condições"})`
    : ""

  if (VALUE_LESS_OPERATORS.has(first.operator)) {
    return `${fieldLabel} ${opLabel}${suffix}`
  }
  return `${fieldLabel} ${opLabel} "${first.value || "..."}"${suffix}`
}

function ConditionNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as ConditionNodeData
  const { deleteElements, getNode, addNodes } = useReactFlow()

  const rules = nodeData.rules || []
  const logic = nodeData.logic || "and"
  const category = getNodeCategory("condition")
  const catConfig = nodeCategoryConfig[category]

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation()
    const node = getNode(id)
    if (!node) return
    addNodes({
      ...node,
      id: `condition-${Date.now()}`,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
    })
  }

  return (
    <div className="relative pt-3">
      {/* Category Badge */}
      <div className="absolute -top-0 left-3 z-10">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold",
            catConfig.badgeBg,
            catConfig.badgeText
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full", catConfig.badgeDot)} />
          {catConfig.label}
        </span>
      </div>

      <div
        className={cn(
          "relative w-[300px] rounded-xl border bg-card shadow-sm transition-all",
          catConfig.cardBorder,
          selected
            ? "ring-2 ring-primary/40 shadow-md"
            : "hover:shadow-md"
        )}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-muted-foreground/40 !border-2 !border-background hover:!bg-primary"
        />

        {/* Header */}
        <div className="flex items-center gap-2.5 px-3.5 py-3">
          <div
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
              nodeColorBgMap["condition"]
            )}
          >
            <GitBranch className={cn("w-4 h-4", nodeColorTextMap["condition"])} />
          </div>
          <span className="flex-1 text-sm font-semibold truncate">
            {nodeData.label || "Condição"}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded-md hover:bg-muted transition-colors shrink-0"
              >
                <MoreVertical className="w-4 h-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="w-3.5 h-3.5 mr-2" />
                Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  deleteElements({ nodes: [{ id }] })
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Content */}
        <div className="px-3.5 pb-3 text-xs text-muted-foreground">
          {rules.length > 0 ? (
            <p className="truncate font-medium">
              {describeCondition(rules, logic)}
            </p>
          ) : (
            <p className="text-muted-foreground/70">Decidir caminho baseado numa condição</p>
          )}
        </div>

        {/* Two handles: Sim (green) and Não (red) */}
        <div className="flex items-center justify-between px-6 py-2 border-t border-border/40 text-[10px] font-medium">
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
    </div>
  )
}

export const ConditionNode = memo(ConditionNodeInner)
