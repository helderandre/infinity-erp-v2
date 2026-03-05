"use client"

import { memo } from "react"
import type { NodeProps } from "@xyflow/react"
import { Database } from "lucide-react"
import { NodeWrapper } from "./node-wrapper"
import type { SupabaseQueryNodeData, SupabaseQueryOperation } from "@/lib/types/automation-flow"
import { Badge } from "@/components/ui/badge"

const OPERATION_LABELS: Record<SupabaseQueryOperation, string> = {
  select: "Consultar",
  insert: "Inserir",
  update: "Actualizar",
  upsert: "Inserir/Actualizar",
  delete: "Remover",
  rpc: "Função",
}

function SupabaseQueryNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as SupabaseQueryNodeData

  const isConfigured = nodeData.operation && (nodeData.table || nodeData.rpcFunction)

  return (
    <NodeWrapper
      id={id}
      nodeType="supabase_query"
      selected={selected}
      icon={<Database />}
      title={nodeData.label || "Consulta Banco"}
    >
      {isConfigured ? (
        <div className="space-y-1">
          <Badge variant="secondary" className="text-[10px]">
            {OPERATION_LABELS[nodeData.operation]}
          </Badge>
          <p className="truncate font-mono text-[10px]">
            {nodeData.operation === "rpc"
              ? nodeData.rpcFunction
              : nodeData.table}
          </p>
          {nodeData.outputVariable && (
            <p className="text-[10px]">Resultado → {nodeData.outputVariable}</p>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground/70">Consultar ou gravar dados no sistema</p>
      )}
    </NodeWrapper>
  )
}

export const SupabaseQueryNode = memo(SupabaseQueryNodeInner)
