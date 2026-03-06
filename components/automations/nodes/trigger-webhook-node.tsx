"use client"

import { memo } from "react"
import type { NodeProps } from "@xyflow/react"
import { Webhook, Copy, Check, Radio, Square, RotateCcw } from "lucide-react"
import { NodeWrapper } from "./node-wrapper"
import type { TriggerWebhookNodeData } from "@/lib/types/automation-flow"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useWebhookTestListener } from "@/hooks/use-webhook-test-listener"
import { WebhookJsonTree } from "@/components/automations/webhook-json-tree"

function TriggerWebhookNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as TriggerWebhookNodeData
  const [copied, setCopied] = useState(false)
  const { state, countdown, capture, startListening, stopListening, reset } =
    useWebhookTestListener()

  const webhookUrl = nodeData.webhookKey
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/webhook/${nodeData.webhookKey}`
    : null

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <NodeWrapper
      id={id}
      nodeType="trigger_webhook"
      selected={selected}
      icon={<Webhook />}
      title={nodeData.label || "Webhook"}
      showTargetHandle={false}
    >
      {webhookUrl ? (
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <code className="flex-1 truncate text-[10px] bg-muted px-1.5 py-0.5 rounded">
              {webhookUrl}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 p-0.5 hover:text-foreground"
            >
              {copied ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>

          {/* Listener states */}
          {state === "idle" && (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-6 text-[10px]"
              onClick={(e) => {
                e.stopPropagation()
                if (nodeData.webhookKey) startListening(nodeData.webhookKey)
              }}
            >
              <Radio className="h-3 w-3 mr-1" />
              Ouvir Webhook
            </Button>
          )}

          {state === "listening" && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                <span className="text-[10px] text-muted-foreground">
                  A ouvir... {countdown}s
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-6 text-[10px]"
                onClick={(e) => {
                  e.stopPropagation()
                  stopListening()
                }}
              >
                <Square className="h-2.5 w-2.5 mr-1" />
                Parar
              </Button>
            </div>
          )}

          {state === "received" && capture && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Check className="h-3 w-3 text-emerald-500" />
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  Webhook recebido!
                </span>
              </div>
              <WebhookJsonTree data={capture.payload} />
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-6 text-[10px]"
                onClick={(e) => {
                  e.stopPropagation()
                  reset()
                }}
              >
                <RotateCcw className="h-2.5 w-2.5 mr-1" />
                Ouvir novamente
              </Button>
            </div>
          )}

          {state === "timeout" && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground">
                Nenhum webhook recebido em 120s
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-6 text-[10px]"
                onClick={(e) => {
                  e.stopPropagation()
                  if (nodeData.webhookKey) startListening(nodeData.webhookKey)
                }}
              >
                <RotateCcw className="h-2.5 w-2.5 mr-1" />
                Tentar novamente
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground/70">
          Recebe dados de uma fonte externa
        </p>
      )}
      {nodeData.webhookMappings && nodeData.webhookMappings.length > 0 && (
        <p className="mt-1">
          {nodeData.webhookMappings.length} campos mapeados
        </p>
      )}
    </NodeWrapper>
  )
}

export const TriggerWebhookNode = memo(TriggerWebhookNodeInner)
