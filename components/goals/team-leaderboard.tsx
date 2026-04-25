'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Trophy, AlertTriangle } from 'lucide-react'
import type { TeamSummaryRow } from '@/app/api/goals/team-summary/route'

interface TeamLeaderboardProps {
  rows: TeamSummaryRow[]
  onSelect: (row: TeamSummaryRow) => void
}

export function TeamLeaderboard({ rows, onSelect }: TeamLeaderboardProps) {
  if (rows.length === 0) return null

  // Top 3 by pct_achieved; bottom 3 by pct_achieved (excluding zero-target)
  const sortedDesc = [...rows].sort((a, b) => b.pct_achieved - a.pct_achieved)
  const top = sortedDesc.slice(0, 3)
  const bottom = [...rows]
    .filter(r => r.annual_target > 0)
    .sort((a, b) => a.pct_achieved - b.pct_achieved)
    .slice(0, 3)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <LeaderboardColumn
        title="Top contribuidores"
        icon={Trophy}
        iconClass="text-emerald-600 bg-emerald-50"
        rows={top}
        onSelect={onSelect}
        deltaClass="text-emerald-600"
      />
      <LeaderboardColumn
        title="A precisar de apoio"
        icon={AlertTriangle}
        iconClass="text-amber-600 bg-amber-50"
        rows={bottom}
        onSelect={onSelect}
        deltaClass="text-amber-600"
      />
    </div>
  )
}

function LeaderboardColumn({
  title, icon: Icon, iconClass, rows, onSelect, deltaClass,
}: {
  title: string
  icon: React.ElementType
  iconClass: string
  rows: TeamSummaryRow[]
  onSelect: (row: TeamSummaryRow) => void
  deltaClass: string
}) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b">
        <div className={`h-7 w-7 rounded-xl flex items-center justify-center ${iconClass}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <p className="text-xs font-semibold">{title}</p>
      </div>
      <div className="divide-y">
        {rows.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">Sem dados.</div>
        ) : (
          rows.map((row, idx) => {
            const initials = row.commercial_name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
            return (
              <button
                key={row.consultant_id}
                type="button"
                onClick={() => onSelect(row)}
                className="w-full flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-muted/30 transition-colors text-left"
              >
                <span className="text-[10px] font-bold tabular-nums text-muted-foreground/60 w-4">#{idx + 1}</span>
                <Avatar className="h-8 w-8">
                  {row.profile_photo_url && <AvatarImage src={row.profile_photo_url} alt={row.commercial_name} />}
                  <AvatarFallback className="text-[10px]">{initials || '?'}</AvatarFallback>
                </Avatar>
                <p className="text-xs font-medium flex-1 truncate">{row.commercial_name}</p>
                <span className={`text-xs font-bold tabular-nums ${deltaClass}`}>
                  {row.pct_achieved.toFixed(0)}%
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
