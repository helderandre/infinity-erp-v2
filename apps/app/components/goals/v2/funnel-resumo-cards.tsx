'use client'

import type { AgentGoalInput, ComputedTargets } from '@/types/agent-goal'
import { FunnelListRow } from './funnel-list-row'
import { ratioToPct } from './inline-number-input'
import { formatCurrency, cn } from '@/lib/utils'
import { AddActivityDialog } from './add-activity-dialog'
import type { FunnelStage } from '@/types/funnel-event'
import {
  Phone, Search, FileText, Tag, Eye, FileSignature, KeyRound,
  ShoppingCart, Clock3, Plus,
} from 'lucide-react'

export type Period = 'ano' | 'mes' | 'semana' | 'dia' | 'fecho'

interface SideAvgStats {
  avg_days: number | null
  count: number
}

// Picker lists exclude stages that are auto-only (see MANUAL_BLOCKED_STAGES).
const COMPRADOR_STAGES: { value: FunnelStage; label: string }[] = [
  { value: 'contacto', label: 'Contactos' },
  { value: 'visita', label: 'Visitas' },
  { value: 'proposta', label: 'Propostas' },
]

const VENDEDOR_STAGES: { value: FunnelStage; label: string }[] = [
  { value: 'contacto', label: 'Contactos' },
  { value: 'estudo', label: 'Estudos de Mercado' },
  { value: 'visita', label: 'Visitas' },
  { value: 'proposta', label: 'Propostas' },
]

// (Period type re-declared above as an export.)


// Returns multiplier (applied to annual count) and the suffix string.
// 'fecho' is per-side: caller passes the side's escritura count as `sideEscrituras`.
// 'dia' uses working_days_per_week × working_weeks_per_year as the divisor.
function periodScaling(
  period: Period,
  weeksPerYear: number,
  daysPerWeek: number,
  sideEscrituras: number,
): { factor: number; suffix: string } {
  const workingDays = Math.max(1, weeksPerYear) * Math.max(1, daysPerWeek)
  switch (period) {
    case 'mes':    return { factor: 1 / 12, suffix: '/mês' }
    case 'semana': return { factor: 1 / Math.max(1, weeksPerYear), suffix: '/sem' }
    case 'dia':    return { factor: 1 / workingDays, suffix: '/dia' }
    case 'fecho':  return { factor: sideEscrituras > 0 ? 1 / sideEscrituras : 0, suffix: '/fecho' }
    default:       return { factor: 1, suffix: '/ano' }
  }
}

// Standalone period selector. Used at the page level so the same period
// scopes both side cards.
export function PeriodToggle({
  period,
  setPeriod,
}: {
  period: Period
  setPeriod: (p: Period) => void
}) {
  return (
    <div className="flex items-center justify-center">
      <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/50 border border-border/30">
        {(['ano', 'mes', 'semana', 'dia', 'fecho'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors',
              period === p
                ? 'bg-background text-foreground shadow-sm'
                : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-background/40'
            )}
          >
            {p === 'ano' ? 'Ano' : p === 'mes' ? 'Mês' : p === 'semana' ? 'Semana' : p === 'dia' ? 'Diário' : 'Fecho'}
          </button>
        ))}
      </div>
    </div>
  )
}

// ───────────────────────── Comprador card ──────────────────────────────────

