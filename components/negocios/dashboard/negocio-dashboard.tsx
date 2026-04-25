'use client'

import { Building2, Send, CalendarDays, Sparkles, Users, Activity, Heart, ThumbsDown } from 'lucide-react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { WidgetCard } from './widget-card'
import { ActivityStrip } from './activity-strip'
import type { NegocioProperty } from '@/types/lead'
import type { NegocioActivity } from '@/hooks/use-negocio-activities'
import type { AgendaItem } from '@/hooks/use-negocio-agenda'

export type DashboardSection =
  | 'enviados'
  | 'matches'
  | 'visitas'
  | 'actividade'
  | 'compradores'

interface NegocioDashboardProps {
  tipo: string
  isBuyerType: boolean
  isSellerType: boolean

  // Data
  properties: NegocioProperty[]
  matches: any[]
  agendaUpcoming: AgendaItem[]
  agendaPast: AgendaItem[]
  activities: NegocioActivity[]
  interessadosCount?: number

  // Loading
  isLoadingMatches?: boolean
  isLoadingAgenda?: boolean
  isLoadingActivities?: boolean
  isLoadingInteressados?: boolean

  // Briefing inline (read-only summary cards)
  briefingPreview: React.ReactNode

  // Top actions
  onOpenBriefing: () => void
  onOpenAssistente: () => void

  // Drilldowns
  onOpenSection: (key: DashboardSection) => void

  // Header actions visible at top of dashboard
  topActions?: React.ReactNode
}

export function NegocioDashboard({
  tipo,
  isBuyerType,
  isSellerType,
  properties,
  matches,
  agendaUpcoming,
  agendaPast,
  activities,
  interessadosCount = 0,
  isLoadingMatches,
  isLoadingAgenda,
  isLoadingActivities,
  isLoadingInteressados,
  briefingPreview,
  onOpenBriefing,
  onOpenAssistente,
  onOpenSection,
  topActions,
}: NegocioDashboardProps) {
  // ── Compute widget data ──────────────────────────────────────────────────
  const dossierCount = properties.length
  const sentCount = properties.filter((p: any) => !!p.sent_at).length
  const pendingCount = dossierCount - sentCount
  const likedCount = properties.filter((p: any) => p.client_reaction === 'liked').length
  const dislikedCount = properties.filter((p: any) => p.client_reaction === 'disliked').length

  // matches not yet in dossier
  const dossierPropertyIds = new Set(
    properties.filter((p) => p.property_id).map((p) => p.property_id),
  )
  const newMatchesCount = matches.filter((m: any) => !dossierPropertyIds.has(m.id)).length

  // Agenda: visitas + eventos de calendário linkados ao lead/dossier
  const upcomingCount = agendaUpcoming.length
  const pastCount = agendaPast.length
  const nextItem = agendaUpcoming[0]

  const lastActivity = activities[0]

  return (
    <div className="space-y-4">
      {/* Briefing preview + actions */}
      <div className="rounded-3xl border border-border/40 bg-card/60 supports-[backdrop-filter]:bg-card/40 backdrop-blur-xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">
              Briefing
            </p>
            <h2 className="text-base font-semibold tracking-tight mt-0.5">
              {summaryTitleFor(tipo)}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-full text-xs"
              onClick={onOpenBriefing}
            >
              Ver/editar
            </Button>
          </div>
        </div>
        {briefingPreview}
        {topActions && <div className="mt-4">{topActions}</div>}
      </div>

      {/* Widgets grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {isBuyerType && (
          <WidgetCard
            icon={Send}
            label="Imóveis"
            value={dossierCount}
            hint={
              dossierCount === 0
                ? 'Nenhum imóvel no dossier'
                : sentCount === 0
                  ? `${pendingCount} por enviar`
                  : pendingCount === 0
                    ? `Todos enviados (${sentCount})`
                    : `${sentCount} enviado${sentCount === 1 ? '' : 's'} · ${pendingCount} por enviar`
            }
            badge={
              likedCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-full px-2 py-0.5">
                  <Heart className="h-3 w-3 fill-current" />
                  {likedCount}
                </span>
              ) : dislikedCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5">
                  <ThumbsDown className="h-3 w-3" />
                  {dislikedCount}
                </span>
              ) : undefined
            }
            onClick={() => onOpenSection('enviados')}
          />
        )}

        {isBuyerType && (
          <WidgetCard
            icon={Sparkles}
            label="Novos matches"
            value={newMatchesCount}
            hint={
              isLoadingMatches
                ? 'A calcular…'
                : newMatchesCount === 0
                  ? matches.length > 0
                    ? 'Todos no dossier'
                    : 'Sem matches compatíveis'
                  : 'Compatíveis · ainda não enviados'
            }
            isLoading={isLoadingMatches && matches.length === 0}
            onClick={() => onOpenSection('matches')}
          />
        )}

        {isSellerType && (
          <WidgetCard
            icon={Users}
            label="Interessados"
            value={interessadosCount}
            hint={
              isLoadingInteressados
                ? 'A carregar…'
                : interessadosCount === 0
                  ? 'Sem compradores compatíveis'
                  : `${interessadosCount} compradores potenciais`
            }
            isLoading={isLoadingInteressados && interessadosCount === 0}
            onClick={() => onOpenSection('compradores')}
          />
        )}

        <WidgetCard
          icon={CalendarDays}
          label="Agenda"
          value={upcomingCount}
          hint={
            isLoadingAgenda
              ? 'A carregar…'
              : nextItem
                ? `Próximo · ${format(new Date(nextItem.start_at), "d 'de' MMM 'às' HH:mm", { locale: pt })}`
                : pastCount > 0
                  ? `${pastCount} ${pastCount === 1 ? 'item' : 'itens'} no histórico`
                  : 'Sem agenda'
          }
          isLoading={isLoadingAgenda && upcomingCount === 0 && pastCount === 0}
          onClick={() => onOpenSection('visitas')}
        />

        <WidgetCard
          icon={Activity}
          label="Última actividade"
          value={lastActivity ? activitySummary(lastActivity) : '—'}
          hint={
            isLoadingActivities
              ? 'A carregar…'
              : lastActivity
                ? format(new Date(lastActivity.created_at), "d MMM, HH:mm", { locale: pt })
                : 'Sem registos'
          }
          isLoading={isLoadingActivities && activities.length === 0}
          onClick={() => onOpenSection('actividade')}
        />
      </div>

      {/* Activity strip */}
      <ActivityStrip
        activities={activities}
        isLoading={!!isLoadingActivities}
        onSeeAll={() => onOpenSection('actividade')}
      />
    </div>
  )
}

function summaryTitleFor(tipo: string): string {
  switch (tipo) {
    case 'Compra':
      return 'O que o cliente procura'
    case 'Venda':
      return 'O que o cliente vende'
    case 'Arrendatário':
      return 'O que o cliente arrenda'
    case 'Arrendador':
      return 'Imóvel para arrendar'
    case 'Compra e Venda':
      return 'Critérios do negócio'
    default:
      return 'Critérios'
  }
}

function activitySummary(a: NegocioActivity): string {
  if (a.subject) return a.subject
  switch (a.activity_type) {
    case 'call':
      return 'Chamada'
    case 'email':
      return 'Email'
    case 'whatsapp':
      return 'WhatsApp'
    case 'sms':
      return 'SMS'
    case 'visit':
      return 'Visita'
    case 'note':
      return 'Nota'
    case 'stage_change':
      return 'Mudança de fase'
    default:
      return 'Actividade'
  }
}
