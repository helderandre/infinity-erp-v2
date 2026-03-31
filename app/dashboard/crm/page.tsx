'use client'

import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { KanbanBoard } from '@/components/crm/kanban-board'
import {
  ShoppingCart,
  Store,
  Key,
  Building2,
  TrendingUp,
  Briefcase,
  Euro,
  Kanban,
  Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CsvExportDialog } from '@/components/shared/csv-export-dialog'
import {
  PIPELINE_TYPE_LABELS,
  PIPELINE_TYPE_COLORS,
} from '@/lib/constants-leads-crm'
import type { PipelineType } from '@/types/leads-crm'
import { cn } from '@/lib/utils'

const PIPELINE_TYPES: PipelineType[] = ['comprador', 'vendedor', 'arrendatario', 'arrendador']

const PIPELINE_ICONS: Record<PipelineType, React.ElementType> = {
  comprador: ShoppingCart,
  vendedor: Store,
  arrendatario: Key,
  arrendador: Building2,
}

const formatEUR = (value: number) =>
  new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
  }).format(value)

// ─── Summary bar ──────────────────────────────────────────────────────────────

interface SummaryData {
  negocios: number
  expected_value: number
  weighted_value: number
}

function SummaryBar({ pipelineType }: { pipelineType: PipelineType }) {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setData(null)
    fetch(`/api/crm/kanban/${pipelineType}`)
      .then((r) => r.json())
      .then((json) => {
        if (json?.totals) setData(json.totals)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [pipelineType])

  const stats = [
    { icon: Briefcase, label: 'Negocios activos', value: loading ? null : String(data?.negocios ?? 0) },
    { icon: Euro, label: 'Valor total', value: loading ? null : formatEUR(data?.expected_value ?? 0) },
    { icon: TrendingUp, label: 'Valor ponderado', value: loading ? null : formatEUR(data?.weighted_value ?? 0) },
  ]

  return (
    <div className="flex items-center gap-2">
      {stats.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-center gap-2 rounded-full bg-card/70 backdrop-blur-sm border border-border/30 shadow-sm px-3.5 py-1.5">
          <div className="p-1 rounded-full bg-muted/60">
            <Icon className="h-3 w-3 text-muted-foreground" />
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{label}</span>
          {loading ? (
            <Skeleton className="h-4 w-12" />
          ) : (
            <span className="text-xs font-bold whitespace-nowrap">{value}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CRMPage() {
  const [activeTab, setActiveTab] = useState<PipelineType>('comprador')
  const [exportOpen, setExportOpen] = useState(false)

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-8 py-10 sm:px-10 sm:py-12">
          <div className="flex items-center gap-2 mb-2">
            <Kanban className="h-5 w-5 text-neutral-400" />
            <p className="text-neutral-400 text-xs font-medium tracking-widest uppercase">Pipeline</p>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">CRM</h2>
          <p className="text-neutral-400 mt-1.5 text-sm leading-relaxed max-w-md">
            Gestao de negocios e pipeline de vendas, compras e arrendamentos.
          </p>
        </div>
        <Button
          size="sm"
          className="absolute top-6 right-6 z-20 rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25"
          onClick={() => setExportOpen(true)}
        >
          <Download className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">Exportar</span>
        </Button>
      </div>

      {/* Tabs + Summary inline */}
      <div className="flex items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm">
          {PIPELINE_TYPES.map((type) => {
            const Icon = PIPELINE_ICONS[type]
            const isActive = activeTab === type
            return (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-colors duration-300',
                  isActive
                    ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                    : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Icon className="h-4 w-4" />
                {PIPELINE_TYPE_LABELS[type]}
              </button>
            )
          })}
        </div>

        <SummaryBar pipelineType={activeTab} />
      </div>

      {/* Kanban board */}
      <KanbanBoard pipelineType={activeTab} />

      <CsvExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        endpoint="/api/export/negocios"
        title="Negócios"
      />
    </div>
  )
}
