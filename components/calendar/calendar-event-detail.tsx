'use client'

import type { CalendarEvent } from '@/types/calendar'
import {
  CALENDAR_CATEGORY_LABELS,
  CALENDAR_CATEGORY_COLORS,
} from '@/types/calendar'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Clock,
  User,
  Building2,
  Zap,
  Trash2,
  Pencil,
  ExternalLink,
  CalendarDays,
  AlertTriangle,
  Info,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Layers,
  Flag,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface CalendarEventDetailProps {
  event: CalendarEvent | null
  open: boolean
  onClose: () => void
  onEdit?: (event: CalendarEvent) => void
  onDelete?: (id: string) => void
}

// Dark-mode-safe colors (same as event-card)
const DETAIL_COLORS: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  contract_expiry:   { bg: 'bg-amber-500/10',   text: 'text-amber-700 dark:text-amber-300',     dot: 'bg-amber-500',   border: 'border-amber-500/20' },
  lead_expiry:       { bg: 'bg-red-500/10',     text: 'text-red-700 dark:text-red-300',         dot: 'bg-red-400',     border: 'border-red-500/20' },
  lead_followup:     { bg: 'bg-yellow-500/10',  text: 'text-yellow-700 dark:text-yellow-300',   dot: 'bg-yellow-500',  border: 'border-yellow-500/20' },
  process_task:      { bg: 'bg-violet-500/10',  text: 'text-violet-700 dark:text-violet-300',   dot: 'bg-violet-500',  border: 'border-violet-500/20' },
  process_subtask:   { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-700 dark:text-fuchsia-300', dot: 'bg-fuchsia-500', border: 'border-fuchsia-500/20' },
  birthday:          { bg: 'bg-pink-500/10',    text: 'text-pink-700 dark:text-pink-300',       dot: 'bg-pink-500',    border: 'border-pink-500/20' },
  vacation:          { bg: 'bg-slate-500/10',   text: 'text-slate-700 dark:text-slate-300',     dot: 'bg-slate-400',   border: 'border-slate-500/20' },
  company_event:     { bg: 'bg-purple-500/10',  text: 'text-purple-700 dark:text-purple-300',   dot: 'bg-purple-500',  border: 'border-purple-500/20' },
  marketing_event:   { bg: 'bg-orange-500/10',  text: 'text-orange-700 dark:text-orange-300',   dot: 'bg-orange-500',  border: 'border-orange-500/20' },
  meeting:           { bg: 'bg-indigo-500/10',  text: 'text-indigo-700 dark:text-indigo-300',   dot: 'bg-indigo-500',  border: 'border-indigo-500/20' },
  reminder:          { bg: 'bg-cyan-500/10',    text: 'text-cyan-700 dark:text-cyan-300',       dot: 'bg-cyan-500',    border: 'border-cyan-500/20' },
  custom:            { bg: 'bg-gray-500/10',    text: 'text-gray-700 dark:text-gray-300',       dot: 'bg-gray-500',    border: 'border-gray-500/20' },
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Pendente',      color: 'text-slate-500' },
  in_progress: { label: 'Em Progresso',  color: 'text-blue-500' },
  completed:   { label: 'Concluída',     color: 'text-emerald-500' },
  skipped:     { label: 'Dispensada',    color: 'text-orange-500' },
  approved:    { label: 'Aprovado',      color: 'text-emerald-500' },
}

