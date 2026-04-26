'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Building2,
  Handshake,
  ArrowRightToLine,
  CircleCheck,
  Lock,
  Receipt,
  Target,
  Sparkles,
  TrendingUp,
  MapPin,
  FileText,
  Trophy,
} from 'lucide-react'
import type { AgentMobileDashboard } from '@/app/dashboard/financeiro/actions'
import {
  getDrillDownProperties,
  getDrillDownNegocios,
  getDrillDownTransactions,
} from '@/app/dashboard/drill-down-actions'
import { cn } from '@/lib/utils'
import {
  MobileDrillDownSheet,
  type MobileDrillDownConfig,
} from './mobile-drill-down-sheet'

const fmtCompact = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

interface AngariacoesFaturacaoCardProps {
  data: AgentMobileDashboard | null
  loading: boolean
  consultantId: string
  fillViewport?: boolean
}

function startOfMonthIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function endOfMonthIso() {
  const d = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfYearIso() {
  return `${new Date().getFullYear()}-01-01`
}

export function AngariacoesFaturacaoCard({
  data,
  loading,
  consultantId,
  fillViewport,
}: AngariacoesFaturacaoCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetConfig, setSheetConfig] = useState<MobileDrillDownConfig | null>(
    null,
  )
  const open = (config: MobileDrillDownConfig) => {
    setSheetConfig(config)
    setSheetOpen(true)
  }

  const cardClass = cn(
    'rounded-3xl border-0 ring-1 ring-border/50 bg-gradient-to-br from-background/80 to-muted/20 backdrop-blur-sm shadow-[0_2px_24px_-12px_rgb(0_0_0_/_0.12)] p-5 gap-5 overflow-y-auto',
    fillViewport &&
      'h-[calc(100dvh-env(safe-area-inset-top,0px)-var(--mobile-nav-height,5rem)-6rem)] min-h-[24rem]',
  )

  if (loading || !data) {
    return (
      <Card className={cardClass}>
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-8 w-48 mt-3" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </Card>
    )
  }

  const a = data.angariacoes
  const c = data.crm
  const monthFrom = startOfMonthIso()
  const monthTo = endOfMonthIso()
  const yearFrom = startOfYearIso()

  return (
    <Card className={cardClass}>
      {/* ─── ANGARIAÇÕES ─── */}
      <SectionHeader icon={Building2} title="Angariações" />

      <Subsection label="Activas" />
      <div className="grid grid-cols-2 gap-3">
        <KpiTile
          icon={ArrowRightToLine}
          tone="warning"
          label="A entrar"
          value={String(a.previsoes.a_entrar)}
          onClick={() =>
            open({
              title: 'Angariações A Entrar',
              description: 'Negócios com ≥70% probabilidade',
              tone: 'warning',
              fetcher: () =>
                getDrillDownNegocios({
                  assigned_consultant_id: consultantId,
                  pipeline_types: ['vendedor', 'arrendador'],
                  not_terminal: true,
                  min_probability_pct: 70,
                }),
            })
          }
        />
        <KpiTile
          icon={Building2}
          tone="info"
          label="Activas"
          value={String(a.activas.ativas)}
          onClick={() =>
            open({
              title: 'Imóveis Activos',
              tone: 'info',
              fetcher: () =>
                getDrillDownProperties({
                  consultant_id: consultantId,
                  status: ['active', 'available'],
                }),
            })
          }
        />
        <KpiTile
          icon={CircleCheck}
          tone="positive"
          label="Disponíveis"
          value={String(a.activas.disponiveis)}
          onClick={() =>
            open({
              title: 'Imóveis Disponíveis',
              tone: 'positive',
              fetcher: () =>
                getDrillDownProperties({
                  consultant_id: consultantId,
                  status: 'available',
                }),
            })
          }
        />
        <KpiTile
          icon={Lock}
          tone="purple"
          label="Reservadas"
          value={String(a.activas.reservadas)}
          onClick={() =>
            open({
              title: 'Imóveis Reservados',
              tone: 'purple',
              fetcher: () =>
                getDrillDownProperties({
                  consultant_id: consultantId,
                  status: 'reserved',
                }),
            })
          }
        />
      </div>

      <Subsection label="Fechadas" />
      <div className="grid grid-cols-2 gap-3">
        <KpiTile
          icon={Receipt}
          tone="positive"
          label="Report este mês"
          value={fmtCompact.format(a.fechadas.report_mes)}
          onClick={() =>
            open({
              title: 'Report Este Mês',
              tone: 'positive',
              fetcher: () =>
                getDrillDownTransactions({
                  consultant_id: consultantId,
                  date_from: monthFrom,
                  date_to: monthTo,
                  status: 'paid',
                }),
            })
          }
        />
        <KpiTile
          icon={Receipt}
          tone="positive"
          label="Report este ano"
          value={fmtCompact.format(a.fechadas.report_ano)}
          onClick={() =>
            open({
              title: 'Report Este Ano',
              tone: 'positive',
              fetcher: () =>
                getDrillDownTransactions({
                  consultant_id: consultantId,
                  date_from: yearFrom,
                  status: 'paid',
                }),
            })
          }
        />
      </div>

      <div className="h-px bg-border/40 my-2" />

      {/* ─── CRM (Compradores + Arrendatários) ─── */}
      <SectionHeader icon={Handshake} title="Compradores & Arrendatários" />

      <Subsection label="Previsões" />
      <div className="grid grid-cols-3 gap-3">
        <KpiTile
          icon={Target}
          tone="warning"
          label="A fechar este mês"
          value={String(c.previsoes.a_fechar_mes)}
          onClick={() =>
            open({
              title: 'Negócios a Fechar Este Mês',
              tone: 'warning',
              fetcher: () =>
                getDrillDownNegocios({
                  assigned_consultant_id: consultantId,
                  pipeline_types: ['comprador', 'arrendatario'],
                  not_terminal: true,
                  expected_close_from: monthFrom,
                  expected_close_to: monthTo,
                }),
            })
          }
        />
        <KpiTile
          icon={Sparkles}
          tone="warning"
          label="Receita prevista"
          value={fmtCompact.format(c.previsoes.receita_prevista)}
          onClick={() =>
            open({
              title: 'Receita Prevista',
              description: 'Valor esperado de negócios a fechar este mês',
              tone: 'warning',
              fetcher: () =>
                getDrillDownNegocios({
                  assigned_consultant_id: consultantId,
                  pipeline_types: ['comprador', 'arrendatario'],
                  not_terminal: true,
                  expected_close_from: monthFrom,
                  expected_close_to: monthTo,
                }),
            })
          }
        />
        <KpiTile
          icon={TrendingUp}
          tone="info"
          label="Pipeline ponderado"
          value={fmtCompact.format(c.previsoes.pipeline_ponderado)}
          onClick={() =>
            open({
              title: 'Pipeline Ponderado',
              description: 'Valor × probabilidade por negócio',
              tone: 'info',
              fetcher: () =>
                getDrillDownNegocios({
                  assigned_consultant_id: consultantId,
                  pipeline_types: ['comprador', 'arrendatario'],
                  not_terminal: true,
                }),
            })
          }
        />
      </div>

      <Subsection label="Activas" />
      <div className="grid grid-cols-3 gap-3">
        <KpiTile
          icon={Handshake}
          tone="info"
          label="Em curso"
          value={String(c.activas.em_curso)}
          onClick={() =>
            open({
              title: 'Negócios em Curso',
              tone: 'info',
              fetcher: () =>
                getDrillDownNegocios({
                  assigned_consultant_id: consultantId,
                  pipeline_types: ['comprador', 'arrendatario'],
                  not_terminal: true,
                }),
            })
          }
        />
        <KpiTile
          icon={MapPin}
          tone="purple"
          label="Visitas"
          value={String(c.activas.visitas)}
          onClick={() =>
            open({
              title: 'Negócios em Visitas',
              tone: 'purple',
              fetcher: () =>
                getDrillDownNegocios({
                  assigned_consultant_id: consultantId,
                  pipeline_types: ['comprador', 'arrendatario'],
                  not_terminal: true,
                  stage_names: ['visitas'],
                }),
            })
          }
        />
        <KpiTile
          icon={FileText}
          tone="warning"
          label="Propostas"
          value={String(c.activas.propostas)}
          onClick={() =>
            open({
              title: 'Propostas em Curso',
              tone: 'warning',
              fetcher: () =>
                getDrillDownNegocios({
                  assigned_consultant_id: consultantId,
                  pipeline_types: ['comprador', 'arrendatario'],
                  not_terminal: true,
                  stage_names: ['proposta', 'proposta aceite'],
                }),
            })
          }
        />
      </div>

      <Subsection label="Fechadas" />
      <div className="grid grid-cols-2 gap-3">
        <KpiTile
          icon={Trophy}
          tone="positive"
          label="Ganhos este mês"
          value={String(c.fechadas.ganhos_mes)}
          onClick={() =>
            open({
              title: 'Negócios Ganhos Este Mês',
              tone: 'positive',
              fetcher: () =>
                getDrillDownNegocios({
                  assigned_consultant_id: consultantId,
                  pipeline_types: ['comprador', 'arrendatario'],
                  terminal_type: 'won',
                  won_from: monthFrom,
                }),
            })
          }
        />
        <KpiTile
          icon={Trophy}
          tone="positive"
          label="Ganhos este ano"
          value={String(c.fechadas.ganhos_ano)}
          onClick={() =>
            open({
              title: 'Negócios Ganhos Este Ano',
              tone: 'positive',
              fetcher: () =>
                getDrillDownNegocios({
                  assigned_consultant_id: consultantId,
                  pipeline_types: ['comprador', 'arrendatario'],
                  terminal_type: 'won',
                  won_from: yearFrom,
                }),
            })
          }
        />
      </div>

      <MobileDrillDownSheet
        config={sheetConfig}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </Card>
  )
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ElementType
  title: string
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="h-8 w-8 rounded-full bg-neutral-100 dark:bg-white/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="text-base font-semibold tracking-tight leading-tight truncate">
        {title}
      </h3>
    </div>
  )
}

