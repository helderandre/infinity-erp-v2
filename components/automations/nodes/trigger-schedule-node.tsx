"use client"

import { memo } from "react"
import type { NodeProps } from "@xyflow/react"
import { Clock } from "lucide-react"
import { NodeWrapper } from "./node-wrapper"
import { useReactFlow } from "@xyflow/react"
import type { TriggerScheduleNodeData } from "@/lib/types/automation-flow"
import { Input } from "@/components/ui/input"

function describeCron(expression: string): string {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) return "Expressão inválida"
  const [min, hour, , , dow] = parts

  if (expression.trim() === "* * * * *") return "A cada minuto"
  if (min === "0" && hour === "0" && dow === "*") return "Todos os dias à meia-noite"
  if (min.startsWith("*/")) return `A cada ${min.slice(2)} minutos`
  if (hour.startsWith("*/")) return `A cada ${hour.slice(2)} horas`
  if (hour !== "*" && min !== "*" && dow === "1-5")
    return `Seg a Sex às ${hour}:${min.padStart(2, "0")}`
  if (hour !== "*" && min !== "*" && dow === "1")
    return `Todas as segundas às ${hour}:${min.padStart(2, "0")}`
  if (hour !== "*" && min !== "*" && dow === "0")
    return `Todos os domingos às ${hour}:${min.padStart(2, "0")}`
  if (hour !== "*" && min !== "*" && dow === "*")
    return `Todos os dias às ${hour}:${min.padStart(2, "0")}`

  return `Cron: ${expression}`
}

function TriggerScheduleNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as TriggerScheduleNodeData
  const { updateNodeData } = useReactFlow()

  return (
    <NodeWrapper
      id={id}
      nodeType="trigger_schedule"
      selected={selected}
      icon={<Clock />}
      title={nodeData.label || "Agendamento"}
      showTargetHandle={false}
    >
      <div className="space-y-1.5">
        <Input
          value={nodeData.cronExpression || ""}
          onChange={(e) =>
            updateNodeData(id, { ...nodeData, cronExpression: e.target.value })
          }
          placeholder="0 9 * * 1-5"
          className="h-7 text-xs font-mono"
        />
        <p className="text-[10px] text-muted-foreground/70">
          {nodeData.cronExpression
            ? describeCron(nodeData.cronExpression)
            : "Executar automaticamente em horários definidos"}
        </p>
        {nodeData.timezone && (
          <p className="text-[10px]">Fuso: {nodeData.timezone}</p>
        )}
      </div>
    </NodeWrapper>
  )
}

export const TriggerScheduleNode = memo(TriggerScheduleNodeInner)
