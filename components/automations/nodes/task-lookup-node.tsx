"use client"

import { memo } from "react"
import type { NodeProps } from "@xyflow/react"
import { Search } from "lucide-react"
import { Handle, Position, useReactFlow } from "@xyflow/react"
import type { TaskLookupNodeData } from "@/lib/types/automation-flow"
import { cn } from "@/lib/utils"
import {
  nodeAccentMap,
  nodeColorBgMap,
  nodeColorTextMap,
} from "@/lib/types/automation-flow"
import { Trash2 } from "lucide-react"

const ENTITY_LABELS: Record<string, string> = {
  lead: "Lead",
  owner: "Proprietário",
  user: "Utilizador",
}

function TaskLookupNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as TaskLookupNodeData
  const { deleteElements } = useReactFlow()

  return (
    <div
      className={cn(
        "relative w-[280px] rounded-lg border-l-[3px] bg-background shadow-sm transition-shadow",
        nodeAccentMap["task_lookup"],
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

      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
        <div
          className={cn(
            "flex items-center justify-center w-7 h-7 rounded-md",
            nodeColorBgMap["task_lookup"]
          )}
        >
          <Search className={cn("w-4 h-4", nodeColorTextMap["task_lookup"])} />
        </div>
        <span className="flex-1 text-sm font-medium truncate">
          {nodeData.label || "Buscar Lead"}
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

      <div className="px-3 py-2 text-xs text-muted-foreground space-y-1">
        {nodeData.entityType ? (
          <>
            <p>Procurar: <span className="font-medium">{ENTITY_LABELS[nodeData.entityType] || nodeData.entityType}</span></p>
            {nodeData.lookupField && (
              <p>Por: <span className="font-medium">{nodeData.lookupField}</span></p>
            )}
            {nodeData.createIfNotFound && (
              <p className="text-[10px]">Criar se não encontrar</p>
            )}
            {nodeData.outputVariable && (
              <p className="text-[10px]">Resultado → {nodeData.outputVariable}</p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground/70">Procurar ou criar um contacto</p>
        )}
      </div>

      {/* Handles: Encontrado and Criado */}
      <div className="flex items-center justify-between px-6 py-1.5 border-t border-border/30 text-[10px] font-medium">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Encontrado</span>
        </div>
        <div className="flex items-center gap-1">
          <span>Criado</span>
          <div className="w-2 h-2 rounded-full bg-blue-500" />
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="found"
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background"
        style={{ left: "30%" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="created"
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-background"
        style={{ left: "70%" }}
      />
    </div>
  )
}

export const TaskLookupNode = memo(TaskLookupNodeInner)
