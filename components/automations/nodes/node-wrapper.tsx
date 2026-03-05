"use client"

import { memo, type ReactNode } from "react"
import { Handle, Position } from "@xyflow/react"
import { Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  type AutomationNodeType,
  nodeAccentMap,
  nodeColorBgMap,
  nodeColorTextMap,
} from "@/lib/types/automation-flow"
import { useReactFlow } from "@xyflow/react"

interface NodeWrapperProps {
  id: string
  nodeType: AutomationNodeType
  selected?: boolean
  icon: ReactNode
  title: string
  showTargetHandle?: boolean
  showSourceHandle?: boolean
  children?: ReactNode
}

function NodeWrapperInner({
  id,
  nodeType,
  selected,
  icon,
  title,
  showTargetHandle = true,
  showSourceHandle = true,
  children,
}: NodeWrapperProps) {
  const { deleteElements } = useReactFlow()

  return (
    <div
      className={cn(
        "relative w-[280px] rounded-lg border-l-[3px] bg-background shadow-sm transition-shadow",
        nodeAccentMap[nodeType],
        selected
          ? "ring-2 ring-primary/50 shadow-md"
          : "border border-border/50 hover:shadow-md"
      )}
    >
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-muted-foreground/40 !border-2 !border-background hover:!bg-primary transition-colors"
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
        <div
          className={cn(
            "flex items-center justify-center w-7 h-7 rounded-md",
            nodeColorBgMap[nodeType]
          )}
        >
          <span className={cn("flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4", nodeColorTextMap[nodeType])}>
            {icon}
          </span>
        </div>
        <span className="flex-1 text-sm font-medium truncate">{title}</span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            deleteElements({ nodes: [{ id }] })
          }}
          className="opacity-0 group-hover:opacity-100 hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
          title="Eliminar"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      {children && (
        <div className="px-3 py-2 text-xs text-muted-foreground">
          {children}
        </div>
      )}

      {showSourceHandle && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-muted-foreground/40 !border-2 !border-background hover:!bg-primary transition-colors"
        />
      )}
    </div>
  )
}

export const NodeWrapper = memo(NodeWrapperInner)
