"use client"

import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
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
import { useAutoLayout } from "@/hooks/use-auto-layout"
import { Button } from "@/components/ui/button"
import { LayoutGrid } from "lucide-react"
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

// ── Public Handle ──

export interface FlowEditorHandle {
  save: () => void
}

// ── Inner Editor ──

interface FlowEditorInnerProps {
  initialDefinition?: FlowDefinition
  onSave: (definition: FlowDefinition) => void
  saving?: boolean
}

const FlowEditorInner = forwardRef<FlowEditorHandle, FlowEditorInnerProps>(function FlowEditorInner({
  initialDefinition,
  onSave,
  saving,
}: FlowEditorInnerProps, ref) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, fitView } = useReactFlow()
  const { layoutNodes } = useAutoLayout()

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
        style: { stroke: "var(--muted-foreground)", strokeWidth: 1.5 },
      })),
    [initialDefinition]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, rawOnEdgesChange] = useEdgesState(initialEdges)

  // Detect edge removal and trigger save
  const onEdgesChange = useCallback((changes: Parameters<typeof rawOnEdgesChange>[0]) => {
    rawOnEdgesChange(changes)
    if (changes.some((c) => c.type === "remove")) {
      queueMicrotask(() => emitDraftRef.current())
    }
  }, [rawOnEdgesChange])

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
      // Save after state update flushes
      queueMicrotask(() => emitDraftRef.current())
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
      queueMicrotask(() => emitDraftRef.current())
    },
    [nodes, screenToFlowPosition, setNodes]
  )

  // ── Validation ──
  function validateFlow(flowNodes: Node[], flowEdges: Edge[]): string[] {
    const errors: string[] = []

    const triggers = flowNodes.filter((n) => isTriggerType(n.type || ""))
    if (triggers.length === 0) {
      errors.push("O fluxo precisa de pelo menos um gatilho")
    }

    for (const t of triggers) {
      const d = t.data as Record<string, unknown>
      if (t.type === "trigger_webhook" && !d.webhookKey)
        errors.push("Gatilho Webhook sem chave configurada")
      if (
        t.type === "trigger_status" &&
        !(d.triggerCondition as Record<string, unknown> | undefined)?.entity_type
      )
        errors.push("Gatilho Status sem entidade configurada")
      if (t.type === "trigger_schedule" && !d.cronExpression)
        errors.push("Gatilho Agendamento sem expressão cron")
    }

    for (const n of flowNodes.filter((n) => n.type === "whatsapp")) {
      const d = n.data as Record<string, unknown>
      if (!d.templateId && (!Array.isArray(d.messages) || (d.messages as unknown[]).length === 0))
        errors.push(`Node WhatsApp "${d.label || "WhatsApp"}" sem mensagens configuradas`)
    }

    for (const n of flowNodes.filter((n) => n.type === "condition")) {
      const d = n.data as Record<string, unknown>
      if (!Array.isArray(d.rules) || (d.rules as unknown[]).length === 0)
        errors.push(`Condição "${d.label || "Condição"}" sem regras definidas`)
    }

    const connectedIds = new Set([
      ...flowEdges.map((e) => e.source),
      ...flowEdges.map((e) => e.target),
    ])
    const triggerIds = new Set(triggers.map((t) => t.id))
    for (const n of flowNodes) {
      if (!triggerIds.has(n.id) && !connectedIds.has(n.id))
        errors.push(`Node "${(n.data as Record<string, unknown>).label || n.type}" não está conectado`)
    }

    return errors
  }

  // ── Save ──
  const handleSave = useCallback(() => {
    const errors = validateFlow(nodes, edges)
    if (errors.length > 0) {
      errors.forEach((e) => toast.error(e))
      return
    }

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

  // Expose save to parent via ref
  useImperativeHandle(ref, () => ({ save: handleSave }), [handleSave])

  // ── Auto-save: triggered only on discrete events ──
  const emitDraftRef = useRef<() => void>(() => {})
  const emitDraft = useCallback(() => {
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

    onSave({ version: 1, nodes: flowNodes, edges: flowEdges })
  }, [nodes, edges, onSave])
  emitDraftRef.current = emitDraft

  // ── Auto-Layout ──
  const handleAutoLayout = useCallback(() => {
    const automationNodes = nodes.map((n) => ({
      id: n.id,
      type: n.type as AutomationNodeType,
      position: n.position,
      data: n.data as unknown as AutomationNodeData,
    }))
    const automationEdges: AutomationEdge[] = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || null,
      targetHandle: e.targetHandle || null,
    }))
    const layouted = layoutNodes(automationNodes, automationEdges)
    setNodes(
      layouted.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data as unknown as Record<string, unknown>,
      }))
    )
    setTimeout(() => fitView({ padding: 0.2 }), 100)
  }, [nodes, edges, layoutNodes, setNodes, fitView])

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
          onNodeDragStop={() => emitDraftRef.current()}
          onNodesDelete={() => queueMicrotask(() => emitDraftRef.current())}
          nodeTypes={nodeTypes}
          isValidConnection={isValidConnection}
          fitView
          deleteKeyCode={["Backspace", "Delete"]}
          className="bg-background"
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: "var(--muted-foreground)", strokeWidth: 1.5 },
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
          <Panel position="top-right">
            <Button variant="outline" size="sm" onClick={handleAutoLayout}>
              <LayoutGrid className="h-4 w-4 mr-1.5" />
              Organizar
            </Button>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  )
})

// ── Wrapper with Provider ──

interface FlowEditorProps {
  initialDefinition?: FlowDefinition
  onSave: (definition: FlowDefinition) => void
  saving?: boolean
}

export const FlowEditor = forwardRef<FlowEditorHandle, FlowEditorProps>(
  function FlowEditor(props, ref) {
    return (
      <ReactFlowProvider>
        <FlowEditorInner ref={ref} {...props} />
      </ReactFlowProvider>
    )
  }
)