export function CompradorListCard({
  goal, targets, period, avgClose, windowMonths, realized, onRefresh,
}: {
  goal: AgentGoalInput
  targets: ComputedTargets
  period: Period
  avgClose: SideAvgStats | null
  windowMonths: number
  realized: Partial<Record<FunnelStage, { total: number; manual: number }>>
  onRefresh: () => void
}) {
  const { factor, suffix } = periodScaling(
    period,
    goal.working_weeks_per_year,
    goal.working_days_per_week,
    targets.comp_target_escrituras,
  )
  const r = (s: FunnelStage) => realized[s] ?? { total: 0, manual: 0 }

  const commissionPerClose = goal.comp_avg_purchase_value_eur * (goal.comp_commission_pct / 100) * 0.5
  const totalConversion = targets.comp_target_contactos > 0
    ? (targets.comp_target_escrituras / targets.comp_target_contactos) * 100
    : 0

  return (
    <section className="rounded-2xl border border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-sm p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          <h3 className="text-base font-medium leading-snug">Compradores</h3>
        </div>
        <AddActivityDialog
          side="comprador"
          stages={COMPRADOR_STAGES}
          onSuccess={onRefresh}
          trigger={
            <button
              type="button"
              aria-label="Adicionar atividade"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/40 bg-background/60 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:border-border/70 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          }
        />
      </div>

      <div className="divide-y divide-border/30">
        <FunnelListRow
          index={1}
          icon={Phone}
          label="Contactos"
          count={targets.comp_target_contactos * factor}
          periodSuffix={suffix}
          subtitle={`A cada ${goal.comp_contactos_per_pesquisa} contactos, começo pesquisas com 1 cliente`}
          realizedYtd={r('contacto').total}
          realizedManual={r('contacto').manual}
          annualTarget={targets.comp_target_contactos}
        />
        <FunnelListRow
          index={2}
          icon={Search}
          label="Pesquisas (clientes activos)"
          count={targets.comp_target_pesquisas * factor}
          periodSuffix={suffix}
          subtitle={`${ratioToPct(goal.comp_pesquisas_per_visita)}% destes clientes começam visitas`}
          realizedYtd={r('pesquisa').total}
          realizedManual={r('pesquisa').manual}
          annualTarget={targets.comp_target_pesquisas}
        />
        <FunnelListRow
          index={3}
          icon={Eye}
          label="Visitas"
          count={targets.comp_target_visitas * factor}
          periodSuffix={suffix}
          subtitle={`O cliente precisa de ${goal.comp_visitas_per_proposta} visitas até apresentar uma proposta`}
          realizedYtd={r('visita').total}
          realizedManual={r('visita').manual}
          annualTarget={targets.comp_target_visitas}
        />
        <FunnelListRow
          index={4}
          icon={FileSignature}
          label="Propostas"
          count={targets.comp_target_propostas * factor}
          periodSuffix={suffix}
          subtitle={`Só à ${goal.comp_propostas_per_cpcv}ª proposta se fecha um CPCV`}
          realizedYtd={r('proposta').total}
          realizedManual={r('proposta').manual}
          annualTarget={targets.comp_target_propostas}
        />
        <FunnelListRow
          index={5}
          icon={KeyRound}
          label="Fechos"
          count={targets.comp_target_cpcvs * factor}
          periodSuffix={suffix}
          emphasis="terminal"
          subtitle="cada CPCV = 1 escritura · se um cair, planeia +1 negócio"
          realizedYtd={(r('cpcv').total + r('fecho').total)}
          realizedManual={(r('cpcv').manual + r('fecho').manual)}
          annualTarget={targets.comp_target_cpcvs}
        />
      </div>

      <CardFooter
        conversion={totalConversion}
        targetEur={targets.comp_projected_revenue_eur}
        commissionPerClose={commissionPerClose}
        avgClose={avgClose}
        windowMonths={windowMonths}
      />
    </section>
  )
}

// ───────────────────────── Vendedor card ───────────────────────────────────

