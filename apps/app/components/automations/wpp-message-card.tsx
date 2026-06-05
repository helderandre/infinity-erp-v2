"use client"

import {
  MessageCircle,
  ImageIcon,
  Video,
  Mic,
  FileText,
  GripVertical,
  Pencil,
  Trash2,
  Timer,
  BarChart3,
  Contact,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { WhatsAppTemplateMessage } from "@/lib/types/whatsapp-template"
import type { WhatsAppMessageType } from "@/lib/types/automation-flow"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface WppMessageCardProps {
  message: WhatsAppTemplateMessage
  index: number
  onEdit: () => void
  onDelete: () => void
}

const TYPE_CONFIG: Record<
  WhatsAppMessageType,
  { icon: typeof MessageCircle; label: string; color: string }
> = {
  text: { icon: MessageCircle, label: "Texto", color: "text-emerald-600" },
  image: { icon: ImageIcon, label: "Imagem", color: "text-blue-600" },
  video: { icon: Video, label: "Vídeo", color: "text-purple-600" },
  audio: { icon: Mic, label: "Áudio", color: "text-amber-600" },
  ptt: { icon: Mic, label: "Mensagem de voz", color: "text-orange-600" },
  document: { icon: FileText, label: "Documento", color: "text-red-600" },
  poll: { icon: BarChart3, label: "Sondagem", color: "text-teal-600" },
  contact: { icon: Contact, label: "Contacto", color: "text-cyan-600" },
}

function getPreviewText(message: WhatsAppTemplateMessage): string {
  if (message.type === "text" && message.content) {
    const clean = message.content.replace(/\{\{(\w+)\}\}/g, "[$1]")
    return clean.length > 60 ? clean.substring(0, 60) + "..." : clean
  }
  if (message.type === "document" && message.docName) {
    return message.docName
  }
  if (message.mediaUrl) {
    const parts = message.mediaUrl.split("/")
    return parts[parts.length - 1] || "Ficheiro"
  }
  if (message.content) {
    return message.content.length > 40
      ? message.content.substring(0, 40) + "..."
      : message.content
  }
  return "Sem conteúdo"
}

export function WppMessageCard({
  message,
  index,
  onEdit,
  onDelete,
}: WppMessageCardProps) {
  const config = TYPE_CONFIG[message.type] || TYPE_CONFIG.text
  const Icon = config.icon

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: message.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`p-3 ${isDragging ? "shadow-lg ring-2 ring-primary/20" : ""}`}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Icon + content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs font-medium text-muted-foreground">
              {index + 1}.
            </span>
            <Icon className={`h-3.5 w-3.5 ${config.color}`} />
            <span className="text-xs font-medium">{config.label}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {getPreviewText(message)}
          </p>
          {message.delay && message.delay > 0 && (
            <div className="flex items-center gap-1 mt-1.5">
              <Timer className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                {message.delay}s delay
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
