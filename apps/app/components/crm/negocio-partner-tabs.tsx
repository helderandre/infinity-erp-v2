'use client'

// Tabs read-only do NegocioDetailSheet em modo `partnerView` (portal de
// parceiros). Renderizam exclusivamente o bundle devolvido por
// GET /api/parceiros/oportunidades/[id] — zero fetches próprios e zero
// acções de escrita. O visual segue os cartões das tabs originais
// (Propostas / Fecho), e o Histórico apresenta a timeline completa do que
// o consultor fez (chamadas, visitas, notas, mudanças de fase, tarefas).

import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  CalendarCheck,
  StickyNote,
  ArrowRightLeft,
  RefreshCw,
  Thermometer,
  CheckSquare,
  Briefcase,
  FileText,
  History,
  MapPin,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

const eur = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

// ─── Propostas (read-only) ──────────────────────────────────────────────

const PROPOSAL_STATUS_META: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: 'Pendente', bg: 'bg-amber-500/15', text: 'text-amber-600' },
  accepted: { label: 'Aceite', bg: 'bg-emerald-500/15', text: 'text-emerald-600' },
  rejected: { label: 'Rejeitada', bg: 'bg-red-500/15', text: 'text-red-600' },
  withdrawn: { label: 'Retirada', bg: 'bg-slate-500/15', text: 'text-slate-600' },
}