export function VendedorListCard({
  goal, targets, period, avgClose, windowMonths, realized, onRefresh,
}: {
  goal: AgentGoalInput
  targets: ComputedTargets
  period: Period
  avgClose: SideAvgStats | null
  windowMonths: number
  realized: Partial<Record<FunnelStage, { total: number; manual: number }>>
  onRefresh: () => void
}) {
  const { factor, suffix } = periodScaling(
    period,
    goal.working_weeks_per_year,
    goal.working_days_per_week,
    targets.vend_target_escrituras,
  )
  const r = (s: FunnelStage) => realized[s] ?? { total: 0, manual: 0 }

  const commissionPerClose = goal.vendedor_avg_sale_value_eur * (goal.vendedor_commission_pct / 100) * 0.5
  const totalConversion = targets.vend_target_contactos > 0
    ? (targets.vend_target_escrituras / targets.vend_target_contactos) * 100
    : 0

  return (
    <section className="rounded-2xl border border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-sm p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          <h3 className="text-base font-medium leading-snug">Vendedores</h3>
        </div>
        <AddActivityDialog
          side="vendedor"
          stages={VENDEDOR_STAGES}
          onSuccess={onRefresh}
          trigger={
            <button
              type="button"
              aria-label="Adicionar atividade"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/40 bg-background/60 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:border-border/70 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          }
        />
      </div>

      {/* Captação sub-section */}
      <SectionLabel>Captação</SectionLabel>
      <div className="divide-y divide-border/30">
        <FunnelListRow
          index={1}
          icon={Phone}
          label="Contactos"
          count={targets.vend_target_contactos * factor}
          periodSuffix={suffix}
          subtitle={`A cada ${goal.vend_contactos_per_pre_angariacao} contactos, faço uma pré-angariação`}
          realizedYtd={r('contacto').total}
          realizedManual={r('contacto').manual}
          annualTarget={targets.vend_target_contactos}
        />
        <FunnelListRow
          index={2}
          icon={Search}
          label="Pré-angariações"
          count={targets.vend_target_pre_angariacoes * factor}
          periodSuffix={suffix}
          subtitle={`Envio estudos a ${ratioToPct(goal.vend_pre_angariacoes_per_estudo)}% destes clientes`}
          realizedYtd={r('pre_angariacao').total}
          realizedManual={r('pre_angariacao').manual}
          annualTarget={targets.vend_target_pre_angariacoes}
        />
        <FunnelListRow
          index={3}
          icon={FileText}
          label="Estudos de Mercado"
          count={targets.vend_target_estudos * factor}
          periodSuffix={suffix}
          subtitle={`${ratioToPct(goal.vend_estudos_per_angariacao)}% dos estudos resultam numa angariação`}
          realizedYtd={r('estudo').total}
          realizedManual={r('estudo').manual}
          annualTarget={targets.vend_target_estudos}
        />
        <FunnelListRow
          index={4}
          icon={Tag}
          label="Angariações"
          count={targets.vend_target_angariacoes * factor}
          periodSuffix={suffix}
          subtitle={`${ratioToPct(goal.vend_angariacoes_per_escritura)}% das angariações dão em fecho (ponte para fechos)`}
          realizedYtd={r('angariacao').total}
          realizedManual={r('angariacao').manual}
          annualTarget={targets.vend_target_angariacoes}
        />
      </div>

      {/* Atividade sub-section */}
      <SectionLabel>Atividade até ao fecho</SectionLabel>
      <div className="divide-y divide-border/30">
        <FunnelListRow
          index={5}
          icon={Eye}
          label="Visitas"
          count={targets.vend_target_visitas * factor}
          periodSuffix={suffix}
          subtitle={`Necessito de ${goal.vend_visitas_per_proposta} visitas até receber uma proposta`}
          realizedYtd={r('visita').total}
          realizedManual={r('visita').manual}
          annualTarget={targets.vend_target_visitas}
        />
        <FunnelListRow
          index={6}
          icon={FileSignature}
          label="Propostas"
          count={targets.vend_target_propostas * factor}
          periodSuffix={suffix}
          subtitle={`Só à ${goal.vend_propostas_per_cpcv}ª proposta se fecha um CPCV`}
          realizedYtd={r('proposta').total}
          realizedManual={r('proposta').manual}
          annualTarget={targets.vend_target_propostas}
        />
        <FunnelListRow
          index={7}
          icon={KeyRound}
          label="Fechos"
          count={targets.vend_target_cpcvs * factor}
          periodSuffix={suffix}
          emphasis="terminal"
          subtitle="cada CPCV = 1 escritura · se um cair, planeia +1 negócio"
          realizedYtd={(r('cpcv').total + r('fecho').total)}
          realizedManual={(r('cpcv').manual + r('fecho').manual)}
          annualTarget={targets.vend_target_cpcvs}
        />
      </div>

      <CardFooter
        conversion={totalConversion}
        targetEur={targets.vend_projected_revenue_eur}
        commissionPerClose={commissionPerClose}
        avgClose={avgClose}
        windowMonths={windowMonths}
      />
    </section>
  )
}

// ───────────────────────── shared bits ─────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      <span>{children}</span>
      <div className="h-px flex-1 bg-border/40" />
    </div>
  )
}

function CardFooter({
  conversion,
  targetEur,
  commissionPerClose,
  avgClose,
  windowMonths,
}: {
  conversion: number
  targetEur: number
  commissionPerClose: number
  avgClose: SideAvgStats | null
  windowMonths: number
}) {
  // Each fecho is collected 50/50: half at CPCV signing, half at escritura
  const halfPerClose = commissionPerClose / 2
  const hasAvg = avgClose && avgClose.avg_days != null && avgClose.count > 0

  return (
    <div className="mt-4 space-y-2 border-t border-border/30 pt-3">
      <div className="grid grid-cols-3 gap-2">
        <FooterStat label="Conv. total" value={`${conversion.toFixed(1)}%`} />
        <FooterStat label="Objetivo" value={formatCurrency(targetEur)} />
        <FooterStat label="Comissão/fecho" value={formatCurrency(commissionPerClose)} />
      </div>
      <p className="text-center text-[10px] text-muted-foreground/80">
        Por fecho: <strong className="text-foreground">{formatCurrency(halfPerClose)}</strong> no CPCV
        {' + '}
        <strong className="text-foreground">{formatCurrency(halfPerClose)}</strong> na escritura
      </p>

      {/* Tempo médio até fecho — observed from negocios with won_date set */}
      <div className="flex items-center justify-center gap-1.5 rounded-xl border border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-sm px-3 py-2">
        <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
        {hasAvg ? (
          <span className="text-[11px] text-foreground">
            <strong className="text-sm font-bold tabular-nums">{avgClose!.avg_days}</strong>
            <span className="text-muted-foreground"> dias até fecho</span>
            <span className="ml-1 text-muted-foreground/70">
              ({avgClose!.count} {avgClose!.count === 1 ? 'fecho' : 'fechos'} · últimos {windowMonths}m)
            </span>
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/70">
            Sem fechos registados nos últimos {windowMonths} meses
          </span>
        )}
      </div>
    </div>
  )
}

function FooterStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-bold tabular-nums">{value}</div>
    </div>
  )
}
