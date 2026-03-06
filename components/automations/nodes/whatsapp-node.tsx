"use client"

import { memo, useState, useCallback, useEffect } from "react"
import type { NodeProps } from "@xyflow/react"
import { MessageCircle, Settings2 } from "lucide-react"
import { NodeWrapper } from "./node-wrapper"
import { useReactFlow } from "@xyflow/react"
import type { WhatsAppNodeData, WhatsAppMessage } from "@/lib/types/automation-flow"
import type { WhatsAppTemplateMessage } from "@/lib/types/whatsapp-template"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { WppMessageCard } from "@/components/automations/wpp-message-card"
import { WppMessageEditor } from "@/components/automations/wpp-message-editor"
import { Plus } from "lucide-react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"

interface WppTemplate {
  id: string
  name: string
  description: string | null
  category: string
  messages: WhatsAppTemplateMessage[]
  is_active: boolean
}

// ── Sheet de Configuração ──

function WhatsAppConfigSheet({
  open,
  onOpenChange,
  nodeData,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  nodeData: WhatsAppNodeData
  onSave: (data: Partial<WhatsAppNodeData>) => void
}) {
  const [mode, setMode] = useState<"template" | "inline">(
    nodeData.templateId ? "template" : "inline"
  )
  const [templates, setTemplates] = useState<WppTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState(nodeData.templateId || "")
  const [selectedTemplateName, setSelectedTemplateName] = useState(nodeData.templateName || "")
  const [messages, setMessages] = useState<WhatsAppTemplateMessage[]>(
    (nodeData.messages || []).map((m, i) => ({
      id: `msg-${i}-${Date.now()}`,
      type: m.type,
      content: m.content,
      mediaUrl: m.mediaUrl,
      docName: m.docName,
      delay: m.delay,
    }))
  )
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingMessage, setEditingMessage] = useState<WhatsAppTemplateMessage | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Load templates on open
  useEffect(() => {
    if (!open) return
    setLoadingTemplates(true)
    fetch("/api/automacao/templates-wpp?active=true")
      .then((res) => res.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false))
  }, [open])

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId)
    const tpl = templates.find((t) => t.id === templateId)
    setSelectedTemplateName(tpl?.name || "")
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = messages.findIndex((m) => m.id === active.id)
    const newIndex = messages.findIndex((m) => m.id === over.id)
    setMessages(arrayMove(messages, oldIndex, newIndex))
  }

  const handleSaveMessage = (msg: WhatsAppTemplateMessage) => {
    if (editingMessage) {
      setMessages((prev) => prev.map((m) => (m.id === editingMessage.id ? msg : m)))
    } else {
      setMessages((prev) => [...prev, msg])
    }
  }

  const handleSave = useCallback(() => {
    if (mode === "template") {
      onSave({
        templateId: selectedTemplateId || undefined,
        templateName: selectedTemplateName || undefined,
        messages: undefined,
      })
    } else {
      const flowMessages: WhatsAppMessage[] = messages.map((m) => ({
        type: m.type,
        content: m.content,
        mediaUrl: m.mediaUrl,
        docName: m.docName,
        delay: m.delay,
      }))
      onSave({
        templateId: undefined,
        templateName: undefined,
        messages: flowMessages,
      })
    }
    onOpenChange(false)
  }, [mode, selectedTemplateId, selectedTemplateName, messages, onSave, onOpenChange])

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg min-w-[560px] p-0 flex flex-col" side="right">
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <SheetTitle className="text-base">Configurar WhatsApp</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Mode toggle */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Modo</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as "template" | "inline")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="template">Template da biblioteca</SelectItem>
                <SelectItem value="inline">Criar neste fluxo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Template mode */}
          {mode === "template" && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Template WhatsApp
                </Label>
                <Select
                  value={selectedTemplateId}
                  onValueChange={handleTemplateSelect}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={loadingTemplates ? "A carregar..." : "Seleccionar template"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                    {templates.length === 0 && !loadingTemplates && (
                      <SelectItem value="_empty" disabled>
                        Nenhum template encontrado
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplate && (
                <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                  <p className="text-sm font-medium">{selectedTemplate.name}</p>
                  {selectedTemplate.description && (
                    <p className="text-xs text-muted-foreground">
                      {selectedTemplate.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {selectedTemplate.messages?.length || 0} mensage
                      {(selectedTemplate.messages?.length || 0) === 1 ? "m" : "ns"}
                    </Badge>
                    <div className="flex gap-0.5">
                      {selectedTemplate.messages?.slice(0, 6).map((m, i) => (
                        <span key={i} className="text-[10px]">
                          {m.type === "text" ? "📝" : m.type === "image" ? "🖼️" : m.type === "video" ? "🎥" : m.type === "audio" || m.type === "ptt" ? "🎵" : "📄"}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Inline mode */}
          {mode === "inline" && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">
                  Mensagens ({messages.length})
                </Label>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={messages.map((m) => m.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {messages.map((msg, i) => (
                      <WppMessageCard
                        key={msg.id}
                        message={msg}
                        index={i}
                        onEdit={() => {
                          setEditingMessage(msg)
                          setEditorOpen(true)
                        }}
                        onDelete={() =>
                          setMessages((prev) => prev.filter((m) => m.id !== msg.id))
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <Button
                variant="outline"
                className="w-full mt-3 border-dashed"
                onClick={() => {
                  setEditingMessage(null)
                  setEditorOpen(true)
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Mensagem
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 shrink-0">
          <Button onClick={handleSave} className="w-full">
            Guardar
          </Button>
        </div>
      </SheetContent>

      {/* Message editor (opens on top of Sheet) */}
      <WppMessageEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        message={editingMessage}
        onSave={handleSaveMessage}
      />
    </Sheet>
  )
}

// ── Node Component ──

function WhatsAppNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as WhatsAppNodeData
  const { updateNodeData } = useReactFlow()
  const [sheetOpen, setSheetOpen] = useState(false)

  const messageCount = nodeData.messages?.length || 0
  const hasTemplate = !!nodeData.templateId

  const handleSave = useCallback(
    (patch: Partial<WhatsAppNodeData>) => {
      updateNodeData(id, { ...nodeData, ...patch })
    },
    [id, nodeData, updateNodeData]
  )

  return (
    <>
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
            <button
              onClick={(e) => { e.stopPropagation(); setSheetOpen(true) }}
              className="flex items-center gap-1 mt-1 text-[10px] text-primary hover:underline"
            >
              <Settings2 className="h-3 w-3" /> Configurar
            </button>
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
            <button
              onClick={(e) => { e.stopPropagation(); setSheetOpen(true) }}
              className="flex items-center gap-1 mt-1 text-[10px] text-primary hover:underline"
            >
              <Settings2 className="h-3 w-3" /> Configurar
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setSheetOpen(true) }}
            className="flex items-center gap-1 text-primary hover:underline"
          >
            <Settings2 className="h-3.5 w-3.5" /> Configurar mensagens
          </button>
        )}
      </NodeWrapper>

      <WhatsAppConfigSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        nodeData={nodeData}
        onSave={handleSave}
      />
    </>
  )
}

export const WhatsAppNode = memo(WhatsAppNodeInner)
