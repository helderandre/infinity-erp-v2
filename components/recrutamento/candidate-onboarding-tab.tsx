// @ts-nocheck
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  CheckCircle2, Circle, Loader2, UserCheck, Target, Calendar, FileText,
  Eye, UserPlus, AlertTriangle, Building2, FileSignature, Key, Mail,
  GraduationCap, Copy, Upload, Link2, Search, Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  upsertOnboarding, upsertProbation,
  getContractTemplates, generateContract, getContracts, getLinkedSubmission,
  createConsultorFromCandidate,
} from '@/app/dashboard/recrutamento/actions'
import type {
  RecruitmentCandidate, RecruitmentOnboarding, RecruitmentProbation,
  ProbationStatus, OnboardingStageKey, ContractSedeStatus, ContractOursStatus,
} from '@/types/recruitment'
import {
  PROBATION_STATUSES, ONBOARDING_STAGES,
  CONTRACT_SEDE_STATUSES, CONTRACT_OURS_STATUSES,
} from '@/types/recruitment'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CandidateOnboardingTabProps {
  candidateId: string
  candidate: RecruitmentCandidate
  onboarding: RecruitmentOnboarding | null
  probation: RecruitmentProbation | null
  recruiters: Array<{ id: string; commercial_name: string }>
  onReload: () => Promise<void>
}

