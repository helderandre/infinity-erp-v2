"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Eye, Plus, Save } from "lucide-react"
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/kibo-ui/spinner"
import { WppPreview } from "@/components/automations/wpp-preview"
import { WppMessageCard } from "@/components/automations/wpp-message-card"
import { WppMessageEditor } from "@/components/automations/wpp-message-editor"
import type {
  WhatsAppTemplateMessage,
  WhatsAppTemplateCategory,
} from "@/lib/types/whatsapp-template"
import { TEMPLATE_CATEGORY_LABELS } from "@/lib/types/whatsapp-template"
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
  isEditing?: boolean
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
  isEditing,
}: WppTemplateBuilderProps) {
  const router = useRouter()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingMessage, setEditingMessage] =
    useState<WhatsAppTemplateMessage | null>(null)
  const [tagInput, setTagInput] = useState("")
  const [leads, setLeads] = useState<PreviewLead[]>([])
  const [selectedLeadId, setSelectedLeadId] = useState<string>("sample")
  const [previewVariables, setPreviewVariables] =
    useState<Record<string, string>>(SAMPLE_VALUES)
  const [showMobilePreview, setShowMobilePreview] = useState(false)

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

  const previewContent = (
    <>
      <div className="space-y-3 mb-4 shrink-0">
        <h3 className="text-sm font-medium">Pré-visualização</h3>
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
      <div className="flex-1 min-h-0 flex justify-center">
        <WppPreview
          messages={messages}
          variables={previewVariables}
          contactName={previewVariables.lead_nome || SAMPLE_VALUES.lead_nome}
        />
      </div>
    </>
  )

  return (
    <>
      <div className="flex flex-1 min-h-0 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                router.push("/dashboard/automacao/templates-wpp")
              }
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">
                {isEditing ? "Editar Template" : "Novo Template"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {isEditing
                  ? "Modificar template de mensagens WhatsApp"
                  : "Criar novo template de mensagens WhatsApp"}
              </p>
            </div>
          </div>
          <Button onClick={onSave} disabled={saving}>
            {saving ? (
              <Spinner variant="infinite" size={16} className="mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Guardar
          </Button>
        </div>

        {/* Split: Editor + Preview */}
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_400px]">
          {/* LEFT: Editor (scrollable) */}
          <div className="min-h-0 overflow-y-auto border-r p-6 space-y-6">
            {/* Row 1: Nome + Categoria + Descrição */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_1fr] gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Nome do Template</Label>
                <Input
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="Ex: Boas-vindas Lead"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Categoria</Label>
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
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Descrição (opcional)
                </Label>
                <Input
                  value={description}
                  onChange={(e) => onDescriptionChange(e.target.value)}
                  placeholder="Descreva quando usar este template..."
                />
              </div>
            </div>

            {/* Row 2: Tags */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Tags</Label>
              <div className="flex flex-wrap items-center gap-1.5 rounded-md border px-3 py-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-xs font-medium shrink-0"
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
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder={tags.length === 0 ? "Escrever e pressionar Enter..." : "Adicionar..."}
                  className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
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

          {/* RIGHT: Preview (fills height) */}
          <div className="hidden lg:flex min-h-0 flex-col p-6 bg-muted/30">
            {previewContent}
          </div>
        </div>
      </div>

      {/* Mobile preview FAB (visible on < lg) */}
      <div className="lg:hidden fixed bottom-4 right-4 z-50">
        <Button
          size="sm"
          onClick={() => setShowMobilePreview(true)}
          className="rounded-full shadow-lg"
        >
          <Eye className="h-4 w-4 mr-1.5" />
          Preview
        </Button>
      </div>

      {/* Mobile preview Sheet */}
      <Sheet open={showMobilePreview} onOpenChange={setShowMobilePreview}>
        <SheetContent side="bottom" className="h-[80vh]">
          <SheetHeader>
            <SheetTitle>Pré-visualização</SheetTitle>
          </SheetHeader>
          <div className="flex justify-center overflow-y-auto py-4">
            <WppPreview
              messages={messages}
              variables={previewVariables}
              contactName={
                previewVariables.lead_nome || SAMPLE_VALUES.lead_nome
              }
            />
          </div>
        </SheetContent>
      </Sheet>

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
