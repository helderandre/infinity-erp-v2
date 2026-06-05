"use client"

import { memo, type ReactNode } from "react"
import { Handle, Position } from "@xyflow/react"
import { MoreVertical, Trash2, Copy } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  type AutomationNodeType,
  getNodeCategory,
  nodeCategoryConfig,
  nodeColorBgMap,
  nodeColorTextMap,
} from "@/lib/types/automation-flow"
import { useReactFlow } from "@xyflow/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface NodeWrapperProps {
  id: string
  nodeType: AutomationNodeType
  selected?: boolean
  icon: ReactNode
  title: string
  description?: string
  showTargetHandle?: boolean
  showSourceHandle?: boolean
  children?: ReactNode
  footer?: ReactNode
}

function NodeWrapperInner({
  id,
  nodeType,
  selected,
  icon,
  title,
  description,
  showTargetHandle = true,
  showSourceHandle = true,
  children,
  footer,
}: NodeWrapperProps) {
  const { deleteElements, getNode, addNodes } = useReactFlow()
  const category = getNodeCategory(nodeType)
  const catConfig = nodeCategoryConfig[category]

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation()
    const node = getNode(id)
    if (!node) return
    addNodes({
      ...node,
      id: `${nodeType}-${Date.now()}`,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
    })
  }

  return (
    <div className="relative pt-3">
      {/* Category Badge — floating above the card */}
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

      {/* Card */}
      <div
        className={cn(
          "relative w-[300px] rounded-xl border bg-card shadow-sm transition-all",
          catConfig.cardBorder,
          selected
            ? "ring-2 ring-primary/40 shadow-md"
            : "hover:shadow-md"
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
        <div className="flex items-center gap-2.5 px-3.5 py-3">
          <div
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
              nodeColorBgMap[nodeType]
            )}
          >
            <span
              className={cn(
                "flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4",
                nodeColorTextMap[nodeType]
              )}
            >
              {icon}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold truncate block">{title}</span>
            {description && (
              <span className="text-[10px] text-muted-foreground truncate block">
                {description}
              </span>
            )}
          </div>
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
        {children && (
          <div className="px-3.5 pb-3 text-xs text-muted-foreground">
            {children}
          </div>
        )}

        {/* Footer */}
        {footer && (
          <div className="flex items-center gap-2 px-3.5 py-2 border-t border-border/40 text-[10px] text-muted-foreground">
            {footer}
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
    </div>
  )
}

export const NodeWrapper = memo(NodeWrapperInner)
