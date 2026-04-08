'use client'

import { useEffect, useState } from 'react'
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
  Users,
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
  MessageCircle,
  MapPin,
  Image as ImageIcon,
  ThumbsUp,
  ThumbsDown,
  ListChecks,
  RefreshCw,
  Video,
  Link2,
} from 'lucide-react'
import { format, parseISO, addHours } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useIsMobile } from '@/hooks/use-mobile'
import { useUser } from '@/hooks/use-user'
import { VisitActionsSection } from './visit-actions-section'

interface RsvpEntry {
  id: string
  user_id: string
  status: 'going' | 'not_going' | 'pending'
  reason?: string | null
  responded_at?: string
  user?: { id: string; commercial_name: string }
}

const MANAGER_ROLES = ['Broker/CEO', 'admin', 'Office Manager', 'Gestora Processual']

interface CalendarEventDetailProps {
  event: CalendarEvent | null
  open: boolean
  onClose: () => void
  onEdit?: (event: CalendarEvent) => void
  onDelete?: (id: string) => void
  onRsvp?: (eventId: string, status: 'going' | 'not_going', reason?: string) => void
  /**
   * Callback opcional disparado quando uma acção interna ao detalhe muda o
   * estado da fonte (ex: confirmar/rejeitar proposta de visita, marcar
   * outcome). Permite à página externa fazer refetch dos eventos.
   */
  onRefresh?: () => void
}

