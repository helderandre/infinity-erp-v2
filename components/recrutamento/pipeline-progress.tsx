'use client'

import { cn } from '@/lib/utils'
import { CheckCircle2 } from 'lucide-react'
import type { CandidateStatus } from '@/types/recruitment'
import { CANDIDATE_STATUSES } from '@/types/recruitment'

const FLOW_STAGES: CandidateStatus[] = [
  'prospect',
  'in_contact',
  'in_process',
  'decision_pending',
  'joined',
]

interface PipelineProgressProps {
  currentStatus: CandidateStatus
  onStatusChange: (status: CandidateStatus) => void
  disabled?: boolean
}

export function PipelineProgress({ currentStatus, onStatusChange, disabled }: PipelineProgressProps) {
  const isTerminal = currentStatus === 'declined' || currentStatus === 'on_hold'
  const currentIdx = FLOW_STAGES.indexOf(currentStatus)

  function pillClass(stage: CandidateStatus, idx: number) {
    if (isTerminal && currentStatus === 'declined') return 'bg-red-500/30 text-red-200 border-red-400/30'
    if (isTerminal && currentStatus === 'on_hold') return 'bg-orange-500/30 text-orange-200 border-orange-400/30'
    if (idx < currentIdx) return 'bg-emerald-500/40 text-emerald-200 border-emerald-400/30'
    if (stage === currentStatus) return 'bg-white text-neutral-900 border-white/60 shadow-sm'
    return 'bg-white/10 text-neutral-400 border-white/10'
  }

  function lineClass(idx: number) {
    if (isTerminal) return 'bg-white/10'
    return idx < currentIdx ? 'bg-emerald-500/40' : 'bg-white/10'
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center gap-0 w-max">
        {FLOW_STAGES.map((stage, idx) => {
          const isCompleted = !isTerminal && idx < currentIdx
          return (
            <div key={stage} className="flex items-center">
              {idx > 0 && (
                <div className={cn('h-0.5 w-6 sm:w-10 transition-colors', lineClass(idx))} />
              )}
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onStatusChange(stage)}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-medium border transition-all',
                    'hover:scale-110 disabled:pointer-events-none disabled:opacity-50',
                    pillClass(stage, idx),
                  )}
                >
                  {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
                </button>
                <span className="text-[9px] text-neutral-500 whitespace-nowrap">
                  {CANDIDATE_STATUSES[stage].label}
                </span>
              </div>
            </div>
          )
        })}

        {isTerminal && (
          <>
            <div className="h-0.5 w-6 sm:w-10 bg-white/10" />
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold border',
                  currentStatus === 'declined'
                    ? 'bg-red-500/30 text-red-200 border-red-400/30'
                    : 'bg-orange-500/30 text-orange-200 border-orange-400/30',
                )}
              >
                !
              </div>
              <span className="text-[9px] text-neutral-500 whitespace-nowrap">
                {CANDIDATE_STATUSES[currentStatus].label}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
