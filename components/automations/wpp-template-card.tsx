"use client"

import {
  MessageCircle,
  ImageIcon,
  Video,
  Mic,
  FileText,
  MoreHorizontal,
  Copy,
  Pencil,
  Trash2,
  BarChart3,
  Contact,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { WhatsAppTemplate } from "@/lib/types/whatsapp-template"
import { TEMPLATE_CATEGORY_LABELS } from "@/lib/types/whatsapp-template"
import type { WhatsAppMessageType } from "@/lib/types/automation-flow"
import { formatDistanceToNow } from "date-fns"
import { pt } from "date-fns/locale"

interface WppTemplateCardProps {
  template: WhatsAppTemplate
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}

const TYPE_ICONS: Record<WhatsAppMessageType, typeof MessageCircle> = {
  text: MessageCircle,
  image: ImageIcon,
  video: Video,
  audio: Mic,
  ptt: Mic,
  document: FileText,
  poll: BarChart3,
  contact: Contact,
}

function getUniqueTypes(
  messages: WhatsAppTemplate["messages"]
): WhatsAppMessageType[] {
  const types = new Set<WhatsAppMessageType>()
  messages.forEach((m) => types.add(m.type))
  return Array.from(types)
}

export function WppTemplateCard({
  template,
  onEdit,
  onDuplicate,
  onDelete,
}: WppTemplateCardProps) {
  const uniqueTypes = getUniqueTypes(template.messages)
  const categoryLabel =
    TEMPLATE_CATEGORY_LABELS[template.category] || template.category

  return (
    <Card className="group hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">{template.name}</h3>
            <Badge
              variant="secondary"
              className="mt-1 text-[10px] px-1.5 py-0"
            >
              {categoryLabel}
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="h-3.5 w-3.5 mr-2" />
                Duplicar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Message count */}
        <p className="text-xs text-muted-foreground mb-2">
          {template.messages.length}{" "}
          {template.messages.length === 1 ? "mensagem" : "mensagens"}
        </p>

        {/* Type icons */}
        <div className="flex items-center gap-1.5 mb-3">
          {uniqueTypes.map((type) => {
            const Icon = TYPE_ICONS[type]
            return (
              <div
                key={type}
                className="w-6 h-6 rounded bg-muted flex items-center justify-center"
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <p className="text-[10px] text-muted-foreground">
          {template.updated_at
            ? `Editado ${formatDistanceToNow(new Date(template.updated_at), { addSuffix: true, locale: pt })}`
            : `Criado ${formatDistanceToNow(new Date(template.created_at), { addSuffix: true, locale: pt })}`}
        </p>

        {/* Edit button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-3 text-xs"
          onClick={onEdit}
        >
          <Pencil className="h-3 w-3 mr-1.5" />
          Editar
        </Button>
      </CardContent>
    </Card>
  )
}
