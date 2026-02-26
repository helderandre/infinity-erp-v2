'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  Undo2,
  UserCheck,
  MessageSquare,
  MessageCircle,
  AtSign,
  RefreshCw,
  AlertTriangle,
  Bell,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Notification, NotificationType } from '@/lib/notifications/types'

const NOTIFICATION_ICONS: Record<NotificationType, React.ElementType> = {
  process_created: FileCheck,
  process_approved: CheckCircle2,
  process_rejected: XCircle,
  process_returned: Undo2,
  process_deleted: Trash2,
  task_assigned: UserCheck,
  task_completed: CheckCircle2,
  task_comment: MessageSquare,
  chat_message: MessageCircle,
  comment_mention: AtSign,
  chat_mention: AtSign,
  task_updated: RefreshCw,
  task_overdue: AlertTriangle,
}

const NOTIFICATION_ICON_COLORS: Partial<Record<NotificationType, string>> = {
  process_approved: 'text-emerald-500',
  process_rejected: 'text-red-500',
  process_returned: 'text-amber-500',
  process_deleted: 'text-red-500',
  task_completed: 'text-emerald-500',
  task_overdue: 'text-red-500',
  task_assigned: 'text-blue-500',
  comment_mention: 'text-violet-500',
  chat_mention: 'text-violet-500',
}

interface NotificationToastContentProps {
  notification: Notification
  toastId: string | number
}

function NotificationToastContent({ notification, toastId }: NotificationToastContentProps) {
  const router = useRouter()
  const Icon = NOTIFICATION_ICONS[notification.notification_type] ?? Bell
  const iconColor = NOTIFICATION_ICON_COLORS[notification.notification_type] ?? 'text-primary'

  const handleClick = () => {
    toast.dismiss(toastId)
    router.push(notification.action_url)
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex w-full gap-3 text-left rounded-lg border bg-background p-4',
        'shadow-lg transition-colors hover:bg-muted/50 cursor-pointer'
      )}
    >
      <div className={cn('shrink-0 mt-0.5', iconColor)}>
        <Icon className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.body}
          </p>
        )}
      </div>

      <div className="shrink-0 mt-0.5">
        <div className="h-2 w-2 rounded-full bg-primary" />
      </div>
    </button>
  )
}

export function showNotificationToast(notification: Notification) {
  toast.custom(
    (id) => (
      <NotificationToastContent notification={notification} toastId={id} />
    ),
    {
      duration: 6000,
      position: 'top-right',
    }
  )
}
