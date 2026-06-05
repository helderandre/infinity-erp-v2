'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, Activity, FileText } from 'lucide-react'
import { formatCurrency } from '@/lib/constants'
import type { TeamSummaryRow } from '@/app/api/goals/team-summary/route'

interface ConsultantGoalCardProps {
  row: TeamSummaryRow
  onClick: () => void
}

const STATUS_DOT: Record<string, string> = {
  green: 'bg-emerald-500',
  orange: 'bg-amber-500',
  red: 'bg-red-500',
}

const STATUS_RING: Record<string, string> = {
  green: 'stroke-emerald-500',
  orange: 'stroke-amber-500',
  red: 'stroke-red-500',
}

const STATUS_LABEL: Record<string, string> = {
  green: 'Em rota',
  orange: 'A acompanhar',
  red: 'Atrasado',
}

const REPORT_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'outline' },
  submitted: { label: 'Submetido', variant: 'secondary' },
  reviewed: { label: 'Revisto', variant: 'default' },
}

export function ConsultantGoalCard({ row, onClick }: ConsultantGoalCardProps) {
  const pct = Math.min(row.pct_achieved, 100)
  const ringRadius = 22
  const circumference = 2 * Math.PI * ringRadius
  const offset = circumference - (pct / 100) * circumference

  const initials = row.commercial_name
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const reportBadge = row.last_report_status ? REPORT_BADGE[row.last_report_status] : null

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border bg-white p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-foreground/15 transition-all text-left group"
    >
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Avatar + ring */}
        <div className="relative shrink-0">
          <Avatar className="h-12 w-12">
            {row.profile_photo_url && <AvatarImage src={row.profile_photo_url} alt={row.commercial_name} />}
            <AvatarFallback>{initials || '?'}</AvatarFallback>
          </Avatar>
          {/* progress ring */}
          <svg className="absolute -inset-1 h-14 w-14 -rotate-90 pointer-events-none" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r={ringRadius} className="stroke-muted/40" strokeWidth="2.5" fill="none" />
            <circle
              cx="28"
              cy="28"
              r={ringRadius}
              className={STATUS_RING[row.status] || 'stroke-emerald-500'}
              strokeWidth="2.5"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Name + status + sub */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold truncate">{row.commercial_name}</p>
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground`}>
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[row.status] || 'bg-slate-400'}`} />
              {STATUS_LABEL[row.status] || '—'}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="tabular-nums font-medium text-foreground">{row.pct_achieved.toFixed(0)}%</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline tabular-nums truncate">
              {formatCurrency(row.realized)} / {formatCurrency(row.annual_target)}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Activity className="h-3 w-3" />
              {row.weekly_activities} act/sem
            </span>
            {reportBadge && (
              <Badge variant={reportBadge.variant} className="h-4 px-1.5 text-[9px] font-medium gap-1">
                <FileText className="h-2.5 w-2.5" />
                {reportBadge.label}
              </Badge>
            )}
          </div>
        </div>

        {/* Right side numbers (desktop) */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <div className="rounded-xl bg-muted/40 px-3 py-1.5 text-center min-w-[100px]">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Anual</p>
            <p className="text-xs font-bold tabular-nums">{formatCurrency(row.annual_target)}</p>
          </div>
          <div className="rounded-xl bg-muted/40 px-3 py-1.5 text-center min-w-[100px]">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Projeção</p>
            <p className="text-xs font-bold tabular-nums">{formatCurrency(row.projected_annual)}</p>
          </div>
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
      </div>
    </button>
  )
}
