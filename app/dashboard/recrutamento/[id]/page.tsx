'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format, isPast, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale/pt'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import {
  getCandidate,
  updateCandidate,
  getOriginProfile,
  upsertOriginProfile,
  getPainPitchRecords,
  upsertPainPitch,
  deletePainPitch,
  getInterviews,
  createInterview,
  updateInterview,
  deleteInterview,
  getFinancialEvolution,
  upsertFinancialEvolution,
  getBudget,
  upsertBudget,
  getOnboarding,
  upsertOnboarding,
  getStageLog,
  getRecruiters,
  getCommunications,
  createCommunication,
  getProbation,
  upsertProbation,
  calculateCandidateScore,
  findDuplicates,
  mergeCandidates,
} from '@/app/dashboard/recrutamento/actions'

import type {
  RecruitmentCandidate,
  RecruitmentOriginProfile,
  RecruitmentPainPitch,
  RecruitmentInterview,
  RecruitmentFinancialEvolution,
  RecruitmentBudget,
  RecruitmentOnboarding,
  RecruitmentStageLog,
  RecruitmentCommunication,
  RecruitmentProbation,
  CandidateStatus,
  CommunicationType,
  CommunicationDirection,
  ProbationStatus,
  InterviewFormat,
  OriginBrand,
  CampaignPlatform,
  CandidateScoreBreakdown,
} from '@/types/recruitment'

import {
  CANDIDATE_SOURCES,
  CANDIDATE_STATUSES,
  CANDIDATE_DECISIONS,
  ORIGIN_BRANDS,
  INTERVIEW_FORMATS,
  CAMPAIGN_PLATFORMS,
  COMMUNICATION_TYPES,
  COMMUNICATION_DIRECTIONS,
  PROBATION_STATUSES,
} from '@/types/recruitment'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'

import {
  ArrowLeft,
  Star,
  Calendar,
  Phone,
  Mail,
  Clock,
  User,
  Pencil,
  Plus,
  Trash2,
  Loader2,
  Save,
  CheckCircle2,
  Circle,
  MessageSquare,
  TrendingUp,
  Euro,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  StickyNote,
  Users,
  ArrowDownRight,
  ArrowUpRight,
  Target,
  Merge,
  AlertTriangle,
} from 'lucide-react'

// ─── Pipeline stages for the progress bar ──────────────────────────────────
const PIPELINE_STAGES: { key: CandidateStatus; label: string }[] = [
  { key: 'prospect', label: 'Prospecto' },
  { key: 'in_contact', label: 'Em Contacto' },
  { key: 'in_process', label: 'Em Processo' },
  { key: 'decision_pending', label: 'Decisão Pendente' },
  { key: 'joined', label: 'Aderiu' },
]

const TERMINAL_STATUSES: CandidateStatus[] = ['joined', 'declined']

function stageIndex(status: CandidateStatus): number {
  const idx = PIPELINE_STAGES.findIndex((s) => s.key === status)
  return idx >= 0 ? idx : -1
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '-'
  return value.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '-'
  try {
    return format(parseISO(d), "d 'de' MMMM 'de' yyyy", { locale: pt })
  } catch {
    return d
  }
}

function formatDateTime(d: string | null | undefined): string {
  if (!d) return '-'
  try {
    return format(parseISO(d), "d MMM yyyy, HH:mm", { locale: pt })
  } catch {
    return d
  }
}

// ─── Main Page Component ───────────────────────────────────────────────────

