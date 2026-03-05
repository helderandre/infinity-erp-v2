"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import type {
  AutomationNodeType,
  AutomationNodeData,
  FlowDefinition,
  AutomationEdge,
} from "@/lib/types/automation-flow"
import { isTriggerType } from "@/lib/types/automation-flow"

import { FlowSidebar } from "./flow-sidebar"
import { TriggerWebhookNode } from "./nodes/trigger-webhook-node"
import { TriggerStatusNode } from "./nodes/trigger-status-node"
import { TriggerScheduleNode } from "./nodes/trigger-schedule-node"
import { TriggerManualNode } from "./nodes/trigger-manual-node"
import { WhatsAppNode } from "./nodes/whatsapp-node"
import { EmailNode } from "./nodes/email-node"
import { DelayNode } from "./nodes/delay-node"
import { ConditionNode } from "./nodes/condition-node"
import { SupabaseQueryNode } from "./nodes/supabase-query-node"
import { TaskLookupNode } from "./nodes/task-lookup-node"
import { SetVariableNode } from "./nodes/set-variable-node"
import { HttpRequestNode } from "./nodes/http-request-node"
import { WebhookResponseNode } from "./nodes/webhook-response-node"
import { NotificationNode } from "./nodes/notification-node"
import { toast } from "sonner"

// ── Node Types ──

const nodeTypes = {
  trigger_webhook: TriggerWebhookNode,
  trigger_status: TriggerStatusNode,
  trigger_schedule: TriggerScheduleNode,
  trigger_manual: TriggerManualNode,
  whatsapp: WhatsAppNode,
  email: EmailNode,
  delay: DelayNode,
  condition: ConditionNode,
  supabase_query: SupabaseQueryNode,
  task_lookup: TaskLookupNode,
  set_variable: SetVariableNode,
  http_request: HttpRequestNode,
  webhook_response: WebhookResponseNode,
  notification: NotificationNode,
}

// ── Default Data ──

function getDefaultData(type: AutomationNodeType): AutomationNodeData {
  const defaults: Record<AutomationNodeType, AutomationNodeData> = {
    trigger_webhook: { label: "Webhook", type: "trigger_webhook" },
    trigger_status: { label: "Mudança de Estado", type: "trigger_status" },
    trigger_schedule: { label: "Agendamento", type: "trigger_schedule" },
    trigger_manual: { label: "Manual", type: "trigger_manual" },
    whatsapp: { label: "WhatsApp", type: "whatsapp", messages: [] },
    email: { label: "Email", type: "email" },
    delay: { label: "Aguardar", type: "delay", value: 5, unit: "minutes" },
    condition: { label: "Condição", type: "condition", rules: [], logic: "and" },
    supabase_query: {
      label: "Consulta Banco",
      type: "supabase_query",
      operation: "select",
    },
    task_lookup: {
      label: "Buscar Lead",
      type: "task_lookup",
      entityType: "lead",
      lookupField: "email",
      lookupVariable: "",
      createIfNotFound: false,
    },
    set_variable: {
      label: "Definir Variável",
      type: "set_variable",
      assignments: [],
    },
    http_request: {
      label: "HTTP Request",
      type: "http_request",
      method: "GET",
      url: "",
    },
    webhook_response: {
      label: "Responder Webhook",
      type: "webhook_response",
      statusCode: 200,
      responseBody: '{ "ok": true }',
      continueAfterResponse: false,
    },
    notification: {
      label: "Notificação",
      type: "notification",
      recipientType: "user",
      title: "",
      body: "",
    },
  }
  return defaults[type]
}

// ── Cycle Detection ──

function hasCycle(
  edges: Edge[],
  newSource: string,
  newTarget: string
): boolean {
  const adjacency = new Map<string, string[]>()
  for (const edge of edges) {
    adjacency.set(edge.source, [
      ...(adjacency.get(edge.source) || []),
      edge.target,
    ])
  }
  adjacency.set(newSource, [
    ...(adjacency.get(newSource) || []),
    newTarget,
  ])

  const visited = new Set<string>()
  const stack = [newTarget]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (current === newSource) return true
    if (visited.has(current)) continue
    visited.add(current)
    for (const next of adjacency.get(current) || []) stack.push(next)
  }
  return false
}

