'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  getCandidate,
  updateCandidate,
  getOriginProfile,
  getPainPitchRecords,
  getInterviews,
  getFinancialEvolution,
  getBudget,
  getOnboarding,
  getStageLog,
  getRecruiters,
  getCommunications,
  getProbation,
  calculateCandidateScore,
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
} from '@/types/recruitment'

import { Skeleton } from '@/components/ui/skeleton'
import { User, Eye, Briefcase, CalendarDays, FileCheck, Pencil } from 'lucide-react'

import { CandidateHeader } from '@/components/recrutamento/candidate-header'
import { CandidateOverviewTab } from '@/components/recrutamento/candidate-overview-tab'
import { CandidateQualificationTab } from '@/components/recrutamento/candidate-qualification-tab'
import { CandidateInterviewsTab } from '@/components/recrutamento/candidate-interviews-tab'
import { CandidateOnboardingTab } from '@/components/recrutamento/candidate-onboarding-tab'

const TABS = [
  { key: 'visao_geral', label: 'Visão Geral', icon: Eye },
  { key: 'qualificacao', label: 'Qualificação', icon: Briefcase },
  { key: 'entrevistas', label: 'Entrevistas', icon: CalendarDays },
  { key: 'onboarding', label: 'Onboarding & Contrato', icon: FileCheck },
] as const

type TabKey = (typeof TABS)[number]['key']

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

  // UI state
  const [activeTab, setActiveTab] = useState<TabKey>('visao_geral')
  const [editMode, setEditMode] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)
  const [savingCandidate, setSavingCandidate] = useState(false)
  const [savingComm, setSavingComm] = useState(false)

  // ─── Load data ─────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    const [
      candidateRes, originRes, painRes, interviewsRes,
      financialRes, budgetRes, onboardingRes, logRes,
      recruitersRes, commRes, probationRes, scoreRes,
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
    ])

    if (candidateRes.candidate) setCandidate(candidateRes.candidate)
    setOriginProfile(originRes.profile)
    setPainPitchRecords(painRes.records)
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

  // ─── Handlers ─────────────────────────────────────────────────────────
  async function handleStatusChange(newStatus: CandidateStatus) {
    if (!candidate) return
    setChangingStatus(true)
    const { error } = await updateCandidate(candidate.id, { status: newStatus })
    setChangingStatus(false)
    if (error) {
      toast.error('Erro ao alterar estado')
    } else {
      toast.success(`Estado alterado`)
      await loadData()
    }
  }

  async function handleUpdateCandidate(updates: Partial<RecruitmentCandidate>) {
    if (!candidate) return
    setSavingCandidate(true)
    const { error } = await updateCandidate(candidate.id, updates)
    setSavingCandidate(false)
    if (error) {
      toast.error('Erro ao guardar')
    } else {
      toast.success('Guardado com sucesso')
      await loadData()
    }
  }

  async function handleAddCommunication(data: {
    type: CommunicationType
    direction: CommunicationDirection
    subject: string
    content: string
  }) {
    setSavingComm(true)
    const { createCommunication } = await import('@/app/dashboard/recrutamento/actions')
    const { error } = await createCommunication(candidateId, {
      type: data.type,
      subject: data.subject || undefined,
      content: data.content || undefined,
      direction: data.direction,
    })
    setSavingComm(false)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Comunicação registada')
      const res = await getCommunications(candidateId)
      setCommunications(res.communications)
    }
  }

  // ─── Loading state ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!candidate) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12">
        <User className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-muted-foreground">Candidato não encontrado</h2>
        <button
          onClick={() => router.push('/dashboard/recrutamento')}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
        >
          Voltar
        </button>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ─── Hero Card ─── */}
      <CandidateHeader
        candidate={candidate}
        recruiters={recruiters}
        scoreData={scoreData}
        onStatusChange={handleStatusChange}
        onBack={() => router.push('/dashboard/recrutamento')}
        changingStatus={changingStatus}
      />

      {/* ─── Content Card with Tabs ─── */}
      <div className="rounded-2xl border shadow-lg bg-card overflow-hidden mt-4">
        {/* Tab navigation inside the card */}
        <div className="px-5 pt-5 pb-4 border-b flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm overflow-x-auto scrollbar-hide w-fit max-w-[calc(100vw-4rem)]">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                    isActive
                      ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                      : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => setEditMode(true)}
            className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border border-border/40 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
          >
            <Pencil className="h-3 w-3" />
            Editar
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8">
          <div key={activeTab} className="animate-in fade-in duration-300">
            {activeTab === 'visao_geral' && (
              <CandidateOverviewTab
                candidate={candidate}
                communications={communications}
                stageLogs={stageLogs}
                recruiters={recruiters}
                onUpdateCandidate={handleUpdateCandidate}
                onAddCommunication={handleAddCommunication}
                savingCandidate={savingCandidate}
                savingComm={savingComm}
              />
            )}

            {activeTab === 'qualificacao' && (
              <CandidateQualificationTab
                candidateId={candidateId}
                originProfile={originProfile}
                painPitchRecords={painPitchRecords}
                financial={financial}
                budget={budget}
                onSave={loadData}
              />
            )}

            {activeTab === 'entrevistas' && (
              <CandidateInterviewsTab
                candidateId={candidateId}
                interviews={interviews}
                recruiters={recruiters}
                onReload={loadData}
              />
            )}

            {activeTab === 'onboarding' && (
              <CandidateOnboardingTab
                candidateId={candidateId}
                candidate={candidate}
                onboarding={onboarding}
                probation={probation}
                recruiters={recruiters}
                onReload={loadData}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
