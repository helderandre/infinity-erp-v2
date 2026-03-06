"use client"

import { formatDistanceToNow } from "date-fns"
import { pt } from "date-fns/locale"
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  ToggleLeft,
  ToggleRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { AutoFlow } from "@/hooks/use-flows"
import type { FlowDefinition } from "@/lib/types/automation-flow"

interface FlowCardProps {
  flow: AutoFlow
  onEdit: (flow: AutoFlow) => void
  onDelete: (flow: AutoFlow) => void
  onToggleActive: (flow: AutoFlow) => void
  onDuplicate: (flow: AutoFlow) => void
}

function PublicationBadge({ flow }: { flow: AutoFlow }) {
  if (!flow.published_at) {
    return (
      <Badge variant="outline" className="text-[10px] shrink-0 text-muted-foreground">
        Rascunho
      </Badge>
    )
  }
  if (flow.has_unpublished_changes) {
    return (
      <Badge variant="outline" className="text-[10px] shrink-0 text-yellow-600 border-yellow-300 bg-yellow-50">
        Alteracoes
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-[10px] shrink-0 text-emerald-600 border-emerald-300 bg-emerald-50">
      Publicado
    </Badge>
  )
}

export function FlowCard({
  flow,
  onEdit,
  onDelete,
  onToggleActive,
  onDuplicate,
}: FlowCardProps) {
  const definition = flow.draft_definition as FlowDefinition | null
  const nodeCount = definition?.nodes?.length || 0
  const edgeCount = definition?.edges?.length || 0
  const canToggle = !!flow.published_at

  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card p-4 transition-all hover:shadow-md cursor-pointer",
        flow.is_active
          ? "border-border"
          : "border-border/50 opacity-75"
      )}
      onClick={() => onEdit(flow)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold truncate">{flow.name}</h3>
            <Badge
              variant={flow.is_active ? "default" : "secondary"}
              className="text-[10px] shrink-0"
            >
              {flow.is_active ? "Activo" : "Inactivo"}
            </Badge>
            <PublicationBadge flow={flow} />
          </div>
          {flow.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {flow.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>{nodeCount} node{nodeCount !== 1 ? "s" : ""}</span>
            <span>{edgeCount} conex{edgeCount !== 1 ? "oes" : "ao"}</span>
            {flow.published_at && (
              <span>
                Publicado{" "}
                {formatDistanceToNow(new Date(flow.published_at), {
                  addSuffix: true,
                  locale: pt,
                })}
              </span>
            )}
            <span>
              {formatDistanceToNow(new Date(flow.updated_at), {
                addSuffix: true,
                locale: pt,
              })}
            </span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onEdit(flow)
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onDuplicate(flow)
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Duplicar
            </DropdownMenuItem>
            {canToggle ? (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleActive(flow)
                }}
              >
                {flow.is_active ? (
                  <>
                    <ToggleLeft className="mr-2 h-4 w-4" />
                    Desactivar
                  </>
                ) : (
                  <>
                    <ToggleRight className="mr-2 h-4 w-4" />
                    Activar
                  </>
                )}
              </DropdownMenuItem>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuItem disabled>
                    <ToggleRight className="mr-2 h-4 w-4" />
                    Activar
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent>Publica o fluxo primeiro</TooltipContent>
              </Tooltip>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onDelete(flow)
              }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
