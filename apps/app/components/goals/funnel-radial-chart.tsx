'use client'

import { useMemo, useState } from 'react'
import { LabelList, RadialBar, RadialBarChart } from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Users, User } from 'lucide-react'
import { useFunnel } from '@/hooks/use-funnel'
import type { FunnelStageKey, FunnelType } from '@/types/funnel'

interface Props {
  consultantId?: string | null
  scope?: 'consultant' | 'team'
}

// Stable colour per stage_key — gradiente do mais claro (topo do funil) ao
// mais escuro (fundo). oklch escolhido para ler bem em light + dark.
const STAGE_COLOURS: Record<FunnelStageKey, string> = {
  contactos: 'oklch(0.82 0.10 252)',
  pesquisa: 'oklch(0.74 0.13 252)',
  pre_angariacao: 'oklch(0.74 0.13 252)',
  estudo_mercado: 'oklch(0.66 0.16 252)',
  angariacao: 'oklch(0.62 0.18 252)',
  visita: 'oklch(0.58 0.20 252)',
  proposta: 'oklch(0.50 0.22 252)',
  cpcv: 'oklch(0.42 0.20 254)',
  escritura: 'oklch(0.34 0.16 256)',
}

export function FunnelRadialChart({ consultantId, scope = 'consultant' }: Props) {
  const [funnel, setFunnel] = useState<FunnelType>('buyer')

  const { data, isLoading, error } = useFunnel({
    consultantId,
    period: 'annual',
    scope,
    enabled: true,
  })

  const { chartData, chartConfig, totalRealized } = useMemo(() => {
    if (!data) return { chartData: [], chartConfig: {} as ChartConfig, totalRealized: 0 }
    const stages = data[funnel].stages
    const cfg: ChartConfig = {
      realized: { label: 'Realizado' },
    }
    const series = stages.map((s) => {
      cfg[s.key] = { label: s.label, color: STAGE_COLOURS[s.key] }
      return {
        stage: s.key,
        realized: s.realized,
        target: Math.round(s.target),
        fill: STAGE_COLOURS[s.key],
      }
    })
    const total = stages.reduce((acc, s) => acc + s.realized, 0)
    return { chartData: series, chartConfig: cfg, totalRealized: total }
  }, [data, funnel])

  if (isLoading) {
    return <Skeleton className="h-[360px] w-full rounded-3xl" />
  }
  if (error) {
    return (
      <div className="rounded-3xl border border-red-200/60 bg-red-50/60 backdrop-blur-sm p-6 text-sm text-red-700">
        {error}
      </div>
    )
  }
  if (!data) return null

  const hasAny = chartData.some((d) => d.realized > 0)

  return (
    <Card className="flex flex-col rounded-2xl border bg-card/50 backdrop-blur-sm shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div>
          <CardTitle className="text-sm font-medium tracking-tight">
            Funil anual · {data.period_start.slice(0, 4)}
          </CardTitle>
          <CardDescription className="text-xs mt-1">
            Volume realizado em cada etapa · total {totalRealized}
          </CardDescription>
        </div>
        {/* Buyer/Seller toggle */}
        <div className="inline-flex items-center rounded-full border border-border/40 bg-muted/40 p-0.5 text-xs font-medium backdrop-blur-sm shrink-0">
          <button
            type="button"
            onClick={() => setFunnel('buyer')}
            className={cn(
              'rounded-full px-2.5 py-1 inline-flex items-center gap-1 transition-all',
              funnel === 'buyer'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <User className="h-3 w-3" />
            Comprador
          </button>
          <button
            type="button"
            onClick={() => setFunnel('seller')}
            className={cn(
              'rounded-full px-2.5 py-1 inline-flex items-center gap-1 transition-all',
              funnel === 'seller'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Users className="h-3 w-3" />
            Vendedor
          </button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        {!hasAny ? (
          <div className="flex items-center justify-center h-[260px] text-xs text-muted-foreground">
            Sem actividade neste funil este ano.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[280px]">
            <RadialBarChart
              data={chartData}
              startAngle={-90}
              endAngle={380}
              innerRadius={36}
              outerRadius={130}
            >
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel nameKey="stage" />}
              />
              <RadialBar dataKey="realized" background>
                <LabelList
                  position="insideStart"
                  dataKey="stage"
                  className="fill-white capitalize mix-blend-luminosity"
                  fontSize={10}
                  formatter={(value: string) => {
                    const labelMap: Record<string, string> = {
                      contactos: 'Contactos',
                      pesquisa: 'Pesquisa',
                      pre_angariacao: 'Pré-ang.',
                      estudo_mercado: 'Estudo',
                      angariacao: 'Angariação',
                      visita: 'Visitas',
                      proposta: 'Propostas',
                      cpcv: 'CPCV',
                      escritura: 'Escritura',
                    }
                    return labelMap[value] || value
                  }}
                />
              </RadialBar>
            </RadialBarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
