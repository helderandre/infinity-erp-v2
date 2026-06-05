'use client'

import React, { useMemo } from 'react'
import {
  Timeline,
  TimelineItem,
  TimelineDot,
  TimelineConnector,
  TimelineContent,
  TimelineHeader,
  TimelineDescription,
  TimelineTime,
} from '@/components/ui/timeline'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  RefreshCw, UserPlus, Flag, CalendarClock, Ban,
  Upload, Mail, FileText, PlayCircle, CheckCircle2,
  Eye, PenLine, MessageSquare, Activity,
  MailCheck, MailOpen, MousePointerClick, MailX, AlertCircle, MailPlus,
  RotateCcw, Clock,
} from 'lucide-react'
import { format, formatDistanceToNow, isToday, isYesterday, isSameDay } from 'date-fns'
import { pt } from 'date-fns/locale'
import { TASK_ACTIVITY_TYPE_CONFIG } from '@/lib/constants'
import type { ProcessActivity } from '@/hooks/use-process-activities'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  RefreshCw, UserPlus, Flag, CalendarClock, Ban,
  Upload, Mail, FileText, PlayCircle, CheckCircle2,
  Eye, PenLine, MessageSquare, Activity,
  MailCheck, MailOpen, MousePointerClick, MailX, AlertCircle, MailPlus,
  RotateCcw, Clock,
}

interface ProcessTimelineViewProps {
  activities: ProcessActivity[]
  isLoading: boolean
}

function getDayLabel(date: Date): string {
  if (isToday(date)) return 'Hoje'
  if (isYesterday(date)) return 'Ontem'
  return format(date, "d 'de' MMMM, yyyy", { locale: pt })
}

export function ProcessTimelineView({ activities, isLoading }: ProcessTimelineViewProps) {
  // Group activities by day
  const grouped = useMemo(() => {
    const groups: { label: string; date: Date; activities: ProcessActivity[] }[] = []
    for (const activity of activities) {
      const date = new Date(activity.created_at)
      const last = groups[groups.length - 1]
      if (last && isSameDay(last.date, date)) {
        last.activities.push(activity)
      } else {
        groups.push({ label: getDayLabel(date), date, activities: [activity] })
      }
    }
    return groups
  }, [activities])

  if (isLoading) {
    return (
      <div className="space-y-6 p-4">
        {[1, 2, 3].map((g) => (
          <div key={g} className="space-y-3">
            <Skeleton className="h-5 w-32" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 ml-4">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Activity className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Sem actividade registada.</p>
        <p className="text-xs text-muted-foreground mt-1">
          As acções realizadas nas tarefas deste processo aparecerão aqui.
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-6 p-1">
        {grouped.map((group) => (
          <div key={group.label}>
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 mb-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label}
              </h4>
            </div>

            <Timeline orientation="vertical">
              {group.activities.map((activity, index) => {
                const config = TASK_ACTIVITY_TYPE_CONFIG[activity.activity_type] || {
                  icon: 'Activity',
                  label: activity.activity_type,
                  color: 'text-muted-foreground',
                }
                const IconComponent = ICON_MAP[config.icon] || Activity

                return (
                  <TimelineItem key={activity.id}>
                    <TimelineDot className={config.color}>
                      <IconComponent className="h-3 w-3" />
                    </TimelineDot>
                    {index < group.activities.length - 1 && <TimelineConnector />}
                    <TimelineContent>
                      <TimelineHeader>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Avatar className="h-5 w-5">
                            {activity.user?.profile?.profile_photo_url && (
                              <AvatarImage src={activity.user.profile.profile_photo_url} />
                            )}
                            <AvatarFallback className="text-[9px]">
                              {activity.user?.commercial_name?.[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">
                            {activity.user?.commercial_name || 'Sistema'}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal">
                            {activity.task_title}
                          </Badge>
                        </div>
                        <TimelineDescription>{activity.description}</TimelineDescription>
                      </TimelineHeader>
                      <TimelineTime>
                        {format(new Date(activity.created_at), 'HH:mm', { locale: pt })}
                        {' · '}
                        {formatDistanceToNow(new Date(activity.created_at), {
                          addSuffix: true,
                          locale: pt,
                        })}
                      </TimelineTime>
                    </TimelineContent>
                  </TimelineItem>
                )
              })}
            </Timeline>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
