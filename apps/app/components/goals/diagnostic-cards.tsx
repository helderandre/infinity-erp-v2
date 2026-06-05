'use client'

import { useMemo } from 'react'
import { useFunnel } from '@/hooks/use-funnel'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, TrendingDown, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FunnelData, FunnelStageResult } from '@/types/funnel'

interface Props {
  consultantId?: string | null
  scope?: 'consultant' | 'team'
}

/**
 * 3 cards de diagnóstico no topo dos funis. Lê do mesmo endpoint que o
 * `<FunnelObjetivosView>` usa, mas filtra para os 3 ângulos accionáveis:
 *  - Maior gap (stage com `still_needed_for_period_target` mais alto)
 *  - Pior ratio (stage onde `realized < target` E `prev_inputs_needed > 0`,
 *    ordenado por `prev_inputs_needed`)
 *  - Stage mais saudável (highest %, completed)
 */
export function DiagnosticCards({ consultantId, scope = 'consultant' }: Props) {
  const { data, isLoading } = useFunnel({
    consultantId,
    period: 'weekly',
    scope,
    enabled: true,
  })

  const insights = useMemo(() => {
    if (!data) return null
    const all = [...data.buyer.stages, ...data.seller.stages]

    // Maior gap: stage com mais "still_needed_for_period_target", target>0.
    const gap = all
      .filter((s) => s.target > 0 && s.still_needed_for_period_target > 0)
      .sort((a, b) => b.still_needed_for_period_target - a.still_needed_for_period_target)[0]

    // Pior ratio (acção mais urgente): stage com prev_inputs_needed > 0, ordenado.
    const action = all
      .filter(
        (s) =>
          s.prev_inputs_needed_for_next_one !== null &&
          s.prev_inputs_needed_for_next_one > 0 &&
          s.target > 0,
      )
      .sort(
        (a, b) =>
          (b.prev_inputs_needed_for_next_one as number) -
          (a.prev_inputs_needed_for_next_one as number),
      )[0]

    // Streak: stage mais saudável (% mais alto)
    const best = all.filter((s) => s.realized > 0).sort((a, b) => b.percent - a.percent)[0]

    return {
      gap: gap ? { funnel: stageFunnel(data, gap), stage: gap } : null,
      action: action ? { funnel: stageFunnel(data, action), stage: action } : null,
      best: best ? { funnel: stageFunnel(data, best), stage: best } : null,
    }
  }, [data])

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[100px] rounded-2xl" />
        ))}
      </div>
    )
  }
  if (!insights) return null
  if (!insights.gap && !insights.action && !insights.best) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {insights.gap && (
        <Card
          icon={<AlertCircle className="h-3.5 w-3.5 text-amber-500" />}
          label="Maior gap esta semana"
          headline={`${insights.gap.stage.still_needed_for_period_target} ${plural(insights.gap.stage.label, insights.gap.stage.still_needed_for_period_target).toLowerCase()} em falta`}
          sub={`Funil de ${insights.gap.funnel === 'buyer' ? 'compradores' : 'vendedores'}`}
          tone="amber"
        />
      )}
      {insights.action && (
        <Card
          icon={<TrendingDown className="h-3.5 w-3.5 text-red-500" />}
          label="Próxima acção"
          headline={`+${insights.action.stage.prev_inputs_needed_for_next_one} ${insights.action.stage.prev_label?.toLowerCase()}`}
          sub={`para próxima ${singular(insights.action.stage.key)}`}
          tone="red"
        />
      )}
      {insights.best && (
        <Card
          icon={<Flame className="h-3.5 w-3.5 text-emerald-500" />}
          label="Stage mais forte"
          headline={`${insights.best.stage.label} · ${Math.round(insights.best.stage.percent)}%`}
          sub={`Funil de ${insights.best.funnel === 'buyer' ? 'compradores' : 'vendedores'}`}
          tone="emerald"
        />
      )}
    </div>
  )
}

function stageFunnel(
  data: { buyer: FunnelData; seller: FunnelData },
  stage: FunnelStageResult,
): 'buyer' | 'seller' {
  return data.buyer.stages.some((s) => s === stage) ? 'buyer' : 'seller'
}

function plural(label: string, n: number): string {
  if (n === 1) return label.replace(/s$/, '') // "Visitas" -> "Visita"
  return label
}

function singular(key: string): string {
  const map: Record<string, string> = {
    contactos: 'contacto',
    pesquisa: 'pesquisa',
    visita: 'visita',
    proposta: 'proposta',
    cpcv: 'CPCV',
    escritura: 'escritura',
    pre_angariacao: 'pré-angariação',
    estudo_mercado: 'estudo',
    angariacao: 'angariação',
  }
  return map[key] || key
}

const TONE_RING: Record<string, string> = {
  amber: 'ring-amber-200/60 from-amber-50/50',
  red: 'ring-red-200/60 from-red-50/50',
  emerald: 'ring-emerald-200/60 from-emerald-50/50',
}

function Card({
  icon,
  label,
  headline,
  sub,
  tone,
}: {
  icon: React.ReactNode
  label: string
  headline: string
  sub: string
  tone: 'amber' | 'red' | 'emerald'
}) {
  return (
    <div
      className={cn(
        'rounded-2xl ring-1 bg-gradient-to-br to-background/60 p-4 backdrop-blur-sm',
        TONE_RING[tone],
      )}
    >
      <p className="text-[10px] text-muted-foreground tracking-wider uppercase font-medium flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p className="text-base font-semibold mt-1.5 leading-tight tabular-nums">{headline}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  )
}
