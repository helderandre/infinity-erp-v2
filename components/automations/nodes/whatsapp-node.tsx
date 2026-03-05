"use client"

import { memo } from "react"
import type { NodeProps } from "@xyflow/react"
import { MessageCircle, Settings } from "lucide-react"
import { NodeWrapper } from "./node-wrapper"
import { useReactFlow } from "@xyflow/react"
import type { WhatsAppNodeData } from "@/lib/types/automation-flow"
import { Badge } from "@/components/ui/badge"

function WhatsAppNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as WhatsAppNodeData

  const messageCount = nodeData.messages?.length || 0
  const hasTemplate = !!nodeData.templateId

  return (
    <NodeWrapper
      id={id}
      nodeType="whatsapp"
      selected={selected}
      icon={<MessageCircle />}
      title={nodeData.label || "WhatsApp"}
    >
      {hasTemplate ? (
        <div className="space-y-1">
          <Badge variant="secondary" className="text-[10px]">
            Template
          </Badge>
          <p className="truncate">{nodeData.templateName || "Template seleccionado"}</p>
        </div>
      ) : messageCount > 0 ? (
        <div className="space-y-1">
          <p>{messageCount} mensage{messageCount === 1 ? "m" : "ns"}</p>
          <div className="flex gap-0.5">
            {nodeData.messages?.slice(0, 5).map((m, i) => (
              <span key={i} className="text-[10px]">
                {m.type === "text" ? "📝" : m.type === "image" ? "🖼️" : m.type === "video" ? "🎥" : m.type === "audio" || m.type === "ptt" ? "🎵" : "📄"}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground/70">Enviar mensagens WhatsApp</p>
      )}
    </NodeWrapper>
  )
}

export const WhatsAppNode = memo(WhatsAppNodeInner)
