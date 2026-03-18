import { Check, CheckCheck, AlertCircle } from 'lucide-react'
import type { WppMessageStatus } from '@/lib/types/whatsapp-web'

interface MessageStatusProps {
  status: WppMessageStatus | null
}

export function MessageStatus({ status }: MessageStatusProps) {
  if (!status) return null

  switch (status) {
    case 'sent':
      return <Check className="h-3.5 w-3.5 text-muted-foreground" />
    case 'delivered':
      return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />
    case 'read':
    case 'played':
      return <CheckCheck className="h-3.5 w-3.5 text-blue-500" />
    case 'failed':
      return <AlertCircle className="h-3.5 w-3.5 text-red-500" />
    default:
      return null
  }
}
