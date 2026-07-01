'use client'

/**
 * "Leads" and "Reach-out" tabs of a campaign's detail. Both consume the payload
 * from GET /api/analise-meta/campaigns/[id]/reach-out (stats + per-lead list).
 *
 *   Leads     — every CRM lead this campaign produced (contact, consultant,
 *               arrival, first contact, SLA, resulting deal).
 *   Reach-out — how fast leads got called, who's still waiting, and how many
 *               converted into won deals.
 */

import {
  Clock,
  Users,
  PhoneCall,
  Hourglass,
  Trophy,
  Timer,
  AlertTriangle,
  Loader2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatEur, formatMetaInt } from '@/lib/meta/labels'
import type { CampaignReachOut, ReachOutLead } from '@/lib/meta/campaign-reachout'

const GLASS = 'rounded-2xl border border-border/40 bg-card/60 shadow-sm backdrop-blur-xl'
const TH = 'text-right px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'

function fmtDuration(h: number | null): string {
  if (h === null || !Number.isFinite(h)) return '—'
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`
  if (h < 48) return `${h < 10 ? h.toFixed(1) : Math.round(h)}h`
  return `${Math.round(h / 24)} dias`
}

const SLA_BADGE: Record<string, { label: string; className: string }> = {
  breached: { label: 'SLA ultrapassado', className: 'bg-red-500/15 text-red-700 dark:text-red-300' },
  warning: { label: 'Em risco', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  on_time: { label: 'A tempo', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  pending: { label: 'Por contactar', className: 'bg-slate-500/15 text-slate-600 dark:text-slate-300' },
  completed: { label: 'Contactado', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
}

function DealBadge({ lead }: { lead: ReachOutLead }) {
  if (lead.deal_stage === 'won')
    return <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px]">Ganho{lead.deal_value ? ` · ${formatEur(lead.deal_value, 'EUR')}` : ''}</Badge>
  if (lead.deal_stage === 'lost')
    return <Badge variant="secondary" className="bg-red-500/10 text-red-600 dark:text-red-300 text-[10px]">Perdido</Badge>
  if (lead.deal_stage === 'open')
    return <Badge variant="secondary" className="bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[10px]">Em negócio</Badge>
  return <span className="text-muted-foreground/60 text-[11px]">—</span>
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className={`${GLASS} text-muted-foreground p-10 text-center text-sm`}>{children}</div>
}

function Loading() {
  return (
    <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
      <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
    </div>
  )
}

// ─── Leads tab ──────────────────────────────────────────────────────────────
export function CampaignLeadsTab({ data, loading }: { data: CampaignReachOut | null; loading: boolean }) {
  if (loading) return <Loading />
  if (!data || data.leads.length === 0)
    return <Empty>Ainda não há leads deste campanha no CRM.</Empty>

  // Contacted-first for this tab reads more naturally as a roster; sort by arrival desc.
  const rows = [...data.leads].sort((a, b) => (b.arrived_at ?? '').localeCompare(a.arrived_at ?? ''))

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Contacto</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Consultor</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Chegou</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Resposta</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Negócio</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const arrived = l.arrived_at
                ? new Date(l.arrived_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
                : '—'
              const overdue = l.sla_status === 'breached'
              return (
                <tr key={l.lead_id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <p className="font-medium leading-tight">{l.nome ?? 'Sem nome'}</p>
                    <p className="text-muted-foreground text-[11px] leading-tight">{l.email ?? l.phone ?? '—'}</p>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{l.agent_name ?? <span className="italic opacity-60">Por atribuir</span>}</td>
                  <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{arrived}</td>
                  <td className="px-3 py-2.5">
                    {l.first_contact_at ? (
                      <span className="text-emerald-600 dark:text-emerald-400">Contactado em {fmtDuration(l.hours_to_contact)}</span>
                    ) : (
                      <span className={cn('inline-flex items-center gap-1', overdue ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')}>
                        {overdue && <AlertTriangle className="h-3 w-3" />}
                        À espera há {fmtDuration(l.waiting_hours)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5"><DealBadge lead={l} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ─── Reach-out tab ──────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className={`${GLASS} p-4`}>
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
        <Icon className={cn('h-4 w-4', color)} />
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-muted-foreground/70 mt-0.5 text-[11px]">{sub}</p>}
    </div>
  )
}

function FunnelBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">
          {formatMetaInt(value)} <span className="text-muted-foreground/60">· {pct}%</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

export function CampaignReachOutTab({ data, loading }: { data: CampaignReachOut | null; loading: boolean }) {
  if (loading) return <Loading />
  if (!data || data.stats.leads === 0)
    return <Empty>Sem leads no CRM para medir o tempo de resposta.</Empty>

  const s = data.stats
  const convRate = s.leads > 0 ? Math.round((s.won / s.leads) * 100) : 0
  const contactRate = s.leads > 0 ? Math.round((s.contacted / s.leads) * 100) : 0
  const waiting = data.leads.filter((l) => !l.first_contact_at).slice(0, 25)

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={Users} label="Leads no CRM" value={formatMetaInt(s.leads)} />
        <StatCard icon={PhoneCall} label="Contactados" value={formatMetaInt(s.contacted)} sub={`${contactRate}% do total`} color="text-emerald-600" />
        <StatCard icon={Hourglass} label="À espera" value={formatMetaInt(s.waiting)} sub={s.breached ? `${s.breached} fora do SLA` : undefined} color="text-amber-600" />
        <StatCard icon={Timer} label="Tempo médio 1º contacto" value={fmtDuration(s.avgHoursToContact)} sub={s.medianHoursToContact !== null ? `mediana ${fmtDuration(s.medianHoursToContact)}` : undefined} color="text-[#1877F2]" />
        <StatCard icon={Trophy} label="Ganhos" value={formatMetaInt(s.won)} sub={`${convRate}% de conversão`} color="text-emerald-600" />
        <StatCard icon={Trophy} label="Valor ganho" value={s.wonValue > 0 ? formatEur(s.wonValue, 'EUR') : '—'} color="text-emerald-600" />
      </div>

      {/* Funnel */}
      <div className={`${GLASS} space-y-3 p-4`}>
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Funil de resposta</p>
        <FunnelBar label="Leads no CRM" value={s.leads} total={s.leads} color="#0ea5e9" />
        <FunnelBar label="Contactados" value={s.contacted} total={s.leads} color="#10b981" />
        <FunnelBar label="Em negócio / qualificados" value={s.qualified} total={s.leads} color="#6366f1" />
        <FunnelBar label="Ganhos" value={s.won} total={s.leads} color="#059669" />
      </div>

      {/* Waiting to be called */}
      <section className="space-y-2.5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="text-muted-foreground h-3.5 w-3.5" />
          À espera de contacto
          {waiting.length > 0 && <Badge variant="secondary" className="text-[10px]">{s.waiting}</Badge>}
        </h3>
        {waiting.length === 0 ? (
          <div className={`${GLASS} text-muted-foreground p-6 text-center text-sm`}>Todos os leads já foram contactados. 🎉</div>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Contacto</th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Consultor</th>
                    <th className={TH}>À espera há</th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {waiting.map((l) => {
                    const sla = l.sla_status ? SLA_BADGE[l.sla_status] : null
                    const overdue = l.sla_status === 'breached'
                    return (
                      <tr key={l.lead_id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2.5">
                          <p className="font-medium leading-tight">{l.nome ?? 'Sem nome'}</p>
                          <p className="text-muted-foreground text-[11px] leading-tight">{l.email ?? l.phone ?? '—'}</p>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{l.agent_name ?? <span className="italic opacity-60">Por atribuir</span>}</td>
                        <td className={cn('px-3 py-2.5 text-right tabular-nums font-medium', overdue && 'text-red-600 dark:text-red-400')}>
                          {overdue && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                          {fmtDuration(l.waiting_hours)}
                        </td>
                        <td className="px-3 py-2.5">
                          {sla ? <Badge variant="secondary" className={cn('text-[10px]', sla.className)}>{sla.label}</Badge> : <span className="text-muted-foreground/60 text-[11px]">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>
    </div>
  )
}
