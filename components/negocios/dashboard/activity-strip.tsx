'use client'

import { format, formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  StickyNote,
  ArrowRightLeft,
  RefreshCw,
  Thermometer,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { NegocioActivity } from '@/hooks/use-negocio-activities'

const ACTIVITY_META: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; tone: string }> = {
  call: { icon: Phone, label: 'Chamada', tone: 'text-blue-600' },
  email: { icon: Mail, label: 'Email', tone: 'text-violet-600' },
  whatsapp: { icon: MessageSquare, label: 'WhatsApp', tone: 'text-emerald-600' },
  sms: { icon: MessageSquare, label: 'SMS', tone: 'text-emerald-600' },
  visit: { icon: Calendar, label: 'Visita', tone: 'text-amber-600' },
  note: { icon: StickyNote, label: 'Nota', tone: 'text-slate-600' },
  stage_change: { icon: ArrowRightLeft, label: 'Mudança de fase', tone: 'text-indigo-600' },
  temperature_change: { icon: Thermometer, label: 'Mudança de temperatura', tone: 'text-rose-600' },
  assignment: { icon: ArrowRightLeft, label: 'Atribuição', tone: 'text-slate-600' },
  lifecycle_change: { icon: ArrowRightLeft, label: 'Ciclo', tone: 'text-slate-600' },
  system: { icon: RefreshCw, label: 'Sistema', tone: 'text-slate-500' },
}

interface ActivityStripProps {
  activities: NegocioActivity[]
  isLoading: boolean
  /** Quantos itens mostrar inline (resto fica no Sheet). */
  limit?: number
  onSeeAll?: () => void
}

export function ActivityStrip({ activities, isLoading, limit = 5, onSeeAll }: ActivityStripProps) {
  const visible = activities.slice(0, limit)

  if (isLoading && activities.length === 0) {
    return (
      <div className="rounded-3xl border border-border/40 bg-card/60 supports-[backdrop-filter]:bg-card/40 backdrop-blur-xl p-5 sm:p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-border/40 bg-card/60 supports-[backdrop-filter]:bg-card/40 backdrop-blur-xl p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold tracking-tight">Actividade recente</h3>
        {onSeeAll && activities.length > limit && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 rounded-full text-xs text-muted-foreground hover:text-foreground"
            onClick={onSeeAll}
          >
            Ver tudo ({activities.length})
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Sem actividade registada neste negócio.
        </p>
      ) : (
        <ul className="space-y-1">
          {visible.map((a) => (
            <ActivityRow key={a.id} activity={a} />
          ))}
        </ul>
      )}

      {isLoading && activities.length > 0 && (
        <div className="flex items-center justify-center pt-2 text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        </div>
      )}
    </div>
  )
}

function ActivityRow({ activity }: { activity: NegocioActivity }) {
  const meta = ACTIVITY_META[activity.activity_type] || ACTIVITY_META.system
  const Icon = meta.icon
  const when = formatRelative(activity.created_at)
  const author = activity.created_by_user?.commercial_name || ''
  const headline = activity.subject || meta.label

  return (
    <li className="flex items-start gap-3 py-1.5">
      <div className="h-7 w-7 rounded-full bg-muted/60 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className={cn('h-3.5 w-3.5', meta.tone)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-sm font-medium leading-tight">{headline}</p>
          <span className="text-[11px] text-muted-foreground">{when}</span>
        </div>
        {activity.description && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{activity.description}</p>
        )}
        {author && (
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">por {author}</p>
        )}
      </div>
    </li>
  )
}

function formatRelative(iso: string) {
  try {
    const date = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const oneDay = 24 * 60 * 60 * 1000
    if (diffMs < 7 * oneDay) {
      return formatDistanceToNow(date, { locale: pt, addSuffix: true })
    }
    return format(date, "d MMM", { locale: pt })
  } catch {
    return ''
  }
}
