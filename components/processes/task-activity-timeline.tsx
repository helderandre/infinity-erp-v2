'use client'

import React from 'react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  RefreshCw, UserPlus, Flag, CalendarClock, Ban,
  Upload, Mail, FileText, PlayCircle, CheckCircle2,
  Eye, PenLine, MessageSquare, Activity,
  MailCheck, MailOpen, MousePointerClick, MailX, AlertCircle, MailPlus, ShieldAlert, Clock,
  RotateCcw, Bot,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { TASK_ACTIVITY_TYPE_CONFIG } from '@/lib/constants'
import type { TaskActivity } from '@/types/process'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  RefreshCw, UserPlus, Flag, CalendarClock, Ban,
  Upload, Mail, FileText, PlayCircle, CheckCircle2,
  Eye, PenLine, MessageSquare, Activity,
  MailCheck, MailOpen, MousePointerClick, MailX, AlertCircle, MailPlus, ShieldAlert, Clock,
  RotateCcw,
}

interface TaskActivityTimelineProps {
  activities: TaskActivity[]
  isLoading: boolean
}

export function TaskActivityTimeline({ activities, isLoading }: TaskActivityTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Actividade
        </h4>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-4 w-4 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Activity className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Sem actividade registada.</p>
        <p className="text-xs text-muted-foreground mt-1">As acções nesta tarefa aparecerão aqui.</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <Timeline orientation="vertical">
          {activities.map((activity, index) => {
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
                {index < activities.length - 1 && <TimelineConnector />}
                <TimelineContent>
                  <TimelineHeader>
                    <div className="flex items-center gap-2">
                      {activity.user_id ? (
                        <Avatar className="h-5 w-5">
                          {activity.user?.profile?.profile_photo_url && (
                            <AvatarImage src={activity.user.profile.profile_photo_url} />
                          )}
                          <AvatarFallback className="text-[9px]">
                            {activity.user?.commercial_name?.[0]?.toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                          <Bot className="h-3 w-3 text-muted-foreground" />
                        </div>
                      )}
                      <span className="text-sm font-medium">
                        {activity.user?.commercial_name || 'Sistema'}
                      </span>
                    </div>
                    <TimelineDescription>{activity.description}</TimelineDescription>
                  </TimelineHeader>
                  <TimelineTime>
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
    </ScrollArea>
  )
}
