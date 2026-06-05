'use client'

import { useEffect, useState, useCallback } from 'react'
import { Phone, MapPin, UserCheck, MessageCircle, Flame, ShieldCheck } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface GoalActivityBreakdownProps {
  goalId: string
  period?: 'week' | 'month' | 'year'
  targets?: Record<string, number>
}

interface ActivityBreakdown {
  total: number
  system: number
  declared: number
  outbound: number
  inbound: number
}

interface SummaryData {
  activities: Record<string, ActivityBreakdown>
  trust_ratio: number
  streak_weeks: number
}

const ACTIVITY_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  call: { label: 'Chamadas', icon: Phone, color: 'bg-emerald-500' },
  visit: { label: 'Visitas', icon: MapPin, color: 'bg-rose-500' },
  follow_up: { label: 'Acompanhamentos', icon: UserCheck, color: 'bg-blue-500' },
  lead_contact: { label: 'Contactos', icon: MessageCircle, color: 'bg-purple-500' },
  listing: { label: 'Angariações', icon: MapPin, color: 'bg-amber-500' },
  sale_close: { label: 'Vendas', icon: ShieldCheck, color: 'bg-emerald-600' },
  buyer_close: { label: 'Compras', icon: ShieldCheck, color: 'bg-indigo-500' },
}

const TRUST_LEVELS: { min: number; label: string; color: string }[] = [
  { min: 0.8, label: 'Excelente', color: 'text-emerald-600 bg-emerald-50' },
  { min: 0.6, label: 'Bom', color: 'text-blue-600 bg-blue-50' },
  { min: 0.4, label: 'Moderado', color: 'text-amber-600 bg-amber-50' },
  { min: 0, label: 'Baixo', color: 'text-red-600 bg-red-50' },
]

function getTrustLevel(ratio: number) {
  return TRUST_LEVELS.find((l) => ratio >= l.min) || TRUST_LEVELS[TRUST_LEVELS.length - 1]
}

export function GoalActivityBreakdown({ goalId, period = 'month', targets = {} }: GoalActivityBreakdownProps) {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/goals/${goalId}/summary?period=${period}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [goalId, period])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    )
  }

  if (!data) return null

  const trust = getTrustLevel(data.trust_ratio)

  return (
    <div className="space-y-4">
      {/* Trust + Streak header */}
      <div className="flex items-center gap-3">
        <div className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold', trust.color)}>
          <ShieldCheck className="h-3 w-3" />
          {trust.label} · {Math.round(data.trust_ratio * 100)}%
        </div>
        {data.streak_weeks > 0 && (
          <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-orange-50 text-orange-600">
            <Flame className="h-3 w-3" />
            {data.streak_weeks} semana{data.streak_weeks !== 1 ? 's' : ''} consecutiva{data.streak_weeks !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Activity cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Object.entries(data.activities).map(([type, breakdown]) => {
          const meta = ACTIVITY_META[type] || { label: type, icon: Phone, color: 'bg-gray-500' }
          const target = targets[type] || 0
          const pct = target > 0 ? Math.min(100, Math.round((breakdown.total / target) * 100)) : 0
          const systemPct = target > 0 ? Math.min(100, Math.round((breakdown.system / target) * 100)) : 0

          return (
            <div key={type} className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', meta.color, 'text-white')}>
                    <meta.icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm font-semibold">{meta.label}</span>
                </div>
                <span className="text-lg font-bold">
                  {breakdown.total}
                  {target > 0 && <span className="text-sm font-normal text-muted-foreground"> / {target}</span>}
                </span>
              </div>

              {/* Dual progress bar */}
              {target > 0 && (
                <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div className="h-full flex">
                    <div
                      className={cn('h-full transition-all duration-500', meta.color)}
                      style={{ width: `${systemPct}%` }}
                    />
                    <div
                      className={cn('h-full transition-all duration-500 opacity-40', meta.color)}
                      style={{ width: `${Math.max(0, pct - systemPct)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Breakdown text */}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {breakdown.system} no sistema
                  {breakdown.declared > 0 && <> · {breakdown.declared} adicionais</>}
                </span>
                {(breakdown.outbound > 0 || breakdown.inbound > 0) && (
                  <span>
                    {breakdown.outbound > 0 && <>↗ {breakdown.outbound}</>}
                    {breakdown.outbound > 0 && breakdown.inbound > 0 && ' · '}
                    {breakdown.inbound > 0 && <>↙ {breakdown.inbound}</>}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
