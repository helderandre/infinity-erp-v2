'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { AnimatedNumber } from '@/components/shared/animated-number'
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

  // Render the layout immediately with zero defaults; AnimatedNumber tweens
  // each KPI from 0 → real value when data arrives. This replaces the
  // skeleton-block flash that made the dashboard feel slow on cold loads.
  const a = data?.angariacoes ?? {
    previsoes: { a_entrar: 0 },
    activas: { ativas: 0, disponiveis: 0, reservadas: 0 },
    fechadas: { report_mes: 0, report_ano: 0 },
  }
  const c = data?.crm ?? {
    previsoes: { a_fechar_mes: 0, receita_prevista: 0, pipeline_ponderado: 0 },
    activas: { em_curso: 0, visitas: 0, propostas: 0 },
    fechadas: { ganhos_mes: 0, ganhos_ano: 0 },
  }
  const interactive = !loading && !!data
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
          numericValue={a.previsoes.a_entrar}
          onClick={interactive ? () =>
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
            }) : undefined
          }
        />
        <KpiTile
          icon={Building2}
          tone="info"
          label="Activas"
          numericValue={a.activas.ativas}
          onClick={interactive ? () =>
            open({
              title: 'Imóveis Activos',
              tone: 'info',
              fetcher: () =>
                getDrillDownProperties({
                  consultant_id: consultantId,
                  status: ['active', 'available'],
                }),
            }) : undefined
          }
        />
        <KpiTile
          icon={CircleCheck}
          tone="positive"
          label="Disponíveis"
          numericValue={a.activas.disponiveis}
          onClick={interactive ? () =>
            open({
              title: 'Imóveis Disponíveis',
              tone: 'positive',
              fetcher: () =>
                getDrillDownProperties({
                  consultant_id: consultantId,
                  status: 'available',
                }),
            }) : undefined
          }
        />
        <KpiTile
          icon={Lock}
          tone="purple"
          label="Reservadas"
          numericValue={a.activas.reservadas}
          onClick={interactive ? () =>
            open({
              title: 'Imóveis Reservados',
              tone: 'purple',
              fetcher: () =>
                getDrillDownProperties({
                  consultant_id: consultantId,
                  status: 'reserved',
                }),
            }) : undefined
          }
        />
      </div>

      <Subsection label="Fechadas" />
      <div className="grid grid-cols-2 gap-3">
        <KpiTile
          icon={Receipt}
          tone="positive"
          label="Report este mês"
          numericValue={a.fechadas.report_mes}
          format={fmtCompact.format}
          onClick={interactive ? () =>
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
            }) : undefined
          }
        />
        <KpiTile
          icon={Receipt}
          tone="positive"
          label="Report este ano"
          numericValue={a.fechadas.report_ano}
          format={fmtCompact.format}
          onClick={interactive ? () =>
            open({
              title: 'Report Este Ano',
              tone: 'positive',
              fetcher: () =>
                getDrillDownTransactions({
                  consultant_id: consultantId,
                  date_from: yearFrom,
                  status: 'paid',
                }),
            }) : undefined
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
          numericValue={c.previsoes.a_fechar_mes}
          onClick={interactive ? () =>
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
            }) : undefined
          }
        />
        <KpiTile
          icon={Sparkles}
          tone="warning"
          label="Receita prevista"
          numericValue={c.previsoes.receita_prevista}
          format={fmtCompact.format}
          onClick={interactive ? () =>
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
            }) : undefined
          }
        />
        <KpiTile
          icon={TrendingUp}
          tone="info"
          label="Pipeline ponderado"
          numericValue={c.previsoes.pipeline_ponderado}
          format={fmtCompact.format}
          onClick={interactive ? () =>
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
            }) : undefined
          }
        />
      </div>

      <Subsection label="Activas" />
      <div className="grid grid-cols-3 gap-3">
        <KpiTile
          icon={Handshake}
          tone="info"
          label="Em curso"
          numericValue={c.activas.em_curso}
          onClick={interactive ? () =>
            open({
              title: 'Negócios em Curso',
              tone: 'info',
              fetcher: () =>
                getDrillDownNegocios({
                  assigned_consultant_id: consultantId,
                  pipeline_types: ['comprador', 'arrendatario'],
                  not_terminal: true,
                }),
            }) : undefined
          }
        />
        <KpiTile
          icon={MapPin}
          tone="purple"
          label="Visitas"
          numericValue={c.activas.visitas}
          onClick={interactive ? () =>
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
            }) : undefined
          }
        />
        <KpiTile
          icon={FileText}
          tone="warning"
          label="Propostas"
          numericValue={c.activas.propostas}
          onClick={interactive ? () =>
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
            }) : undefined
          }
        />
      </div>

      <Subsection label="Fechadas" />
      <div className="grid grid-cols-2 gap-3">
        <KpiTile
          icon={Trophy}
          tone="positive"
          label="Ganhos este mês"
          numericValue={c.fechadas.ganhos_mes}
          onClick={interactive ? () =>
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
            }) : undefined
          }
        />
        <KpiTile
          icon={Trophy}
          tone="positive"
          label="Ganhos este ano"
          numericValue={c.fechadas.ganhos_ano}
          onClick={interactive ? () =>
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
            }) : undefined
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
  numericValue,
  format,
  tone,
  onClick,
}: {
  icon: React.ElementType
  label: string
  value?: string
  numericValue?: number
  format?: (n: number) => string
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
        {numericValue !== undefined ? (
          <AnimatedNumber value={numericValue} format={format} />
        ) : (
          value
        )}
      </p>
    </Component>
  )
}
