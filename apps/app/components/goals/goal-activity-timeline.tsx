'use client'

import { Phone, MapPin, Home, Handshake, UserCheck, MessageSquare, RotateCcw } from 'lucide-react'
import { GOAL_ACTIVITY_TYPES, GOAL_ORIGINS, formatDate, formatCurrency } from '@/lib/constants'
import type { GoalActivity, GoalActivityType } from '@/types/goal'

const ACTIVITY_ICONS: Record<GoalActivityType, React.ElementType> = {
  call: Phone,
  visit: MapPin,
  listing: Home,
  sale_close: Handshake,
  buyer_close: Handshake,
  lead_contact: MessageSquare,
  buyer_qualify: UserCheck,
  follow_up: RotateCcw,
}

const ACTIVITY_COLORS: Record<GoalActivityType, string> = {
  call: 'text-blue-500 bg-blue-500/10',
  visit: 'text-violet-500 bg-violet-500/10',
  listing: 'text-emerald-500 bg-emerald-500/10',
  sale_close: 'text-green-600 bg-green-500/10',
  buyer_close: 'text-green-600 bg-green-500/10',
  lead_contact: 'text-sky-500 bg-sky-500/10',
  buyer_qualify: 'text-amber-500 bg-amber-500/10',
  follow_up: 'text-orange-500 bg-orange-500/10',
}

interface GoalActivityTimelineProps {
  activities: GoalActivity[]
}

export function GoalActivityTimeline({ activities }: GoalActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Nenhuma actividade registada.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => {
        const Icon = ACTIVITY_ICONS[activity.activity_type] || MessageSquare
        const colorClass = ACTIVITY_COLORS[activity.activity_type] || 'text-slate-500 bg-slate-500/10'

        return (
          <div key={activity.id} className="flex items-start gap-3">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${colorClass}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {GOAL_ACTIVITY_TYPES[activity.activity_type]}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({GOAL_ORIGINS[activity.origin]})
                </span>
                {activity.revenue_amount && (
                  <span className="ml-auto text-sm font-semibold text-emerald-600">
                    {formatCurrency(activity.revenue_amount)}
                  </span>
                )}
              </div>
              {activity.notes && (
                <p className="mt-0.5 text-xs text-muted-foreground">{activity.notes}</p>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(activity.activity_date)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
