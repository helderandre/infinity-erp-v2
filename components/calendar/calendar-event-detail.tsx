'use client'

import { useState } from 'react'
import type { CalendarEvent } from '@/types/calendar'
import { CALENDAR_CATEGORY_LABELS } from '@/types/calendar'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  Trash2,
  Pencil,
  ExternalLink,
  AlertTriangle,
  ClipboardList,
  MessageCircle,
  MapPin,
  Video,
  Link2,
  Building2,
  Zap,
  Maximize2,
} from 'lucide-react'
import { format, parseISO, addHours } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useIsMobile } from '@/hooks/use-mobile'
import { useUser } from '@/hooks/use-user'
import { isManagementRole } from '@/lib/auth/roles'
import { RsvpSection } from './rsvp-section'
import { VisitActionsSection } from './visit-actions-section'

// Gate "manager" agora é a fonte canónica em lib/auth/roles.ts
// (admin, Broker/CEO, Gestor Processual, Office Manager, Team Leader).

interface CalendarEventDetailProps {
  event: CalendarEvent | null
  open: boolean
  onClose: () => void
  onEdit?: (event: CalendarEvent) => void
  onDelete?: (id: string) => void
  onRefresh?: () => void
}

// Minimal palette — dot + text accent per category. No filled backgrounds.
const DETAIL_COLORS: Record<string, { dot: string; text: string }> = {
  contract_expiry:   { dot: 'bg-stone-500',    text: 'text-stone-600 dark:text-stone-400' },
  lead_expiry:       { dot: 'bg-red-700',      text: 'text-red-600 dark:text-red-400' },
  lead_followup:     { dot: 'bg-yellow-600',   text: 'text-yellow-600 dark:text-yellow-400' },
  process_task:      { dot: 'bg-violet-600',   text: 'text-violet-600 dark:text-violet-400' },
  process_subtask:   { dot: 'bg-teal-600',     text: 'text-teal-600 dark:text-teal-400' },
  process_event:     { dot: 'bg-sky-700',      text: 'text-sky-600 dark:text-sky-400' },
  birthday:          { dot: 'bg-rose-500',     text: 'text-rose-600 dark:text-rose-400' },
  vacation:          { dot: 'bg-slate-500',    text: 'text-slate-600 dark:text-slate-400' },
  company_event:     { dot: 'bg-yellow-500',   text: 'text-yellow-700 dark:text-yellow-400' },
  marketing_event:   { dot: 'bg-orange-600',   text: 'text-orange-600 dark:text-orange-400' },
  meeting:           { dot: 'bg-indigo-700',   text: 'text-indigo-600 dark:text-indigo-400' },
  visit:             { dot: 'bg-fuchsia-600',  text: 'text-fuchsia-600 dark:text-fuchsia-400' },
  reminder:          { dot: 'bg-blue-600',     text: 'text-blue-600 dark:text-blue-400' },
  custom:            { dot: 'bg-neutral-500',  text: 'text-neutral-600 dark:text-neutral-400' },
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Pendente',      color: 'text-slate-500' },
  in_progress: { label: 'Em Progresso',  color: 'text-blue-500' },
  completed:   { label: 'Concluída',     color: 'text-emerald-500' },
  skipped:     { label: 'Dispensada',    color: 'text-orange-500' },
  approved:    { label: 'Aprovado',      color: 'text-emerald-500' },
}

type AccentTone = 'neutral' | 'blue' | 'red' | 'emerald' | 'violet'

const ACCENT_STYLES: Record<AccentTone, { iconBg: string; iconText: string }> = {
  neutral: { iconBg: 'bg-muted/60',       iconText: 'text-muted-foreground' },
  blue:    { iconBg: 'bg-blue-500/10',    iconText: 'text-blue-600 dark:text-blue-400' },
  red:     { iconBg: 'bg-red-500/10',     iconText: 'text-red-600 dark:text-red-400' },
  emerald: { iconBg: 'bg-emerald-500/10', iconText: 'text-emerald-600 dark:text-emerald-400' },
  violet:  { iconBg: 'bg-violet-500/10',  iconText: 'text-violet-600 dark:text-violet-400' },
}

