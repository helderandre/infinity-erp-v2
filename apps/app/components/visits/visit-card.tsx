'use client'

import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  Building2,
  Clock,
  MapPin,
  MoreHorizontal,
  Phone,
  Star,
  User,
  CheckCircle2,
  XCircle,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react'
import {
  VISIT_STATUS_COLORS,
  VISIT_FEEDBACK_INTEREST_OPTIONS,
  VISIT_FEEDBACK_NEXT_STEP_OPTIONS,
} from '@/lib/constants'
import type { VisitWithRelations } from '@/types/visit'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface VisitCardProps {
  visit: VisitWithRelations
  onComplete?: (id: string) => void
  onCancel?: (id: string) => void
  onFeedback?: (id: string) => void
  onNoShow?: (id: string) => void
  onDelete?: (id: string) => void
}

export function VisitCard({
  visit,
  onComplete,
  onCancel,
  onFeedback,
  onNoShow,
  onDelete,
}: VisitCardProps) {
  const statusStyle = VISIT_STATUS_COLORS[visit.status as keyof typeof VISIT_STATUS_COLORS]
  const clientName = visit.lead?.name || visit.client_name || 'Cliente não definido'
  const clientPhone = visit.lead?.telemovel || visit.client_phone

  const visitDateTime = new Date(`${visit.visit_date}T${visit.visit_time}`)
  const isUpcoming = visitDateTime > new Date() && visit.status === 'scheduled'
  const isProposal = visit.status === 'proposal'
  const canRegisterOutcome = visit.status === 'scheduled'
  const hasFeedback = !!visit.feedback_submitted_at

  const interestLabel = visit.feedback_interest
    ? VISIT_FEEDBACK_INTEREST_OPTIONS.find((o) => o.value === visit.feedback_interest)?.label
    : null
  const nextStepLabel = visit.feedback_next_step
    ? VISIT_FEEDBACK_NEXT_STEP_OPTIONS.find((o) => o.value === visit.feedback_next_step)?.label
    : null

  return (
    <div className="group rounded-lg border bg-card p-4 transition-all hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        {/* Left content */}
        <div className="min-w-0 flex-1 space-y-2">
          {/* Date & Status row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">
              {format(visitDateTime, "EEEE, d 'de' MMMM", { locale: pt })}
            </span>
            <span className="text-sm text-muted-foreground">
              {visit.visit_time?.slice(0, 5)}
            </span>
            <Badge
              variant="secondary"
              className={`${statusStyle?.bg} ${statusStyle?.text} border-0`}
            >
              <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${statusStyle?.dot}`} />
              {statusStyle?.label}
            </Badge>
            {isUpcoming && (
              <Badge variant="outline" className="text-xs">
                <Clock className="mr-1 h-3 w-3" />
                {visit.duration_minutes} min
              </Badge>
            )}
          </div>

          {/* Property */}
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">
              {visit.property?.external_ref && (
                <span className="text-muted-foreground mr-1">{visit.property.external_ref}</span>
              )}
              {visit.property?.title || 'Imóvel'}
            </span>
            {visit.property?.city && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {visit.property.city}{visit.property.zone ? `, ${visit.property.zone}` : ''}
              </span>
            )}
          </div>

          {/* Client */}
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{clientName}</span>
            {clientPhone && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                {clientPhone}
              </span>
            )}
          </div>

          {/* Consultant */}
          {visit.consultant?.commercial_name && (
            <div className="text-xs text-muted-foreground">
              Consultor: {visit.consultant.commercial_name}
            </div>
          )}

          {/* Feedback */}
          {hasFeedback && (
            <div className="mt-2 rounded-md bg-muted/50 p-2.5 text-sm space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`h-3.5 w-3.5 ${
                        s <= (visit.feedback_rating || 0)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground/20'
                      }`}
                    />
                  ))}
                </div>
                {interestLabel && (
                  <span className="text-xs text-muted-foreground">· {interestLabel}</span>
                )}
                {nextStepLabel && (
                  <Badge variant="outline" className="text-xs">
                    {nextStepLabel}
                  </Badge>
                )}
              </div>
              {visit.feedback_notes && (
                <p className="text-xs text-muted-foreground">{visit.feedback_notes}</p>
              )}
            </div>
          )}

          {/* Notes */}
          {visit.notes && !hasFeedback && (
            <p className="text-xs text-muted-foreground line-clamp-1">{visit.notes}</p>
          )}

          {/* Cancelled reason */}
          {visit.status === 'cancelled' && visit.cancelled_reason && (
            <p className="text-xs text-red-600">
              Motivo: {visit.cancelled_reason}
            </p>
          )}
        </div>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Propostas: a confirmação/rejeição é feita pelo seller agent
                via endpoint dedicado. Para manter este card simples,
                redireccionamos para o detalhe (calendário ou tarefas).
                As acções inline ficam noutros sítios mais apropriados. */}
            {isProposal && (
              <DropdownMenuItem disabled>
                <Clock className="mr-2 h-4 w-4" />
                Aguardando confirmação
              </DropdownMenuItem>
            )}
            {canRegisterOutcome && onComplete && (
              <DropdownMenuItem onClick={() => onComplete(visit.id)}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Marcar como realizada
              </DropdownMenuItem>
            )}
            {canRegisterOutcome && onNoShow && (
              <DropdownMenuItem onClick={() => onNoShow(visit.id)}>
                <AlertTriangle className="mr-2 h-4 w-4" />
                Cliente não compareceu
              </DropdownMenuItem>
            )}
            {visit.status === 'completed' && !hasFeedback && onFeedback && (
              <DropdownMenuItem onClick={() => onFeedback(visit.id)}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Registar Feedback
              </DropdownMenuItem>
            )}
            {canRegisterOutcome && onCancel && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onCancel(visit.id)}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancelar Visita
                </DropdownMenuItem>
              </>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(visit.id)}
                >
                  Eliminar
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
