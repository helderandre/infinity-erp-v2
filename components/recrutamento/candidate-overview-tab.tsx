'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { User, Mail, Phone, ExternalLink, Calendar, Clock, Save, Loader2, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type {
  RecruitmentCandidate,
  RecruitmentCommunication,
  RecruitmentStageLog,
  CommunicationType,
  CommunicationDirection,
} from '@/types/recruitment'
import { CANDIDATE_SOURCES, CANDIDATE_STATUSES } from '@/types/recruitment'
import { CommunicationsTimeline } from './communications-timeline'

interface CandidateOverviewTabProps {
  candidate: RecruitmentCandidate
  communications: RecruitmentCommunication[]
  stageLogs: RecruitmentStageLog[]
  recruiters: Array<{ id: string; commercial_name: string }>
  onUpdateCandidate: (updates: Partial<RecruitmentCandidate>) => Promise<void>
  onAddCommunication: (data: { type: CommunicationType; direction: CommunicationDirection; subject: string; content: string }) => Promise<void>
  savingCandidate: boolean
  savingComm: boolean
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
  candidate, communications, stageLogs, recruiters,
  onUpdateCandidate, onAddCommunication, savingCandidate, savingComm,
}: CandidateOverviewTabProps) {
  const [notes, setNotes] = useState(candidate.notes ?? '')
  const [reasonYes, setReasonYes] = useState(candidate.reason_yes ?? '')
  const [reasonNo, setReasonNo] = useState(candidate.reason_no ?? '')
  const [showHistory, setShowHistory] = useState(false)

  const showDecision = ['decision_pending', 'joined', 'declined'].includes(candidate.status)
  const recruiterName = recruiters.find(r => r.id === candidate.assigned_recruiter_id)?.commercial_name

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ─── Left column: Info + Notes ─── */}
      <div className="lg:col-span-1 space-y-4">
        {/* Contact info */}
        <div className={cardClass}>
          <div className={cardHeaderClass}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contacto</h3>
          </div>
          <div className={cardBodyClass}>
            <InfoRow label="Nome" value={candidate.full_name} />
            <InfoRow label="Email" value={candidate.email} />
            <InfoRow label="Telemóvel" value={candidate.phone} mono />
          </div>
        </div>

        {/* Origin & Assignment */}
        <div className={cardClass}>
          <div className={cardHeaderClass}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Origem & Atribuição</h3>
          </div>
          <div className={cardBodyClass}>
            <InfoRow label="Origem" value={CANDIDATE_SOURCES[candidate.source]} />
            <InfoRow label="Detalhe" value={candidate.source_detail} />
            <InfoRow label="Recrutador" value={recruiterName} />
            <InfoRow label="1.º Contacto" value={fmt(candidate.first_contact_date)} />
          </div>
        </div>

        {/* Notes */}
        <div className={cardClass}>
          <div className={cardHeaderClass}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notas</h3>
          </div>
          <div className={cardBodyClass}>
            <Textarea
              className="min-h-[60px] text-xs border-0 bg-transparent p-0 focus-visible:ring-0 resize-none"
              placeholder="Notas sobre o candidato..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
            {notes !== (candidate.notes ?? '') && (
              <div className="mt-2 flex justify-end">
                <Button size="sm" className="h-7 text-xs rounded-full gap-1" disabled={savingCandidate} onClick={() => onUpdateCandidate({ notes })}>
                  {savingCandidate ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Guardar
                </Button>
              </div>
            )}
          </div>
        </div>

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
              {(reasonYes !== (candidate.reason_yes ?? '') || reasonNo !== (candidate.reason_no ?? '')) && (
                <div className="flex justify-end">
                  <Button size="sm" className="h-7 text-xs rounded-full gap-1" disabled={savingCandidate} onClick={() => onUpdateCandidate({ reason_yes: reasonYes, reason_no: reasonNo })}>
                    {savingCandidate ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Guardar
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Right column: Communications + History ─── */}
      <div className="lg:col-span-2 space-y-4">
        {/* Communications */}
        <div className={cardClass}>
          <div className={cardHeaderClass}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Comunicações</h3>
          </div>
          <div className={cardBodyClass}>
            <CommunicationsTimeline communications={communications} onAddCommunication={onAddCommunication} saving={savingComm} />
          </div>
        </div>

      {/* Stage history */}
      <div className={cardClass}>
        <button
          type="button"
          className={`${cardHeaderClass} flex w-full items-center justify-between text-left hover:bg-muted/30 transition-colors`}
          onClick={() => setShowHistory(v => !v)}
        >
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Histórico de Estágios
          </h3>
          {showHistory ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>

        {showHistory && (
          <div className={`${cardBodyClass} space-y-2`}>
            {stageLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Sem transições registadas.</p>
            ) : (
              stageLogs.map(log => {
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
              })
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
