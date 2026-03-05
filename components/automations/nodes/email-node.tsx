"use client"

import { memo } from "react"
import type { NodeProps } from "@xyflow/react"
import { Mail } from "lucide-react"
import { NodeWrapper } from "./node-wrapper"
import type { EmailNodeData } from "@/lib/types/automation-flow"
import { Badge } from "@/components/ui/badge"

function EmailNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as EmailNodeData

  return (
    <NodeWrapper
      id={id}
      nodeType="email"
      selected={selected}
      icon={<Mail />}
      title={nodeData.label || "Email"}
    >
      {nodeData.emailTemplateId ? (
        <div className="space-y-1">
          <Badge variant="secondary" className="text-[10px]">
            Template
          </Badge>
          <p className="truncate">{nodeData.emailTemplateName || "Template seleccionado"}</p>
        </div>
      ) : nodeData.subject ? (
        <div className="space-y-1">
          <p className="truncate font-medium">{nodeData.subject}</p>
          {nodeData.recipientVariable && (
            <p className="text-[10px]">Para: {nodeData.recipientVariable}</p>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground/70">Enviar email com template</p>
      )}
    </NodeWrapper>
  )
}

export const EmailNode = memo(EmailNodeInner)