// ── Inner Editor ──

interface FlowEditorInnerProps {
  initialDefinition?: FlowDefinition
  onSave: (definition: FlowDefinition) => void
  saving?: boolean
}

function FlowEditorInner({
  initialDefinition,
  onSave,
  saving,
}: FlowEditorInnerProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()

  const initialNodes: Node[] = useMemo(
    () =>
      (initialDefinition?.nodes || []).map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data as unknown as Record<string, unknown>,
      })),
    [initialDefinition]
  )

  const initialEdges: Edge[] = useMemo(
    () =>
      (initialDefinition?.edges || []).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle || undefined,
        targetHandle: e.targetHandle || undefined,
        label: e.label,
        animated: true,
        style: { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1.5 },
      })),
    [initialDefinition]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // ── Connection validation ──
  const isValidConnection = useCallback(
    (connection: Edge | Connection) => {
      const { source, target } = connection
      if (!source || !target) return false

      // No self-loops
      if (source === target) return false

      // Triggers cannot be targets
      const targetNode = nodes.find((n) => n.id === target)
      if (targetNode && isTriggerType(targetNode.type || "")) return false

      // Cycle detection
      if (hasCycle(edges, source, target)) return false

      return true
    },
    [nodes, edges]
  )

  const onConnect: OnConnect = useCallback(
    (params) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            id: `e-${params.source}-${params.target}-${Date.now()}`,
          },
          eds
        )
      )
    },
    [setEdges]
  )

  // ── Drop handler ──
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const type = event.dataTransfer.getData(
        "application/reactflow"
      ) as AutomationNodeType
      if (!type) return

      // Max 1 trigger per flow
      if (isTriggerType(type)) {
        const existingTrigger = nodes.find((n) => isTriggerType(n.type || ""))
        if (existingTrigger) {
          toast.error("Apenas um gatilho por fluxo")
          return
        }
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: getDefaultData(type) as unknown as Record<string, unknown>,
      }

      setNodes((nds) => [...nds, newNode])
    },
    [nodes, screenToFlowPosition, setNodes]
  )

  // ── Save ──
  const handleSave = useCallback(() => {
    const flowNodes = nodes.map((n) => ({
      id: n.id,
      type: n.type as AutomationNodeType,
      position: n.position,
      data: n.data as unknown as AutomationNodeData,
    }))

    const flowEdges: AutomationEdge[] = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || null,
      targetHandle: e.targetHandle || null,
      label: typeof e.label === "string" ? e.label : undefined,
    }))

    const definition: FlowDefinition = {
      version: 1,
      nodes: flowNodes,
      edges: flowEdges,
    }

    onSave(definition)
  }, [nodes, edges, onSave])

  return (
    <div className="flex h-full">
      <FlowSidebar />
      <div ref={reactFlowWrapper} className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          isValidConnection={isValidConnection}
          fitView
          deleteKeyCode={["Backspace", "Delete"]}
          className="bg-background"
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1.5 },
          }}
        >
          <Background gap={20} size={1} />
          <Controls
            showInteractive={false}
            className="!bg-background !border-border !shadow-sm [&>button]:!bg-background [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-accent"
          />
          <MiniMap
            nodeStrokeWidth={3}
            className="!bg-background !border-border"
          />
        </ReactFlow>
      </div>
    </div>
  )
}

// ── Wrapper with Provider ──

interface FlowEditorProps {
  initialDefinition?: FlowDefinition
  onSave: (definition: FlowDefinition) => void
  saving?: boolean
}

export function FlowEditor(props: FlowEditorProps) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner {...props} />
    </ReactFlowProvider>
  )
}
