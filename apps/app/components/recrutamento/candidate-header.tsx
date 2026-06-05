'use client'

import { formatDistanceToNow, differenceInDays } from 'date-fns'
import { pt } from 'date-fns/locale/pt'
import { ArrowLeft, Mail, Phone, Clock, User, Users, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type RecruitmentCandidate,
  type CandidateStatus,
  CANDIDATE_STATUSES,
  CANDIDATE_SOURCES,
} from '@/types/recruitment'
import { PipelineProgress } from './pipeline-progress'

interface CandidateHeaderProps {
  candidate: RecruitmentCandidate
  recruiters: Array<{ id: string; commercial_name: string }>
  scoreData: { score: number; breakdown: Record<string, number> } | null
  onStatusChange: (status: CandidateStatus) => void
  onBack: () => void
  changingStatus: boolean
}

export function CandidateHeader({
  candidate, recruiters, scoreData, onStatusChange, onBack, changingStatus,
}: CandidateHeaderProps) {
  const recruiter = recruiters.find(r => r.id === candidate.assigned_recruiter_id)
  const statusInfo = CANDIDATE_STATUSES[candidate.status]

  const lastDate = candidate.last_interaction_date
  const daysSince = lastDate ? differenceInDays(new Date(), new Date(lastDate)) : null
  const lastLabel = lastDate ? formatDistanceToNow(new Date(lastDate), { addSuffix: true, locale: pt }) : null

  const scoreColor = scoreData
    ? scoreData.score >= 70 ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400/30'
    : scoreData.score >= 40 ? 'bg-amber-500/30 text-amber-200 border-amber-400/30'
    : 'bg-red-500/30 text-red-200 border-red-400/30'
    : ''

  return (
    <div className="relative overflow-hidden bg-neutral-900 rounded-2xl">
      {/* Gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/80 to-neutral-900/60" />

      {/* Back button */}
      <button
        onClick={onBack}
        className="absolute top-4 left-4 z-20 inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-medium hover:bg-white/25 transition-colors duration-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </button>

      {/* Content */}
      <div className="relative z-10 px-8 pt-14 pb-6 sm:px-10 sm:pt-16 sm:pb-8">
        {/* Label row */}
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-5 w-5 text-neutral-400" />
          <p className="text-neutral-400 text-xs font-medium tracking-widest uppercase">
            Candidato
          </p>
        </div>

        {/* Name + Score stars */}
        <div className="flex items-center gap-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {candidate.full_name}
          </h2>
          {scoreData && (
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map(star => {
                  const filled = scoreData.score >= star * 20
                  const half = !filled && scoreData.score >= (star - 1) * 20 + 10
                  return (
                    <Star
                      key={star}
                      className={cn(
                        'h-4 w-4 transition-colors',
                        filled ? 'text-amber-400 fill-amber-400' :
                        half ? 'text-amber-400 fill-amber-400/50' :
                        'text-white/20'
                      )}
                    />
                  )
                })}
              </div>
              <span className="text-xs font-bold text-amber-400">{scoreData.score}</span>
            </div>
          )}
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-2 flex-wrap mt-3">
          {/* Status */}
          <span className={cn(
            'text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border',
            candidate.status === 'joined' && 'bg-emerald-500/30 text-emerald-200 border-emerald-400/30',
            candidate.status === 'declined' && 'bg-red-500/30 text-red-200 border-red-400/30',
            candidate.status === 'on_hold' && 'bg-orange-500/30 text-orange-200 border-orange-400/30',
            candidate.status === 'prospect' && 'bg-slate-500/30 text-slate-200 border-slate-400/30',
            candidate.status === 'in_contact' && 'bg-blue-500/30 text-blue-200 border-blue-400/30',
            candidate.status === 'in_process' && 'bg-purple-500/30 text-purple-200 border-purple-400/30',
            candidate.status === 'decision_pending' && 'bg-amber-500/30 text-amber-200 border-amber-400/30',
          )}>
            {statusInfo.label}
          </span>

          {/* Source */}
          <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-white/10 text-neutral-300 border border-white/10">
            {CANDIDATE_SOURCES[candidate.source]}
          </span>

          {/* Status change */}
          <select
            value={candidate.status}
            onChange={(e) => onStatusChange(e.target.value as CandidateStatus)}
            disabled={changingStatus}
            className="ml-auto h-7 rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 px-3 text-[11px] font-medium appearance-none cursor-pointer hover:bg-white/25 transition-colors focus:outline-none"
          >
            {Object.entries(CANDIDATE_STATUSES).map(([key, { label }]) => (
              <option key={key} value={key} className="bg-neutral-900 text-white">{label}</option>
            ))}
          </select>
        </div>

        {/* Contact + meta */}
        <div className="flex items-center gap-4 flex-wrap mt-3 text-neutral-400 text-xs">
          {candidate.email && (
            <a href={`mailto:${candidate.email}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
              <Mail className="h-3 w-3" /> {candidate.email}
            </a>
          )}
          {candidate.phone && (
            <a href={`tel:${candidate.phone}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
              <Phone className="h-3 w-3" /> {candidate.phone}
            </a>
          )}
          {recruiter && (
            <span className="flex items-center gap-1.5">
              <User className="h-3 w-3" /> {recruiter.commercial_name}
            </span>
          )}
          {lastLabel && (
            <span className={cn(
              'flex items-center gap-1.5',
              daysSince && daysSince > 14 ? 'text-red-400' : daysSince && daysSince > 7 ? 'text-amber-400' : ''
            )}>
              <Clock className="h-3 w-3" /> {lastLabel}
            </span>
          )}
        </div>

        {/* Pipeline progress */}
        <div className="mt-5">
          <PipelineProgress currentStatus={candidate.status} onStatusChange={onStatusChange} disabled={changingStatus} />
        </div>
      </div>
    </div>
  )
}
