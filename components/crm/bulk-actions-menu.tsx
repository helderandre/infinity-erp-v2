'use client'

/**
 * BulkActionsMenu — small dropdown rendered inside the kanban floating
 * selection bar. Entry point for every multi-select action (currently
 * "Enviar imóveis"; the others are placeholders until they're built).
 */

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  ChevronDown, Building2, MessageSquare, Mail,
  Sparkles, Move, UserCheck, AlertCircle, Thermometer,
  CalendarPlus, Workflow, Download,
} from 'lucide-react'

export type BulkAction =
  | 'send_properties'
  | 'whatsapp_message'
  | 'email_message'
  | 'send_matches'
  | 'move_stage'
  | 'reassign_consultant'
  | 'mark_lost'
  | 'change_temperature'
  | 'add_task'
  | 'add_to_automation'
  | 'export_csv'

interface BulkActionsMenuProps {
  count: number
  onAction: (action: BulkAction) => void
}

export function BulkActionsMenu({ count, onAction }: BulkActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2.5 rounded-full text-background hover:bg-background/15 hover:text-background gap-1.5"
        >
          Acções
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        side="top"
        sideOffset={8}
        className="w-64"
      >
        <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal">
          Acções para {count} {count === 1 ? 'negócio' : 'negócios'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Currently wired */}
        <DropdownMenuItem onClick={() => onAction('send_properties')}>
          <Building2 className="h-4 w-4" />
          Enviar imóveis escolhidos
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => onAction('whatsapp_message')}>
          <MessageSquare className="h-4 w-4" />
          Mensagem WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction('email_message')}>
          <Mail className="h-4 w-4" />
          Email
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction('send_matches')}>
          <Sparkles className="h-4 w-4" />
          Matches rígidos
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] text-muted-foreground font-normal uppercase tracking-wider">
          Pipeline
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onAction('move_stage')}>
          <Move className="h-4 w-4" />
          Mover de fase
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction('reassign_consultant')}>
          <UserCheck className="h-4 w-4" />
          Reatribuir consultor
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction('mark_lost')}>
          <AlertCircle className="h-4 w-4" />
          Marcar como perdido
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction('change_temperature')}>
          <Thermometer className="h-4 w-4" />
          Mudar temperatura
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] text-muted-foreground font-normal uppercase tracking-wider">
          Outros
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onAction('add_task')}>
          <CalendarPlus className="h-4 w-4" />
          Criar tarefa
        </DropdownMenuItem>
        <DropdownMenuItem disabled onClick={() => onAction('add_to_automation')}>
          <Workflow className="h-4 w-4" />
          Adicionar a automação
          <ComingSoon />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction('export_csv')}>
          <Download className="h-4 w-4" />
          Exportar selecção
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ComingSoon() {
  return (
    <span className="ml-auto text-[10px] text-muted-foreground/70 italic">
      em breve
    </span>
  )
}
