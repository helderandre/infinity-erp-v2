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

function InfoField({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value || '—'}</p>
      </div>
    </div>
  )
}

const cardClass = 'rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm p-6'

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
    <div className="space-y-6">
      {/* Section 1: Dados do Candidato */}
      <div className={cardClass}>
        <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados do Candidato</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoField icon={User} label="Nome" value={candidate.full_name} />
          <InfoField icon={Mail} label="Email" value={candidate.email} />
          <InfoField icon={Phone} label="Telemovel" value={candidate.phone} />
          <InfoField icon={ExternalLink} label="Origem" value={CANDIDATE_SOURCES[candidate.source]} />
          <InfoField icon={ExternalLink} label="Detalhe origem" value={candidate.source_detail} />
          <InfoField icon={Calendar} label="Primeiro contacto" value={fmt(candidate.first_contact_date)} />
          <InfoField icon={User} label="Recrutador" value={recruiterName} />
        </div>
        <div className="mt-5">
          <Label htmlFor="notes" className="text-xs text-muted-foreground">Notas</Label>
          <Textarea
            id="notes"
            className="mt-1.5 min-h-[80px]"
            placeholder="Notas sobre o candidato..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              disabled={savingCandidate || notes === (candidate.notes ?? '')}
              onClick={() => onUpdateCandidate({ notes })}
            >
              {savingCandidate ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Guardar notas
            </Button>
          </div>
        </div>
      </div>

      {/* Section 2: Decisao */}
      {showDecision && (
        <div className={cardClass}>
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Decisao</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="reason-yes" className="text-xs text-muted-foreground">Razoes para aderir</Label>
              <Textarea id="reason-yes" className="mt-1.5 min-h-[80px]" placeholder="Pontos a favor..." value={reasonYes} onChange={e => setReasonYes(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="reason-no" className="text-xs text-muted-foreground">Razoes para recusar</Label>
              <Textarea id="reason-no" className="mt-1.5 min-h-[80px]" placeholder="Pontos contra..." value={reasonNo} onChange={e => setReasonNo(e.target.value)} />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              disabled={savingCandidate || (reasonYes === (candidate.reason_yes ?? '') && reasonNo === (candidate.reason_no ?? ''))}
              onClick={() => onUpdateCandidate({ reason_yes: reasonYes, reason_no: reasonNo })}
            >
              {savingCandidate ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Guardar decisao
            </Button>
          </div>
        </div>
      )}

      {/* Section 3: Comunicacoes */}
      <div className={cardClass}>
        <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Comunicacoes</h3>
        <CommunicationsTimeline communications={communications} onAddCommunication={onAddCommunication} saving={savingComm} />
      </div>

      {/* Section 4: Historico de Estagios */}
      <div className={cardClass}>
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          onClick={() => setShowHistory(v => !v)}
        >
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Historico de Estagios
          </h3>
          {showHistory ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        <p className="mt-1 text-xs text-muted-foreground">
          {showHistory ? 'Ocultar historico' : 'Mostrar historico'}
        </p>

        {showHistory && (
          <div className="mt-4 space-y-3">
            {stageLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem transicoes registadas.</p>
            ) : (
              stageLogs.map(log => {
                const from = log.from_status ? CANDIDATE_STATUSES[log.from_status] : null
                const to = CANDIDATE_STATUSES[log.to_status]
                return (
                  <div key={log.id} className="flex items-start gap-3 rounded-lg border border-border/20 bg-muted/30 px-3 py-2.5">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
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
  )
}