export default function CandidateDetailPage() {
  const params = useParams()
  const router = useRouter()
  const candidateId = params.id as string

  // ─── State ─────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [candidate, setCandidate] = useState<RecruitmentCandidate | null>(null)
  const [originProfile, setOriginProfile] = useState<RecruitmentOriginProfile | null>(null)
  const [painPitchRecords, setPainPitchRecords] = useState<RecruitmentPainPitch[]>([])
  const [interviews, setInterviews] = useState<RecruitmentInterview[]>([])
  const [financial, setFinancial] = useState<RecruitmentFinancialEvolution | null>(null)
  const [budget, setBudget] = useState<RecruitmentBudget | null>(null)
  const [onboarding, setOnboarding] = useState<RecruitmentOnboarding | null>(null)
  const [stageLogs, setStageLogs] = useState<RecruitmentStageLog[]>([])
  const [recruiters, setRecruiters] = useState<Array<{ id: string; commercial_name: string }>>([])
  const [communications, setCommunications] = useState<RecruitmentCommunication[]>([])
  const [probation, setProbation] = useState<RecruitmentProbation | null>(null)
  const [scoreData, setScoreData] = useState<{ score: number; breakdown: Record<string, number> } | null>(null)
  const [duplicates, setDuplicates] = useState<(RecruitmentCandidate & { match_reason: 'phone' | 'email' | 'both' })[]>([])

  // UI state
  const [editMode, setEditMode] = useState(false)
  const [statusConfirm, setStatusConfirm] = useState<CandidateStatus | null>(null)
  const [painPitchDialog, setPainPitchDialog] = useState(false)
  const [editingPainPitch, setEditingPainPitch] = useState<RecruitmentPainPitch | null>(null)
  const [interviewDialog, setInterviewDialog] = useState(false)
  const [editingInterview, setEditingInterview] = useState<RecruitmentInterview | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string } | null>(null)
  const [commDialog, setCommDialog] = useState(false)
  const [mergeConfirm, setMergeConfirm] = useState<string | null>(null)

  // Saving states
  const [savingCandidate, setSavingCandidate] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [savingOrigin, setSavingOrigin] = useState(false)
  const [savingPainPitch, setSavingPainPitch] = useState(false)
  const [savingInterview, setSavingInterview] = useState(false)
  const [savingFinancial, setSavingFinancial] = useState(false)
  const [savingBudget, setSavingBudget] = useState(false)
  const [savingOnboarding, setSavingOnboarding] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)
  const [savingComm, setSavingComm] = useState(false)
  const [savingProbation, setSavingProbation] = useState(false)
  const [merging, setMerging] = useState(false)

  // ─── Local form states ─────────────────────────────────────────────────
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    source: '' as string,
    source_detail: '',
    assigned_recruiter_id: '',
    first_contact_date: '',
    reason_yes: '',
    reason_no: '',
  })
  const [notesValue, setNotesValue] = useState('')

  const [originForm, setOriginForm] = useState({
    currently_active_real_estate: false,
    origin_brand: '' as string,
    origin_brand_custom: '',
    time_at_origin_months: '',
    reason_for_leaving: '',
    billing_avg_month: '',
    billing_avg_year: '',
  })

  const [painPitchForm, setPainPitchForm] = useState({
    identified_pains: '',
    solutions_presented: '',
    candidate_objections: '',
    fit_score: 0,
  })

  const [interviewForm, setInterviewForm] = useState({
    interview_date: '',
    format: 'in_person' as string,
    conducted_by: '',
    notes: '',
    next_step: '',
    follow_up_date: '',
  })

  const [financialForm, setFinancialForm] = useState({
    billing_month_1: '',
    billing_month_2: '',
    billing_month_3: '',
    billing_month_6: '',
    billing_month_12: '',
    months_to_match_previous: '',
    notes: '',
  })

  const [budgetForm, setBudgetForm] = useState({
    paid_campaign_used: false,
    campaign_platform: '' as string,
    estimated_cost: '',
    resources_used: '',
  })

  const [onboardingForm, setOnboardingForm] = useState({
    contract_sent: false,
    contract_sent_by: '',
    form_sent: false,
    access_created: false,
    onboarding_start_date: '',
  })

  const [commForm, setCommForm] = useState({
    type: 'call' as string,
    direction: 'outbound' as string,
    subject: '',
    content: '',
  })

  const [probationForm, setProbationForm] = useState({
    start_date: '',
    end_date: '',
    milestone_30_days: false,
    milestone_30_notes: '',
    milestone_60_days: false,
    milestone_60_notes: '',
    milestone_90_days: false,
    milestone_90_notes: '',
    billing_target_month_1: '',
    billing_actual_month_1: '',
    billing_target_month_2: '',
    billing_actual_month_2: '',
    billing_target_month_3: '',
    billing_actual_month_3: '',
    status: 'active' as string,
    notes: '',
  })

  // ─── Load data ─────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    const [
      candidateRes,
      originRes,
      painRes,
      interviewsRes,
      financialRes,
      budgetRes,
      onboardingRes,
      logRes,
      recruitersRes,
      commRes,
      probationRes,
      scoreRes,
      duplicatesRes,
    ] = await Promise.all([
      getCandidate(candidateId),
      getOriginProfile(candidateId),
      getPainPitchRecords(candidateId),
      getInterviews(candidateId),
      getFinancialEvolution(candidateId),
      getBudget(candidateId),
      getOnboarding(candidateId),
      getStageLog(candidateId),
      getRecruiters(),
      getCommunications(candidateId),
      getProbation(candidateId),
      calculateCandidateScore(candidateId),
      findDuplicates(candidateId),
    ])

    if (candidateRes.candidate) {
      setCandidate(candidateRes.candidate)
      setNotesValue(candidateRes.candidate.notes || '')
      populateEditForm(candidateRes.candidate)
    }
    setOriginProfile(originRes.profile)
    if (originRes.profile) populateOriginForm(originRes.profile)
    setPainPitchRecords(painRes.records)
    setInterviews(interviewsRes.interviews)
    setFinancial(financialRes.financial)
    if (financialRes.financial) populateFinancialForm(financialRes.financial)
    setBudget(budgetRes.budget)
    if (budgetRes.budget) populateBudgetForm(budgetRes.budget)
    setOnboarding(onboardingRes.onboarding)
    if (onboardingRes.onboarding) populateOnboardingForm(onboardingRes.onboarding)
    setStageLogs(logRes.logs)
    setRecruiters(recruitersRes.recruiters)
    setCommunications(commRes.communications)
    setProbation(probationRes.probation)
    if (probationRes.probation) populateProbationForm(probationRes.probation)
    if (!scoreRes.error) setScoreData({ score: scoreRes.score, breakdown: scoreRes.breakdown })
    setDuplicates(duplicatesRes.duplicates)

    setLoading(false)
  }, [candidateId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ─── Form populators ──────────────────────────────────────────────────
  function populateEditForm(c: RecruitmentCandidate) {
    setEditForm({
      full_name: c.full_name,
      phone: c.phone || '',
      email: c.email || '',
      source: c.source,
      source_detail: c.source_detail || '',
      assigned_recruiter_id: c.assigned_recruiter_id || '',
      first_contact_date: c.first_contact_date || '',
      reason_yes: c.reason_yes || '',
      reason_no: c.reason_no || '',
    })
  }

  function populateOriginForm(p: RecruitmentOriginProfile) {
    setOriginForm({
      currently_active_real_estate: p.currently_active_real_estate,
      origin_brand: p.origin_brand || '',
      origin_brand_custom: p.origin_brand_custom || '',
      time_at_origin_months: p.time_at_origin_months?.toString() || '',
      reason_for_leaving: p.reason_for_leaving || '',
      billing_avg_month: p.billing_avg_month?.toString() || '',
      billing_avg_year: p.billing_avg_year?.toString() || '',
    })
  }

  function populateFinancialForm(f: RecruitmentFinancialEvolution) {
    setFinancialForm({
      billing_month_1: f.billing_month_1?.toString() || '',
      billing_month_2: f.billing_month_2?.toString() || '',
      billing_month_3: f.billing_month_3?.toString() || '',
      billing_month_6: f.billing_month_6?.toString() || '',
      billing_month_12: f.billing_month_12?.toString() || '',
      months_to_match_previous: f.months_to_match_previous?.toString() || '',
      notes: f.notes || '',
    })
  }

  function populateBudgetForm(b: RecruitmentBudget) {
    setBudgetForm({
      paid_campaign_used: b.paid_campaign_used,
      campaign_platform: b.campaign_platform || '',
      estimated_cost: b.estimated_cost?.toString() || '',
      resources_used: b.resources_used || '',
    })
  }

  function populateOnboardingForm(o: RecruitmentOnboarding) {
    setOnboardingForm({
      contract_sent: o.contract_sent,
      contract_sent_by: o.contract_sent_by || '',
      form_sent: o.form_sent,
      access_created: o.access_created,
      onboarding_start_date: o.onboarding_start_date || '',
    })
  }

  function populateProbationForm(p: RecruitmentProbation) {
    setProbationForm({
      start_date: p.start_date || '',
      end_date: p.end_date || '',
      milestone_30_days: p.milestone_30_days,
      milestone_30_notes: p.milestone_30_notes || '',
      milestone_60_days: p.milestone_60_days,
      milestone_60_notes: p.milestone_60_notes || '',
      milestone_90_days: p.milestone_90_days,
      milestone_90_notes: p.milestone_90_notes || '',
      billing_target_month_1: p.billing_target_month_1?.toString() || '',
      billing_actual_month_1: p.billing_actual_month_1?.toString() || '',
      billing_target_month_2: p.billing_target_month_2?.toString() || '',
      billing_actual_month_2: p.billing_actual_month_2?.toString() || '',
      billing_target_month_3: p.billing_target_month_3?.toString() || '',
      billing_actual_month_3: p.billing_actual_month_3?.toString() || '',
      status: p.status || 'active',
      notes: p.notes || '',
    })
  }

  // ─── Handlers ──────────────────────────────────────────────────────────

  async function handleSaveCandidate() {
    if (!candidate) return
    setSavingCandidate(true)
    const { error } = await updateCandidate(candidate.id, {
      full_name: editForm.full_name,
      phone: editForm.phone || null,
      email: editForm.email || null,
      source: editForm.source as RecruitmentCandidate['source'],
      source_detail: editForm.source_detail || null,
      assigned_recruiter_id: editForm.assigned_recruiter_id || null,
      first_contact_date: editForm.first_contact_date || null,
      reason_yes: editForm.reason_yes || null,
      reason_no: editForm.reason_no || null,
    })
    setSavingCandidate(false)
    if (error) {
      toast.error('Erro ao guardar candidato')
    } else {
      toast.success('Candidato actualizado')
      setEditMode(false)
      await loadData()
    }
  }

  async function handleSaveNotes() {
    if (!candidate) return
    setSavingNotes(true)
    const { error } = await updateCandidate(candidate.id, { notes: notesValue || null })
    setSavingNotes(false)
    if (error) {
      toast.error('Erro ao guardar notas')
    } else {
      toast.success('Notas guardadas')
      setCandidate({ ...candidate, notes: notesValue || null })
    }
  }

  async function handleStatusChange(newStatus: CandidateStatus) {
    if (TERMINAL_STATUSES.includes(newStatus)) {
      setStatusConfirm(newStatus)
      return
    }
    await confirmStatusChange(newStatus)
  }

  async function confirmStatusChange(newStatus: CandidateStatus) {
    if (!candidate) return
    setChangingStatus(true)
    const { error } = await updateCandidate(candidate.id, { status: newStatus })
    setChangingStatus(false)
    setStatusConfirm(null)
    if (error) {
      toast.error('Erro ao alterar estado')
    } else {
      toast.success(`Estado alterado para ${CANDIDATE_STATUSES[newStatus].label}`)
      await loadData()
    }
  }

  async function handleSaveOriginProfile() {
    setSavingOrigin(true)
    const { error } = await upsertOriginProfile(candidateId, {
      currently_active_real_estate: originForm.currently_active_real_estate,
      origin_brand: (originForm.origin_brand || null) as OriginBrand | null,
      origin_brand_custom: originForm.origin_brand === 'other' ? originForm.origin_brand_custom || null : null,
      time_at_origin_months: originForm.time_at_origin_months ? parseInt(originForm.time_at_origin_months) : null,
      reason_for_leaving: originForm.reason_for_leaving || null,
      billing_avg_month: originForm.billing_avg_month ? parseFloat(originForm.billing_avg_month) : null,
      billing_avg_year: originForm.billing_avg_year ? parseFloat(originForm.billing_avg_year) : null,
    })
    setSavingOrigin(false)
    if (error) {
      toast.error('Erro ao guardar perfil de origem')
    } else {
      toast.success('Perfil de origem guardado')
      const res = await getOriginProfile(candidateId)
      setOriginProfile(res.profile)
    }
  }

  function openPainPitchDialog(record?: RecruitmentPainPitch) {
    if (record) {
      setEditingPainPitch(record)
      setPainPitchForm({
        identified_pains: record.identified_pains || '',
        solutions_presented: record.solutions_presented || '',
        candidate_objections: record.candidate_objections || '',
        fit_score: record.fit_score || 0,
      })
    } else {
      setEditingPainPitch(null)
      setPainPitchForm({ identified_pains: '', solutions_presented: '', candidate_objections: '', fit_score: 0 })
    }
    setPainPitchDialog(true)
  }

  async function handleSavePainPitch() {
    setSavingPainPitch(true)
    const payload: Partial<RecruitmentPainPitch> = {
      identified_pains: painPitchForm.identified_pains || null,
      solutions_presented: painPitchForm.solutions_presented || null,
      candidate_objections: painPitchForm.candidate_objections || null,
      fit_score: painPitchForm.fit_score || null,
    }
    if (editingPainPitch) payload.id = editingPainPitch.id
    const { error } = await upsertPainPitch(candidateId, payload)
    setSavingPainPitch(false)
    if (error) {
      toast.error('Erro ao guardar registo')
    } else {
      toast.success(editingPainPitch ? 'Registo actualizado' : 'Registo criado')
      setPainPitchDialog(false)
      const res = await getPainPitchRecords(candidateId)
      setPainPitchRecords(res.records)
    }
  }

  function openInterviewDialog(interview?: RecruitmentInterview) {
    if (interview) {
      setEditingInterview(interview)
      setInterviewForm({
        interview_date: interview.interview_date ? interview.interview_date.slice(0, 16) : '',
        format: interview.format,
        conducted_by: interview.conducted_by || '',
        notes: interview.notes || '',
        next_step: interview.next_step || '',
        follow_up_date: interview.follow_up_date || '',
      })
    } else {
      setEditingInterview(null)
      setInterviewForm({ interview_date: '', format: 'in_person', conducted_by: '', notes: '', next_step: '', follow_up_date: '' })
    }
    setInterviewDialog(true)
  }

  async function handleSaveInterview() {
    if (!interviewForm.interview_date) {
      toast.error('Data da entrevista obrigatoria')
      return
    }
    setSavingInterview(true)
    if (editingInterview) {
      const { error } = await updateInterview(editingInterview.id, {
        interview_date: interviewForm.interview_date,
        format: interviewForm.format as InterviewFormat,
        conducted_by: interviewForm.conducted_by || null,
        notes: interviewForm.notes || null,
        next_step: interviewForm.next_step || null,
        follow_up_date: interviewForm.follow_up_date || null,
      })
      setSavingInterview(false)
      if (error) {
        toast.error('Erro ao actualizar entrevista')
      } else {
        toast.success('Entrevista actualizada')
        setInterviewDialog(false)
        const res = await getInterviews(candidateId)
        setInterviews(res.interviews)
      }
    } else {
      const { error } = await createInterview(candidateId, {
        interview_date: interviewForm.interview_date,
        format: interviewForm.format,
        conducted_by: interviewForm.conducted_by || undefined,
        notes: interviewForm.notes || undefined,
        next_step: interviewForm.next_step || undefined,
        follow_up_date: interviewForm.follow_up_date || undefined,
      })
      setSavingInterview(false)
      if (error) {
        toast.error('Erro ao criar entrevista')
      } else {
        toast.success('Entrevista criada')
        setInterviewDialog(false)
        const res = await getInterviews(candidateId)
        setInterviews(res.interviews)
      }
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    const { type, id } = deleteConfirm
    if (type === 'pain_pitch') {
      const { error } = await deletePainPitch(id)
      if (error) toast.error('Erro ao eliminar')
      else {
        toast.success('Registo eliminado')
        const res = await getPainPitchRecords(candidateId)
        setPainPitchRecords(res.records)
      }
    } else if (type === 'interview') {
      const { error } = await deleteInterview(id)
      if (error) toast.error('Erro ao eliminar')
      else {
        toast.success('Entrevista eliminada')
        const res = await getInterviews(candidateId)
        setInterviews(res.interviews)
      }
    }
    setDeleteConfirm(null)
  }

  async function handleSaveFinancial() {
    setSavingFinancial(true)
    const { error } = await upsertFinancialEvolution(candidateId, {
      billing_month_1: financialForm.billing_month_1 ? parseFloat(financialForm.billing_month_1) : null,
      billing_month_2: financialForm.billing_month_2 ? parseFloat(financialForm.billing_month_2) : null,
      billing_month_3: financialForm.billing_month_3 ? parseFloat(financialForm.billing_month_3) : null,
      billing_month_6: financialForm.billing_month_6 ? parseFloat(financialForm.billing_month_6) : null,
      billing_month_12: financialForm.billing_month_12 ? parseFloat(financialForm.billing_month_12) : null,
      months_to_match_previous: financialForm.months_to_match_previous ? parseInt(financialForm.months_to_match_previous) : null,
      notes: financialForm.notes || null,
    })
    setSavingFinancial(false)
    if (error) {
      toast.error('Erro ao guardar evolucao financeira')
    } else {
      toast.success('Evolucao financeira guardada')
      const res = await getFinancialEvolution(candidateId)
      setFinancial(res.financial)
    }
  }

  async function handleSaveBudget() {
    setSavingBudget(true)
    const { error } = await upsertBudget(candidateId, {
      paid_campaign_used: budgetForm.paid_campaign_used,
      campaign_platform: budgetForm.paid_campaign_used ? (budgetForm.campaign_platform || null) as CampaignPlatform | null : null,
      estimated_cost: budgetForm.estimated_cost ? parseFloat(budgetForm.estimated_cost) : null,
      resources_used: budgetForm.resources_used || null,
    })
    setSavingBudget(false)
    if (error) {
      toast.error('Erro ao guardar orcamento')
    } else {
      toast.success('Orcamento guardado')
      const res = await getBudget(candidateId)
      setBudget(res.budget)
    }
  }

  async function handleSaveOnboarding() {
    setSavingOnboarding(true)
    const { error } = await upsertOnboarding(candidateId, {
      contract_sent: onboardingForm.contract_sent,
      contract_sent_by: onboardingForm.contract_sent_by || null,
      form_sent: onboardingForm.form_sent,
      access_created: onboardingForm.access_created,
      onboarding_start_date: onboardingForm.onboarding_start_date || null,
    })
    setSavingOnboarding(false)
    if (error) {
      toast.error('Erro ao guardar onboarding')
    } else {
      toast.success('Onboarding guardado')
      const res = await getOnboarding(candidateId)
      setOnboarding(res.onboarding)
    }
  }

  async function handleSaveCommunication() {
    setSavingComm(true)
    const { success, error } = await createCommunication(candidateId, {
      type: commForm.type as CommunicationType,
      subject: commForm.subject || undefined,
      content: commForm.content || undefined,
      direction: commForm.direction as CommunicationDirection,
    })
    setSavingComm(false)
    if (error) { toast.error(error); return }
    toast.success('Comunicacao registada')
    setCommDialog(false)
    setCommForm({ type: 'call', direction: 'outbound', subject: '', content: '' })
    const res = await getCommunications(candidateId)
    setCommunications(res.communications)
  }

  async function handleSaveProbation() {
    if (!probationForm.start_date) { toast.error('Indique a data de inicio'); return }
    setSavingProbation(true)
    const { success, error } = await upsertProbation(candidateId, {
      start_date: probationForm.start_date,
      end_date: probationForm.end_date || null,
      milestone_30_days: probationForm.milestone_30_days,
      milestone_30_notes: probationForm.milestone_30_notes || null,
      milestone_60_days: probationForm.milestone_60_days,
      milestone_60_notes: probationForm.milestone_60_notes || null,
      milestone_90_days: probationForm.milestone_90_days,
      milestone_90_notes: probationForm.milestone_90_notes || null,
      billing_target_month_1: probationForm.billing_target_month_1 ? parseFloat(probationForm.billing_target_month_1) : null,
      billing_actual_month_1: probationForm.billing_actual_month_1 ? parseFloat(probationForm.billing_actual_month_1) : null,
      billing_target_month_2: probationForm.billing_target_month_2 ? parseFloat(probationForm.billing_target_month_2) : null,
      billing_actual_month_2: probationForm.billing_actual_month_2 ? parseFloat(probationForm.billing_actual_month_2) : null,
      billing_target_month_3: probationForm.billing_target_month_3 ? parseFloat(probationForm.billing_target_month_3) : null,
      billing_actual_month_3: probationForm.billing_actual_month_3 ? parseFloat(probationForm.billing_actual_month_3) : null,
      status: probationForm.status as ProbationStatus,
      notes: probationForm.notes || null,
    })
    setSavingProbation(false)
    if (error) { toast.error(error); return }
    toast.success('Periodo de experiencia guardado')
    const res = await getProbation(candidateId)
    setProbation(res.probation)
  }

  async function handleMerge(mergeId: string) {
    setMerging(true)
    const { success, error } = await mergeCandidates(candidateId, mergeId)
    setMerging(false)
    setMergeConfirm(null)
    if (error) { toast.error(error); return }
    toast.success('Candidatos fundidos com sucesso')
    await loadData()
  }

  const COMM_ICON_MAP: Record<string, React.ReactNode> = {
    call: <Phone className="h-4 w-4" />,
    email: <Mail className="h-4 w-4" />,
    whatsapp: <MessageCircle className="h-4 w-4" />,
    sms: <MessageSquare className="h-4 w-4" />,
    meeting: <Users className="h-4 w-4" />,
    note: <StickyNote className="h-4 w-4" />,
  }

  // ─── Loading state ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    )
  }

  // ─── Not found ─────────────────────────────────────────────────────────
  if (!candidate) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12">
        <User className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-muted-foreground">Candidato nao encontrado</h2>
        <button onClick={() => router.push('/dashboard/recrutamento')} className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </button>
      </div>
    )
  }

  const currentStageIdx = stageIndex(candidate.status)
  const isJoined = candidate.status === 'joined'

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/recrutamento')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{candidate.full_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge className={cn(CANDIDATE_STATUSES[candidate.status].color)}>
                {CANDIDATE_STATUSES[candidate.status].label}
              </Badge>
              <Badge variant="outline">{CANDIDATE_SOURCES[candidate.source]}</Badge>
              {candidate.recruiter && (
                <span className="text-sm text-muted-foreground">
                  Recrutador: {candidate.recruiter.commercial_name}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={candidate.status}
            onValueChange={(v) => handleStatusChange(v as CandidateStatus)}
            disabled={changingStatus}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Alterar estado" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CANDIDATE_STATUSES).map(([key, val]) => (
                <SelectItem key={key} value={key}>
                  {val.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => { populateEditForm(candidate); setEditMode(true) }}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
        </div>
      </div>

      {/* ─── Pipeline Progress Bar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-0 overflow-x-auto py-2">
        {PIPELINE_STAGES.map((stage, idx) => {
          const isCurrent = stage.key === candidate.status
          const isPast = currentStageIdx >= 0 && idx < currentStageIdx
          const isDeclined = candidate.status === 'declined' && idx === PIPELINE_STAGES.length - 1
          return (
            <div key={stage.key} className="flex items-center">
              {idx > 0 && (
                <div
                  className={cn(
                    'h-0.5 w-8 sm:w-12',
                    isPast ? 'bg-emerald-500' : 'bg-muted'
                  )}
                />
              )}
              <button
                type="button"
                onClick={() => handleStatusChange(stage.key)}
                disabled={changingStatus}
                className="flex flex-col items-center gap-1 group"
              >
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors',
                    isCurrent && 'border-primary bg-primary text-primary-foreground',
                    isPast && 'border-emerald-500 bg-emerald-500 text-white',
                    isDeclined && 'border-red-500 bg-red-500 text-white',
                    !isCurrent && !isPast && !isDeclined && 'border-muted bg-background text-muted-foreground',
                    'group-hover:opacity-80'
                  )}
                >
                  {isPast ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                </div>
                <span className={cn(
                  'text-[10px] sm:text-xs whitespace-nowrap',
                  isCurrent ? 'font-semibold text-primary' : 'text-muted-foreground'
                )}>
                  {stage.label}
                </span>
              </button>
            </div>
          )
        })}
        {/* Show declined/on_hold as separate indicator if active */}
        {(candidate.status === 'declined' || candidate.status === 'on_hold') && (
          <>
            <div className="h-0.5 w-8 sm:w-12 bg-muted" />
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold',
                candidate.status === 'declined' ? 'border-red-500 bg-red-500 text-white' : 'border-orange-500 bg-orange-500 text-white'
              )}>
                !
              </div>
              <span className="text-[10px] sm:text-xs whitespace-nowrap font-semibold">
                {CANDIDATE_STATUSES[candidate.status].label}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ─── Tabs ──────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="resumo">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="perfil_origem">Perfil de Origem</TabsTrigger>
          <TabsTrigger value="pain_pitch">Pain &amp; Pitch</TabsTrigger>
          <TabsTrigger value="entrevistas">Entrevistas</TabsTrigger>
          {isJoined && <TabsTrigger value="financeiro">Evolucao Financeira</TabsTrigger>}
          <TabsTrigger value="orcamento">Orcamento &amp; Recursos</TabsTrigger>
          {isJoined && <TabsTrigger value="onboarding">Onboarding</TabsTrigger>}
          <TabsTrigger value="comunicacoes">Comunicacoes</TabsTrigger>
          {isJoined && <TabsTrigger value="experiencia">Experiencia</TabsTrigger>}
        </TabsList>

        {/* ─── Tab: Resumo ───────────────────────────────────────────────────── */}
        <TabsContent value="resumo" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <InfoCard icon={<User className="h-4 w-4" />} label="Nome" value={candidate.full_name} />
            <InfoCard icon={<Mail className="h-4 w-4" />} label="Email" value={candidate.email || '-'} />
            <InfoCard icon={<Phone className="h-4 w-4" />} label="Telemovel" value={candidate.phone || '-'} />
            <InfoCard icon={<ExternalLink className="h-4 w-4" />} label="Origem" value={CANDIDATE_SOURCES[candidate.source]} />
            <InfoCard icon={<MessageSquare className="h-4 w-4" />} label="Detalhe Origem" value={candidate.source_detail || '-'} />
            <InfoCard icon={<Calendar className="h-4 w-4" />} label="Primeiro Contacto" value={formatDate(candidate.first_contact_date)} />
            <InfoCard icon={<Clock className="h-4 w-4" />} label="Ultimo Contacto" value={formatDate(candidate.last_interaction_date)} />
            <InfoCard icon={<Calendar className="h-4 w-4" />} label="Data Decisao" value={formatDate(candidate.decision_date)} />
          </div>

          {candidate.decision && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={cn(CANDIDATE_DECISIONS[candidate.decision].color)}>
                    {CANDIDATE_DECISIONS[candidate.decision].label}
                  </Badge>
                </div>
                {candidate.reason_yes && (
                  <p className="text-sm"><span className="font-medium">Motivo (sim):</span> {candidate.reason_yes}</p>
                )}
                {candidate.reason_no && (
                  <p className="text-sm"><span className="font-medium">Motivo (nao):</span> {candidate.reason_no}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                rows={4}
                placeholder="Notas sobre o candidato..."
              />
              <Button onClick={handleSaveNotes} disabled={savingNotes} size="sm">
                {savingNotes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar Notas
              </Button>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {stageLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem registos de alteracao de estado.</p>
              ) : (
                <div className="space-y-3">
                  {stageLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 border-l-2 border-muted pl-4 pb-3">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          {log.from_status && (
                            <Badge variant="outline" className={cn(CANDIDATE_STATUSES[log.from_status]?.color, 'text-xs')}>
                              {CANDIDATE_STATUSES[log.from_status]?.label || log.from_status}
                            </Badge>
                          )}
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          <Badge className={cn(CANDIDATE_STATUSES[log.to_status]?.color, 'text-xs')}>
                            {CANDIDATE_STATUSES[log.to_status]?.label || log.to_status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDateTime(log.created_at)}
                          {log.user && ` - ${log.user.commercial_name}`}
                        </p>
                        {log.notes && <p className="text-xs mt-1">{log.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Score */}
          {scoreData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Score do Candidato</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className={cn(
                    'flex items-center justify-center h-20 w-20 rounded-full border-4 text-2xl font-bold',
                    scoreData.score >= 70 ? 'border-emerald-500 text-emerald-700' :
                    scoreData.score >= 40 ? 'border-amber-500 text-amber-700' :
                    'border-red-400 text-red-600'
                  )}>
                    {scoreData.score}
                  </div>
                  <div className="flex-1 space-y-2">
                    {Object.entries(scoreData.breakdown).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        <span className="w-40 text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                        <Progress value={val * (100 / 30)} className="h-2 flex-1" />
                        <span className="w-8 text-right font-medium">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Duplicados */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Duplicados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {duplicates.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum duplicado detectado.</p>
              ) : (
                <div className="space-y-3">
                  {duplicates.map((dup) => (
                    <div key={dup.id} className="flex items-center justify-between border rounded-lg p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <User className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{dup.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{dup.email || dup.phone || '-'}</p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {dup.match_reason === 'both' ? 'Telefone + Email' :
                           dup.match_reason === 'phone' ? 'Telefone' : 'Email'}
                        </Badge>
                        <Badge className={cn(CANDIDATE_STATUSES[dup.status]?.color, 'text-xs')}>
                          {CANDIDATE_STATUSES[dup.status]?.label}
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMergeConfirm(dup.id)}
                        disabled={merging}
                      >
                        <Merge className="mr-1.5 h-3.5 w-3.5" />
                        Fundir
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab: Perfil de Origem ─────────────────────────────────────────── */}
        <TabsContent value="perfil_origem" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Perfil de Origem</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="active_re"
                  checked={originForm.currently_active_real_estate}
                  onCheckedChange={(v) => setOriginForm({ ...originForm, currently_active_real_estate: !!v })}
                />
                <Label htmlFor="active_re">Atualmente Ativo em Imobiliario</Label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Marca de Origem</Label>
                  <Select
                    value={originForm.origin_brand}
                    onValueChange={(v) => setOriginForm({ ...originForm, origin_brand: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar marca" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ORIGIN_BRANDS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {originForm.origin_brand === 'other' && (
                  <div className="space-y-2">
                    <Label>Marca de Origem (Custom)</Label>
                    <Input
                      value={originForm.origin_brand_custom}
                      onChange={(e) => setOriginForm({ ...originForm, origin_brand_custom: e.target.value })}
                      placeholder="Nome da marca"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Tempo na Marca de Origem (meses)</Label>
                  <Input
                    type="number"
                    value={originForm.time_at_origin_months}
                    onChange={(e) => setOriginForm({ ...originForm, time_at_origin_months: e.target.value })}
                    placeholder="Ex: 24"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Facturacao Media/Mes</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={originForm.billing_avg_month}
                    onChange={(e) => setOriginForm({ ...originForm, billing_avg_month: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Facturacao Media/Ano</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={originForm.billing_avg_year}
                    onChange={(e) => setOriginForm({ ...originForm, billing_avg_year: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Motivo de Saida</Label>
                <Textarea
                  value={originForm.reason_for_leaving}
                  onChange={(e) => setOriginForm({ ...originForm, reason_for_leaving: e.target.value })}
                  rows={3}
                  placeholder="Descreva o motivo de saida..."
                />
              </div>

              <Button onClick={handleSaveOriginProfile} disabled={savingOrigin}>
                {savingOrigin ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab: Pain & Pitch ─────────────────────────────────────────────── */}
        <TabsContent value="pain_pitch" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Registos Pain &amp; Pitch</h3>
            <Button onClick={() => openPainPitchDialog()} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Registo
            </Button>
          </div>

          {painPitchRecords.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare className="h-10 w-10 mb-2" />
                <p>Nenhum registo encontrado</p>
              </CardContent>
            </Card>
          ) : (
            painPitchRecords.map((record) => (
              <Card key={record.id}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={cn(
                            'h-4 w-4',
                            n <= (record.fit_score || 0) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'
                          )}
                        />
                      ))}
                      <span className="ml-2 text-xs text-muted-foreground">
                        Fit Score: {record.fit_score || 0}/5
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openPainPitchDialog(record)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm({ type: 'pain_pitch', id: record.id })}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {record.identified_pains && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Dores Identificadas</p>
                      <p className="text-sm">{record.identified_pains}</p>
                    </div>
                  )}
                  {record.solutions_presented && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Solucoes Apresentadas</p>
                      <p className="text-sm">{record.solutions_presented}</p>
                    </div>
                  )}
                  {record.candidate_objections && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Objecoes</p>
                      <p className="text-sm">{record.candidate_objections}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">{formatDateTime(record.created_at)}</p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ─── Tab: Entrevistas ──────────────────────────────────────────────── */}
        <TabsContent value="entrevistas" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Entrevistas</h3>
            <Button onClick={() => openInterviewDialog()} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nova Entrevista
            </Button>
          </div>

          {interviews.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Calendar className="h-10 w-10 mb-2" />
                <p>Nenhuma entrevista registada</p>
              </CardContent>
            </Card>
          ) : (
            interviews.map((interview) => {
              const followUpOverdue = interview.follow_up_date && isPast(parseISO(interview.follow_up_date))
              return (
                <Card key={interview.id}>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                          #{interview.interview_number}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{formatDateTime(interview.interview_date)}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {INTERVIEW_FORMATS[interview.format]}
                            </Badge>
                            {interview.interviewer && (
                              <span className="text-xs text-muted-foreground">
                                por {interview.interviewer.commercial_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openInterviewDialog(interview)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm({ type: 'interview', id: interview.id })}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {interview.notes && (
                      <p className="text-sm text-muted-foreground line-clamp-3">{interview.notes}</p>
                    )}
                    {interview.next_step && (
                      <p className="text-sm"><span className="font-medium">Proximo passo:</span> {interview.next_step}</p>
                    )}
                    {interview.follow_up_date && (
                      <p className={cn('text-sm', followUpOverdue ? 'text-red-600 font-medium' : '')}>
                        <span className="font-medium">Follow-up:</span> {formatDate(interview.follow_up_date)}
                        {followUpOverdue && ' (em atraso)'}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        {/* ─── Tab: Evolucao Financeira ──────────────────────────────────────── */}
        {isJoined && (
          <TabsContent value="financeiro" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Evolucao Financeira
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {originProfile?.billing_avg_month && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-sm text-muted-foreground">
                      Facturacao anterior: <span className="font-semibold text-foreground">{formatCurrency(originProfile.billing_avg_month)}/mes</span>
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { key: 'billing_month_1', label: 'Facturacao Mes 1' },
                    { key: 'billing_month_2', label: 'Facturacao Mes 2' },
                    { key: 'billing_month_3', label: 'Facturacao Mes 3' },
                    { key: 'billing_month_6', label: 'Facturacao Mes 6' },
                    { key: 'billing_month_12', label: 'Facturacao Mes 12' },
                  ].map(({ key, label }) => (
                    <div key={key} className="space-y-2">
                      <Label>{label}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={financialForm[key as keyof typeof financialForm]}
                        onChange={(e) => setFinancialForm({ ...financialForm, [key]: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  ))}
                  <div className="space-y-2">
                    <Label>Meses ate Igualar Facturacao Anterior</Label>
                    <Input
                      type="number"
                      value={financialForm.months_to_match_previous}
                      onChange={(e) => setFinancialForm({ ...financialForm, months_to_match_previous: e.target.value })}
                      placeholder="Ex: 6"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea
                    value={financialForm.notes}
                    onChange={(e) => setFinancialForm({ ...financialForm, notes: e.target.value })}
                    rows={3}
                  />
                </div>

                {/* Simple bar chart */}
                <FinancialBarChart
                  previousAvg={originProfile?.billing_avg_month ?? null}
                  month1={financialForm.billing_month_1 ? parseFloat(financialForm.billing_month_1) : null}
                  month2={financialForm.billing_month_2 ? parseFloat(financialForm.billing_month_2) : null}
                  month3={financialForm.billing_month_3 ? parseFloat(financialForm.billing_month_3) : null}
                  month6={financialForm.billing_month_6 ? parseFloat(financialForm.billing_month_6) : null}
                  month12={financialForm.billing_month_12 ? parseFloat(financialForm.billing_month_12) : null}
                />

                <Button onClick={handleSaveFinancial} disabled={savingFinancial}>
                  {savingFinancial ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Guardar
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ─── Tab: Orcamento & Recursos ─────────────────────────────────────── */}
        <TabsContent value="orcamento" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Euro className="h-4 w-4" />
                Orcamento &amp; Recursos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="paid_campaign"
                  checked={budgetForm.paid_campaign_used}
                  onCheckedChange={(v) => setBudgetForm({ ...budgetForm, paid_campaign_used: !!v })}
                />
                <Label htmlFor="paid_campaign">Campanha Paga Utilizada</Label>
              </div>

              {budgetForm.paid_campaign_used && (
                <div className="space-y-2">
                  <Label>Plataforma da Campanha</Label>
                  <Select
                    value={budgetForm.campaign_platform}
                    onValueChange={(v) => setBudgetForm({ ...budgetForm, campaign_platform: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar plataforma" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CAMPAIGN_PLATFORMS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Custo Estimado de Aquisicao</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={budgetForm.estimated_cost}
                  onChange={(e) => setBudgetForm({ ...budgetForm, estimated_cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Recursos Utilizados</Label>
                <Textarea
                  value={budgetForm.resources_used}
                  onChange={(e) => setBudgetForm({ ...budgetForm, resources_used: e.target.value })}
                  rows={3}
                  placeholder="Descreva os recursos utilizados..."
                />
              </div>

              <Button onClick={handleSaveBudget} disabled={savingBudget}>
                {savingBudget ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab: Onboarding ───────────────────────────────────────────────── */}
        {isJoined && (
          <TabsContent value="onboarding" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Onboarding</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-4">
                  <OnboardingCheckItem
                    checked={onboardingForm.contract_sent}
                    onChange={(v) => setOnboardingForm({ ...onboardingForm, contract_sent: v })}
                    label="Contrato Enviado"
                  >
                    <div className="ml-8 mt-2 space-y-2">
                      <Label className="text-xs">Por:</Label>
                      <Select
                        value={onboardingForm.contract_sent_by}
                        onValueChange={(v) => setOnboardingForm({ ...onboardingForm, contract_sent_by: v })}
                      >
                        <SelectTrigger className="w-[240px]">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {recruiters.map((r) => (
                            <SelectItem key={r.id} value={r.id}>{r.commercial_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </OnboardingCheckItem>

                  <OnboardingCheckItem
                    checked={onboardingForm.form_sent}
                    onChange={(v) => setOnboardingForm({ ...onboardingForm, form_sent: v })}
                    label="Formulario Enviado"
                  />

                  <OnboardingCheckItem
                    checked={onboardingForm.access_created}
                    onChange={(v) => setOnboardingForm({ ...onboardingForm, access_created: v })}
                    label="Acessos Criados"
                  />

                  <div className="space-y-2 ml-8">
                    <Label>Data de Inicio do Onboarding</Label>
                    <Input
                      type="date"
                      value={onboardingForm.onboarding_start_date}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, onboarding_start_date: e.target.value })}
                      className="w-[240px]"
                    />
                  </div>
                </div>

                <Button onClick={handleSaveOnboarding} disabled={savingOnboarding}>
                  {savingOnboarding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Guardar
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ─── Tab: Comunicacoes ────────────────────────────────────────────────── */}
        <TabsContent value="comunicacoes" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Historico de Comunicacoes</h3>
            <Button size="sm" onClick={() => { setCommForm({ type: 'call', direction: 'outbound', subject: '', content: '' }); setCommDialog(true) }}>
              <Plus className="mr-2 h-4 w-4" />Nova Comunicacao
            </Button>
          </div>
          {communications.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-8 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Sem comunicacoes registadas.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {communications.map((comm) => (
                <Card key={comm.id}>
                  <CardContent className="flex items-start gap-3 py-3 px-4">
                    <div className="mt-0.5 text-muted-foreground">{COMM_ICON_MAP[comm.type] || <MessageSquare className="h-4 w-4" />}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">{COMMUNICATION_TYPES[comm.type]?.label || comm.type}</Badge>
                        <Badge className={cn(comm.direction === 'inbound' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700', 'text-xs')}>
                          {comm.direction === 'inbound' ? <ArrowDownRight className="mr-1 h-3 w-3" /> : <ArrowUpRight className="mr-1 h-3 w-3" />}
                          {COMMUNICATION_DIRECTIONS[comm.direction]}
                        </Badge>
                      </div>
                      {comm.subject && <p className="text-sm font-medium">{comm.subject}</p>}
                      {comm.content && <p className="text-sm text-muted-foreground line-clamp-2">{comm.content}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateTime(comm.created_at)}
                        {comm.user && ` - ${comm.user.commercial_name}`}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Tab: Experiencia ──────────────────────────────────────────────────── */}
        {isJoined && (
          <TabsContent value="experiencia" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Periodo de Experiencia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Data de Inicio *</Label>
                    <Input type="date" value={probationForm.start_date} onChange={(e) => setProbationForm({ ...probationForm, start_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Data de Fim</Label>
                    <Input type="date" value={probationForm.end_date} onChange={(e) => setProbationForm({ ...probationForm, end_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select value={probationForm.status} onValueChange={(v) => setProbationForm({ ...probationForm, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.entries(PROBATION_STATUSES) as [ProbationStatus, { label: string; color: string }][]).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Milestones */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold">Marcos</h4>
                  {[
                    { days: 30, checked: probationForm.milestone_30_days, notes: probationForm.milestone_30_notes, setChecked: (v: boolean) => setProbationForm({ ...probationForm, milestone_30_days: v }), setNotes: (v: string) => setProbationForm({ ...probationForm, milestone_30_notes: v }) },
                    { days: 60, checked: probationForm.milestone_60_days, notes: probationForm.milestone_60_notes, setChecked: (v: boolean) => setProbationForm({ ...probationForm, milestone_60_days: v }), setNotes: (v: string) => setProbationForm({ ...probationForm, milestone_60_notes: v }) },
                    { days: 90, checked: probationForm.milestone_90_days, notes: probationForm.milestone_90_notes, setChecked: (v: boolean) => setProbationForm({ ...probationForm, milestone_90_days: v }), setNotes: (v: string) => setProbationForm({ ...probationForm, milestone_90_notes: v }) },
                  ].map((m) => (
                    <div key={m.days} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-3">
                        <Checkbox checked={m.checked} onCheckedChange={(v) => m.setChecked(!!v)} />
                        <Label className="font-medium">{m.days} Dias</Label>
                        {m.checked && <Badge className="bg-emerald-100 text-emerald-700 text-xs">Concluido</Badge>}
                      </div>
                      <Textarea value={m.notes} onChange={(e) => m.setNotes(e.target.value)} rows={2} placeholder={`Notas do marco de ${m.days} dias...`} />
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Billing targets */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><Target className="h-4 w-4" />Objectivos de Facturacao</h4>
                  <div className="space-y-3">
                    {[
                      { label: 'Mes 1', target: probationForm.billing_target_month_1, actual: probationForm.billing_actual_month_1, setTarget: (v: string) => setProbationForm({ ...probationForm, billing_target_month_1: v }), setActual: (v: string) => setProbationForm({ ...probationForm, billing_actual_month_1: v }) },
                      { label: 'Mes 2', target: probationForm.billing_target_month_2, actual: probationForm.billing_actual_month_2, setTarget: (v: string) => setProbationForm({ ...probationForm, billing_target_month_2: v }), setActual: (v: string) => setProbationForm({ ...probationForm, billing_actual_month_2: v }) },
                      { label: 'Mes 3', target: probationForm.billing_target_month_3, actual: probationForm.billing_actual_month_3, setTarget: (v: string) => setProbationForm({ ...probationForm, billing_target_month_3: v }), setActual: (v: string) => setProbationForm({ ...probationForm, billing_actual_month_3: v }) },
                    ].map((row) => {
                      const target = parseFloat(row.target) || 0
                      const actual = parseFloat(row.actual) || 0
                      const pct = target > 0 ? Math.min(Math.round((actual / target) * 100), 100) : 0
                      return (
                        <div key={row.label} className="grid grid-cols-[100px_1fr_1fr_80px] items-center gap-3">
                          <Label className="text-sm font-medium">{row.label}</Label>
                          <Input type="number" placeholder="Objectivo" value={row.target} onChange={(e) => row.setTarget(e.target.value)} />
                          <Input type="number" placeholder="Real" value={row.actual} onChange={(e) => row.setActual(e.target.value)} />
                          <div className="flex items-center gap-1.5">
                            <Progress value={pct} className="h-2 flex-1" />
                            <span className={cn('text-xs font-medium', pct >= 100 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600')}>{pct}%</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea value={probationForm.notes} onChange={(e) => setProbationForm({ ...probationForm, notes: e.target.value })} rows={3} placeholder="Notas sobre o periodo de experiencia..." />
                </div>

                <Button onClick={handleSaveProbation} disabled={savingProbation}>
                  {savingProbation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Guardar
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* ─── Communication Dialog ──────────────────────────────────────────────── */}
      <Dialog open={commDialog} onOpenChange={setCommDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Comunicacao</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={commForm.type} onValueChange={(v) => setCommForm({ ...commForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(COMMUNICATION_TYPES) as [CommunicationType, { label: string }][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Direccao</Label>
                <Select value={commForm.direction} onValueChange={(v) => setCommForm({ ...commForm, direction: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(COMMUNICATION_DIRECTIONS) as [CommunicationDirection, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Assunto</Label>
              <Input value={commForm.subject} onChange={(e) => setCommForm({ ...commForm, subject: e.target.value })} placeholder="Assunto da comunicacao" />
            </div>
            <div className="space-y-2">
              <Label>Conteudo</Label>
              <Textarea value={commForm.content} onChange={(e) => setCommForm({ ...commForm, content: e.target.value })} rows={4} placeholder="Detalhes da comunicacao..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCommDialog(false)}>Cancelar</Button>
              <Button onClick={handleSaveCommunication} disabled={savingComm}>
                {savingComm ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Merge Confirmation ────────────────────────────────────────────────── */}
      <AlertDialog open={!!mergeConfirm} onOpenChange={() => setMergeConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fundir candidatos</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende fundir este candidato com o actual? Os dados do duplicado serao transferidos e o duplicado sera eliminado. Esta accao e irreversivel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => mergeConfirm && handleMerge(mergeConfirm)} disabled={merging}>
              {merging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Merge className="mr-2 h-4 w-4" />}
              Fundir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Edit Candidate Dialog ───────────────────────────────────────────── */}
      <Dialog open={editMode} onOpenChange={setEditMode}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Candidato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome Completo *</Label>
              <Input
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Telemovel</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Origem</Label>
                <Select
                  value={editForm.source}
                  onValueChange={(v) => setEditForm({ ...editForm, source: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CANDIDATE_SOURCES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Detalhe Origem</Label>
                <Input
                  value={editForm.source_detail}
                  onChange={(e) => setEditForm({ ...editForm, source_detail: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Recrutador</Label>
                <Select
                  value={editForm.assigned_recruiter_id}
                  onValueChange={(v) => setEditForm({ ...editForm, assigned_recruiter_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {recruiters.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.commercial_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Primeiro Contacto</Label>
                <Input
                  type="date"
                  value={editForm.first_contact_date}
                  onChange={(e) => setEditForm({ ...editForm, first_contact_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Motivo (sim)</Label>
              <Textarea
                value={editForm.reason_yes}
                onChange={(e) => setEditForm({ ...editForm, reason_yes: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Motivo (nao)</Label>
              <Textarea
                value={editForm.reason_no}
                onChange={(e) => setEditForm({ ...editForm, reason_no: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditMode(false)}>Cancelar</Button>
              <Button onClick={handleSaveCandidate} disabled={savingCandidate || !editForm.full_name.trim()}>
                {savingCandidate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Pain & Pitch Dialog ─────────────────────────────────────────────── */}
      <Dialog open={painPitchDialog} onOpenChange={setPainPitchDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPainPitch ? 'Editar Registo' : 'Novo Registo Pain & Pitch'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Dores Identificadas</Label>
              <Textarea
                value={painPitchForm.identified_pains}
                onChange={(e) => setPainPitchForm({ ...painPitchForm, identified_pains: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Solucoes Apresentadas</Label>
              <Textarea
                value={painPitchForm.solutions_presented}
                onChange={(e) => setPainPitchForm({ ...painPitchForm, solutions_presented: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Objecoes</Label>
              <Textarea
                value={painPitchForm.candidate_objections}
                onChange={(e) => setPainPitchForm({ ...painPitchForm, candidate_objections: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Fit Score</Label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPainPitchForm({ ...painPitchForm, fit_score: n })}
                    className="p-0.5"
                  >
                    <Star
                      className={cn(
                        'h-6 w-6 cursor-pointer transition-colors',
                        n <= painPitchForm.fit_score ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground hover:text-amber-300'
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPainPitchDialog(false)}>Cancelar</Button>
              <Button onClick={handleSavePainPitch} disabled={savingPainPitch}>
                {savingPainPitch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Interview Dialog ────────────────────────────────────────────────── */}
      <Dialog open={interviewDialog} onOpenChange={setInterviewDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingInterview ? 'Editar Entrevista' : 'Nova Entrevista'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input
                type="datetime-local"
                value={interviewForm.interview_date}
                onChange={(e) => setInterviewForm({ ...interviewForm, interview_date: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Formato</Label>
                <Select
                  value={interviewForm.format}
                  onValueChange={(v) => setInterviewForm({ ...interviewForm, format: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(INTERVIEW_FORMATS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Entrevistador</Label>
                <Select
                  value={interviewForm.conducted_by}
                  onValueChange={(v) => setInterviewForm({ ...interviewForm, conducted_by: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {recruiters.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.commercial_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={interviewForm.notes}
                onChange={(e) => setInterviewForm({ ...interviewForm, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Proximo Passo</Label>
              <Input
                value={interviewForm.next_step}
                onChange={(e) => setInterviewForm({ ...interviewForm, next_step: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Follow-up</Label>
              <Input
                type="date"
                value={interviewForm.follow_up_date}
                onChange={(e) => setInterviewForm({ ...interviewForm, follow_up_date: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setInterviewDialog(false)}>Cancelar</Button>
              <Button onClick={handleSaveInterview} disabled={savingInterview}>
                {savingInterview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Status Change Confirmation ──────────────────────────────────────── */}
      <AlertDialog open={!!statusConfirm} onOpenChange={() => setStatusConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alteracao de estado</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende alterar o estado para{' '}
              <strong>{statusConfirm ? CANDIDATE_STATUSES[statusConfirm].label : ''}</strong>?
              {statusConfirm && TERMINAL_STATUSES.includes(statusConfirm) && (
                <> Este e um estado terminal.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => statusConfirm && confirmStatusChange(statusConfirm)}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Delete Confirmation ─────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar registo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar este registo? Esta accao e irreversivel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-3 px-4">
        <div className="text-muted-foreground">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-medium truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function OnboardingCheckItem({
  checked,
  onChange,
  label,
  children,
}: {
  checked: boolean
  onChange: (val: boolean) => void
  label: string
  children?: React.ReactNode
}) {
  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-3 text-left"
        onClick={() => onChange(!checked)}
      >
        {checked ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
        )}
        <span className={cn('text-sm', checked ? 'font-medium' : 'text-muted-foreground')}>
          {label}
        </span>
      </button>
      {children}
    </div>
  )
}

function FinancialBarChart({
  previousAvg,
  month1,
  month2,
  month3,
  month6,
  month12,
}: {
  previousAvg: number | null
  month1: number | null
  month2: number | null
  month3: number | null
  month6: number | null
  month12: number | null
}) {
  const bars = [
    { label: 'Anterior', value: previousAvg, color: 'bg-slate-400' },
    { label: 'Mes 1', value: month1, color: 'bg-blue-500' },
    { label: 'Mes 2', value: month2, color: 'bg-blue-500' },
    { label: 'Mes 3', value: month3, color: 'bg-blue-500' },
    { label: 'Mes 6', value: month6, color: 'bg-blue-500' },
    { label: 'Mes 12', value: month12, color: 'bg-blue-500' },
  ].filter((b) => b.value != null) as { label: string; value: number; color: string }[]

  if (bars.length === 0) return null

  const maxVal = Math.max(...bars.map((b) => b.value))

  return (
    <div className="space-y-2 pt-2">
      <p className="text-xs font-medium text-muted-foreground">Comparacao de Facturacao</p>
      <div className="flex items-end gap-3 h-32">
        {bars.map((bar) => {
          const pct = maxVal > 0 ? (bar.value / maxVal) * 100 : 0
          return (
            <div key={bar.label} className="flex flex-col items-center gap-1 flex-1">
              <span className="text-[10px] text-muted-foreground">
                {bar.value.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
              </span>
              <div
                className={cn('w-full rounded-t transition-all', bar.color)}
                style={{ height: `${Math.max(pct, 4)}%` }}
              />
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{bar.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
