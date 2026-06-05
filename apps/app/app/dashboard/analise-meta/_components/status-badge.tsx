import { Badge } from '@/components/ui/badge'

/**
 * Badge para estados da Meta (effective_status / status nos endpoints de campaign,
 * adset, ad e form). Mapeia para o variant adequado.
 */
export function MetaStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>

  const variant = (() => {
    if (status === 'ACTIVE') return 'default' as const
    if (status === 'PAUSED') return 'secondary' as const
    if (status === 'ARCHIVED' || status === 'DELETED') return 'outline' as const
    return 'outline' as const
  })()

  return (
    <Badge variant={variant} className="text-[10px] uppercase tracking-wide">
      {status}
    </Badge>
  )
}
