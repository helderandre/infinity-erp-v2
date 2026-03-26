'use client'

import { useEffect, useState, useCallback } from 'react'
import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Phone,
  Mail,
  MessageCircle,
  MessageSquare,
  StickyNote,
  MapPin,
  ArrowRight,
  UserPlus,
  RefreshCw,
  Cog,
  Plus,
  LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_COLORS,
  ACTIVITY_DIRECTION_LABELS,
} from '@/lib/constants-leads-crm'
import { AddActivityDialog } from '@/components/crm/add-activity-dialog'
import type { LeadsActivityWithAuthor, ActivityType } from '@/types/leads-crm'

// Map icon name strings from constants to actual Lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  Phone,
  Mail,
  MessageCircle,
  MessageSquare,
  StickyNote,
  MapPin,
  ArrowRight,
  UserPlus,
  RefreshCw,
  Cog,
}

const ACTIVITY_TYPE_ICON_NAMES: Record<ActivityType, string> = {
  call: 'Phone',
  email: 'Mail',
  whatsapp: 'MessageCircle',
  sms: 'MessageSquare',
  note: 'StickyNote',
  visit: 'MapPin',
  stage_change: 'ArrowRight',
  assignment: 'UserPlus',
  lifecycle_change: 'RefreshCw',
  system: 'Cog',
}

const ACTIVITY_TYPE_BORDER: Record<ActivityType, string> = {
  call: 'border-l-green-500',
  email: 'border-l-blue-500',
  whatsapp: 'border-l-emerald-500',
  sms: 'border-l-purple-500',
  note: 'border-l-amber-500',
  visit: 'border-l-rose-500',
  stage_change: 'border-l-indigo-500',
  assignment: 'border-l-cyan-500',
  lifecycle_change: 'border-l-orange-500',
  system: 'border-l-slate-400',
}

function groupActivitiesByDate(activities: LeadsActivityWithAuthor[]): {
  label: string
  items: LeadsActivityWithAuthor[]
}[] {
  const groups: Map<string, LeadsActivityWithAuthor[]> = new Map()

  for (const activity of activities) {
    const date = parseISO(activity.created_at)
    let key: string

    if (isToday(date)) {
      key = 'Hoje'
    } else if (isYesterday(date)) {
      key = 'Ontem'
    } else {
      key = format(date, "d 'de' MMMM yyyy", { locale: pt })
    }

    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(activity)
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }))
}

interface ActivityTimelineProps {
  contactId: string
}

export function ActivityTimeline({ contactId }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<LeadsActivityWithAuthor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterType, setFilterType] = useState<ActivityType | 'all'>('all')
  const [addOpen, setAddOpen] = useState(false)

  const fetchActivities = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ per_page: '100' })
      if (filterType !== 'all') params.set('activity_type', filterType)

      const res = await fetch(
        `/api/crm/contacts/${contactId}/activities?${params.toString()}`
      )
      if (!res.ok) throw new Error('Erro ao carregar actividades')
      const json = await res.json()
      setActivities(json.data ?? [])
    } catch {
      setActivities([])
    } finally {
      setIsLoading(false)
    }
  }, [contactId, filterType])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  const groups = groupActivitiesByDate(activities)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <Select
          value={filterType}
          onValueChange={(v) => setFilterType(v as ActivityType | 'all')}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por tipo..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {(Object.entries(ACTIVITY_TYPE_LABELS) as [ActivityType, string][]).map(
              ([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>

        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nova actividade
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <TimelineSkeleton />
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <StickyNote className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">Sem actividades registadas</p>
          <p className="text-xs mt-1">Clique em &quot;Nova actividade&quot; para registar</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ label, items }) => (
            <div key={label}>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-2">
                {items.map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddActivityDialog
        contactId={contactId}
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={fetchActivities}
      />
    </div>
  )
}

function ActivityItem({ activity }: { activity: LeadsActivityWithAuthor }) {
  const iconName = ACTIVITY_TYPE_ICON_NAMES[activity.activity_type] ?? 'Cog'
  const Icon = ICON_MAP[iconName] ?? Cog
  const colorClass = ACTIVITY_TYPE_COLORS[activity.activity_type]
  const borderClass = ACTIVITY_TYPE_BORDER[activity.activity_type]

  const timeAgo = formatDistanceToNow(parseISO(activity.created_at), {
    addSuffix: true,
    locale: pt,
  })
  const exactTime = format(parseISO(activity.created_at), 'HH:mm', { locale: pt })

  return (
    <div
      className={cn(
        'rounded-2xl border-l-4 bg-card/50 backdrop-blur-sm px-4 py-3 shadow-sm transition-all duration-200 hover:bg-card/80 hover:shadow-md',
        borderClass
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Icon + content */}
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted',
              colorClass
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                {ACTIVITY_TYPE_LABELS[activity.activity_type]}
              </span>

              {activity.direction && (
                <Badge variant="secondary" className="text-xs">
                  {ACTIVITY_DIRECTION_LABELS[activity.direction]}
                </Badge>
              )}
            </div>

            {activity.subject && (
              <p className="mt-0.5 text-sm text-foreground/80 font-medium truncate">
                {activity.subject}
              </p>
            )}

            {activity.description && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                {activity.description}
              </p>
            )}

            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {activity.author?.commercial_name && (
                <span className="font-medium text-foreground/60">
                  {activity.author.commercial_name}
                </span>
              )}
              {activity.author?.commercial_name && <span>&middot;</span>}
              <span title={format(parseISO(activity.created_at), "d MMM yyyy 'às' HH:mm", { locale: pt })}>
                {exactTime} &middot; {timeAgo}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TimelineSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3 rounded-2xl border-l-4 border-l-muted bg-card/50 px-4 py-3">
          <Skeleton className="mt-0.5 h-7 w-7 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}
