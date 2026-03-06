"use client"

import { useState, useCallback, useEffect } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { WppPreview } from "@/components/automations/wpp-preview"
import { WppMessageCard } from "@/components/automations/wpp-message-card"
import { WppMessageEditor } from "@/components/automations/wpp-message-editor"
import type {
  WhatsAppTemplateMessage,
  WhatsAppTemplateCategory,
} from "@/lib/types/whatsapp-template"
import {
  TEMPLATE_CATEGORY_LABELS,
} from "@/lib/types/whatsapp-template"
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

// Sample values for preview
const SAMPLE_VALUES: Record<string, string> = {
  lead_nome: "João Silva",
  lead_email: "joao@email.com",
  lead_telefone: "+351 912 345 678",
  lead_telemovel: "+351 963 456 789",
  lead_origem: "Website",
  lead_estado: "Novo",
  lead_temperatura: "Quente",
  consultor_nome: "Maria Santos",
  consultor_email: "maria@infinitygroup.pt",
  consultor_telefone: "+351 210 000 000",
  proprietario_nome: "Carlos Ferreira",
  proprietario_email: "carlos@email.com",
  proprietario_telefone: "+351 934 567 890",
  imovel_ref: "REF-2024-001",
  imovel_titulo: "T3 Parque das Nações",
  imovel_preco: "350.000 €",
  imovel_morada: "Av. Dom João II, Lisboa",
  processo_ref: "PROC-2024-0012",
  data_actual: new Date().toLocaleDateString("pt-PT"),
  hora_actual: new Date().toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  }),
  empresa_nome: "Infinity Group",
}

interface PreviewLead {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  telemovel: string | null
  origem: string | null
  estado: string | null
  temperatura: string | null
}

function leadToVariables(lead: PreviewLead): Record<string, string> {
  return {
    ...SAMPLE_VALUES,
    lead_nome: lead.nome || "",
    lead_email: lead.email || "",
    lead_telefone: lead.telefone || "",
    lead_telemovel: lead.telemovel || "",
    lead_origem: lead.origem || "",
    lead_estado: lead.estado || "",
    lead_temperatura: lead.temperatura || "",
  }
}

interface WppTemplateBuilderProps {
  name: string
  description: string
  category: WhatsAppTemplateCategory
  messages: WhatsAppTemplateMessage[]
  tags: string[]
  onNameChange: (name: string) => void
  onDescriptionChange: (description: string) => void
  onCategoryChange: (category: WhatsAppTemplateCategory) => void
  onMessagesChange: (messages: WhatsAppTemplateMessage[]) => void
  onTagsChange: (tags: string[]) => void
  onSave: () => void
  saving: boolean
}

export function WppTemplateBuilder({
  name,
  description,
  category,
  messages,
  tags,
  onNameChange,
  onDescriptionChange,
  onCategoryChange,
  onMessagesChange,
  onTagsChange,
  onSave,
  saving,
}: WppTemplateBuilderProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingMessage, setEditingMessage] =
    useState<WhatsAppTemplateMessage | null>(null)
  const [tagInput, setTagInput] = useState("")
  const [leads, setLeads] = useState<PreviewLead[]>([])
  const [selectedLeadId, setSelectedLeadId] = useState<string>("sample")
  const [previewVariables, setPreviewVariables] =
    useState<Record<string, string>>(SAMPLE_VALUES)

  // Fetch leads for preview
  useEffect(() => {
    fetch("/api/leads?limit=20")
      .then((res) => res.json())
      .then((json) => setLeads(json.data || []))
      .catch(() => {})
  }, [])

  // Update preview variables when lead selection changes
  useEffect(() => {
    if (selectedLeadId === "sample") {
      setPreviewVariables(SAMPLE_VALUES)
    } else {
      const lead = leads.find((l) => l.id === selectedLeadId)
      if (lead) {
        setPreviewVariables(leadToVariables(lead))
      }
    }
  }, [selectedLeadId, leads])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = messages.findIndex((m) => m.id === active.id)
      const newIndex = messages.findIndex((m) => m.id === over.id)
      onMessagesChange(arrayMove(messages, oldIndex, newIndex))
    },
    [messages, onMessagesChange]
  )

  function handleAddMessage() {
    setEditingMessage(null)
    setEditorOpen(true)
  }

  function handleEditMessage(msg: WhatsAppTemplateMessage) {
    setEditingMessage(msg)
    setEditorOpen(true)
  }

  function handleDeleteMessage(id: string) {
    onMessagesChange(messages.filter((m) => m.id !== id))
  }

  function handleSaveMessage(msg: WhatsAppTemplateMessage) {
    if (editingMessage) {
      onMessagesChange(
        messages.map((m) => (m.id === editingMessage.id ? msg : m))
      )
    } else {
      onMessagesChange([...messages, msg])
    }
  }

  function handleAddTag(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault()
      if (!tags.includes(tagInput.trim())) {
        onTagsChange([...tags, tagInput.trim()])
      }
      setTagInput("")
    }
  }

  function handleRemoveTag(tag: string) {
    onTagsChange(tags.filter((t) => t !== tag))
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-6 h-full">
        {/* Left: Editor */}
        <div className="space-y-6 overflow-y-auto">
          {/* Name + Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Nome do Template
              </Label>
              <Input
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Ex: Boas-vindas Lead"
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Categoria
              </Label>
              <Select
                value={category}
                onValueChange={(v) =>
                  onCategoryChange(v as WhatsAppTemplateCategory)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TEMPLATE_CATEGORY_LABELS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Descrição (opcional)
            </Label>
            <Textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Descreva quando usar este template..."
              className="min-h-[60px] resize-y"
            />
          </div>

          {/* Tags */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Tags</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-xs font-medium"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Escrever e pressionar Enter..."
              className="text-sm"
            />
          </div>

          <Separator />

          {/* Messages list */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium">
                Sequência de Mensagens ({messages.length})
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
                      onEdit={() => handleEditMessage(msg)}
                      onDelete={() => handleDeleteMessage(msg.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <Button
              variant="outline"
              className="w-full mt-3 border-dashed"
              onClick={handleAddMessage}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Mensagem
            </Button>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Pré-visualização
            </Label>
            <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
              <SelectTrigger className="text-xs h-8">
                <SelectValue placeholder="Pré-visualizar com..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sample">Dados de exemplo</SelectItem>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.nome}
                    {lead.email ? ` (${lead.email})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <WppPreview
            messages={messages}
            variables={previewVariables}
            contactName={previewVariables.lead_nome || SAMPLE_VALUES.lead_nome}
          />
        </div>
      </div>

      {/* Message Editor Sheet */}
      <WppMessageEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        message={editingMessage}
        onSave={handleSaveMessage}
      />
    </>
  )
}