function Subsection({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider px-1">
      {label}
    </p>
  )
}

function KpiTile({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: React.ElementType
  label: string
  value: string
  tone: 'positive' | 'negative' | 'info' | 'warning' | 'purple'
  onClick?: () => void
}) {
  const toneMap = {
    positive: { from: 'from-emerald-500/15', icon: 'text-emerald-600', accent: 'bg-emerald-500/60' },
    negative: { from: 'from-red-500/15', icon: 'text-red-600', accent: 'bg-red-500/60' },
    info: { from: 'from-blue-500/15', icon: 'text-blue-600', accent: 'bg-blue-500/60' },
    warning: { from: 'from-amber-500/15', icon: 'text-amber-600', accent: 'bg-amber-500/60' },
    purple: { from: 'from-purple-500/15', icon: 'text-purple-600', accent: 'bg-purple-500/60' },
  }[tone]

  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-2xl bg-gradient-to-br to-transparent text-left w-full',
        'ring-1 ring-border/40 p-4 transition-all duration-300',
        'hover:ring-border/70 hover:shadow-[0_4px_20px_-4px_rgb(0_0_0_/_0.08)]',
        onClick &&
          'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        toneMap.from,
      )}
    >
      <span
        className={cn(
          'absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full',
          toneMap.accent,
        )}
      />
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4 shrink-0', toneMap.icon)} />
        <p className="text-[11px] text-muted-foreground font-medium leading-tight">
          {label}
        </p>
      </div>
      <p className="text-base sm:text-xl font-semibold tracking-tight tabular-nums mt-2.5 text-foreground break-words">
        {value}
      </p>
    </Component>
  )
}