interface OnboardingData {
  onboarding: RecruitmentOnboarding | null
  submission: any | null
  current_stage: OnboardingStageKey
  percent_complete: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const cardClass = 'rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm'
const sectionClass = 'p-5 space-y-4'

const STAGE_ICONS: Record<string, any> = {
  FileText, CheckCircle2, Building2, FileSignature, Key, Mail, GraduationCap, Target,
}

function getStageIcon(iconName: string) {
  return STAGE_ICONS[iconName] || Circle
}

function isStageComplete(stageKey: OnboardingStageKey, data: OnboardingData): boolean {
  const { onboarding: onb, submission: sub } = data
  switch (stageKey) {
    case 'form_submitted': return !!sub
    case 'admin_validation': return sub?.status === 'approved'
    case 'contract_sede': return onb?.contract_sede_status === 'signed'
    case 'contract_ours': return onb?.contract_ours_status === 'signed'
    case 'access_creation': return !!(onb?.app_access_created && onb?.remax_access_granted)
    case 'email_materials': return !!(onb?.email_created && onb?.materials_ready)
    case 'initial_training': return !!onb?.initial_training_completed
    case 'plan_66_days': return !!onb?.plan_66_started
    default: return false
  }
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CandidateOnboardingTab({
  candidateId, candidate, onboarding: initialOnboarding, probation, recruiters, onReload,
}: CandidateOnboardingTabProps) {
  const [data, setData] = useState<OnboardingData>({
    onboarding: initialOnboarding,
    submission: null,
    current_stage: initialOnboarding?.current_stage as OnboardingStageKey || 'form_submitted',
    percent_complete: 0,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedStage, setExpandedStage] = useState<OnboardingStageKey | null>(null)
  const stageRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Fetch onboarding data
  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/recrutamento/candidates/${candidateId}/onboarding`)
      if (res.ok) {
        const d = await res.json()
        setData(d)
        setExpandedStage(prev => prev || d.current_stage)
      }
    } catch {}
    setLoading(false)
  }, [candidateId])

  useEffect(() => { loadData() }, [loadData])

  // Save onboarding field
  const saveField = useCallback(async (updates: Partial<RecruitmentOnboarding>) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/recrutamento/candidates/${candidateId}/onboarding`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const d = await res.json()
        setData(prev => ({
          ...prev,
          onboarding: d.onboarding,
          current_stage: d.current_stage,
          percent_complete: d.percent_complete,
        }))
        toast.success('Guardado')
      } else {
        toast.error('Erro ao guardar')
      }
    } catch {
      toast.error('Erro ao guardar')
    }
    setSaving(false)
  }, [candidateId])

  // Guard: candidate must be 'joined' or 'decision_pending'
  if (!['joined', 'decision_pending'].includes(candidate.status)) {
    return (
      <div className={cn(cardClass, 'flex flex-col items-center justify-center gap-3 py-16 p-6')}>
        <UserCheck className="h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground text-center max-w-md">
          O onboarding fica disponível quando o estado for &quot;Decisão Pendente&quot; ou &quot;Aderiu&quot;.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const scrollToStage = (key: OnboardingStageKey) => {
    setExpandedStage(key)
    setTimeout(() => {
      stageRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  return (
    <div className="space-y-5">
      {/* ─── Pipeline Progress Bar ─────────────────────────────────── */}
      <PipelineBar
        data={data}
        onStageClick={scrollToStage}
        expandedStage={expandedStage}
      />

      {/* ─── Stage Sections ────────────────────────────────────────── */}
      <div className="space-y-4">
        {ONBOARDING_STAGES.map((stage) => {
          const complete = isStageComplete(stage.key, data)
          const isCurrent = data.current_stage === stage.key
          const isExpanded = expandedStage === stage.key

          return (
            <div
              key={stage.key}
              ref={(el) => { stageRefs.current[stage.key] = el }}
              className={cn(
                cardClass,
                'transition-all overflow-hidden',
                isCurrent && 'ring-1 ring-primary/30',
              )}
            >
              {/* Stage Header */}
              <button
                type="button"
                className="w-full flex items-center gap-3 p-4 hover:bg-muted/20 transition-colors"
                onClick={() => setExpandedStage(isExpanded ? null : stage.key)}
              >
                <StageIndicator complete={complete} isCurrent={isCurrent} iconName={stage.iconName} />
                <div className="flex-1 text-left">
                  <p className={cn('text-sm font-medium', complete && 'text-emerald-700')}>
                    {stage.label}
                  </p>
                </div>
                {complete && (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                    Concluído
                  </Badge>
                )}
                {isCurrent && !complete && (
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] animate-pulse">
                    Em curso
                  </Badge>
                )}
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-border/20">
                  <StageContent
                    stageKey={stage.key}
                    data={data}
                    candidateId={candidateId}
                    candidate={candidate}
                    recruiters={recruiters}
                    saving={saving}
                    onSave={saveField}
                    onReload={async () => { await loadData(); await onReload() }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ─── Probation Section (below pipeline) ────────────────────── */}
      {candidate.status === 'joined' && (
        <ProbationSection candidateId={candidateId} probation={probation} onReload={onReload} />
      )}
    </div>
  )
}

// ─── Pipeline Bar ─────────────────────────────────────────────────────────────

function PipelineBar({ data, onStageClick, expandedStage }: {
  data: OnboardingData
  onStageClick: (key: OnboardingStageKey) => void
  expandedStage: OnboardingStageKey | null
}) {
  return (
    <div className={cn(cardClass, 'p-4')}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pipeline de Onboarding</p>
        <Badge variant="outline" className="text-xs">{data.percent_complete}%</Badge>
      </div>
      <Progress value={data.percent_complete} className="h-2 mb-4" />
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {ONBOARDING_STAGES.map((stage, i) => {
          const complete = isStageComplete(stage.key, data)
          const isCurrent = data.current_stage === stage.key
          const isSelected = expandedStage === stage.key
          const Icon = getStageIcon(stage.iconName)

          return (
            <div key={stage.key} className="flex items-center">
              {i > 0 && (
                <div className={cn(
                  'h-px w-3 sm:w-5 shrink-0',
                  complete ? 'bg-emerald-400' : 'bg-border/40',
                )} />
              )}
              <button
                type="button"
                onClick={() => onStageClick(stage.key)}
                className={cn(
                  'flex flex-col items-center gap-1 px-1.5 py-1 rounded-lg transition-all min-w-[52px]',
                  isSelected && 'bg-muted/40',
                  'hover:bg-muted/30',
                )}
              >
                <div className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-all',
                  complete && 'bg-emerald-500 text-white',
                  isCurrent && !complete && 'bg-blue-500 text-white ring-2 ring-blue-200',
                  !complete && !isCurrent && 'bg-muted/50 text-muted-foreground/50',
                )}>
                  {complete ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                </div>
                <span className={cn(
                  'text-[9px] leading-tight text-center whitespace-nowrap',
                  complete ? 'text-emerald-700 font-medium' : 'text-muted-foreground',
                  isCurrent && !complete && 'text-blue-700 font-medium',
                )}>
                  {stage.label}
                </span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Stage Indicator ──────────────────────────────────────────────────────────

function StageIndicator({ complete, isCurrent, iconName }: {
  complete: boolean; isCurrent: boolean; iconName: string
}) {
  const Icon = getStageIcon(iconName)
  return (
    <div className={cn(
      'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
      complete && 'bg-emerald-100 text-emerald-600',
      isCurrent && !complete && 'bg-blue-100 text-blue-600',
      !complete && !isCurrent && 'bg-muted/40 text-muted-foreground/50',
    )}>
      {complete ? <CheckCircle2 className="h-4.5 w-4.5" /> : <Icon className="h-4.5 w-4.5" />}
    </div>
  )
}

// ─── Stage Content Router ─────────────────────────────────────────────────────

function StageContent({ stageKey, data, candidateId, candidate, recruiters, saving, onSave, onReload }: {
  stageKey: OnboardingStageKey
  data: OnboardingData
  candidateId: string
  candidate: RecruitmentCandidate
  recruiters: Array<{ id: string; commercial_name: string }>
  saving: boolean
  onSave: (updates: Partial<RecruitmentOnboarding>) => Promise<void>
  onReload: () => Promise<void>
}) {
  switch (stageKey) {
    case 'form_submitted':
      return <StageFormSubmitted data={data} candidateId={candidateId} />
    case 'admin_validation':
      return <StageAdminValidation data={data} onReload={onReload} />
    case 'contract_sede':
      return <StageContractSede data={data} saving={saving} onSave={onSave} />
    case 'contract_ours':
      return <StageContractOurs data={data} candidateId={candidateId} candidate={candidate} saving={saving} onSave={onSave} onReload={onReload} />
    case 'access_creation':
      return <StageAccessCreation data={data} candidateId={candidateId} candidate={candidate} saving={saving} onSave={onSave} onReload={onReload} />
    case 'email_materials':
      return <StageEmailMaterials data={data} saving={saving} onSave={onSave} />
    case 'initial_training':
      return <StageInitialTraining data={data} saving={saving} onSave={onSave} />
    case 'plan_66_days':
      return <StagePlan66Days data={data} saving={saving} onSave={onSave} />
    default:
      return null
  }
}

// ─── Stage 1: Formulário ──────────────────────────────────────────────────────

function StageFormSubmitted({ data, candidateId }: {
  data: OnboardingData; candidateId: string
}) {
  const { submission } = data
  const formLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/entryform?c=${candidateId}`

  const copyLink = () => {
    navigator.clipboard.writeText(formLink)
    toast.success('Link copiado! Envie ao consultor.')
  }

  if (submission) {
    return (
      <div className={sectionClass}>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <p className="text-sm font-medium">Formulário preenchido</p>
        </div>
        <div className="rounded-xl bg-muted/20 border border-border/20 p-3 space-y-1.5">
          <InfoRow label="Nome" value={submission.display_name || submission.full_name} />
          <InfoRow label="Email" value={submission.personal_email} />
          <InfoRow label="Telemóvel" value={submission.professional_phone} />
          <InfoRow label="NIF" value={submission.nif} />
          <InfoRow label="Estado" value={
            submission.status === 'approved' ? 'Aprovado' :
            submission.status === 'rejected' ? 'Rejeitado' : 'Pendente'
          } />
          <InfoRow label="Submetido" value={submission.submitted_at ? new Date(submission.submitted_at).toLocaleDateString('pt-PT') : '—'} />
        </div>
      </div>
    )
  }

  return (
    <div className={sectionClass}>
      <div className="flex items-center gap-2 text-amber-600">
        <Clock className="h-4 w-4" />
        <p className="text-sm font-medium">Aguardar preenchimento do formulário</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Envie o link do formulário de entrada ao candidato para iniciar o processo.
      </p>
      <div className="flex items-center gap-2">
        <Input value={formLink} readOnly className="text-xs h-9 flex-1 font-mono bg-muted/20" />
        <Button size="sm" variant="outline" onClick={copyLink} className="shrink-0 gap-1.5">
          <Copy className="h-3.5 w-3.5" />
          Copiar
        </Button>
      </div>
    </div>
  )
}

// ─── Stage 2: Validação Administrativa ────────────────────────────────────────

function StageAdminValidation({ data, onReload }: { data: OnboardingData; onReload: () => Promise<void> }) {
  const { submission } = data
  const [saving, setSaving] = useState(false)

  if (!submission) {
    return (
      <div className={sectionClass}>
        <p className="text-xs text-muted-foreground">
          Aguardar submissão do formulário para validação.
        </p>
      </div>
    )
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
  }

  const statusLabels: Record<string, string> = {
    pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado',
  }

  const checks = [
    { label: 'Dados pessoais completos', done: !!(submission.full_name && submission.nif && submission.date_of_birth) },
    { label: 'Documentos CC recebidos (frente + verso)', done: !!(submission.id_document_front_url && submission.id_document_back_url) },
    { label: 'Foto profissional recebida', done: !!submission.professional_photo_url },
  ]

  const handleUpdateStatus = async (newStatus: 'approved' | 'rejected') => {
    setSaving(true)
    try {
      const { updateEntrySubmission } = await import('@/app/dashboard/recrutamento/actions')
      const { error } = await updateEntrySubmission(submission.id, {
        status: newStatus,
        reviewed_at: new Date().toISOString(),
      })
      if (error) { toast.error(error); return }
      toast.success(newStatus === 'approved' ? 'Submissão aprovada' : 'Submissão rejeitada')
      await onReload()
    } catch {
      toast.error('Erro ao actualizar')
    }
    setSaving(false)
  }

  return (
    <div className={sectionClass}>
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">Estado da submissão</p>
        <Badge className={cn('text-[10px]', statusColors[submission.status] || statusColors.pending)}>
          {statusLabels[submission.status] || 'Pendente'}
        </Badge>
      </div>

      <div className="space-y-2 mt-2">
        {checks.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            {c.done
              ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              : <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
            <span className={cn('text-xs', c.done && 'text-muted-foreground line-through')}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* Approve / Reject buttons */}
      {submission.status === 'pending' && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/20">
          <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={saving} onClick={() => handleUpdateStatus('approved')}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Aprovar
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
            disabled={saving} onClick={() => handleUpdateStatus('rejected')}>
            <Circle className="h-3.5 w-3.5" />
            Rejeitar
          </Button>
        </div>
      )}

      {submission.status === 'rejected' && (
        <div className="mt-3 pt-3 border-t border-border/20">
          <Button size="sm" variant="outline" className="gap-1.5"
            disabled={saving} onClick={() => handleUpdateStatus('approved')}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Reverter para Aprovado
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Stage 3: Contrato Sede ───────────────────────────────────────────────────

function StageContractSede({ data, saving, onSave }: {
  data: OnboardingData; saving: boolean; onSave: (u: any) => Promise<void>
}) {
  const onb = data.onboarding
  const status = (onb?.contract_sede_status || 'pending') as ContractSedeStatus

  return (
    <div className={sectionClass}>
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-sm font-medium">Estado do contrato sede</p>
        <Select
          value={status}
          onValueChange={(v) => onSave({ contract_sede_status: v as ContractSedeStatus })}
          disabled={saving}
        >
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CONTRACT_SEDE_STATUSES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {onb?.contract_sede_requested_at && (
        <p className="text-xs text-muted-foreground">
          Solicitado em {new Date(onb.contract_sede_requested_at).toLocaleDateString('pt-PT')}
        </p>
      )}
      {onb?.contract_sede_signed_at && (
        <p className="text-xs text-muted-foreground">
          Assinado em {new Date(onb.contract_sede_signed_at).toLocaleDateString('pt-PT')}
        </p>
      )}

      <div className="flex items-center gap-2 mt-1">
        {status === 'pending' && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" disabled={saving}
            onClick={() => onSave({
              contract_sede_status: 'requested',
              contract_sede_requested_at: new Date().toISOString(),
            })}>
            <Building2 className="h-3.5 w-3.5" />
            Solicitar à Sede
          </Button>
        )}
        {status !== 'signed' && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" disabled={saving}
            onClick={() => onSave({
              contract_sede_status: 'signed',
              contract_sede_signed_at: new Date().toISOString(),
            })}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Marcar como Assinado
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Stage 4: Contrato Nosso ──────────────────────────────────────────────────

function StageContractOurs({ data, candidateId, candidate, saving, onSave, onReload }: {
  data: OnboardingData; candidateId: string; candidate: RecruitmentCandidate
  saving: boolean; onSave: (u: any) => Promise<void>; onReload: () => Promise<void>
}) {
  const onb = data.onboarding
  const status = (onb?.contract_ours_status || 'pending') as ContractOursStatus
  const [templates, setTemplates] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [generating, setGenerating] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([getContractTemplates(), getContracts(candidateId)])
      .then(([tpl, ctr]) => {
        setTemplates(tpl.templates)
        setContracts(ctr.contracts)
        setLoaded(true)
      })
  }, [candidateId])

  const handleGenerate = async () => {
    if (!selectedTemplate) { toast.error('Seleccione um template'); return }
    setGenerating(true)
    const contractData: Record<string, string> = {
      nome_completo: data.submission?.full_name || candidate.full_name || '',
      nif: data.submission?.nif || '',
      niss: data.submission?.niss || '',
      morada: data.submission?.full_address || '',
      telemovel: data.submission?.professional_phone || candidate.phone || '',
      email_profissional: data.submission?.personal_email || candidate.email || '',
      data_contrato: new Date().toISOString().slice(0, 10),
      empresa: 'Infinity Group',
    }
    const { error } = await generateContract(candidateId, selectedTemplate, contractData)
    setGenerating(false)
    if (error) { toast.error(error); return }
    toast.success('Contrato gerado')
    onSave({ contract_ours_status: 'generated', contract_ours_generated_at: new Date().toISOString() })
    const res = await getContracts(candidateId)
    setContracts(res.contracts)
  }

  return (
    <div className={sectionClass}>
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-sm font-medium">Estado do nosso contrato</p>
        <Select
          value={status}
          onValueChange={(v) => onSave({ contract_ours_status: v as ContractOursStatus })}
          disabled={saving}
        >
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CONTRACT_OURS_STATUSES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Generate contract */}
      {loaded && templates.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger className="w-52 h-8 text-xs">
              <SelectValue placeholder="Seleccionar template..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleGenerate} disabled={generating || !selectedTemplate}>
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSignature className="h-3.5 w-3.5" />}
            Gerar Contrato
          </Button>
        </div>
      )}

      {contracts.length > 0 && (
        <div className="space-y-1.5 mt-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Contratos gerados</p>
          {contracts.map(c => (
            <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border/20 bg-muted/20 p-2 text-xs">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{c.template?.name || 'Contrato'}</span>
              <Badge variant="outline" className={cn('text-[10px]',
                c.status === 'draft' && 'bg-amber-50 text-amber-700',
                c.status === 'sent' && 'bg-blue-50 text-blue-700',
                c.status === 'signed' && 'bg-emerald-50 text-emerald-700',
              )}>{c.status === 'draft' ? 'Rascunho' : c.status === 'sent' ? 'Enviado' : 'Assinado'}</Badge>
            </div>
          ))}
        </div>
      )}

      {status !== 'signed' && (
        <Button size="sm" variant="outline" className="gap-1.5 text-xs mt-1" disabled={saving}
          onClick={() => onSave({
            contract_ours_status: 'signed',
            contract_ours_signed_at: new Date().toISOString(),
          })}>
          <CheckCircle2 className="h-3.5 w-3.5" />
          Marcar como Assinado
        </Button>
      )}
    </div>
  )
}

// ─── Stage 5: Criação de Acessos ──────────────────────────────────────────────

function StageAccessCreation({ data, candidateId, candidate, saving, onSave, onReload }: {
  data: OnboardingData; candidateId: string; candidate: RecruitmentCandidate
  saving: boolean; onSave: (u: any) => Promise<void>; onReload: () => Promise<void>
}) {
  const onb = data.onboarding
  const [showConfirm, setShowConfirm] = useState(false)
  const [creating, setCreating] = useState(false)

  const checks = [
    { key: 'app_access_created', label: 'Acesso à APP criado', checked: onb?.app_access_created ?? false },
    { key: 'remax_access_requested', label: 'Acesso RE/MAX solicitado', checked: onb?.remax_access_requested ?? false },
    { key: 'remax_access_granted', label: 'Acesso RE/MAX concedido', checked: onb?.remax_access_granted ?? false },
  ]

  const handleCreateConsultor = async () => {
    setShowConfirm(false)
    setCreating(true)
    const { userId, error } = await createConsultorFromCandidate(candidateId, {
      professional_email: candidate.email || '',
      commercial_name: candidate.full_name,
      full_name: candidate.full_name,
      phone_commercial: candidate.phone || undefined,
    })
    setCreating(false)
    if (error) { toast.error(error); return }
    toast.success('Consultor criado com sucesso!')
    onSave({ app_access_created: true, accesses_created: true })
    onReload()
  }

  const allChecked = checks.every(c => c.checked)
  const canCreate = candidate.email && candidate.full_name && !(candidate as any).consultant_user_id

  return (
    <div className={sectionClass}>
      <div className="space-y-2.5">
        {checks.map(c => (
          <div key={c.key} className="flex items-center gap-3">
            <Switch
              checked={c.checked}
              onCheckedChange={(v) => onSave({ [c.key]: v })}
              disabled={saving}
            />
            <span className={cn('text-sm', c.checked && 'text-muted-foreground line-through')}>{c.label}</span>
          </div>
        ))}
      </div>

      <Separator className="my-3" />

      {(candidate as any).consultant_user_id ? (
        <div className="flex items-center gap-2 text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm font-medium">Consultor já criado</span>
        </div>
      ) : (
        <>
          <Button size="sm" className="gap-1.5" disabled={creating || !canCreate}
            onClick={() => setShowConfirm(true)}>
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
            Criar Consultor
          </Button>
          {!canCreate && !((candidate as any).consultant_user_id) && (
            <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
              <AlertTriangle className="h-3 w-3" />
              O candidato precisa de email e nome preenchidos.
            </p>
          )}

          <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Criar consultor</AlertDialogTitle>
                <AlertDialogDescription>
                  Criar o consultor <strong>{candidate.full_name}</strong> com email <strong>{candidate.email}</strong>?
                  Será criado utilizador, perfil e dados privados automaticamente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleCreateConsultor}>Confirmar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  )
}

// ─── Stage 6: Email & Materiais ───────────────────────────────────────────────

function StageEmailMaterials({ data, saving, onSave }: {
  data: OnboardingData; saving: boolean; onSave: (u: any) => Promise<void>
}) {
  const onb = data.onboarding
  const [emailAddr, setEmailAddr] = useState(onb?.email_address || '')

  const checks = [
    { key: 'email_created', label: 'Email criado', checked: onb?.email_created ?? false },
    { key: 'email_signature_generated', label: 'Assinatura de email gerada', checked: onb?.email_signature_generated ?? false },
    { key: 'materials_ready', label: 'Materiais de marketing prontos', checked: onb?.materials_ready ?? false },
  ]

  return (
    <div className={sectionClass}>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Email profissional (@remax.pt)</Label>
        <div className="flex items-center gap-2">
          <Input
            value={emailAddr}
            onChange={(e) => setEmailAddr(e.target.value)}
            placeholder="nome@remax.pt"
            className="h-8 text-sm flex-1"
          />
          <Button size="sm" variant="outline" className="text-xs shrink-0" disabled={saving || !emailAddr.trim()}
            onClick={() => onSave({ email_address: emailAddr.trim() })}>
            Guardar
          </Button>
        </div>
      </div>

      <div className="space-y-2.5 mt-3">
        {checks.map(c => (
          <div key={c.key} className="flex items-center gap-3">
            <Switch
              checked={c.checked}
              onCheckedChange={(v) => onSave({ [c.key]: v })}
              disabled={saving}
            />
            <span className={cn('text-sm', c.checked && 'text-muted-foreground line-through')}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Stage 7: Formação Inicial ────────────────────────────────────────────────

function StageInitialTraining({ data, saving, onSave }: {
  data: OnboardingData; saving: boolean; onSave: (u: any) => Promise<void>
}) {
  const onb = data.onboarding
  const [date, setDate] = useState(onb?.initial_training_date || '')

  return (
    <div className={sectionClass}>
      <div className="flex items-center gap-3">
        <Switch
          checked={onb?.initial_training_completed ?? false}
          onCheckedChange={(v) => onSave({ initial_training_completed: v })}
          disabled={saving}
        />
        <span className="text-sm font-medium">Formação inicial concluída</span>
      </div>

      <div className="mt-2">
        <Label className="text-xs text-muted-foreground">Data da formação</Label>
        <div className="flex items-center gap-2 mt-1">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 text-sm w-48"
          />
          <Button size="sm" variant="outline" className="text-xs" disabled={saving || !date}
            onClick={() => onSave({ initial_training_date: date })}>
            Guardar
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Stage 8: Plano 66 Dias ──────────────────────────────────────────────────

function StagePlan66Days({ data, saving, onSave }: {
  data: OnboardingData; saving: boolean; onSave: (u: any) => Promise<void>
}) {
  const onb = data.onboarding
  const [date, setDate] = useState(onb?.plan_66_start_date || '')

  return (
    <div className={sectionClass}>
      <div className="flex items-center gap-3">
        <Switch
          checked={onb?.plan_66_started ?? false}
          onCheckedChange={(v) => onSave({ plan_66_started: v })}
          disabled={saving}
        />
        <span className="text-sm font-medium">Plano 66 dias iniciado</span>
      </div>

      <div className="mt-2">
        <Label className="text-xs text-muted-foreground">Data de início</Label>
        <div className="flex items-center gap-2 mt-1">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 text-sm w-48"
          />
          <Button size="sm" variant="outline" className="text-xs" disabled={saving || !date}
            onClick={() => onSave({ plan_66_start_date: date })}>
            Guardar
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        Futuramente ligado ao módulo de objectivos para acompanhamento dos 66 dias.
      </p>
    </div>
  )
}

// ─── Info Row helper ──────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%] truncate">{value || '—'}</span>
    </div>
  )
}

// ─── Probation Section (preserved from original) ─────────────────────────────

function ProbationSection({ candidateId, probation, onReload }: {
  candidateId: string
  probation: RecruitmentProbation | null
  onReload: () => Promise<void>
}) {
  const today = new Date().toISOString().split('T')[0]
  const [startDate, setStartDate] = useState(probation?.start_date ?? today)
  const [endDate, setEndDate] = useState(probation?.end_date ?? addDays(today, 90))
  const [status, setStatus] = useState<ProbationStatus>(probation?.status ?? 'active')
  const [m30, setM30] = useState(probation?.milestone_30_days ?? false)
  const [m30Notes, setM30Notes] = useState(probation?.milestone_30_notes ?? '')
  const [m60, setM60] = useState(probation?.milestone_60_days ?? false)
  const [m60Notes, setM60Notes] = useState(probation?.milestone_60_notes ?? '')
  const [m90, setM90] = useState(probation?.milestone_90_days ?? false)
  const [m90Notes, setM90Notes] = useState(probation?.milestone_90_notes ?? '')
  const [bt1, setBt1] = useState(probation?.billing_target_month_1?.toString() ?? '')
  const [ba1, setBa1] = useState(probation?.billing_actual_month_1?.toString() ?? '')
  const [bt2, setBt2] = useState(probation?.billing_target_month_2?.toString() ?? '')
  const [ba2, setBa2] = useState(probation?.billing_actual_month_2?.toString() ?? '')
  const [bt3, setBt3] = useState(probation?.billing_target_month_3?.toString() ?? '')
  const [ba3, setBa3] = useState(probation?.billing_actual_month_3?.toString() ?? '')
  const [notes, setNotes] = useState(probation?.notes ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setEndDate(addDays(startDate, 90)) }, [startDate])

  const handleSave = useCallback(async () => {
    setSaving(true)
    const num = (v: string) => v ? parseFloat(v) : null
    const res = await upsertProbation(candidateId, {
      start_date: startDate, end_date: endDate, status,
      milestone_30_days: m30, milestone_30_notes: m30Notes || null,
      milestone_60_days: m60, milestone_60_notes: m60Notes || null,
      milestone_90_days: m90, milestone_90_notes: m90Notes || null,
      billing_target_month_1: num(bt1), billing_actual_month_1: num(ba1),
      billing_target_month_2: num(bt2), billing_actual_month_2: num(ba2),
      billing_target_month_3: num(bt3), billing_actual_month_3: num(ba3),
      notes: notes || null,
    })
    setSaving(false)
    if (res.success) { toast.success('Período de experiência guardado'); await onReload() }
    else toast.error(res.error ?? 'Erro ao guardar')
  }, [candidateId, startDate, endDate, status, m30, m30Notes, m60, m60Notes, m90, m90Notes, bt1, ba1, bt2, ba2, bt3, ba3, notes, onReload])

  const milestones = [
    { days: 30, checked: m30, toggle: () => setM30(v => !v), notes: m30Notes, setNotes: setM30Notes },
    { days: 60, checked: m60, toggle: () => setM60(v => !v), notes: m60Notes, setNotes: setM60Notes },
    { days: 90, checked: m90, toggle: () => setM90(v => !v), notes: m90Notes, setNotes: setM90Notes },
  ]

  const billing = [
    { label: 'Mês 1', target: bt1, setTarget: setBt1, actual: ba1, setActual: setBa1 },
    { label: 'Mês 2', target: bt2, setTarget: setBt2, actual: ba2, setActual: setBa2 },
    { label: 'Mês 3', target: bt3, setTarget: setBt3, actual: ba3, setActual: setBa3 },
  ]

  function pct(target: string, actual: string) {
    const t = parseFloat(target), a = parseFloat(actual)
    if (!t || isNaN(t) || !a || isNaN(a)) return 0
    return Math.min(Math.round((a / t) * 100), 100)
  }

  return (
    <div className={cn(cardClass, 'p-6')}>
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">Período de Experiência</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <Label className="text-xs text-muted-foreground">Data de início</Label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Data de fim (auto +90 dias)</Label>
          <Input type="date" value={endDate} readOnly className="mt-1 h-9 text-sm bg-muted/30" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Estado</Label>
          <Select value={status} onValueChange={v => setStatus(v as ProbationStatus)}>
            <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.entries(PROBATION_STATUSES) as [ProbationStatus, { label: string; color: string }][]).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator className="my-4" />

      <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Marcos</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {milestones.map(ms => (
          <div key={ms.days} className="rounded-xl border border-border/20 bg-muted/20 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <button type="button" onClick={ms.toggle} className="shrink-0 focus:outline-none">
                {ms.checked ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-muted-foreground/40" />}
              </button>
              <span className="text-sm font-medium">{ms.days} Dias</span>
              {ms.checked && <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-200">Concluído</Badge>}
            </div>
            <Textarea placeholder="Notas..." value={ms.notes} onChange={e => ms.setNotes(e.target.value)} rows={2} className="text-xs resize-none" />
          </div>
        ))}
      </div>

      <Separator className="my-4" />

      <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Facturação: Objectivo vs Real</p>
      <div className="space-y-3 mb-4">
        {billing.map(b => {
          const p = pct(b.target, b.actual)
          return (
            <div key={b.label} className="grid grid-cols-[80px_1fr_1fr_1fr] items-center gap-3">
              <span className="text-sm font-medium">{b.label}</span>
              <Input type="number" placeholder="Objectivo" value={b.target} onChange={e => b.setTarget(e.target.value)} className="h-8 text-xs" />
              <Input type="number" placeholder="Real" value={b.actual} onChange={e => b.setActual(e.target.value)} className="h-8 text-xs" />
              <div className="flex items-center gap-2">
                <Progress value={p} className="h-2 flex-1" />
                <span className="text-xs text-muted-foreground w-10 text-right">{p}%</span>
              </div>
            </div>
          )
        })}
      </div>

      <Separator className="my-4" />

      <div>
        <Label className="text-xs text-muted-foreground">Notas gerais</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-1 text-sm resize-none" placeholder="Observações sobre o período de experiência..." />
      </div>

      <div className="flex justify-end mt-5">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          Guardar Experiência
        </Button>
      </div>
    </div>
  )
}
