'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { User, Mail, Phone, ExternalLink, Calendar, Clock, Save, Loader2, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Star as StarIcon } from 'lucide-react'
import type {
  RecruitmentCandidate,
  RecruitmentCommunication,
  RecruitmentStageLog,
  RecruitmentPainPitch,
  CommunicationType,
  CommunicationDirection,
} from '@/types/recruitment'
import { CANDIDATE_SOURCES, CANDIDATE_STATUSES } from '@/types/recruitment'
import { CommunicationsTimeline } from './communications-timeline'
import { upsertPainPitch } from '@/app/dashboard/recrutamento/actions'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface CandidateOverviewTabProps {
  candidate: RecruitmentCandidate
  candidateId?: string
  communications: RecruitmentCommunication[]
  stageLogs: RecruitmentStageLog[]
  painPitchRecords?: RecruitmentPainPitch[]
  recruiters: Array<{ id: string; commercial_name: string }>
  onUpdateCandidate: (updates: Partial<RecruitmentCandidate>) => Promise<void>
  onAddCommunication: (data: { type: CommunicationType; direction: CommunicationDirection; subject: string; content: string }) => Promise<void>
  onReload?: () => Promise<void>
  savingCandidate: boolean
  savingComm: boolean
  hideDecision?: boolean
}

function fmt(date: string | null) {
  if (!date) return '—'
  return format(parseISO(date), "d MMM yyyy, HH:mm", { locale: pt })
}

function InfoRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/10 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs font-medium text-right max-w-[60%] truncate ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
    </div>
  )
}

const cardClass = 'rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm'
const cardHeaderClass = 'px-4 py-2.5 border-b border-border/20 bg-muted/20'
const cardBodyClass = 'px-4 py-3'

export function CandidateOverviewTab({
  candidate, candidateId, communications, stageLogs, painPitchRecords, recruiters,
  onUpdateCandidate, onAddCommunication, onReload, savingCandidate, savingComm, hideDecision,
}: CandidateOverviewTabProps) {
  const [notes, setNotes] = useState(candidate.notes ?? '')
  const [reasonYes, setReasonYes] = useState(candidate.reason_yes ?? '')
  const [reasonNo, setReasonNo] = useState(candidate.reason_no ?? '')
  const [showHistory, setShowHistory] = useState(false)

  // Pain & Pitch inline form
  const lastPp = painPitchRecords && painPitchRecords.length > 0 ? painPitchRecords[painPitchRecords.length - 1] : null
  const [ppForm, setPpForm] = useState({
    id: lastPp?.id ?? '',
    identified_pains: lastPp?.identified_pains ?? '',
    solutions_presented: lastPp?.solutions_presented ?? '',
    candidate_objections: lastPp?.candidate_objections ?? '',
    fit_score: lastPp?.fit_score ?? 0,
  })
  const [savingPp, setSavingPp] = useState(false)
  const [ppHoverScore, setPpHoverScore] = useState(0)

  const handleSavePainPitch = async () => {
    if (!candidateId) return
    setSavingPp(true)
    const payload: any = {
      identified_pains: ppForm.identified_pains || null,
      solutions_presented: ppForm.solutions_presented || null,
      candidate_objections: ppForm.candidate_objections || null,
      fit_score: ppForm.fit_score || null,
    }
    if (ppForm.id) payload.id = ppForm.id
    const { error } = await upsertPainPitch(candidateId, payload)
    setSavingPp(false)
    if (error) { toast.error(error) } else { toast.success('Pain & Pitch guardado'); onReload?.() }
  }

  const showDecision = !hideDecision && ['decision_pending', 'joined', 'declined'].includes(candidate.status)
  const recruiterName = recruiters.find(r => r.id === candidate.assigned_recruiter_id)?.commercial_name

  return (
    <div className="space-y-4">
      {/* Decision (when applicable) */}
      {showDecision && (
        <div className={cardClass}>
          <div className={cardHeaderClass}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Decisão</h3>
          </div>
          <div className={`${cardBodyClass} space-y-3`}>
            <div>
              <Label className="text-[10px] text-emerald-600 uppercase tracking-wider font-semibold">A favor</Label>
              <Textarea className="mt-1 min-h-[50px] text-xs" placeholder="Pontos a favor..." value={reasonYes} onChange={e => setReasonYes(e.target.value)} />
            </div>
            <div>
              <Label className="text-[10px] text-red-500 uppercase tracking-wider font-semibold">Contra</Label>
              <Textarea className="mt-1 min-h-[50px] text-xs" placeholder="Pontos contra..." value={reasonNo} onChange={e => setReasonNo(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Pain & Pitch — inline editable */}
      {candidateId && (
        <div className={cardClass}>
          <div className={cardHeaderClass}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pain & Pitch</h3>
          </div>
          <div className={`${cardBodyClass} space-y-4`}>
            <div>
              <Label className="text-[10px] text-amber-600 uppercase tracking-wider font-semibold">Dores Identificadas</Label>
              <Textarea className="mt-1 min-h-[50px] text-xs" placeholder="Quais são as dores/frustrações do candidato..."
                value={ppForm.identified_pains} onChange={e => setPpForm(f => ({ ...f, identified_pains: e.target.value }))} />
            </div>
            <div>
              <Label className="text-[10px] text-emerald-600 uppercase tracking-wider font-semibold">Soluções Apresentadas</Label>
              <Textarea className="mt-1 min-h-[50px] text-xs" placeholder="Que soluções apresentámos..."
                value={ppForm.solutions_presented} onChange={e => setPpForm(f => ({ ...f, solutions_presented: e.target.value }))} />
            </div>
            <div>
              <Label className="text-[10px] text-red-500 uppercase tracking-wider font-semibold">Objecções</Label>
              <Textarea className="mt-1 min-h-[50px] text-xs" placeholder="Objecções levantadas pelo candidato..."
                value={ppForm.candidate_objections} onChange={e => setPpForm(f => ({ ...f, candidate_objections: e.target.value }))} />
            </div>
          </div>
        </div>
      )}

      {/* Communications — only in histórico tab (when stageLogs are passed) */}
      {(communications.length > 0 || stageLogs.length > 0) && (
        <div className={cardClass}>
          <div className={cardHeaderClass}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Comunicações</h3>
          </div>
          <div className={cardBodyClass}>
            <CommunicationsTimeline communications={communications} onAddCommunication={onAddCommunication} saving={savingComm} />
          </div>
        </div>
      )}

      {/* Stage history */}
      {stageLogs.length > 0 && (
        <div className={cardClass}>
          <button
            type="button"
            className={`${cardHeaderClass} flex w-full items-center justify-between text-left hover:bg-muted/30 transition-colors`}
            onClick={() => setShowHistory(v => !v)}
          >
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Histórico de Fases
            </h3>
            {showHistory ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          {showHistory && (
            <div className={`${cardBodyClass} space-y-2`}>
              {stageLogs.map(log => {
                const from = log.from_status ? CANDIDATE_STATUSES[log.from_status] : null
                const to = CANDIDATE_STATUSES[log.to_status]
                return (
                  <div key={log.id} className="flex items-start gap-2.5 rounded-lg bg-muted/20 px-3 py-2">
                    <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-sm">
                        {from ? (
                          <Badge variant="outline" className={`text-xs ${from.color}`}>{from.label}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Inicio</Badge>
                        )}
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="outline" className={`text-xs ${to.color}`}>{to.label}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {log.user && <span>{log.user.commercial_name}</span>}
                        <span>{fmt(log.created_at)}</span>
                      </div>
                      {log.notes && <p className="mt-1 text-xs">{log.notes}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
