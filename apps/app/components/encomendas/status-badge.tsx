'use client'

import { Badge } from '@/components/ui/badge'
import {
  REQUISITION_STATUS,
  SUPPLIER_ORDER_STATUS,
  REQUISITION_PRIORITY,
} from '@/lib/constants'

type StatusType = 'requisition' | 'supplier_order' | 'priority'

interface StatusBadgeProps {
  status: string
  type: StatusType
}

const STATUS_MAPS: Record<StatusType, Record<string, { bg: string; text: string; label: string }>> = {
  requisition: REQUISITION_STATUS,
  supplier_order: SUPPLIER_ORDER_STATUS,
  priority: REQUISITION_PRIORITY,
}

export function StatusBadge({ status, type }: StatusBadgeProps) {
  const map = STATUS_MAPS[type]
  const config = map[status]

  if (!config) {
    return <Badge variant="outline">{status}</Badge>
  }

  return (
    <Badge className={`${config.bg} ${config.text} border-0 font-medium`}>
      {config.label}
    </Badge>
  )
}
