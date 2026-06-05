'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ClipboardList,
  Activity,
  MessageSquare,
  FileText,
  PanelLeftClose,
  Columns2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type SheetTab = 'task' | 'activity' | 'comments' | 'documents'

const SIDEBAR_ITEMS: { id: SheetTab; icon: typeof ClipboardList; label: string; shortcut: string }[] = [
  { id: 'task',      icon: ClipboardList, label: 'Tarefa',      shortcut: '1' },
  { id: 'activity',  icon: Activity,      label: 'Actividade',  shortcut: '2' },
  { id: 'comments',  icon: MessageSquare, label: 'Comentários', shortcut: '3' },
  { id: 'documents', icon: FileText,      label: 'Documentos',  shortcut: '4' },
]

interface TaskSheetSidebarProps {
  activeTab: SheetTab
  onTabChange: (tab: SheetTab) => void
  commentsCount?: number
  activitiesCount?: number
  splitMode?: boolean
  splitTab?: SheetTab | null
  onSplitToggle?: () => void
}

export function TaskSheetSidebar({
  activeTab,
  onTabChange,
  commentsCount,
  activitiesCount,
  splitMode,
  splitTab,
  onSplitToggle,
}: TaskSheetSidebarProps) {
  return (
    <div className="w-14 shrink-0 border-r flex flex-col items-center py-3 gap-1">
      {SIDEBAR_ITEMS.map((item) => {
        const isActive = activeTab === item.id
        const isSplitActive = splitMode && splitTab === item.id
        const Icon = item.icon
        const count = item.id === 'comments' ? commentsCount : item.id === 'activity' ? activitiesCount : undefined

        return (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-10 w-10 relative',
                  isActive && 'bg-accent text-accent-foreground',
                  isSplitActive && !isActive && 'bg-accent/50 text-accent-foreground'
                )}
                onClick={() => onTabChange(item.id)}
              >
                <Icon className="h-4.5 w-4.5" />
                {/* Indicador activo — primário */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-foreground rounded-r" />
                )}
                {/* Indicador activo — secundário (split) */}
                {isSplitActive && !isActive && (
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-foreground/50 rounded-l" />
                )}
                {/* Badge de contagem */}
                {count !== undefined && count > 0 && (
                  <Badge
                    variant="secondary"
                    className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[9px] font-bold"
                  >
                    {count > 99 ? '99+' : count}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {item.label} <kbd className="ml-1 text-[10px] text-muted-foreground">{item.shortcut}</kbd>
            </TooltipContent>
          </Tooltip>
        )
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Split view toggle */}
      {onSplitToggle && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-10 w-10 relative',
                splitMode && 'bg-accent text-accent-foreground'
              )}
              onClick={onSplitToggle}
            >
              {splitMode ? (
                <PanelLeftClose className="h-4.5 w-4.5" />
              ) : (
                <Columns2 className="h-4.5 w-4.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {splitMode ? 'Fechar split' : 'Vista dividida'} <kbd className="ml-1 text-[10px] text-muted-foreground">S</kbd>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
