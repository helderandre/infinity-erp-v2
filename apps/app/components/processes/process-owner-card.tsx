'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User, Building2, Phone, Mail, Percent, CheckCircle2 } from 'lucide-react'
import { OwnerTasksDropdown } from '@/components/processes/owner-tasks-dropdown'
import { OWNER_ROLE_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface OwnerRole {
  id: string
  name: string
  label: string
  color?: string | null
}

interface ProcessOwnerCardProps {
  owner: {
    id: string
    name: string
    email?: string | null
    phone?: string | null
    person_type?: 'singular' | 'coletiva' | string
    ownership_percentage?: number | null
    is_main_contact?: boolean
    owner_role?: OwnerRole | null
  }
  /** Whether this owner already has tasks in the process */
  hasTasks?: boolean
  /** Process ID — needed for populate-tasks action */
  processId?: string
  /** Set of tpl_subtask_ids already created for this owner */
  existingSubtaskIds?: Set<string>
  /** Whether all possible tasks are already populated */
  allPopulated?: boolean
  /** Callback after tasks are populated */
  onTasksPopulated?: () => void
  onClick?: () => void
}

export function ProcessOwnerCard({
  owner,
  hasTasks,
  processId,
  existingSubtaskIds = new Set(),
  allPopulated = false,
  onTasksPopulated,
  onClick,
}: ProcessOwnerCardProps) {
  const isSingular = owner.person_type === 'singular'
  const roleName = owner.owner_role?.name || 'proprietario'
  const roleLabel = owner.owner_role?.label || 'Proprietário'
  const roleColors = OWNER_ROLE_COLORS[roleName] || OWNER_ROLE_COLORS.proprietario

  return (
    <Card
      className="relative cursor-pointer transition-all py-0 hover:shadow-md hover:border-primary/30"
      onClick={onClick}
    >
      <CardContent className="flex flex-col items-center text-center pt-6 pb-5 px-5">
        {/* Avatar */}
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
          {isSingular ? (
            <User className="h-6 w-6 text-muted-foreground" />
          ) : (
            <Building2 className="h-6 w-6 text-muted-foreground" />
          )}
        </div>

        {/* Nome */}
        <p className="text-sm font-semibold truncate max-w-full">{owner.name}</p>

        {/* Tipo de pessoa */}
        <p className="text-xs text-muted-foreground">
          {isSingular ? 'Pessoa Singular' : 'Pessoa Colectiva'}
        </p>

        {/* Badges + actions */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2 mb-3">
          <Badge
            variant="outline"
            className={cn('h-5 px-2 text-[10px] border-0', roleColors.bg, roleColors.text)}
          >
            {roleLabel}
          </Badge>
          {owner.is_main_contact && (
            <Badge variant="default" className="h-5 px-2 text-[10px]">Principal</Badge>
          )}
          {owner.ownership_percentage != null && owner.ownership_percentage > 0 && (
            <Badge variant="outline" className="h-5 px-2 text-[10px] gap-0.5">
              <Percent className="h-2.5 w-2.5" />
              {owner.ownership_percentage}%
            </Badge>
          )}
          {hasTasks && (
            <Badge variant="outline" className="h-5 px-2 text-[10px] gap-0.5 border-emerald-200 bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-2.5 w-2.5" />
              No fluxo
            </Badge>
          )}
        </div>

        {/* Contactos */}
        <div className="w-full border-t pt-3 space-y-1.5">
          {owner.phone && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{owner.phone}</span>
            </div>
          )}
          {owner.email && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{owner.email}</span>
            </div>
          )}
          {!owner.phone && !owner.email && (
            <p className="text-xs text-muted-foreground/60">Sem contacto</p>
          )}
        </div>

        {/* Dropdown de tarefas — sempre visível se há processo, posicionado no canto */}
        {processId && (
          <div
            className="absolute top-3 right-3"
            onClick={(e) => e.stopPropagation()}
          >
            <OwnerTasksDropdown
              processId={processId}
              ownerId={owner.id}
              ownerName={owner.name}
              existingSubtaskIds={existingSubtaskIds}
              allPopulated={allPopulated}
              onTasksPopulated={onTasksPopulated}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
