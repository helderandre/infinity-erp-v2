'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import {
  CalendarDays,
  Clock,
  FileText,
  Globe,
  Linkedin,
  Megaphone,
  Share2,
  UserPlus,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CandidateSource, RecruitmentCandidate } from '@/types/recruitment'
import { CANDIDATE_SOURCES, CANDIDATE_STATUS_DOT, normalizeCandidateStatus } from '@/types/recruitment'

const SOURCE_ICON: Record<CandidateSource, LucideIcon> = {
  linkedin: Linkedin,
  social_media: Share2,
  referral: Users,
  inbound: Globe,
  paid_campaign: Megaphone,
  event: CalendarDays,
  other: UserPlus,
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

export function CandidateKanbanCard({
  candidate,
  onClick,
  onDragStart,
  onDragEnd,
  dragging = false,
}: {
  candidate: RecruitmentCandidate
  onClick: () => void
  onDragStart?: (id: string) => void
  onDragEnd?: () => void
  dragging?: boolean
}) {
  const accent = CANDIDATE_STATUS_DOT[normalizeCandidateStatus(candidate.status)]
  const days = daysSince(candidate.last_interaction_date ?? candidate.created_at)
  const slaOverdue = days !== null && days > 7
  const SourceIcon = SOURCE_ICON[candidate.source] ?? UserPlus

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('candidate_id', candidate.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart?.(candidate.id)
      }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        'group/card relative bg-card rounded-xl border border-border/40 pl-3 pr-2.5 py-2.5 overflow-hidden',
        'shadow-[0_2px_4px_-2px_rgba(0,0,0,0.08),0_4px_12px_-4px_rgba(0,0,0,0.06)]',
        'hover:border-border/70 hover:-translate-y-px transition-all duration-150 select-none',
        'cursor-grab active:cursor-grabbing',
        dragging && 'opacity-40 scale-[0.98]',
      )}
    >
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: accent }} />

      <div className="flex items-start gap-2">
        <Avatar className="h-7 w-7 shrink-0">
          {candidate.photo_url && <AvatarImage src={candidate.photo_url} alt={candidate.full_name} />}
          <AvatarFallback className="text-[10px] font-semibold">{initials(candidate.full_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[13px] leading-tight truncate">{candidate.full_name}</p>
          {candidate.source_detail ? (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{candidate.source_detail}</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/30 gap-2">
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground truncate min-w-0">
          <SourceIcon className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{CANDIDATE_SOURCES[candidate.source] ?? candidate.source}</span>
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          {candidate.recruiter && (
            <Avatar className="h-4 w-4" title={candidate.recruiter.commercial_name}>
              <AvatarFallback className="text-[7px] font-semibold">
                {initials(candidate.recruiter.commercial_name)}
              </AvatarFallback>
            </Avatar>
          )}
          {candidate.cv_url && <FileText className="h-3 w-3 text-muted-foreground" />}
          {days !== null && (
            <span
              className={cn(
                'flex items-center gap-0.5 text-[10px] tabular-nums',
                slaOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground',
              )}
            >
              <Clock className="h-2.5 w-2.5" />
              {days}d
            </span>
          )}
        </span>
      </div>
    </div>
  )
}
