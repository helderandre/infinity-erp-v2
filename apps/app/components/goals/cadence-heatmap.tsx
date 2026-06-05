'use client'

import { useEffect, useMemo, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Day {
  date: string
  count: number
  by_stage: Record<string, number>
}

interface ApiResponse {
  weeks: number
  start: string
  end: string
  max_count: number
  total_count: number
  days: Day[]
}

interface Props {
  consultantId?: string | null
  scope?: 'consultant' | 'team'
  weeks?: number
}

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const STAGE_PT: Record<string, string> = {
  contactos: 'Contactos',
  pesquisa: 'Pesquisa',
  visita: 'Visitas',
  proposta: 'Propostas',
  cpcv: 'CPCV',
  escritura: 'Escrituras',
  pre_angariacao: 'Pré-angariação',
  estudo_mercado: 'Estudos',
  angariacao: 'Angariações',
}

/** 5 buckets discretos a partir da escala observada — evita extremos quando
 *  alguém tem 1 dia muito acima da média. */
function bucketFor(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0
  if (max <= 0) return 0
  const ratio = count / max
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

const BUCKET_BG: Record<number, string> = {
  0: 'bg-muted/40',
  1: 'bg-blue-100',
  2: 'bg-blue-300',
  3: 'bg-blue-500',
  4: 'bg-blue-700',
}

export function CadenceHeatmap({ consultantId, scope = 'consultant', weeks = 12 }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    const params = new URLSearchParams({ scope, weeks: String(weeks) })
    if (scope === 'consultant' && consultantId) params.set('consultant_id', consultantId)
    fetch(`/api/goals/cadence?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`)
        return (await res.json()) as ApiResponse
      })
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [scope, consultantId, weeks])

  // Reorganiza linear em colunas (semana) × linhas (dia da semana, Seg-Dom).
  const grid = useMemo(() => {
    if (!data) return null
    const cols: Day[][] = []
    let week: Day[] = []
    for (const d of data.days) {
      week.push(d)
      if (week.length === 7) {
        cols.push(week)
        week = []
      }
    }
    if (week.length > 0) cols.push(week)
    return cols
  }, [data])

  if (isLoading) return <Skeleton className="h-[200px] w-full rounded-3xl" />
  if (error) {
    return (
      <div className="rounded-3xl border border-red-200/60 bg-red-50/60 backdrop-blur-sm p-6 text-sm text-red-700">
        {error}
      </div>
    )
  }
  if (!data || !grid) return null

  return (
    <div className="overflow-hidden rounded-2xl border bg-card/50 backdrop-blur-sm shadow-sm">
      <div className="px-4 py-4 sm:px-6 sm:py-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[11px] text-muted-foreground font-medium tracking-wider uppercase flex items-center gap-1.5">
              <Activity className="h-3 w-3 text-blue-500" />
              Cadência · últimas {data.weeks} semanas
            </p>
            <p className="text-sm font-medium mt-1.5 text-foreground/90">
              {data.total_count} acções no período · pico {data.max_count}/dia
            </p>
          </div>
        </div>

        {/* Heatmap */}
        <div className="overflow-x-auto -mx-2 pb-1">
          <div className="inline-flex gap-1.5 px-2">
            {/* Day labels column */}
            <div className="grid grid-rows-7 gap-1.5 mr-2 text-[11px] text-muted-foreground tracking-tight">
              {DAY_LABELS.map((d) => (
                <div key={d} className="h-7 sm:h-8 flex items-center">
                  {d}
                </div>
              ))}
            </div>
            {grid.map((week, i) => (
              <div key={i} className="grid grid-rows-7 gap-1.5">
                {week.map((day) => {
                  const bucket = bucketFor(day.count, data.max_count)
                  const stageList = Object.entries(day.by_stage)
                    .map(([k, v]) => `${STAGE_PT[k] || k}: ${v}`)
                    .join(' · ')
                  return (
                    <div
                      key={day.date}
                      title={`${day.date} — ${day.count} acção(ões)${stageList ? ` (${stageList})` : ''}`}
                      className={cn(
                        'h-7 w-7 sm:h-8 sm:w-8 rounded-md transition-colors',
                        BUCKET_BG[bucket],
                        bucket === 0 && 'ring-1 ring-border/30',
                      )}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-5 text-[11px] text-muted-foreground">
          <span>Menos</span>
          {[0, 1, 2, 3, 4].map((b) => (
            <span
              key={b}
              className={cn('h-4 w-4 rounded-md', BUCKET_BG[b], b === 0 && 'ring-1 ring-border/30')}
            />
          ))}
          <span>Mais</span>
        </div>
      </div>
    </div>
  )
}
