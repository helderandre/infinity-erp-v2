'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GoalStatusIndicator } from './goal-status-indicator'
import { getGoalStatus } from '@/lib/goals/calculations'
import type { GoalActivity, SellerFunnelTargets, BuyerFunnelTargets } from '@/types/goal'
import { GOAL_ACTIVITY_TYPES } from '@/lib/constants'

interface GoalWeeklyActivitySummaryProps {
  activities: GoalActivity[]
  sellerWeekly: SellerFunnelTargets
  buyerWeekly: BuyerFunnelTargets
}

export function GoalWeeklyActivitySummary({ activities, sellerWeekly, buyerWeekly }: GoalWeeklyActivitySummaryProps) {
  // Get this week's date range
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOffset)
  const mondayStr = monday.toISOString().split('T')[0]
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const sundayStr = sunday.toISOString().split('T')[0]

  const weekActs = activities.filter(a => a.activity_date >= mondayStr && a.activity_date <= sundayStr)

  const metrics = [
    {
      key: 'lead_contact',
      label: GOAL_ACTIVITY_TYPES.lead_contact,
      done: weekActs.filter(a => a.activity_type === 'lead_contact').length,
      target: Math.ceil(sellerWeekly.leads + buyerWeekly.leads),
    },
    {
      key: 'call',
      label: GOAL_ACTIVITY_TYPES.call,
      done: weekActs.filter(a => a.activity_type === 'call').length,
      target: Math.ceil(sellerWeekly.calls + buyerWeekly.calls),
    },
    {
      key: 'visit',
      label: GOAL_ACTIVITY_TYPES.visit,
      done: weekActs.filter(a => a.activity_type === 'visit').length,
      target: Math.ceil(sellerWeekly.visits),
    },
    {
      key: 'listing',
      label: GOAL_ACTIVITY_TYPES.listing,
      done: weekActs.filter(a => a.activity_type === 'listing').length,
      target: Math.ceil(sellerWeekly.listings),
    },
    {
      key: 'follow_up',
      label: GOAL_ACTIVITY_TYPES.follow_up,
      done: weekActs.filter(a => a.activity_type === 'follow_up').length,
      target: Math.ceil((sellerWeekly.leads + buyerWeekly.leads) * 0.5),
    },
    {
      key: 'buyer_qualify',
      label: GOAL_ACTIVITY_TYPES.buyer_qualify,
      done: weekActs.filter(a => a.activity_type === 'buyer_qualify').length,
      target: Math.ceil(buyerWeekly.qualified),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resumo Semanal</CardTitle>
        <p className="text-xs text-muted-foreground">
          {monday.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })} — {sunday.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {metrics.map((m) => {
            const pct = m.target > 0 ? Math.min((m.done / m.target) * 100, 100) : 0
            const status = getGoalStatus(m.done, m.target)

            return (
              <div key={m.key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <GoalStatusIndicator status={status} size="sm" />
                    <span>{m.label}</span>
                  </div>
                  <span className="tabular-nums font-medium">
                    {m.done}<span className="text-muted-foreground">/{m.target}</span>
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      status === 'green' ? 'bg-emerald-500' :
                      status === 'orange' ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
