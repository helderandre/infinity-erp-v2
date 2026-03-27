// @ts-nocheck
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format, formatDistanceToNow, differenceInDays } from 'date-fns'
import { pt } from 'date-fns/locale/pt'
import { cn } from '@/lib/utils'

import {
  getCandidate, updateCandidate, getOriginProfile, getPainPitchRecords,
  getInterviews, getFinancialEvolution, getBudget, getOnboarding,
  getStageLog, getRecruiters, getCommunications, getProbation, calculateCandidateScore,
} from '@/app/dashboard/recrutamento/actions'

import type {
  RecruitmentCandidate, RecruitmentOriginProfile, RecruitmentPainPitch,
  RecruitmentInterview, RecruitmentFinancialEvolution, RecruitmentBudget,
  RecruitmentOnboarding, RecruitmentStageLog, RecruitmentCommunication,
  RecruitmentProbation, CandidateStatus, CommunicationType, CommunicationDirection,
} from '@/types/recruitment'
import { CANDIDATE_SOURCES, CANDIDATE_STATUSES, PIPELINE_STAGES } from '@/types/recruitment'

import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ArrowLeft, User, Eye, Briefcase, CalendarDays, FileCheck, Pencil, Check, Loader2,
  Phone, Mail, Clock, ExternalLink, Linkedin, MapPin, Sparkles, FileText, Star, Upload, Trash2, MessageCircle, Camera, Download,
} from 'lucide-react'

import { CandidateOverviewTab } from '@/components/recrutamento/candidate-overview-tab'
import { CandidateQualificationTab } from '@/components/recrutamento/candidate-qualification-tab'
import { CandidateInterviewsTab } from '@/components/recrutamento/candidate-interviews-tab'
import { CandidateOnboardingTab } from '@/components/recrutamento/candidate-onboarding-tab'
import { AiNotesDialog } from '@/components/recrutamento/ai-notes-dialog'
import { ChatThread } from '@/components/whatsapp/chat-thread'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'

const TABS = [
  { key: 'visao_geral', label: 'Visão Geral', icon: Eye },
  { key: 'qualificacao', label: 'Qualificação', icon: Briefcase },
  { key: 'entrevistas', label: 'Entrevistas', icon: CalendarDays },
  { key: 'historico', label: 'Histórico', icon: Clock },
  { key: 'onboarding', label: 'Onboarding', icon: FileCheck },
] as const

type TabKey = (typeof TABS)[number]['key']

function getStatusColor(status: CandidateStatus): string {
  const colors: Record<CandidateStatus, string> = {
    prospect: '#64748b', in_contact: '#3b82f6', in_process: '#a855f7',
    decision_pending: '#f59e0b', joined: '#10b981', declined: '#ef4444', on_hold: '#f97316',
  }
  return colors[status]
}

const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