function UnifiedLinkRow({
  href,
  external = false,
  icon,
  title,
  subtitle,
  accent = 'neutral',
}: {
  href: string
  external?: boolean
  icon: React.ReactNode
  title: string
  subtitle?: string
  accent?: AccentTone
}) {
  const styles = ACCENT_STYLES[accent]
  const classes =
    'group flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-border/40 bg-background/40 px-3.5 py-2.5 transition-all hover:bg-muted/50 hover:border-border/70'
  const body = (
    <>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
          styles.iconBg,
          styles.iconText,
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="text-sm font-medium truncate">{title}</p>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
    </>
  )
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
      {body}
    </a>
  ) : (
    <Link href={href} className={classes}>
      {body}
    </Link>
  )
}

export function CalendarEventDetail({
  event,
  open,
  onClose,
  onEdit,
  onDelete,
  onRefresh,
}: CalendarEventDetailProps) {
  const isMobile = useIsMobile()
  const { user: currentUser } = useUser()
  const [imageLightboxOpen, setImageLightboxOpen] = useState(false)

  const isManager = isManagementRole(currentUser?.role_names ?? [])

  if (!event) return null

  const colors = DETAIL_COLORS[event.category] ?? DETAIL_COLORS.custom
  const categoryLabel = CALENDAR_CATEGORY_LABELS[event.category]
  const isManual = event.source === 'manual'
  // Consultores só podem editar/eliminar eventos que criaram. Gestão pode tudo.
  const canModify =
    isManager ||
    (!!currentUser?.id && !!event.created_by && event.created_by === currentUser.id)
  const isProcessEvent =
    event.category === 'process_task' ||
    event.category === 'process_subtask' ||
    event.category === 'process_event'
  const isScheduledEvent = event.category === 'process_event'
  const TASK_CATS = [
    'process_task',
    'process_subtask',
    'reminder',
    'lead_followup',
    'contract_expiry',
    'lead_expiry',
  ]
  const isTask = TASK_CATS.includes(event.category)
  const impliedEndTime =
    !event.end_date && !event.all_day && !isTask
      ? format(addHours(parseISO(event.start_date), 1), 'HH:mm')
      : null

  const formatEventDate = (dateStr: string, allDay: boolean) => {
    const date = parseISO(dateStr)
    if (allDay) {
      return format(date, "EEEE, d 'de' MMMM", { locale: pt })
    }
    return format(date, "EEEE, d 'de' MMMM 'às' HH:mm", { locale: pt })
  }

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  const relatedLinks: {
    label: string
    href: string
    icon: React.ReactNode
    sublabel?: string
  }[] = []

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

  const hasLinkRows = !!(
    event.registration_url ||
    event.livestream_url ||
    (event.links && event.links.length > 0) ||
    relatedLinks.length > 0 ||
    (isProcessEvent && event.process_id) ||
    event.wpp_chat_id
  )

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[80dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[468px] sm:rounded-l-3xl',
        )}
      >
        {/* Mobile grabber */}
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}

        {/* Header */}
        <div className="shrink-0 px-6 pt-8 pb-4 sm:pt-10">
          <SheetHeader className="p-0 gap-0">
            <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight pr-10 text-balance break-words">
              {event.title}
            </SheetTitle>
            <SheetDescription className="sr-only">Detalhes do evento</SheetDescription>
          </SheetHeader>

          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
            <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', colors.dot)} />
            <span className={cn('font-medium', colors.text)}>{categoryLabel}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>{capitalize(formatEventDate(event.start_date, event.all_day))}</span>
            {event.end_date && !event.all_day && (
              <span>– {format(parseISO(event.end_date), 'HH:mm')}</span>
            )}
            {impliedEndTime && <span>– {impliedEndTime}</span>}
          </div>

          {(event.item_type === 'task' ||
            event.all_day ||
            event.is_recurring ||
            (isProcessEvent && event.priority === 'urgent')) && (
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              {event.item_type === 'task' && (
                <span className="rounded-full bg-muted/60 px-2.5 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                  Tarefa
                </span>
              )}
              {event.all_day && (
                <span className="rounded-full bg-muted/60 px-2.5 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                  Todo o dia
                </span>
              )}
              {event.is_recurring && (
                <span className="rounded-full bg-muted/60 px-2.5 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                  Recorrente
                </span>
              )}
              {isProcessEvent && event.priority === 'urgent' && (
                <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-[10.5px] font-medium text-red-600 dark:text-red-400">
                  Urgente
                </span>
              )}
            </div>
          )}
        </div>

        {/* Body — note: morada e cover image vivem aqui dentro para que o
            scroll comece a partir da morada (em mobile o sheet inteiro abaixo
            do header de título scrolla em conjunto). */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
          <div className="px-6 pt-3 pb-5 space-y-4">
            {/* Morada — texto completo + link para Google Maps */}
            {event.location && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-2.5 rounded-2xl border border-border/40 bg-background/40 px-3.5 py-2.5 transition-colors hover:bg-muted/50 hover:border-border/70"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug break-words">
                    {event.location}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Abrir no Google Maps
                  </p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 self-center text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
              </a>
            )}

            {/* Cover image — centered square thumbnail with expand affordance */}
            {event.cover_image_url && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setImageLightboxOpen(true)}
                  className="group relative overflow-hidden rounded-2xl border border-border/40 shadow-sm transition-transform hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  aria-label="Ampliar imagem"
                >
                  <img
                    src={event.cover_image_url}
                    alt={event.title}
                    className="h-56 w-56 sm:h-64 sm:w-64 object-cover"
                  />
                  <span className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md shadow-md group-hover:bg-black/75 transition-colors">
                    <Maximize2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </span>
                </button>
              </div>
            )}

            <div className="space-y-6">
            {/* Description */}
            {event.description && (
              <div className="rounded-2xl border border-border/40 bg-muted/30 px-4 py-3 backdrop-blur-sm">
                {event.description.includes('<') ? (
                  <div
                    className="prose prose-sm max-w-none text-sm break-words [&_p]:my-0.5 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold"
                    dangerouslySetInnerHTML={{ __html: event.description }}
                  />
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground/85">
                    {event.description}
                  </p>
                )}
              </div>
            )}

            {/* Overdue */}
            {event.is_overdue && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-red-500/20 bg-red-500/5 px-3.5 py-2.5">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">Em atraso</p>
                  <p className="text-xs text-muted-foreground truncate">
                    Ultrapassou a data prevista
                  </p>
                </div>
              </div>
            )}

            {/* Unified links */}
            {hasLinkRows && (
              <div className="space-y-1.5">
                {event.registration_url && (
                  <UnifiedLinkRow
                    href={event.registration_url}
                    external
                    icon={<ClipboardList className="h-4 w-4" />}
                    title="Inscrever-se"
                    subtitle={event.registration_url}
                    accent="blue"
                  />
                )}
                {event.livestream_url && (
                  <UnifiedLinkRow
                    href={event.livestream_url}
                    external
                    icon={<Video className="h-4 w-4" />}
                    title="Ver livestream"
                    subtitle={event.livestream_url}
                    accent="red"
                  />
                )}
                {isProcessEvent && event.process_id && (
                  <UnifiedLinkRow
                    href={`/dashboard/processos/${event.process_id}`}
                    icon={<ClipboardList className="h-4 w-4" />}
                    title={event.process_ref ?? 'Processo'}
                    subtitle={event.stage_name ? `Fase: ${event.stage_name}` : undefined}
                    accent="violet"
                  />
                )}
                {relatedLinks.map((link) => (
                  <UnifiedLinkRow
                    key={link.href}
                    href={link.href}
                    icon={link.icon}
                    title={link.label}
                    subtitle={link.sublabel}
                  />
                ))}
                {event.links?.map((link, i) => (
                  <UnifiedLinkRow
                    key={i}
                    href={link.url}
                    external
                    icon={<Link2 className="h-4 w-4" />}
                    title={link.name}
                    subtitle={link.url}
                  />
                ))}
                {event.wpp_chat_id && (
                  <UnifiedLinkRow
                    href={`/dashboard/whatsapp?chat=${event.wpp_chat_id}`}
                    icon={<MessageCircle className="h-4 w-4" />}
                    title="Abrir conversa WhatsApp"
                    subtitle="Ver mensagem original"
                    accent="emerald"
                  />
                )}
              </div>
            )}

            {/* Status */}
            {statusInfo && (
              <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-background/40 px-4 py-3 text-sm">
                <span className="text-muted-foreground">Estado</span>
                <span className={cn('font-medium', statusInfo.color)}>
                  {statusInfo.label}
                </span>
              </div>
            )}

            {/* Atribuído a */}
            {event.user_name && !event.visit_id && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Atribuído a</span>
                <span className="font-medium truncate max-w-[60%] text-right">
                  {event.user_name}
                </span>
              </div>
            )}

            {/* RSVP — tabbed Vão / Não vão lists with own-entry controls. */}
            {event.requires_rsvp && isManual && (
              <RsvpSection
                eventId={event.id}
                currentUserId={currentUser?.id}
                currentUserName={currentUser?.commercial_name}
                currentUserPhoto={currentUser?.profile_photo_url}
                isManager={isManager}
                onChanged={onRefresh}
              />
            )}

            {/* Visit participants */}
            {event.visit_id &&
              (event.visit_buyer_agent_name ||
                event.visit_seller_agent_name ||
                event.lead_name) && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground/80">Participantes</p>
                  <div className="space-y-1.5">
                    {event.visit_buyer_agent_name && (
                      <div className="flex items-center gap-3 overflow-hidden rounded-2xl border border-border/40 bg-background/40 px-3.5 py-2.5">
                        <span className="text-xs text-muted-foreground shrink-0">Comprador</span>
                        <span className="text-sm font-medium truncate ml-auto min-w-0">
                          {event.visit_buyer_agent_name}
                        </span>
                      </div>
                    )}
                    {event.visit_seller_agent_name && (
                      <div className="flex items-center gap-3 overflow-hidden rounded-2xl border border-border/40 bg-background/40 px-3.5 py-2.5">
                        <span className="text-xs text-muted-foreground shrink-0">Vendedor</span>
                        <span className="text-sm font-medium truncate ml-auto min-w-0 flex items-center gap-1.5">
                          <span className="truncate">{event.visit_seller_agent_name}</span>
                          {event.visit_buyer_agent_id &&
                            event.visit_seller_agent_id === event.visit_buyer_agent_id && (
                              <span className="text-[10px] text-muted-foreground font-normal shrink-0">
                                (mesmo)
                              </span>
                            )}
                        </span>
                      </div>
                    )}
                    {event.lead_name && (
                      <div className="flex items-center gap-3 overflow-hidden rounded-2xl border border-border/40 bg-background/40 px-3.5 py-2.5">
                        <span className="text-xs text-muted-foreground shrink-0">Lead</span>
                        <span className="text-sm font-medium truncate ml-auto min-w-0">
                          {event.lead_name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

            {/* Visit actions */}
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

            {/* Owners */}
            {isScheduledEvent && event.owners && event.owners.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground/80">Proprietários</p>
                <div className="flex flex-wrap gap-1.5">
                  {event.owners.map((owner) => (
                    <span
                      key={owner.id}
                      className="rounded-full bg-muted/60 px-2.5 py-0.5 text-xs"
                    >
                      {owner.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Attendees */}
            {isScheduledEvent && event.attendees && event.attendees.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground/80">Participantes</p>
                <div className="flex flex-wrap gap-1.5">
                  {event.attendees.map((attendee) => (
                    <span
                      key={attendee.id}
                      className="rounded-full border border-border/50 px-2.5 py-0.5 text-xs text-muted-foreground"
                    >
                      {attendee.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Footer — translucent, borderless */}
        <SheetFooter className="px-6 py-4 flex-row gap-2 shrink-0 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md">
          {isManual && onEdit && canModify && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-full"
              onClick={() => onEdit(event)}
            >
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Editar
            </Button>
          )}
          {isManual && onDelete && canModify && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              onClick={() => onDelete(event.id)}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Eliminar
            </Button>
          )}
          {isProcessEvent && event.process_id && (
            <Button variant="default" size="sm" className="flex-1 rounded-full" asChild>
              <Link href={`/dashboard/processos/${event.process_id}`}>
                <ClipboardList className="mr-2 h-3.5 w-3.5" />
                Abrir Processo
              </Link>
            </Button>
          )}
          {!isManual && !isProcessEvent && relatedLinks.length > 0 && (
            <Button variant="default" size="sm" className="flex-1 rounded-full" asChild>
              <Link href={relatedLinks[0].href}>
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                Abrir {event.property_id ? 'Imóvel' : 'Lead'}
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" className="rounded-full" onClick={onClose}>
            Fechar
          </Button>
        </SheetFooter>
      </SheetContent>

      {/* Cover image lightbox */}
      {event.cover_image_url && (
        <Dialog open={imageLightboxOpen} onOpenChange={setImageLightboxOpen}>
          <DialogContent
            className="max-w-[min(92vw,1000px)] p-2 rounded-3xl border-border/40 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl shadow-2xl"
            showCloseButton={false}
          >
            <DialogHeader className="sr-only">
              <DialogTitle>{event.title}</DialogTitle>
            </DialogHeader>
            <img
              src={event.cover_image_url}
              alt={event.title}
              className="w-full max-h-[85vh] object-contain rounded-2xl"
            />
          </DialogContent>
        </Dialog>
      )}
    </Sheet>
  )
}