export function CalendarEventDetail({
  event,
  open,
  onClose,
  onEdit,
  onDelete,
}: CalendarEventDetailProps) {
  if (!event) return null

  const colors = DETAIL_COLORS[event.category] ?? DETAIL_COLORS.custom
  const categoryLabel = CALENDAR_CATEGORY_LABELS[event.category]
  const isManual = event.source === 'manual'
  const isProcessEvent = event.category === 'process_task' || event.category === 'process_subtask'

  const formatEventDate = (dateStr: string, allDay: boolean) => {
    const date = parseISO(dateStr)
    if (allDay) {
      return format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
    }
    return format(date, "EEEE, d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
  }

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  const relatedLinks: { label: string; href: string; icon: React.ReactNode; sublabel?: string }[] = []

  if (event.property_id) {
    relatedLinks.push({
      label: event.property_title ?? 'Imóvel',
      href: `/dashboard/imoveis/${event.property_id}`,
      icon: <Building2 className="h-4 w-4" />,
    })
  }
  if (event.lead_id) {
    relatedLinks.push({
      label: event.lead_name ?? 'Lead',
      href: `/dashboard/leads/${event.lead_id}`,
      icon: <Zap className="h-4 w-4" />,
    })
  }

  const statusInfo = event.status ? STATUS_LABELS[event.status] : null

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[440px] p-0 flex flex-col">
        {/* Header — colored banner */}
        <div className={cn('px-6 pt-6 pb-5', colors.bg)}>
          <SheetHeader className="p-0">
            <div className="flex items-start gap-3">
              <span className={cn('mt-1 h-3.5 w-3.5 rounded-full shrink-0 ring-2 ring-background', colors.dot)} />
              <div className="flex-1 min-w-0 pr-8">
                <SheetTitle className="text-left text-lg font-semibold leading-snug">
                  {event.title}
                </SheetTitle>
                <SheetDescription className="text-left mt-1.5 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn('text-[11px] font-medium', colors.text, colors.border)}
                  >
                    {categoryLabel}
                  </Badge>
                  {event.is_recurring && (
                    <Badge variant="secondary" className="text-[11px]">
                      Recorrente
                    </Badge>
                  )}
                  {isProcessEvent && event.priority && (
                    <Badge
                      variant={event.priority === 'urgent' ? 'destructive' : 'secondary'}
                      className="text-[11px]"
                    >
                      {event.priority === 'urgent' ? 'Urgente' : event.priority === 'low' ? 'Baixa' : 'Normal'}
                    </Badge>
                  )}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
        </div>

        {/* Body */}
        <ScrollArea className="flex-1">
          <div className="px-6 py-5 space-y-5">
            {/* Overdue warning */}
            {event.is_overdue && (
              <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">Em atraso</p>
                  <p className="text-xs text-muted-foreground">Este evento já ultrapassou a data prevista</p>
                </div>
              </div>
            )}

            {/* Date & Time */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <CalendarDays className="h-3.5 w-3.5" />
                Data
              </div>
              <div className="pl-5.5 ml-[1px]">
                <p className="text-sm font-medium">
                  {capitalize(formatEventDate(event.start_date, event.all_day))}
                </p>
                {event.end_date && (
                  <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                    <ArrowRight className="h-3 w-3" />
                    {capitalize(formatEventDate(event.end_date, event.all_day))}
                  </div>
                )}
                {event.all_day && (
                  <Badge variant="secondary" className="mt-2 text-[11px]">
                    <Clock className="h-3 w-3 mr-1" />
                    Todo o dia
                  </Badge>
                )}
              </div>
            </div>

            <Separator />

            {/* Details grid */}
            <div className="grid gap-4">
              {/* Status */}
              {statusInfo && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Estado
                  </div>
                  <Badge
                    variant="outline"
                    className={cn('text-xs font-medium', statusInfo.color)}
                  >
                    {statusInfo.label}
                  </Badge>
                </div>
              )}

              {/* Assigned user */}
              {event.user_name && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <User className="h-3.5 w-3.5" />
                    Responsável
                  </div>
                  <span className="text-sm font-medium">{event.user_name}</span>
                </div>
              )}

            </div>

            {/* Process info */}
            {isProcessEvent && event.process_id && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <ClipboardList className="h-3.5 w-3.5" />
                    Processo
                  </div>
                  <Link
                    href={`/dashboard/processos/${event.process_id}`}
                    className="flex items-center gap-3 rounded-lg border px-4 py-3 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:bg-violet-500/20">
                      <ClipboardList className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.process_ref}</p>
                      {event.stage_name && (
                        <p className="text-xs text-muted-foreground truncate">
                          Fase: {event.stage_name}
                        </p>
                      )}
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </Link>
                </div>
              </>
            )}

            {/* Related entities */}
            {relatedLinks.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <Info className="h-3.5 w-3.5" />
                    Ligações
                  </div>
                  <div className="space-y-1.5">
                    {relatedLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="flex items-center gap-3 rounded-lg border px-4 py-3 hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted/60 text-muted-foreground group-hover:bg-muted">
                          {link.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{link.label}</p>
                          {link.sublabel && (
                            <p className="text-xs text-muted-foreground truncate">{link.sublabel}</p>
                          )}
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Description */}
            {event.description && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <Info className="h-3.5 w-3.5" />
                    Descrição
                  </div>
                  <div className="rounded-lg bg-muted/30 px-4 py-3">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {event.description}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer actions */}
        <SheetFooter className="border-t px-6 py-4 flex-row gap-2">
          {isManual && onEdit && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onEdit(event)}
            >
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Editar
            </Button>
          )}
          {isManual && onDelete && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              onClick={() => onDelete(event.id)}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Eliminar
            </Button>
          )}
          {isProcessEvent && event.process_id && (
            <Button variant="default" size="sm" className="flex-1" asChild>
              <Link href={`/dashboard/processos/${event.process_id}`}>
                <ClipboardList className="mr-2 h-3.5 w-3.5" />
                Abrir Processo
              </Link>
            </Button>
          )}
          {!isManual && !isProcessEvent && relatedLinks.length > 0 && (
            <Button variant="default" size="sm" className="flex-1" asChild>
              <Link href={relatedLinks[0].href}>
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                Abrir {event.property_id ? 'Imóvel' : 'Lead'}
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