export default function CandidateDetailPage() {
  const params = useParams()
  const router = useRouter()
  const candidateId = params.id as string

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

  const [activeTab, setActiveTab] = useState<TabKey>('visao_geral')
  const [fitScore, setFitScore] = useState(0)
  const [fitScoreHover, setFitScoreHover] = useState(0)
  const [changingStatus, setChangingStatus] = useState(false)
  const [savingCandidate, setSavingCandidate] = useState(false)
  const [savingComm, setSavingComm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({
    full_name: '', phone: '', email: '', source_detail: '', notes: '',
    assigned_recruiter_id: '',
  })

  // AI notes dialog
  const [aiNotesOpen, setAiNotesOpen] = useState(false)
  // Notes popup
  const [notesPopupOpen, setNotesPopupOpen] = useState(false)
  const [popupNotes, setPopupNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  // WhatsApp inline
  const [showWhatsapp, setShowWhatsapp] = useState(false)
  const [whatsappInstance, setWhatsappInstance] = useState('')
  const [whatsappChatId, setWhatsappChatId] = useState('')
  const [whatsappLoading, setWhatsappLoading] = useState(false)
  // CV
  const [cvDialogOpen, setCvDialogOpen] = useState(false)
  const [uploadingCv, setUploadingCv] = useState(false)
  const [deletingCv, setDeletingCv] = useState(false)
  const [deleteCvConfirm, setDeleteCvConfirm] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [
      candidateRes, originRes, painRes, interviewsRes,
      financialRes, budgetRes, onboardingRes, logRes,
      recruitersRes, commRes, probationRes, scoreRes,
    ] = await Promise.all([
      getCandidate(candidateId), getOriginProfile(candidateId),
      getPainPitchRecords(candidateId), getInterviews(candidateId),
      getFinancialEvolution(candidateId), getBudget(candidateId),
      getOnboarding(candidateId), getStageLog(candidateId),
      getRecruiters(), getCommunications(candidateId),
      getProbation(candidateId), calculateCandidateScore(candidateId),
    ])
    if (candidateRes.candidate) setCandidate(candidateRes.candidate)
    setOriginProfile(originRes.profile)
    setPainPitchRecords(painRes.records)
    if (painRes.records.length > 0) {
      const lastPp = painRes.records[painRes.records.length - 1]
      setFitScore((lastPp as any).fit_score ?? 0)
    }
    setInterviews(interviewsRes.interviews)
    setFinancial(financialRes.financial)
    setBudget(budgetRes.budget)
    setOnboarding(onboardingRes.onboarding)
    setStageLogs(logRes.logs)
    setRecruiters(recruitersRes.recruiters)
    setCommunications(commRes.communications)
    setProbation(probationRes.probation)
    if (!scoreRes.error) setScoreData({ score: scoreRes.score, breakdown: scoreRes.breakdown })
    setLoading(false)
  }, [candidateId])

  useEffect(() => { loadData() }, [loadData])

  // Update candidate locally without full reload
  const patchCandidate = useCallback((updates: Partial<typeof candidate>) => {
    setCandidate(prev => prev ? { ...prev, ...updates } as any : prev)
  }, [])

  async function handleStatusChange(newStatus: CandidateStatus) {
    if (!candidate) return
    setChangingStatus(true)
    const { error } = await updateCandidate(candidate.id, { status: newStatus })
    setChangingStatus(false)
    if (error) toast.error('Erro ao alterar estado')
    else { patchCandidate({ status: newStatus }); toast.success('Estado alterado') }
  }

  async function handleUpdateCandidate(updates: Partial<RecruitmentCandidate>) {
    if (!candidate) return
    setSavingCandidate(true)
    const { error } = await updateCandidate(candidate.id, updates)
    setSavingCandidate(false)
    if (error) toast.error('Erro ao guardar')
    else { patchCandidate(updates); toast.success('Guardado') }
  }

  async function handleAddCommunication(data: { type: CommunicationType; direction: CommunicationDirection; subject: string; content: string }) {
    setSavingComm(true)
    const { createCommunication } = await import('@/app/dashboard/recrutamento/actions')
    const { error } = await createCommunication(candidateId, { type: data.type, subject: data.subject || undefined, content: data.content || undefined, direction: data.direction })
    setSavingComm(false)
    if (error) toast.error(error)
    else { toast.success('Comunicação registada'); const res = await getCommunications(candidateId); setCommunications(res.communications) }
  }

  function enterEditMode() {
    if (!candidate) return
    setEditForm({
      full_name: candidate.full_name || '',
      phone: candidate.phone || '',
      email: candidate.email || '',
      source_detail: candidate.source_detail || '',
      notes: candidate.notes || '',
      assigned_recruiter_id: candidate.assigned_recruiter_id || '',
    })
    setEditMode(true)
  }

  async function saveEdit() {
    if (!candidate) return
    setSavingCandidate(true)
    const updates: Record<string, any> = {
      full_name: editForm.full_name,
      phone: editForm.phone || null,
      email: editForm.email || null,
      source_detail: editForm.source_detail || null,
      notes: editForm.notes || null,
    }
    if (editForm.assigned_recruiter_id) updates.assigned_recruiter_id = editForm.assigned_recruiter_id
    const { error } = await updateCandidate(candidate.id, updates)
    setSavingCandidate(false)
    if (error) toast.error('Erro ao guardar')
    else { patchCandidate(updates); toast.success('Guardado'); setEditMode(false) }
  }

  // AI notes confirm handler
  const handleAiNotesConfirm = async (data: { note: string; fields: Record<string, any> }) => {
    if (!candidate) return
    const timestamp = new Date().toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const newNote = `[${timestamp}] ${data.note}`
    const currentNotes = candidate.notes || ''
    const updatedNotes = currentNotes ? `${currentNotes}\n\n${newNote}` : newNote

    const updates: Record<string, any> = { notes: updatedNotes }
    if (data.fields.full_name) updates.full_name = data.fields.full_name
    if (data.fields.phone) updates.phone = data.fields.phone
    if (data.fields.email) updates.email = data.fields.email
    if (data.fields.source_detail) updates.source_detail = data.fields.source_detail

    await handleUpdateCandidate(updates)

    if (data.fields.identified_pains || data.fields.solutions_presented || data.fields.candidate_objections) {
      const { upsertPainPitch } = await import('@/app/dashboard/recrutamento/actions')
      await upsertPainPitch(candidateId, {
        identified_pains: data.fields.identified_pains || null,
        solutions_presented: data.fields.solutions_presented || null,
        candidate_objections: data.fields.candidate_objections || null,
      })
    }

    patchCandidate(updates)
    toast.success('Nota adicionada e dados extraídos')
  }

  const handleFitScoreChange = async (score: number) => {
    setFitScore(score)
    try {
      const { upsertPainPitch } = await import('@/app/dashboard/recrutamento/actions')
      await upsertPainPitch(candidateId, { fit_score: score })
    } catch { /* silent */ }
  }

  if (loading) return (
    <div className="h-[calc(100vh-4rem)] md:p-4">
      <div className="flex h-full md:rounded-2xl overflow-hidden border shadow-lg">
        <div className="w-screen md:w-80 shrink-0 bg-neutral-900 p-5 space-y-4"><Skeleton className="h-8 w-28 rounded-full bg-white/10" /><Skeleton className="h-20 w-20 rounded-2xl mx-auto bg-white/10" /><Skeleton className="h-5 w-32 mx-auto bg-white/10" /><Skeleton className="h-28 rounded-xl bg-white/10" /><Skeleton className="h-28 rounded-xl bg-white/10" /></div>
        <div className="w-screen md:w-auto flex-1 p-6 space-y-4 shrink-0"><Skeleton className="h-10 w-96" /><Skeleton className="h-64 rounded-2xl" /></div>
      </div>
    </div>
  )

  if (!candidate) return (
    <div className="flex items-center justify-center h-[calc(100vh-4rem)] p-4">
      <div className="text-center"><User className="h-16 w-16 text-muted-foreground/20 mx-auto mb-3" /><p className="text-sm text-muted-foreground">Candidato não encontrado</p>
        <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={() => router.push('/dashboard/recrutamento/candidatos')}>Voltar</Button></div>
    </div>
  )

  const recruiter = recruiters.find(r => r.id === candidate.assigned_recruiter_id)
  const daysSince = candidate.last_interaction_date ? differenceInDays(new Date(), new Date(candidate.last_interaction_date)) : null
  const slaOverdue = daysSince !== null && daysSince > 7
  const scoreColor = scoreData ? (scoreData.score >= 70 ? 'text-emerald-600 bg-emerald-500/10' : scoreData.score >= 40 ? 'text-amber-600 bg-amber-500/10' : 'text-red-600 bg-red-500/10') : ''

  return (
    <>
    {/* ═══ Desktop ═══ */}
    <div className="hidden md:block h-[calc(100vh-4rem)] p-4">
      <div className="flex h-full rounded-2xl overflow-hidden border shadow-lg">
      {/* Left Sidebar */}
      <ScrollArea className="w-80 shrink-0 bg-neutral-900 text-white">
        <div className="p-5 space-y-4">
          {/* Back */}
          <button onClick={() => router.push('/dashboard/recrutamento/candidatos')}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 px-3 py-1.5 text-[11px] font-medium text-neutral-300 hover:bg-white/20 hover:text-white transition-colors">
            <ArrowLeft className="h-3 w-3" />Candidatos
          </button>

          {/* Avatar + name */}
          <div className="text-center pt-1">
            <label className="relative mx-auto block h-20 w-20 cursor-pointer group">
              <Avatar className="h-20 w-20 rounded-2xl">
                {candidate.photo_url ? (
                  <img src={candidate.photo_url} alt="" className="h-full w-full rounded-2xl object-cover" />
                ) : (
                  <AvatarFallback className="text-2xl font-bold rounded-2xl bg-white/10 text-white">{getInitials(editMode ? editForm.full_name : candidate.full_name)}</AvatarFallback>
                )}
              </Avatar>
              <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="h-5 w-5 text-white" />
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                toast.loading('A carregar foto...', { id: 'photo-upload' })
                try {
                  const fd = new FormData()
                  fd.append('file', file)
                  const res = await fetch(`/api/recrutamento/candidates/${candidateId}/photo`, { method: 'POST', body: fd })
                  if (res.ok) { const { url: photoUrl } = await res.json(); patchCandidate({ photo_url: photoUrl }); toast.success('Foto actualizada', { id: 'photo-upload' }) }
                  else toast.error('Erro ao carregar foto', { id: 'photo-upload' })
                } catch { toast.error('Erro', { id: 'photo-upload' }) }
              }} />
            </label>
            {editMode ? (
              <input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                className="mt-3 text-lg font-bold text-white bg-transparent border-b border-white/20 text-center w-full focus:outline-none focus:border-white/50" />
            ) : (
              <h2 className="text-lg font-bold mt-3 text-white">{candidate.full_name}</h2>
            )}
            <p className="text-xs text-neutral-400 mt-0.5">{CANDIDATE_SOURCES[candidate.source]}</p>

            <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium bg-white/10 border border-white/10"
                style={{ color: getStatusColor(candidate.status) }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: getStatusColor(candidate.status) }} />
                {CANDIDATE_STATUSES[candidate.status].label}
              </span>
              {candidate.cv_url ? (
                <button type="button" onClick={() => setCvDialogOpen(true)}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/30 transition-colors">
                  <FileText className="h-2.5 w-2.5" />CV
                </button>
              ) : (
                <label className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium bg-white/10 text-neutral-500 border border-white/10 hover:bg-white/15 cursor-pointer transition-colors">
                  <FileText className="h-2.5 w-2.5" />CV
                  <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    toast.loading('A carregar CV...', { id: 'cv-upload' })
                    try {
                      const fd = new FormData()
                      fd.append('file', file)
                      const res = await fetch(`/api/recrutamento/candidates/${candidateId}/cv`, { method: 'POST', body: fd })
                      if (res.ok) { const { url: cvUrl } = await res.json(); patchCandidate({ cv_url: cvUrl }); toast.success('CV carregado', { id: 'cv-upload' }) }
                      else toast.error('Erro', { id: 'cv-upload' })
                    } catch { toast.error('Erro', { id: 'cv-upload' }) }
                  }} />
                </label>
              )}
            </div>

            {/* Fit Score stars — interactive */}
            <div className="flex items-center justify-center gap-1 mt-2">
              {[1, 2, 3, 4, 5].map(s => {
                const filled = s <= (fitScoreHover || fitScore)
                return (
                  <button key={s} type="button"
                    onMouseEnter={() => setFitScoreHover(s)}
                    onMouseLeave={() => setFitScoreHover(0)}
                    onClick={() => handleFitScoreChange(s)}
                    className="p-0.5 transition-transform hover:scale-110">
                    <Star className={cn('h-4 w-4', filled ? 'fill-amber-400 text-amber-400' : 'text-neutral-700')} />
                  </button>
                )
              })}
              {fitScore > 0 && <span className="text-[10px] text-neutral-500 ml-1">{fitScore}/5</span>}
            </div>
          </div>

          {/* Contact — white card */}
          <div className="rounded-xl bg-white/[0.07] p-4 space-y-3">
            <h3 className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Contacto</h3>
            {editMode ? (
              <div className="space-y-2">
                <DarkEditField icon={Phone} iconColor="text-blue-400" iconBg="bg-blue-500/20" label="Telemóvel" value={editForm.phone} onChange={v => setEditForm(f => ({ ...f, phone: v }))} />
                <DarkEditField icon={Mail} iconColor="text-emerald-400" iconBg="bg-emerald-500/20" label="Email" value={editForm.email} onChange={v => setEditForm(f => ({ ...f, email: v }))} />
              </div>
            ) : (
              <div className="space-y-2">
                <a href={candidate.phone ? `tel:${candidate.phone}` : '#'} className={cn('flex items-center gap-2.5 rounded-lg p-2 -mx-2 transition-colors', candidate.phone && 'hover:bg-white/5 cursor-pointer')}>
                  <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0"><Phone className="h-3.5 w-3.5 text-blue-400" /></div>
                  <div><p className="text-[10px] text-neutral-500">Telemóvel</p>
                    <p className={cn('text-sm font-medium', candidate.phone ? 'text-neutral-200' : 'text-neutral-600')}>{candidate.phone || '—'}</p>
                  </div>
                </a>
                {candidate.phone && (
                  <button type="button" onClick={async () => {
                    if (whatsappChatId && whatsappInstance) {
                      setShowWhatsapp(true)
                      return
                    }
                    setWhatsappLoading(true)
                    try {
                      // 1. Get instance
                      let instId = whatsappInstance
                      if (!instId) {
                        const instRes = await fetch('/api/automacao/instancias')
                        const instData = await instRes.json()
                        const inst = (instData.instances || [])[0]
                        if (!inst) { toast.error('Nenhuma instância WhatsApp configurada'); return }
                        instId = inst.id
                        setWhatsappInstance(instId)
                      }

                      // 2. Resolve chat ID from phone
                      const cleanPhone = candidate.phone!.replace(/[\s+\-()]/g, '')
                      const waNumber = `${cleanPhone}@s.whatsapp.net`

                      // Check if chat exists
                      const { createClient } = await import('@/lib/supabase/client')
                      const supabase = createClient() as any
                      let { data: existingChat } = await supabase
                        .from('wpp_chats')
                        .select('id')
                        .eq('instance_id', instId)
                        .eq('wa_chat_id', waNumber)
                        .single()

                      if (existingChat?.id) {
                        setWhatsappChatId(existingChat.id)
                      }
                      // Show WhatsApp panel even without existing chat (will show "no conversation" state)
                      setShowWhatsapp(true)
                    } catch { toast.error('Erro ao abrir WhatsApp') }
                    finally { setWhatsappLoading(false) }
                  }}
                    className={cn('flex items-center gap-2.5 rounded-lg p-2 -mx-2 transition-colors cursor-pointer w-full text-left',
                      showWhatsapp ? 'bg-green-500/15' : 'hover:bg-white/5'
                    )}>
                    <div className="h-8 w-8 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0"><MessageCircle className="h-3.5 w-3.5 text-green-400" /></div>
                    <div><p className="text-[10px] text-neutral-500">WhatsApp</p>
                      <p className="text-sm font-medium text-neutral-200 flex items-center gap-1.5">
                        {whatsappLoading ? <><Loader2 className="h-3 w-3 animate-spin" />A abrir...</> : showWhatsapp ? 'Conversa aberta' : 'Abrir conversa'}
                      </p>
                    </div>
                  </button>
                )}
                <a href={candidate.email ? `mailto:${candidate.email}` : '#'} className={cn('flex items-center gap-2.5 rounded-lg p-2 -mx-2 transition-colors', candidate.email && 'hover:bg-white/5 cursor-pointer')}>
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0"><Mail className="h-3.5 w-3.5 text-emerald-400" /></div>
                  <div className="min-w-0"><p className="text-[10px] text-neutral-500">Email</p>
                    <p className={cn('text-sm font-medium truncate', candidate.email ? 'text-neutral-200' : 'text-neutral-600')}>{candidate.email || '—'}</p>
                  </div>
                </a>
                <a href={candidate.linkedin_url || '#'} target={candidate.linkedin_url ? '_blank' : undefined} rel="noopener"
                  className={cn('flex items-center gap-2.5 rounded-lg p-2 -mx-2 transition-colors', candidate.linkedin_url && 'hover:bg-white/5 cursor-pointer')}>
                  <div className="h-8 w-8 rounded-lg bg-sky-500/20 flex items-center justify-center shrink-0"><Linkedin className="h-3.5 w-3.5 text-sky-400" /></div>
                  <div><p className="text-[10px] text-neutral-500">LinkedIn</p>
                    <p className={cn('text-sm font-medium', candidate.linkedin_url ? 'text-sky-400' : 'text-neutral-600')}>{candidate.linkedin_url ? 'Perfil' : '—'}</p>
                  </div>
                </a>
              </div>
            )}
          </div>

          {/* Details — white card */}
          <div className="rounded-xl bg-white/[0.07] p-4 space-y-2">
            <h3 className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-1">Detalhes</h3>
            <DarkDetailRow label="Origem" value={CANDIDATE_SOURCES[candidate.source]} />
            {candidate.source_detail && <DarkDetailRow label="Detalhe" value={candidate.source_detail} />}
            <DarkDetailRow label="Recrutador" value={recruiter?.commercial_name || '—'} />
            {candidate.first_contact_date && <DarkDetailRow label="1.º Contacto" value={format(new Date(candidate.first_contact_date), 'dd/MM/yyyy', { locale: pt })} />}
            <DarkDetailRow label="Criado" value={format(new Date(candidate.created_at), 'dd/MM/yyyy', { locale: pt })} />
            {candidate.last_interaction_date && (
              <DarkDetailRow label="Último Contacto"
                value={formatDistanceToNow(new Date(candidate.last_interaction_date), { locale: pt, addSuffix: true }).replace('aproximadamente ', '')}
                warn={slaOverdue} />
            )}
          </div>

          {/* Notes — white card, clickable */}
          <button type="button" className="w-full text-left rounded-xl bg-white/[0.07] p-4 space-y-2 hover:bg-white/[0.1] transition-colors"
            onClick={() => { setPopupNotes(candidate.notes || ''); setNotesPopupOpen(true) }}>
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Notas</h3>
              <Pencil className="h-3 w-3 text-neutral-600" />
            </div>
            <p className="text-xs text-neutral-400 whitespace-pre-wrap leading-relaxed line-clamp-4">{candidate.notes || 'Sem notas. Clique para adicionar.'}</p>
          </button>


          {/* Recruiter */}
          {recruiter && (
            <div className="rounded-xl bg-white/[0.07] p-4">
              <h3 className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-2">Recrutador</h3>
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9"><AvatarFallback className="text-[10px] font-bold bg-white/10 text-white">{getInitials(recruiter.commercial_name)}</AvatarFallback></Avatar>
                <div><p className="text-sm font-medium text-neutral-200">{recruiter.commercial_name}</p></div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Right Content — Tabs */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Tab bar + status selector */}
        <div className="shrink-0 px-3 md:px-6 py-3 md:py-4 border-b bg-background/80 backdrop-blur-sm flex items-center justify-between">
          <div className="inline-flex items-center gap-0.5 md:gap-1 p-1 rounded-full bg-muted/30 backdrop-blur-sm">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button key={tab.key} onClick={() => { setActiveTab(tab.key); setShowWhatsapp(false) }}
                  title={tab.label}
                  className={cn('inline-flex items-center justify-center gap-1.5 rounded-full text-xs font-medium transition-all duration-300',
                    'p-2 md:px-4 md:py-1.5',
                    activeTab === tab.key ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}>
                  <Icon className="h-3.5 w-3.5" /><span className="hidden md:inline">{tab.label}</span>
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2">
            <Select value={candidate.status} onValueChange={(v) => handleStatusChange(v as CandidateStatus)}>
              <SelectTrigger
                className="w-auto gap-2 rounded-full text-xs h-8 px-4 font-medium border-0 text-white"
                style={{ backgroundColor: getStatusColor(candidate.status) }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {PIPELINE_STAGES.map(s => (
                  <SelectItem key={s} value={s}>
                    <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: getStatusColor(s) }} />{CANDIDATE_STATUSES[s].label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* AI Notes button */}
            <button type="button" onClick={() => setAiNotesOpen(true)} title="Nota IA"
              className="inline-flex items-center gap-1.5 rounded-full p-2 md:px-3 md:py-1.5 text-[11px] font-medium bg-violet-500/10 text-violet-600 hover:bg-violet-500/20 transition-colors">
              <Sparkles className="h-3 w-3" /><span className="hidden md:inline">Nota IA</span>
            </button>
            <button
              type="button"
              onClick={editMode ? saveEdit : enterEditMode}
              disabled={editMode && savingCandidate}
              title={editMode ? 'Guardar' : 'Editar'}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full p-2 md:px-3 md:py-1.5 text-[11px] font-medium transition-colors',
                editMode ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {editMode ? (
                savingCandidate ? <><Loader2 className="h-3 w-3 animate-spin" /><span className="hidden md:inline">A guardar...</span></> : <><Check className="h-3 w-3" /><span className="hidden md:inline">Guardar</span></>
              ) : (
                <><Pencil className="h-3 w-3" /><span className="hidden md:inline">Editar</span></>
              )}
            </button>
          </div>
        </div>

        {/* WhatsApp inline chat OR tab content */}
        {showWhatsapp && candidate.phone ? (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* WhatsApp header */}
            <div className="shrink-0 px-4 py-2 border-b bg-green-500/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium">WhatsApp — {candidate.full_name}</span>
                <span className="text-[10px] text-muted-foreground">{candidate.phone}</span>
              </div>
              <button type="button" onClick={() => setShowWhatsapp(false)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors rounded-full px-2.5 py-1 hover:bg-muted/50">
                ✕ Fechar
              </button>
            </div>
            <div className="flex-1 min-h-0">
              {whatsappInstance && whatsappChatId ? (
                <ChatThread
                  chatId={whatsappChatId}
                  instanceId={whatsappInstance}
                  onToggleInfo={() => {}}
                />
              ) : whatsappInstance && !whatsappChatId ? (
                <NoChatState
                  phone={candidate.phone!}
                  name={candidate.full_name}
                  instanceId={whatsappInstance}
                  onChatCreated={(chatId) => { setWhatsappChatId(chatId) }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />A carregar...
                </div>
              )}
            </div>
          </div>
        ) : (
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-6">
            <div key={activeTab} className="animate-in fade-in duration-300">
              {activeTab === 'visao_geral' && (
                <CandidateOverviewTab
                  candidate={candidate} candidateId={candidateId}
                  communications={[]} stageLogs={[]}
                  painPitchRecords={painPitchRecords}
                  recruiters={recruiters} onUpdateCandidate={handleUpdateCandidate}
                  onAddCommunication={handleAddCommunication} onReload={loadData}
                  savingCandidate={savingCandidate} savingComm={savingComm}
                />
              )}
              {activeTab === 'qualificacao' && (
                <CandidateQualificationTab candidateId={candidateId} candidateSource={candidate.source}
                  originProfile={originProfile} painPitchRecords={painPitchRecords} financial={financial} budget={budget} onSave={loadData} />
              )}
              {activeTab === 'entrevistas' && (
                <CandidateInterviewsTab candidateId={candidateId} interviews={interviews} recruiters={recruiters} onReload={loadData} />
              )}
              {activeTab === 'historico' && (
                <CandidateOverviewTab
                  candidate={candidate} communications={communications} stageLogs={stageLogs}
                  recruiters={recruiters} onUpdateCandidate={handleUpdateCandidate}
                  onAddCommunication={handleAddCommunication} savingCandidate={savingCandidate} savingComm={savingComm}
                  hideDecision
                />
              )}
              {activeTab === 'onboarding' && (
                <CandidateOnboardingTab candidateId={candidateId} candidate={candidate}
                  onboarding={onboarding} probation={probation} recruiters={recruiters} onReload={loadData} />
              )}
            </div>
          </div>
        </ScrollArea>
        )}
      </div>
      </div>
    </div>

    {/* ═══ Mobile ═══ */}
    <div className="md:hidden flex items-center h-[calc(100vh-4rem)] px-4 py-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4">
      {/* Card 1: Dark profile */}
      <div className="w-[80vw] h-[80vh] shrink-0 snap-center rounded-2xl bg-neutral-900 text-white shadow-2xl overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-5 space-y-4">
            <button onClick={() => router.push('/dashboard/recrutamento/candidatos')}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-[11px] font-medium text-neutral-300">
              <ArrowLeft className="h-3 w-3" />Voltar
            </button>
            <div className="text-center pt-1">
              <label className="relative mx-auto block h-16 w-16 cursor-pointer group">
                <Avatar className="h-16 w-16 rounded-2xl">
                  {candidate.photo_url ? (
                    <img src={candidate.photo_url} alt="" className="h-full w-full rounded-2xl object-cover" />
                  ) : (
                    <AvatarFallback className="text-xl font-bold rounded-2xl bg-white/10 text-white">{getInitials(candidate.full_name)}</AvatarFallback>
                  )}
                </Avatar>
                <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="h-4 w-4 text-white" />
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  toast.loading('A carregar foto...', { id: 'photo-upload' })
                  try {
                    const fd = new FormData()
                    fd.append('file', file)
                    const res = await fetch(`/api/recrutamento/candidates/${candidateId}/photo`, { method: 'POST', body: fd })
                    if (res.ok) { const { url: photoUrl } = await res.json(); patchCandidate({ photo_url: photoUrl }); toast.success('Foto actualizada', { id: 'photo-upload' }) }
                    else toast.error('Erro', { id: 'photo-upload' })
                  } catch { toast.error('Erro', { id: 'photo-upload' }) }
                }} />
              </label>
              <h2 className="text-base font-bold mt-2 text-white">{candidate.full_name}</h2>
              <p className="text-[10px] text-neutral-400">{CANDIDATE_SOURCES[candidate.source]}</p>
              <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium bg-white/10 border border-white/10"
                  style={{ color: getStatusColor(candidate.status) }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: getStatusColor(candidate.status) }} />
                  {CANDIDATE_STATUSES[candidate.status].label}
                </span>
                {candidate.cv_url ? (
                  <button type="button" onClick={() => setCvDialogOpen(true)}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">
                    <FileText className="h-2.5 w-2.5" />CV
                  </button>
                ) : (
                  <label className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium bg-white/10 text-neutral-500 border border-white/10 cursor-pointer">
                    <FileText className="h-2.5 w-2.5" />CV
                    <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      toast.loading('A carregar CV...', { id: 'cv-upload' })
                      try {
                        const fd = new FormData()
                        fd.append('file', file)
                        const res = await fetch(`/api/recrutamento/candidates/${candidateId}/cv`, { method: 'POST', body: fd })
                        if (res.ok) { const { url: cvUrl } = await res.json(); patchCandidate({ cv_url: cvUrl }); toast.success('CV carregado', { id: 'cv-upload' }) }
                        else toast.error('Erro', { id: 'cv-upload' })
                      } catch { toast.error('Erro', { id: 'cv-upload' }) }
                    }} />
                  </label>
                )}
              </div>
              {/* Fit Score stars — interactive */}
              <div className="flex items-center justify-center gap-0.5 mt-1.5">
                {[1, 2, 3, 4, 5].map(s => {
                  const filled = s <= fitScore
                  return (
                    <button key={s} type="button" onClick={() => handleFitScoreChange(s)} className="p-0.5">
                      <Star className={cn('h-3.5 w-3.5', filled ? 'fill-amber-400 text-amber-400' : 'text-neutral-700')} />
                    </button>
                  )
                })}
                {fitScore > 0 && <span className="text-[9px] text-neutral-500 ml-1">{fitScore}/5</span>}
              </div>
            </div>

            <div className="rounded-xl bg-white/[0.07] p-3 space-y-2.5">
              <h3 className="text-[9px] uppercase tracking-wider text-neutral-500 font-semibold">Contacto</h3>
              <a href={candidate.phone ? `tel:${candidate.phone}` : '#'} className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-blue-500/20 flex items-center justify-center"><Phone className="h-3 w-3 text-blue-400" /></div>
                <div><p className="text-[9px] text-neutral-500">Telemóvel</p><p className="text-xs font-medium text-neutral-200">{candidate.phone || '—'}</p></div>
              </a>
              <a href={candidate.email ? `mailto:${candidate.email}` : '#'} className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-emerald-500/20 flex items-center justify-center"><Mail className="h-3 w-3 text-emerald-400" /></div>
                <div className="min-w-0"><p className="text-[9px] text-neutral-500">Email</p><p className="text-xs font-medium text-neutral-200 truncate">{candidate.email || '—'}</p></div>
              </a>
            </div>

            <div className="rounded-xl bg-white/[0.07] p-3 space-y-1.5">
              <h3 className="text-[9px] uppercase tracking-wider text-neutral-500 font-semibold">Detalhes</h3>
              <DarkDetailRow label="Recrutador" value={recruiter?.commercial_name || '—'} />
              <DarkDetailRow label="Criado" value={format(new Date(candidate.created_at), 'dd/MM/yyyy', { locale: pt })} />
              {candidate.last_interaction_date && <DarkDetailRow label="Último Contacto" value={formatDistanceToNow(new Date(candidate.last_interaction_date), { locale: pt, addSuffix: true }).replace('aproximadamente ', '')} warn={slaOverdue} />}
            </div>

            <button type="button" className="w-full text-left rounded-xl bg-white/[0.07] p-3 space-y-1"
              onClick={() => { setPopupNotes(candidate.notes || ''); setNotesPopupOpen(true) }}>
              <h3 className="text-[9px] uppercase tracking-wider text-neutral-500 font-semibold">Notas</h3>
              <p className="text-[10px] text-neutral-400 line-clamp-3">{candidate.notes || 'Sem notas.'}</p>
            </button>
          </div>
        </ScrollArea>
      </div>

      {/* Card 2: White tabs */}
      <div className="w-[80vw] h-[80vh] shrink-0 snap-center rounded-2xl border bg-card shadow-2xl overflow-hidden flex flex-col">
        <div className="shrink-0 px-3 py-2.5 border-b flex items-center justify-between">
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-muted/30">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button key={tab.key} onClick={() => { setActiveTab(tab.key); setShowWhatsapp(false) }} title={tab.label}
                  className={cn('p-2 rounded-full text-xs transition-all',
                    activeTab === tab.key ? 'bg-neutral-900 text-white shadow-sm' : 'text-muted-foreground'
                  )}>
                  <Icon className="h-3.5 w-3.5" />
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setAiNotesOpen(true)} className="p-1.5 rounded-full bg-violet-500/10 text-violet-600"><Sparkles className="h-3 w-3" /></button>
            <button type="button" onClick={editMode ? saveEdit : enterEditMode} className={cn('p-1.5 rounded-full', editMode ? 'bg-emerald-600 text-white' : 'bg-muted/50 text-muted-foreground')}>
              {editMode ? <Check className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
            </button>
          </div>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4">
            <div key={activeTab} className="animate-in fade-in duration-200">
              {activeTab === 'visao_geral' && (
                <CandidateOverviewTab candidate={candidate} candidateId={candidateId} communications={[]} stageLogs={[]}
                  painPitchRecords={painPitchRecords} recruiters={recruiters} onUpdateCandidate={handleUpdateCandidate}
                  onAddCommunication={handleAddCommunication} onReload={loadData} savingCandidate={savingCandidate} savingComm={savingComm} />
              )}
              {activeTab === 'qualificacao' && (
                <CandidateQualificationTab candidateId={candidateId} candidateSource={candidate.source}
                  originProfile={originProfile} painPitchRecords={painPitchRecords} financial={financial} budget={budget} onSave={loadData} />
              )}
              {activeTab === 'entrevistas' && (
                <CandidateInterviewsTab candidateId={candidateId} interviews={interviews} recruiters={recruiters} onReload={loadData} />
              )}
              {activeTab === 'historico' && (
                <CandidateOverviewTab candidate={candidate} communications={communications} stageLogs={stageLogs}
                  recruiters={recruiters} onUpdateCandidate={handleUpdateCandidate} onAddCommunication={handleAddCommunication}
                  savingCandidate={savingCandidate} savingComm={savingComm} hideDecision />
              )}
              {activeTab === 'onboarding' && (
                <CandidateOnboardingTab candidateId={candidateId} candidate={candidate}
                  onboarding={onboarding} probation={probation} recruiters={recruiters} onReload={loadData} />
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>

      {/* ═══ Shared Dialogs ═══ */}

      {/* CV Dialog */}
      <Dialog open={cvDialogOpen} onOpenChange={setCvDialogOpen}>
        <DialogContent className="w-[90vw] max-w-3xl max-h-[85vh] rounded-2xl p-0 overflow-hidden flex flex-col">
          <DialogHeader className="sr-only">
            <DialogTitle>Currículo</DialogTitle>
            <DialogDescription>Pré-visualização do currículo</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
            <span className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4" />Currículo</span>
            <div className="flex items-center gap-1">
              {candidate.cv_url && (
                <>
                  <a href={`/api/recrutamento/candidates/${candidateId}/cv-preview`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
                    <ExternalLink className="h-3 w-3" /><span className="hidden sm:inline">Abrir</span>
                  </a>
                  <a href={candidate.cv_url} download
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
                    <Download className="h-3 w-3" /><span className="hidden sm:inline">Download</span>
                  </a>
                </>
              )}
              <label className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors">
                <Upload className="h-3 w-3" /><span className="hidden sm:inline">Substituir</span>
                <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setUploadingCv(true)
                  try {
                    const fd = new FormData()
                    fd.append('file', file)
                    const res = await fetch(`/api/recrutamento/candidates/${candidateId}/cv`, { method: 'POST', body: fd })
                    if (res.ok) { const { url: newCvUrl } = await res.json(); patchCandidate({ cv_url: newCvUrl }); toast.success('CV actualizado') }
                    else toast.error('Erro')
                  } catch { toast.error('Erro') }
                  finally { setUploadingCv(false) }
                }} />
              </label>
              <button type="button" disabled={deletingCv}
                onClick={() => setDeleteCvConfirm(true)}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-500/10 transition-colors">
                <Trash2 className="h-3 w-3" /><span className="hidden sm:inline">Eliminar</span>
              </button>
            </div>
          </div>
          {/* CV viewer */}
          {candidate.cv_url && (() => {
            const ext = candidate.cv_url!.split('.').pop()?.toLowerCase() || ''
            const isPdf = ext === 'pdf'
            const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext)
            const isDoc = ['doc', 'docx'].includes(ext)
            return (
              <div className="flex-1 min-h-0">
                {isPdf ? (
                  <iframe
                    key={candidate.cv_url}
                    src={`/api/recrutamento/candidates/${candidateId}/cv-preview`}
                    style={{ width: '100%', height: '70vh', border: 'none' }}
                    title="CV Preview"
                  />
                ) : isImage ? (
                  <div className="flex items-center justify-center h-[50vh] sm:h-[70vh] bg-muted/20 p-4">
                    <img src={candidate.cv_url!} alt="CV" className="max-h-full max-w-full object-contain rounded-xl" />
                  </div>
                ) : isDoc ? (
                  <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(candidate.cv_url!)}`}
                    className="w-full h-[50vh] sm:h-[70vh] border-0" title="CV" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-[50vh] sm:h-[70vh] gap-3">
                    <FileText className="h-12 w-12 text-muted-foreground/20" />
                    <p className="text-sm text-muted-foreground">Pré-visualização não disponível para este formato.</p>
                    <a href={candidate.cv_url!} download className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium border hover:bg-muted/50">
                      <Download className="h-3 w-3" />Download
                    </a>
                  </div>
                )}
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Delete CV Confirmation */}
      <AlertDialog open={deleteCvConfirm} onOpenChange={setDeleteCvConfirm}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar CV</AlertDialogTitle>
            <AlertDialogDescription>Tem a certeza de que pretende eliminar o currículo? Esta acção é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deletingCv}
              onClick={async () => {
                setDeletingCv(true)
                try {
                  const res = await fetch(`/api/recrutamento/candidates/${candidateId}/cv`, { method: 'DELETE' })
                  if (res.ok) { patchCandidate({ cv_url: null }); toast.success('CV eliminado'); setCvDialogOpen(false) }
                  else toast.error('Erro')
                } catch { toast.error('Erro') }
                finally { setDeletingCv(false); setDeleteCvConfirm(false) }
              }}>
              {deletingCv && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Notes Popup */}
      <Dialog open={notesPopupOpen} onOpenChange={setNotesPopupOpen}>
        <DialogContent className="w-[90vw] max-w-lg rounded-2xl">
          <DialogHeader><DialogTitle>Notas</DialogTitle><DialogDescription className="sr-only">Editar notas do candidato</DialogDescription></DialogHeader>
          <Textarea rows={10} value={popupNotes} onChange={e => setPopupNotes(e.target.value)}
            placeholder="Notas sobre o candidato..." className="text-sm" />
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setNotesPopupOpen(false)}>Cancelar</Button>
            <Button className="rounded-full gap-1.5" disabled={savingNotes}
              onClick={async () => {
                setSavingNotes(true)
                await handleUpdateCandidate({ notes: popupNotes })
                setSavingNotes(false)
                setNotesPopupOpen(false)
              }}>
              {savingNotes ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Notes Dialog */}
      <AiNotesDialog
        open={aiNotesOpen}
        onOpenChange={setAiNotesOpen}
        candidateName={candidate.full_name}
        onConfirm={handleAiNotesConfirm}
      />
    </>
  )
}

function DarkDetailRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-neutral-500 text-xs">{label}</span>
      <span className={cn('font-medium text-xs text-neutral-300', warn && 'text-red-400')}>{value}</span>
    </div>
  )
}

function DarkEditField({ icon: Icon, iconColor, iconBg, label, value, onChange }: {
  icon: any; iconColor: string; iconBg: string; label: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', iconBg)}>
        <Icon className={cn('h-3.5 w-3.5', iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-neutral-500">{label}</p>
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={label}
          className="w-full text-sm font-medium text-neutral-200 bg-transparent border-b border-white/10 focus:outline-none focus:border-white/30 pb-0.5" />
      </div>
    </div>
  )
}

function NoChatState({ phone, name, instanceId, onChatCreated }: {
  phone: string; name: string; instanceId: string; onChatCreated: (chatId: string) => void
}) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!message.trim()) return
    setSending(true)
    try {
      const cleanPhone = phone.replace(/[\s+\-()]/g, '')
      const waNumber = `${cleanPhone}@s.whatsapp.net`

      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instance_id: instanceId,
          wa_chat_id: waNumber,
          type: 'text',
          text: message.trim(),
        }),
      })

      if (!res.ok) throw new Error()
      const data = await res.json()

      // After sending, the chat should exist — find it
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient() as any

      // Wait a moment for the webhook to create the chat
      await new Promise(r => setTimeout(r, 1500))

      const { data: chat } = await supabase
        .from('wpp_chats')
        .select('id')
        .eq('instance_id', instanceId)
        .eq('wa_chat_id', waNumber)
        .single()

      if (chat?.id) {
        onChatCreated(chat.id)
      } else if (data.message?.chat_id) {
        onChatCreated(data.message.chat_id)
      }

      toast.success('Mensagem enviada')
    } catch {
      toast.error('Erro ao enviar mensagem')
    } finally { setSending(false) }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
      <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
        <MessageCircle className="h-8 w-8 text-green-500/40" />
      </div>
      <div>
        <p className="text-sm font-medium">Sem conversa com {name}</p>
        <p className="text-xs text-muted-foreground mt-1">Envie a primeira mensagem para iniciar a conversa via WhatsApp.</p>
      </div>
      <div className="w-full max-w-sm flex gap-2">
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Escreva a primeira mensagem..."
          className="flex-1 h-9 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
        />
        <button type="button" onClick={handleSend} disabled={!message.trim() || sending}
          className="h-9 px-4 rounded-xl bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-1.5">
          {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3" />}
          Enviar
        </button>
      </div>
    </div>
  )
}