// Dark-mode-safe colors (same as event-card)
const DETAIL_COLORS: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  contract_expiry:   { bg: 'bg-amber-500/10',    text: 'text-amber-700 dark:text-amber-300',     dot: 'bg-amber-500',   border: 'border-amber-500/20' },
  lead_expiry:       { bg: 'bg-red-500/10',      text: 'text-red-700 dark:text-red-300',         dot: 'bg-red-500',     border: 'border-red-500/20' },
  lead_followup:     { bg: 'bg-yellow-500/10',   text: 'text-yellow-700 dark:text-yellow-300',   dot: 'bg-yellow-500',  border: 'border-yellow-500/20' },
  process_task:      { bg: 'bg-violet-500/10',   text: 'text-violet-700 dark:text-violet-300',   dot: 'bg-violet-500',  border: 'border-violet-500/20' },
  process_subtask:   { bg: 'bg-teal-500/10',     text: 'text-teal-700 dark:text-teal-300',       dot: 'bg-teal-500',    border: 'border-teal-500/20' },
  process_event:     { bg: 'bg-cyan-500/10',     text: 'text-cyan-700 dark:text-cyan-300',       dot: 'bg-cyan-500',    border: 'border-cyan-500/20' },
  birthday:          { bg: 'bg-pink-500/10',     text: 'text-pink-700 dark:text-pink-300',       dot: 'bg-pink-500',    border: 'border-pink-500/20' },
  vacation:          { bg: 'bg-slate-500/10',    text: 'text-slate-700 dark:text-slate-300',     dot: 'bg-slate-400',   border: 'border-slate-500/20' },
  company_event:     { bg: 'bg-emerald-500/10',  text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', border: 'border-emerald-500/20' },
  marketing_event:   { bg: 'bg-orange-500/10',   text: 'text-orange-700 dark:text-orange-300',   dot: 'bg-orange-500',  border: 'border-orange-500/20' },
  meeting:           { bg: 'bg-indigo-500/10',   text: 'text-indigo-700 dark:text-indigo-300',   dot: 'bg-indigo-500',  border: 'border-indigo-500/20' },
  visit:             { bg: 'bg-rose-500/10',     text: 'text-rose-700 dark:text-rose-300',       dot: 'bg-rose-500',    border: 'border-rose-500/20' },
  reminder:          { bg: 'bg-sky-500/10',      text: 'text-sky-700 dark:text-sky-300',         dot: 'bg-sky-500',     border: 'border-sky-500/20' },
  custom:            { bg: 'bg-stone-500/10',    text: 'text-stone-700 dark:text-stone-300',     dot: 'bg-stone-500',   border: 'border-stone-500/20' },
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
  onRsvp,
  onRefresh,
}: CalendarEventDetailProps) {
  const isMobile = useIsMobile()
  const { user: currentUser } = useUser()
  const [rsvpList, setRsvpList] = useState<RsvpEntry[]>([])
  const [rsvpLoading, setRsvpLoading] = useState(false)
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false)
  const [reasonText, setReasonText] = useState('')
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmType, setConfirmType] = useState<'going' | 'not_going' | null>(null)

  const isManager = currentUser?.role?.name
    ? MANAGER_ROLES.some((r) => r.toLowerCase() === currentUser.role!.name!.toLowerCase())
    : false

  // Fetch RSVP list when event detail opens and event requires RSVP
  useEffect(() => {
    if (!open || !event || !event.requires_rsvp) {
      setRsvpList([])
      return
    }
    let cancelled = false
    const fetchRsvps = async () => {
      setRsvpLoading(true)
      try {
        const realId = event.id.replace('manual:', '')
        const res = await fetch(`/api/calendar/events/${realId}/rsvp`)
        if (res.ok) {
          const json = await res.json()
          if (!cancelled) setRsvpList(json.data ?? [])
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setRsvpLoading(false)
      }
    }
    fetchRsvps()
    return () => { cancelled = true }
  }, [open, event?.id, event?.requires_rsvp, event?.rsvp_status])

  if (!event) return null

  const colors = DETAIL_COLORS[event.category] ?? DETAIL_COLORS.custom
  const categoryLabel = CALENDAR_CATEGORY_LABELS[event.category]
  const isManual = event.source === 'manual'
  const isProcessEvent = event.category === 'process_task' || event.category === 'process_subtask' || event.category === 'process_event'
  const isScheduledEvent = event.category === 'process_event'
  const TASK_CATS = ['process_task', 'process_subtask', 'reminder', 'lead_followup', 'contract_expiry', 'lead_expiry']
  const isTask = TASK_CATS.includes(event.category)
  const impliedEndTime = !event.end_date && !event.all_day && !isTask
    ? format(addHours(parseISO(event.start_date), 1), 'HH:mm')
    : null

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
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden',
          isMobile ? 'h-[85dvh] rounded-t-2xl' : 'w-full sm:max-w-[440px]',
        )}
      >
        {/* Header — colored banner */}
        <div className={cn('shrink-0', colors.bg)}>
          <div className="px-5 pt-5 sm:px-6 sm:pt-6">
            <SheetHeader className="p-0">
              <div className="flex items-start gap-3">
                <span className={cn('mt-1 h-3.5 w-3.5 rounded-full shrink-0 ring-2 ring-background', colors.dot)} />
                <div className="flex-1 min-w-0 pr-8">
                  <SheetTitle className="text-left text-base sm:text-lg font-semibold leading-snug truncate">
                    {event.title}
                  </SheetTitle>
                </div>
              </div>
            </SheetHeader>
          </div>

          {/* Cover image — full width, no rounded corners */}
          {event.cover_image_url && (
            <div className="mt-3 overflow-hidden">
              <img
                src={event.cover_image_url}
                alt={event.title}
                className="w-full h-36 sm:h-44 object-cover"
              />
            </div>
          )}

          <div className="px-5 pb-4 sm:px-6 sm:pb-5 mt-3">
            <p className="text-xs sm:text-sm text-muted-foreground">
              {capitalize(formatEventDate(event.start_date, event.all_day))}
              {event.end_date && !event.all_day && (
                <span> — {format(parseISO(event.end_date), 'HH:mm')}</span>
              )}
              {impliedEndTime && (
                <span> — {impliedEndTime}</span>
              )}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge
                variant="outline"
                className={cn('text-[11px] font-medium', colors.text, colors.border)}
              >
                {categoryLabel}
              </Badge>
              {event.all_day && (
                <Badge variant="secondary" className="text-[11px]">
                  Todo o dia
                </Badge>
              )}
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
            </div>
          </div>
        </div>

        {/* Description — right below the header */}
        {event.description && (
          <div className="px-5 py-3 sm:px-6 border-b bg-muted/10 shrink-0 overflow-hidden">
            {event.description.includes('<') ? (
              <div
                className="prose prose-sm max-w-none text-sm break-words [&_p]:my-0.5 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold"
                dangerouslySetInnerHTML={{ __html: event.description }}
              />
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-muted-foreground">
                {event.description}
              </p>
            )}
          </div>
        )}

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-5 py-4 sm:px-6 sm:py-5 space-y-4 sm:space-y-5 overflow-hidden">
            {/* Overdue warning */}
            {event.is_overdue && (
              <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 sm:px-4 sm:py-3">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">Em atraso</p>
                  <p className="text-xs text-muted-foreground truncate">Este evento já ultrapassou a data prevista</p>
                </div>
              </div>
            )}

            {/* Item type badge */}
            {event.item_type === 'task' && (
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline" className="text-xs">Tarefa</Badge>
              </div>
            )}

            {/* Location */}
            {event.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{event.location}</span>
              </div>
            )}

            {/* Livestream + Registration + Links */}
            {(event.livestream_url || event.registration_url || (event.links && event.links.length > 0)) && (
              <div className="space-y-2">
                {event.registration_url && (
                  <a
                    href={event.registration_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2.5 hover:bg-blue-500/10 transition-colors group"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-600">
                      <ClipboardList className="h-4 w-4" />
                    </div>
                    <div className="w-0 flex-1">
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Inscrever-se</p>
                      <p className="text-[11px] text-muted-foreground truncate">{event.registration_url}</p>
                    </div>
                  </a>
                )}
                {event.livestream_url && (
                  <a
                    href={event.livestream_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 hover:bg-red-500/10 transition-colors group"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-600">
                      <Video className="h-4 w-4" />
                    </div>
                    <div className="w-0 flex-1">
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">Ver Livestream</p>
                      <p className="text-[11px] text-muted-foreground truncate">{event.livestream_url}</p>
                    </div>
                  </a>
                )}
                {event.links && event.links.length > 0 && (
                  <div className="space-y-1.5">
                    {event.links.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 rounded-lg border px-3 py-2 hover:bg-muted/30 transition-colors"
                      >
                        <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="w-0 flex-1">
                          <p className="text-sm font-medium truncate">{link.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{link.url}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* RSVP section */}
            {event.requires_rsvp && onRsvp && event.source === 'manual' && (() => {
              // Derive rsvp_status from the fetched list if available
              const myRsvp = rsvpList.find((r) => r.user_id === currentUser?.id)
              const rsvpStatus = myRsvp?.status ?? event.rsvp_status
              const hasResponded = rsvpStatus === 'going' || rsvpStatus === 'not_going'
              const goingList = rsvpList.filter((r) => r.status === 'going')
              const notGoingList = rsvpList.filter((r) => r.status === 'not_going')

              return (
                <>
                  <Separator />
                  <div className="space-y-3">
                    {/* Header — smaller after responding */}
                    <div className={cn(
                      'flex items-center gap-2 font-medium text-muted-foreground uppercase tracking-wider',
                      hasResponded ? 'text-[10px]' : 'text-xs',
                    )}>
                      {hasResponded ? (
                        <>
                          <RefreshCw className="h-3 w-3" />
                          Alteração de Presença
                        </>
                      ) : (
                        <>
                          <ThumbsUp className="h-3.5 w-3.5" />
                          Confirmação de Presença
                        </>
                      )}
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant={rsvpStatus === 'going' ? 'default' : 'outline'}
                        size="sm"
                        className={cn('flex-1', rsvpStatus === 'going' && 'bg-emerald-600 hover:bg-emerald-700')}
                        disabled={rsvpStatus === 'going'}
                        onClick={() => {
                          onRsvp(event.id, 'going')
                          setConfirmType('going')
                          setConfirmDialogOpen(true)
                        }}
                      >
                        <ThumbsUp className="mr-1.5 h-3.5 w-3.5" />
                        {rsvpStatus === 'going' ? 'Confirmado' : 'Vou'}
                      </Button>
                      <Button
                        variant={rsvpStatus === 'not_going' ? 'default' : 'outline'}
                        size="sm"
                        className={cn('flex-1', rsvpStatus === 'not_going' && 'bg-red-600 hover:bg-red-700')}
                        disabled={rsvpStatus === 'not_going'}
                        onClick={() => {
                          setReasonText('')
                          setReasonDialogOpen(true)
                        }}
                      >
                        <ThumbsDown className="mr-1.5 h-3.5 w-3.5" />
                        {rsvpStatus === 'not_going' ? 'Ausente' : 'Não vou'}
                      </Button>
                    </div>

                    {/* Counts + attendee lists */}
                    {(goingList.length > 0 || notGoingList.length > 0) && (
                      <div className="space-y-2 pt-1">
                        {/* Going */}
                        {goingList.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                              <ThumbsUp className="h-3 w-3" />
                              Vão ({goingList.length})
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {goingList.map((r) => (
                                <Badge key={r.user_id} variant="secondary" className="text-xs">
                                  {r.user?.commercial_name ?? 'Utilizador'}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Not going */}
                        {notGoingList.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-red-500 flex items-center gap-1">
                              <ThumbsDown className="h-3 w-3" />
                              Não vão ({notGoingList.length})
                            </p>
                            <div className="space-y-1">
                              {notGoingList.map((r) => (
                                <div key={r.user_id} className="flex items-center gap-1.5">
                                  <Badge variant="secondary" className="text-xs">
                                    {r.user?.commercial_name ?? 'Utilizador'}
                                  </Badge>
                                  {isManager && r.reason && (
                                    <span className="text-[11px] text-muted-foreground italic truncate">
                                      — {r.reason}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {event.rsvp_counts && goingList.length === 0 && notGoingList.length === 0 && (
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span className="text-emerald-600 font-medium">{event.rsvp_counts.going} vão</span>
                        <span className="text-red-500 font-medium">{event.rsvp_counts.not_going} não vão</span>
                        <span>{event.rsvp_counts.pending} pendentes</span>
                      </div>
                    )}
                  </div>

                  {/* Not-going reason dialog */}
                  <Dialog open={reasonDialogOpen} onOpenChange={setReasonDialogOpen}>
                    <DialogContent className="sm:max-w-sm">
                      <DialogHeader>
                        <DialogTitle>Porquê não pode ir?</DialogTitle>
                      </DialogHeader>
                      <Input
                        placeholder="Motivo (opcional)"
                        value={reasonText}
                        onChange={(e) => setReasonText(e.target.value)}
                        autoFocus
                      />
                      <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setReasonDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            onRsvp(event.id, 'not_going', reasonText || undefined)
                            setReasonDialogOpen(false)
                            setConfirmType('not_going')
                            setConfirmDialogOpen(true)
                          }}
                        >
                          Confirmar ausência
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Confirmation popup */}
                  <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                    <DialogContent className="sm:max-w-xs text-center">
                      {confirmType === 'going' ? (
                        <div className="py-4 space-y-2">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
                            <ThumbsUp className="h-6 w-6 text-emerald-600" />
                          </div>
                          <p className="text-base font-semibold">Presença confirmada!</p>
                          <p className="text-sm text-muted-foreground">Obrigado por confirmar. Contamos consigo!</p>
                        </div>
                      ) : (
                        <div className="py-4 space-y-2">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950">
                            <ThumbsDown className="h-6 w-6 text-red-500" />
                          </div>
                          <p className="text-base font-semibold">Ausência registada</p>
                          <p className="text-sm text-muted-foreground">Que pena não poder estar presente. Fica para a próxima!</p>
                        </div>
                      )}
                      <DialogFooter className="justify-center">
                        <Button size="sm" onClick={() => setConfirmDialogOpen(false)}>Fechar</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              )
            })()}

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

              {/* Assigned user — escondido para visitas (têm secção própria de Participantes) */}
              {event.user_name && !event.visit_id && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <User className="h-3.5 w-3.5" />
                    Responsável
                  </div>
                  <span className="text-sm font-medium">{event.user_name}</span>
                </div>
              )}

            </div>

            {/* Participantes — apenas para visitas */}
            {event.visit_id && (event.visit_buyer_agent_name || event.visit_seller_agent_name || event.lead_name) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <Users className="h-3.5 w-3.5" />
                    Participantes
                  </div>
                  <div className="space-y-2">
                    {event.visit_buyer_agent_name && (
                      <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge
                            variant="outline"
                            className="text-[10px] font-medium text-blue-700 dark:text-blue-300 border-blue-500/30 bg-blue-500/10 shrink-0"
                          >
                            Comprador
                          </Badge>
                          <span className="text-sm font-medium truncate">{event.visit_buyer_agent_name}</span>
                        </div>
                      </div>
                    )}
                    {event.visit_seller_agent_name && (
                      <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge
                            variant="outline"
                            className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300 border-emerald-500/30 bg-emerald-500/10 shrink-0"
                          >
                            Vendedor
                          </Badge>
                          <span className="text-sm font-medium truncate">{event.visit_seller_agent_name}</span>
                          {event.visit_buyer_agent_id &&
                            event.visit_seller_agent_id === event.visit_buyer_agent_id && (
                              <span className="text-[10px] text-muted-foreground">(mesmo consultor)</span>
                            )}
                        </div>
                      </div>
                    )}
                    {event.lead_name && (
                      <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge
                            variant="outline"
                            className="text-[10px] font-medium text-rose-700 dark:text-rose-300 border-rose-500/30 bg-rose-500/10 shrink-0"
                          >
                            Lead
                          </Badge>
                          <span className="text-sm font-medium truncate">{event.lead_name}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Acções de visita: confirmar/rejeitar proposta, registar outcome,
                preencher ficha. Renderiza nada se o user não estiver envolvido. */}
            {event.visit_id && (
              <VisitActionsSection
                event={event}
                currentUserId={currentUser?.id}
                onChanged={() => {
                  onRefresh?.()
                  onClose()
                }}
              />
            )}

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
                    className="flex items-center gap-3 rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3 hover:bg-muted/50 transition-colors group"
                    style={{ maxWidth: '100%' }}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:bg-violet-500/20">
                      <ClipboardList className="h-4 w-4" />
                    </div>
                    <div className="w-0 flex-1">
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

            {/* Owners (for process_event) */}
            {isScheduledEvent && event.owners && event.owners.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <User className="h-3.5 w-3.5" />
                    Proprietários
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {event.owners.map((owner) => (
                      <Badge key={owner.id} variant="secondary" className="text-xs">
                        {owner.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Attendees (for process_event) */}
            {isScheduledEvent && event.attendees && event.attendees.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <User className="h-3.5 w-3.5" />
                    Participantes
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {event.attendees.map((attendee) => (
                      <Badge key={attendee.id} variant="outline" className="text-xs">
                        {attendee.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Related entities */}
            {relatedLinks.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2 overflow-hidden">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <Info className="h-3.5 w-3.5" />
                    Ligações
                  </div>
                  <div className="space-y-1.5 overflow-hidden">
                    {relatedLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="flex items-center gap-3 rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3 hover:bg-muted/50 transition-colors group"
                        style={{ maxWidth: '100%' }}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground group-hover:bg-muted">
                          {link.icon}
                        </div>
                        <div className="w-0 flex-1">
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

            {/* WhatsApp origin */}
            {event.wpp_chat_id && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <MessageCircle className="h-3.5 w-3.5" />
                    Origem WhatsApp
                  </div>
                  <Link
                    href={`/dashboard/whatsapp?chat=${event.wpp_chat_id}`}
                    className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 sm:px-4 sm:py-3 hover:bg-emerald-500/10 transition-colors group"
                    style={{ maxWidth: '100%' }}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/25">
                      <MessageCircle className="h-4 w-4" />
                    </div>
                    <div className="w-0 flex-1">
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 truncate">Abrir conversa</p>
                      <p className="text-xs text-muted-foreground truncate">Ver mensagem original no WhatsApp</p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-emerald-600/50 group-hover:text-emerald-600 transition-colors shrink-0" />
                  </Link>
                </div>
              </>
            )}

          </div>
        </ScrollArea>

        {/* Footer actions */}
        <SheetFooter className="border-t px-5 py-3 sm:px-6 sm:py-4 flex-row gap-2 shrink-0">
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