export function PartnerPropostasList({ proposals }: { proposals: any[] }) {
  if (!proposals.length) {
    return (
      <PartnerEmptyHint
        icon={FileText}
        message="Ainda não há propostas nesta oportunidade."
      />
    )
  }
  return (
    <div className="space-y-2">
      {proposals.map((p) => {
        const meta = PROPOSAL_STATUS_META[p.status] || {
          label: p.status || '—',
          bg: 'bg-muted',
          text: 'text-muted-foreground',
        }
        return (
          <div
            key={p.id}
            className="rounded-2xl bg-background border border-border/50 shadow-sm p-4"
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold truncate">
                    {p.property?.title || 'Proposta'}
                  </p>
                  <span
                    className={cn(
                      'inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full',
                      meta.bg,
                      meta.text,
                    )}
                  >
                    {meta.label}
                  </span>
                  {p.direction === 'inbound' && (
                    <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300">
                      Recebida
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                  {p.amount != null && (
                    <span className="font-medium tabular-nums">{eur.format(p.amount)}</span>
                  )}
                  {p.created_at && (
                    <span>
                      · {format(new Date(p.created_at), "d 'de' MMM yyyy", { locale: pt })}
                    </span>
                  )}
                  {p.creator?.commercial_name && <span>· {p.creator.commercial_name}</span>}
                </div>
                {p.property?.city && (
                  <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                    <MapPin className="h-2.5 w-2.5" />
                    {[p.property.zone, p.property.city].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Fecho (read-only) ──────────────────────────────────────────────────

const DEAL_STATUS_META: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: 'Rascunho', bg: 'bg-amber-500/15', text: 'text-amber-700' },
  submitted: { label: 'Submetido', bg: 'bg-blue-500/15', text: 'text-blue-700' },
  under_review: { label: 'Em revisão', bg: 'bg-amber-500/15', text: 'text-amber-700' },
  approved: { label: 'Aprovado', bg: 'bg-emerald-500/15', text: 'text-emerald-700' },
  completed: { label: 'Concluído', bg: 'bg-emerald-600/15', text: 'text-emerald-700' },
  rejected: { label: 'Rejeitado', bg: 'bg-red-500/15', text: 'text-red-700' },
  cancelled: { label: 'Cancelado', bg: 'bg-slate-500/15', text: 'text-slate-700' },
}

export function PartnerFechoList({ deals }: { deals: any[] }) {
  if (!deals.length) {
    return (
      <PartnerEmptyHint
        icon={Briefcase}
        message="Ainda não há fecho de negócio nesta oportunidade."
      />
    )
  }
  return (
    <div className="space-y-2">
      {deals.map((d) => {
        const meta = DEAL_STATUS_META[d.status] || {
          label: d.status || '—',
          bg: 'bg-muted',
          text: 'text-muted-foreground',
        }
        return (
          <div
            key={d.id}
            className="rounded-2xl bg-background border border-border/50 shadow-sm p-4"
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold truncate">
                    {d.property?.title || 'Fecho de negócio'}
                  </p>
                  <span
                    className={cn(
                      'inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full',
                      meta.bg,
                      meta.text,
                    )}
                  >
                    {meta.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                  {d.deal_value != null && d.deal_value > 0 && (
                    <span className="font-medium tabular-nums">{eur.format(d.deal_value)}</span>
                  )}
                  {d.deal_date && (
                    <span>· {format(new Date(d.deal_date), "d 'de' MMM yyyy", { locale: pt })}</span>
                  )}
                  {d.consultant?.commercial_name && <span>· {d.consultant.commercial_name}</span>}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Histórico (timeline completa) ──────────────────────────────────────

const HISTORICO_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; label: string; tone: string; bg: string }
> = {
  call: { icon: Phone, label: 'Chamada', tone: 'text-blue-600', bg: 'bg-blue-500/10' },
  email: { icon: Mail, label: 'Email', tone: 'text-violet-600', bg: 'bg-violet-500/10' },
  whatsapp: { icon: MessageSquare, label: 'WhatsApp', tone: 'text-emerald-600', bg: 'bg-emerald-500/10' },
  sms: { icon: MessageSquare, label: 'SMS', tone: 'text-emerald-600', bg: 'bg-emerald-500/10' },
  visit: { icon: CalendarCheck, label: 'Visita', tone: 'text-fuchsia-600', bg: 'bg-fuchsia-500/10' },
  note: { icon: StickyNote, label: 'Nota', tone: 'text-slate-600', bg: 'bg-slate-500/10' },
  observation: { icon: StickyNote, label: 'Nota', tone: 'text-slate-600', bg: 'bg-slate-500/10' },
  task: { icon: CheckSquare, label: 'Tarefa', tone: 'text-indigo-600', bg: 'bg-indigo-500/10' },
  event: { icon: Calendar, label: 'Evento agendado', tone: 'text-amber-600', bg: 'bg-amber-500/10' },
  stage_change: { icon: ArrowRightLeft, label: 'Mudança de fase', tone: 'text-indigo-600', bg: 'bg-indigo-500/10' },
  temperature_change: { icon: Thermometer, label: 'Mudança de temperatura', tone: 'text-rose-600', bg: 'bg-rose-500/10' },
  assignment: { icon: ArrowRightLeft, label: 'Atribuição', tone: 'text-slate-600', bg: 'bg-slate-500/10' },
  lifecycle_change: { icon: ArrowRightLeft, label: 'Ciclo de vida', tone: 'text-slate-600', bg: 'bg-slate-500/10' },
  system: { icon: RefreshCw, label: 'Sistema', tone: 'text-slate-500', bg: 'bg-slate-500/10' },
}

// Coloured pill for a call outcome stored in metadata.outcome.
const OUTCOME_PILL: Record<string, { label: string; className: string }> = {
  success: { label: 'Atendeu', className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
  no_answer: { label: 'Sem resposta', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  busy: { label: 'Ocupado', className: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30' },
  voicemail: { label: 'Voicemail', className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30' },
  failed: { label: 'Cancelado', className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30' },
}

interface PartnerActivity {
  id: string
  activity_type: string
  subject?: string | null
  description?: string | null
  created_at: string
  occurred_at?: string | null
  created_by_user?: { commercial_name?: string | null } | null
  metadata?: Record<string, unknown> | null
}

export function PartnerHistoricoTimeline({ activities }: { activities: PartnerActivity[] }) {
  if (!activities.length) {
    return (
      <PartnerEmptyHint
        icon={History}
        message="Ainda não há histórico nesta oportunidade."
      />
    )
  }

  // Agrupa por dia (data efectiva: occurred_at quando existe, senão created_at)
  const groups: { key: string; date: Date; items: PartnerActivity[] }[] = []
  const byKey = new Map<string, { key: string; date: Date; items: PartnerActivity[] }>()
  for (const a of activities) {
    const iso = a.occurred_at || a.created_at
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) continue
    const key = format(date, 'yyyy-MM-dd')
    let group = byKey.get(key)
    if (!group) {
      group = { key, date, items: [] }
      byKey.set(key, group)
      groups.push(group)
    }
    group.items.push(a)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold tracking-tight">Histórico</h3>
        <Badge variant="secondary" className="rounded-full text-[10px] px-2">
          {activities.length}
        </Badge>
      </div>

      {groups.map((group) => (
        <div key={group.key} className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground capitalize sticky top-0">
            {format(group.date, "EEEE, d 'de' MMMM yyyy", { locale: pt })}
          </p>
          <div className="relative pl-4 space-y-2 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-px before:bg-border/60">
            {group.items.map((a) => {
              const meta = HISTORICO_META[a.activity_type] || HISTORICO_META.system
              const Icon = meta.icon
              const author = a.created_by_user?.commercial_name || null
              const iso = a.occurred_at || a.created_at
              let time: string | null = null
              try {
                time = format(new Date(iso), 'HH:mm')
              } catch {
                time = null
              }
              return (
                <div
                  key={a.id}
                  className="relative flex items-start gap-3 rounded-2xl border border-border/40 bg-background shadow-sm p-3"
                >
                  <div
                    className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
                      meta.bg,
                    )}
                  >
                    <Icon className={cn('h-3.5 w-3.5', meta.tone)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium leading-tight truncate">
                        {a.subject || meta.label}
                      </p>
                      {time && time !== '00:00' && (
                        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                          {time}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                      {meta.label}
                    </p>
                    {(() => {
                      const m = a.metadata as { outcome?: string; direction?: string } | null
                      const pill = m?.outcome ? OUTCOME_PILL[m.outcome] : null
                      const dir = m?.direction
                      if (!pill && !dir) return null
                      return (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {pill && (
                            <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', pill.className)}>
                              {pill.label}
                            </span>
                          )}
                          {dir && (
                            <span className="inline-flex items-center rounded-full border border-border/50 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {dir === 'inbound' ? '↙ Recebida' : '↗ Enviada'}
                            </span>
                          )}
                        </div>
                      )
                    })()}
                    {a.description && (
                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line line-clamp-4">
                        {a.description}
                      </p>
                    )}
                    {author && (
                      <p className="text-[11px] text-muted-foreground/70 mt-1">por {author}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Empty state partilhado ─────────────────────────────────────────────

function PartnerEmptyHint({
  icon: Icon,
  message,
}: {
  icon: React.ComponentType<{ className?: string }>
  message: string
}) {
  return (
    <div className="rounded-2xl bg-background border border-border/50 shadow-sm p-6 flex flex-col items-center text-center">
      <Icon className="h-7 w-7 text-muted-foreground/40 mb-2" />
      <p className="text-xs text-muted-foreground max-w-[300px]">{message}</p>
    </div>
  )
}
