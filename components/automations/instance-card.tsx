"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { pt } from "date-fns/locale"
import {
  MoreHorizontal,
  Plug,
  Unplug,
  Trash2,
  UserPlus,
  RefreshCw,
  Phone,
  Workflow,
  Clock,
  User,
  Briefcase,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import type { WhatsAppInstance } from "@/lib/types/whatsapp-template"
import {
  CONNECTION_STATUS_LABELS,
  CONNECTION_STATUS_COLORS,
  type WhatsAppConnectionStatus,
} from "@/lib/types/whatsapp-template"

interface InstanceCardProps {
  instance: WhatsAppInstance
  onConnect: (id: string) => void
  onDisconnect: (id: string) => void
  onDelete: (id: string) => void
  onAssignUser: (id: string) => void
  onCheckStatus: (id: string) => void
}

function formatPhone(phone: string): string {
  // +351912345678 → +351 912 345 678
  const clean = phone.replace(/\s/g, "")
  if (clean.startsWith("+351") && clean.length === 13) {
    return `${clean.slice(0, 4)} ${clean.slice(4, 7)} ${clean.slice(7, 10)} ${clean.slice(10)}`
  }
  // Genérico: adicionar espaços a cada 3 dígitos após o código de país
  if (clean.startsWith("+") && clean.length > 6) {
    const code = clean.slice(0, clean.length > 12 ? 3 : 4)
    const rest = clean.slice(code.length)
    return `${code} ${rest.replace(/(\d{3})(?=\d)/g, "$1 ")}`
  }
  return phone
}

export function InstanceCard({
  instance,
  onConnect,
  onDisconnect,
  onDelete,
  onAssignUser,
  onCheckStatus,
}: InstanceCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const status = instance.connection_status as WhatsAppConnectionStatus
  const colors = CONNECTION_STATUS_COLORS[status] ?? CONNECTION_STATUS_COLORS.disconnected
  const label = CONNECTION_STATUS_LABELS[status] ?? "Desconhecido"
  const isConnected = status === "connected"
  const initials = instance.profile_name
    ? instance.profile_name.slice(0, 2).toUpperCase()
    : instance.name.slice(0, 2).toUpperCase()

  const createdAgo = instance.created_at
    ? formatDistanceToNow(new Date(instance.created_at), { addSuffix: true, locale: pt })
    : null

  return (
    <Card className="py-0 transition-all hover:shadow-md">
      <CardContent className="p-5">
        {/* Header: Avatar + Nome + Menu */}
        <div className="flex items-start gap-3">
          <Avatar className="h-11 w-11 shrink-0">
            {instance.profile_pic_url && (
              <AvatarImage src={instance.profile_pic_url} alt={instance.name} />
            )}
            <AvatarFallback className="bg-emerald-100 text-emerald-700 text-sm font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm truncate">{instance.name}</h3>
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => { setMenuOpen(false); onCheckStatus(instance.id) }}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Verificar estado
                  </DropdownMenuItem>
                  {isConnected ? (
                    <DropdownMenuItem
                      onClick={() => { setMenuOpen(false); onDisconnect(instance.id) }}
                    >
                      <Unplug className="mr-2 h-4 w-4" />
                      Desconectar
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => { setMenuOpen(false); onConnect(instance.id) }}
                    >
                      <Plug className="mr-2 h-4 w-4" />
                      Conectar
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => { setMenuOpen(false); onAssignUser(instance.id) }}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Atribuir utilizador
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => { setMenuOpen(false); onDelete(instance.id) }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {instance.profile_name && (
              <p className="text-xs text-muted-foreground truncate">{instance.profile_name}</p>
            )}

            {/* Badges */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className={`${colors.bg} ${colors.text} border-transparent text-xs`}
              >
                <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${colors.dot}`} />
                {label}
              </Badge>
              {instance.is_business && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Briefcase className="h-2.5 w-2.5" />
                  Business
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Separator className="my-3" />

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {/* Telefone */}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Phone className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {instance.phone ? formatPhone(instance.phone) : "Sem número"}
            </span>
          </div>

          {/* Fluxos */}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Workflow className="h-3 w-3 shrink-0" />
            <span>{instance.flow_count ?? 0} fluxo{(instance.flow_count ?? 0) !== 1 ? "s" : ""}</span>
          </div>

          {/* Utilizador atribuído */}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {instance.user?.commercial_name ?? "Não atribuído"}
            </span>
          </div>

          {/* Criado há */}
          {createdAgo && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" />
              <span className="truncate">Criado {createdAgo}</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="mt-4">
          {isConnected ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onCheckStatus(instance.id)}
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Detalhes
            </Button>
          ) : (
            <Button
              size="sm"
              className="w-full"
              onClick={() => onConnect(instance.id)}
              disabled={status === "not_found"}
            >
              <Plug className="mr-2 h-3.5 w-3.5" />
              Conectar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
