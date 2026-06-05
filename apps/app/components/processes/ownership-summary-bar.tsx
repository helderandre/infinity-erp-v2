'use client'

import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, UserPlus, Users } from 'lucide-react'
import { OWNER_ROLE_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface OwnerSummary {
  id: string
  name: string
  ownership_percentage?: number | null
  is_main_contact?: boolean
  owner_role?: { name: string; label: string } | null
}

interface OwnershipSummaryBarProps {
  owners: OwnerSummary[]
  onAddOwner?: () => void
}

export function OwnershipSummaryBar({ owners, onAddOwner }: OwnershipSummaryBarProps) {
  const totalPercentage = owners.reduce(
    (sum, o) => sum + (o.ownership_percentage ?? 0),
    0
  )
  const hasMainContact = owners.some((o) => o.is_main_contact)
  const percentageWarning = totalPercentage !== 100
  const mainContactWarning = !hasMainContact && owners.length > 0

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {owners.length} proprietário{owners.length !== 1 ? 's' : ''}
          </span>
        </div>
        {onAddOwner && (
          <Button variant="outline" size="sm" onClick={onAddOwner} className="h-7 text-xs gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            Adicionar
          </Button>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Propriedade alocada</span>
          <span className={cn(
            'font-medium',
            totalPercentage === 100 ? 'text-emerald-600' : 'text-amber-600'
          )}>
            {totalPercentage}% / 100%
          </span>
        </div>
        <Progress
          value={Math.min(totalPercentage, 100)}
          className={cn('h-2', totalPercentage > 100 && '[&>div]:bg-red-500')}
        />
      </div>

      {/* Owner pills */}
      <div className="flex flex-wrap gap-1.5">
        {owners.map((o) => {
          const roleName = o.owner_role?.name || 'proprietario'
          const colors = OWNER_ROLE_COLORS[roleName] || OWNER_ROLE_COLORS.proprietario
          return (
            <Badge
              key={o.id}
              variant="outline"
              className={cn('text-[10px] h-5 px-2 gap-1 border-0', colors.bg, colors.text)}
            >
              {o.name.split(' ')[0]} · {o.ownership_percentage ?? 0}%
            </Badge>
          )
        })}
      </div>

      {/* Warnings */}
      {(percentageWarning || mainContactWarning) && (
        <div className="space-y-1">
          {percentageWarning && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {totalPercentage > 100
                ? 'A soma das percentagens excede 100%'
                : 'A soma das percentagens não totaliza 100%'}
            </div>
          )}
          {mainContactWarning && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Nenhum contacto principal definido
            </div>
          )}
        </div>
      )}
    </div>
  )
}
