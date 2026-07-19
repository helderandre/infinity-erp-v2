'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Activity as ActivityIcon,
  Briefcase,
  CalendarCheck,
  Camera,
  CheckCircle2,
  FileText,
  Flag,
  Linkedin,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Rocket,
  Sparkles,
  Trash2,
  Upload,
  User as UserIcon,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  deleteCandidate,
  getBudget,
  getCandidate,
  getFinancialEvolution,
  getOnboarding,
  getOriginProfile,
  getPainPitchRecords,
  getProbation,
  getRecruiters,
  updateCandidate,
  upsertPainPitch,
} from '@/app/dashboard/recrutamento/actions'
import type {
  CandidateSource,
  CandidateStatus,
  RecruitmentBudget,
  RecruitmentCandidate,
  RecruitmentFinancialEvolution,
  RecruitmentOnboarding,
  RecruitmentOriginProfile,
  RecruitmentPainPitch,
  RecruitmentProbation,
} from '@/types/recruitment'
import {
  CANDIDATE_SOURCES,
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_DOT,
  PIPELINE_STAGES,
  normalizeCandidateStatus,
} from '@/types/recruitment'

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

import { CandidateActivityTab } from './candidate-activity-tab'
import { CandidateInterviewsTab } from './candidate-interviews-tab'
import { CandidateQualificationTab } from './candidate-qualification-tab'
import { CandidateOnboardingTab } from './candidate-onboarding-tab'
import { AiNotesDialog, type ExtractedFields } from './ai-notes-dialog'

type TabKey = 'perfil' | 'qualificacao' | 'atividade' | 'entrevistas' | 'decisao' | 'onboarding'

const BASE_TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'perfil', label: 'Perfil', icon: UserIcon },
  { key: 'qualificacao', label: 'Qualificação', icon: Briefcase },
  { key: 'atividade', label: 'Atividade', icon: ActivityIcon },
  { key: 'entrevistas', label: 'Entrevistas', icon: CalendarCheck },
  { key: 'decisao', label: 'Decisão', icon: Flag },
]

interface Recruiter {
  id: string
  commercial_name: string
}

interface EditForm {
  full_name: string
  email: string
  phone: string
  linkedin_url: string
  source: CandidateSource
  source_detail: string
  notes: string
}

function seedForm(c: RecruitmentCandidate): EditForm {
  return {
    full_name: c.full_name ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    linkedin_url: c.linkedin_url ?? '',
    source: c.source,
    source_detail: c.source_detail ?? '',
    notes: c.notes ?? '',
  }
}

export function CandidateSheet({
  candidateId,
  open,
  onOpenChange,
  onMutated,
}: {
  candidateId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onMutated?: () => void
}) {
  const isMobile = useIsMobile()
  const [candidate, setCandidate] = useState<RecruitmentCandidate | null>(null)
  const [recruiters, setRecruiters] = useState<Recruiter[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('perfil')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<EditForm>()
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [aiNotesOpen, setAiNotesOpen] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [cvUploading, setCvUploading] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Qualificação (lazy)
  const [qualLoaded, setQualLoaded] = useState(false)
  const [originProfile, setOriginProfile] = useState<RecruitmentOriginProfile | null>(null)
  const [painPitch, setPainPitch] = useState<RecruitmentPainPitch[]>([])
  const [financial, setFinancial] = useState<RecruitmentFinancialEvolution | null>(null)
  const [budget, setBudget] = useState<RecruitmentBudget | null>(null)

  // Onboarding (lazy, só contratado)
  const [obLoaded, setObLoaded] = useState(false)
  const [onboarding, setOnboarding] = useState<RecruitmentOnboarding | null>(null)
  const [probation, setProbation] = useState<RecruitmentProbation | null>(null)

  const status = normalizeCandidateStatus(candidate?.status)
  const tabs = status === 'contratado'
    ? [...BASE_TABS, { key: 'onboarding' as TabKey, label: 'Onboarding', icon: Rocket }]
    : BASE_TABS

  const load = useCallback(async () => {
    if (!candidateId) return
    setLoading(true)
    try {
      const [{ candidate: c }, recs] = await Promise.all([
        getCandidate(candidateId),
        recruiters.length ? Promise.resolve(null) : getRecruiters(),
      ])
      if (recs) setRecruiters(recs.recruiters)
      setCandidate(c)
      if (c) setForm(seedForm(c))
    } catch (e) {
      console.error(e)
      toast.error('Não foi possível carregar o candidato')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId])

  const loadQual = useCallback(async () => {
    if (!candidateId) return
    try {
      const [op, pp, fin, bud] = await Promise.all([
        getOriginProfile(candidateId),
        getPainPitchRecords(candidateId),
        getFinancialEvolution(candidateId),
        getBudget(candidateId),
      ])
      setOriginProfile(op.profile)
      setPainPitch(pp.records)
      setFinancial(fin.financial)
      setBudget(bud.budget)
      setQualLoaded(true)
    } catch (e) {
      console.error(e)
    }
  }, [candidateId])

  const loadOnboarding = useCallback(async () => {
    if (!candidateId) return
    try {
      const [ob, pb] = await Promise.all([getOnboarding(candidateId), getProbation(candidateId)])
      setOnboarding(ob.onboarding)
      setProbation(pb.probation as RecruitmentProbation | null)
      setObLoaded(true)
    } catch (e) {
      console.error(e)
    }
  }, [candidateId])

  useEffect(() => {
    if (open && candidateId) {
      setActiveTab('perfil')
      setEditing(false)
      setQualLoaded(false)
      setObLoaded(false)
      setCandidate(null)
      void load()
    }
  }, [open, candidateId, load])

  useEffect(() => {
    if (activeTab === 'qualificacao' && !qualLoaded) void loadQual()
    if (activeTab === 'onboarding' && !obLoaded) void loadOnboarding()
  }, [activeTab, qualLoaded, obLoaded, loadQual, loadOnboarding])

  async function changeStatus(next: CandidateStatus) {
    if (!candidate || candidate.status === next) return
    setCandidate((c) => (c ? { ...c, status: next } : c))
    const { error } = await updateCandidate(candidate.id, { status: next })
    if (error) {
      toast.error('Falha ao mudar de fase')
      void load()
      return
    }
    void load()
    onMutated?.()
  }

  async function changeRecruiter(recruiterId: string | null) {
    if (!candidate) return
    setCandidate((c) => (c ? { ...c, assigned_recruiter_id: recruiterId } : c))
    const { error } = await updateCandidate(candidate.id, { assigned_recruiter_id: recruiterId })
    if (error) {
      void load()
      return
    }
    void load()
    onMutated?.()
  }

  async function saveField(patch: Partial<RecruitmentCandidate>) {
    if (!candidate) return
    setCandidate((c) => (c ? { ...c, ...patch } : c))
    const { error } = await updateCandidate(candidate.id, patch)
    if (error) {
      toast.error('Não foi possível guardar')
      void load()
    }
  }

  async function saveEdits() {
    if (!candidate || !form) return
    setSaving(true)
    try {
      const { error } = await updateCandidate(candidate.id, {
        full_name: form.full_name.trim() || candidate.full_name,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        linkedin_url: form.linkedin_url.trim() || null,
        source: form.source,
        source_detail: form.source_detail.trim() || null,
        notes: form.notes.trim() || null,
      })
      if (error) throw new Error(error)
      setEditing(false)
      await load()
      onMutated?.()
      toast.success('Candidato actualizado')
    } catch (e) {
      console.error(e)
      toast.error('Não foi possível guardar')
    } finally {
      setSaving(false)
    }
  }

  async function doDelete() {
    if (!candidate) return
    const { error } = await deleteCandidate(candidate.id)
    if (error) {
      toast.error('Não foi possível eliminar')
      return
    }
    toast.success('Candidato eliminado')
    setConfirmDelete(false)
    onOpenChange(false)
    onMutated?.()
  }

  async function uploadPhoto(file: File) {
    if (!candidate) return
    setPhotoUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/recrutamento/candidates/${candidate.id}/photo`, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro')
      setCandidate((c) => (c ? { ...c, photo_url: json.url } : c))
      onMutated?.()
      toast.success('Foto actualizada')
    } catch (e) {
      console.error(e)
      toast.error('Não foi possível carregar a foto')
    } finally {
      setPhotoUploading(false)
    }
  }

  async function uploadCv(file: File) {
    if (!candidate) return
    setCvUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/recrutamento/candidates/${candidate.id}/cv`, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro')
      setCandidate((c) => (c ? { ...c, cv_url: json.url } : c))
      onMutated?.()
      toast.success('CV carregado')
    } catch (e) {
      console.error(e)
      toast.error('Não foi possível carregar o CV')
    } finally {
      setCvUploading(false)
    }
  }

  // Nota ditada/colada → IA extrai campos e dores (mesmo fluxo da antiga página de detalhe).
  async function handleAiNotes(data: { note: string; fields: ExtractedFields }) {
    if (!candidate) return
    const timestamp = new Date().toLocaleString('pt-PT', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    const newNote = `[${timestamp}] ${data.note}`
    const updatedNotes = candidate.notes ? `${candidate.notes}\n\n${newNote}` : newNote

    const updates: Partial<RecruitmentCandidate> = { notes: updatedNotes }
    if (data.fields.full_name) updates.full_name = data.fields.full_name
    if (data.fields.phone) updates.phone = data.fields.phone
    if (data.fields.email) updates.email = data.fields.email
    if (data.fields.source_detail) updates.source_detail = data.fields.source_detail

    await updateCandidate(candidate.id, updates)

    if (data.fields.identified_pains || data.fields.solutions_presented || data.fields.candidate_objections) {
      await upsertPainPitch(candidate.id, {
        identified_pains: data.fields.identified_pains || null,
        solutions_presented: data.fields.solutions_presented || null,
        candidate_objections: data.fields.candidate_objections || null,
      })
      setQualLoaded(false)
    }

    await load()
    onMutated?.()
    toast.success('Nota adicionada e dados extraídos')
  }

  const set = (k: keyof EditForm, v: string) => setForm((f) => (f ? ({ ...f, [k]: v } as EditForm) : f))

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={cn(
            'p-0 gap-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
            'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
            isMobile
              ? 'data-[side=bottom]:h-[88dvh] rounded-t-3xl'
              : 'h-full w-full data-[side=right]:sm:max-w-[760px] sm:rounded-l-3xl',
          )}
        >
          {isMobile && (
            <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
          )}

          <SheetTitle className="sr-only">{candidate?.full_name ?? 'Candidato'}</SheetTitle>
          <SheetDescription className="sr-only">Detalhes da candidatura.</SheetDescription>

          {loading || !candidate ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-12 w-48" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <>
              {/* Header */}
              <SheetHeader className="shrink-0 px-6 pt-6 pb-3 gap-3">
                <div className="flex items-start justify-between gap-3 mr-10">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="relative shrink-0 group/photo"
                      title="Carregar foto"
                    >
                      <Avatar className="h-11 w-11">
                        {candidate.photo_url && <AvatarImage src={candidate.photo_url} alt={candidate.full_name} />}
                        <AvatarFallback className="text-sm font-semibold">
                          {candidate.full_name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute inset-0 rounded-full bg-black/40 grid place-items-center opacity-0 group-hover/photo:opacity-100 transition-opacity">
                        {photoUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-white" />
                        ) : (
                          <Camera className="h-3.5 w-3.5 text-white" />
                        )}
                      </span>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) uploadPhoto(f)
                          e.target.value = ''
                        }}
                      />
                    </button>
                    <div className="min-w-0">
                      <p className="text-base font-semibold leading-tight truncate">{candidate.full_name}</p>
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        {CANDIDATE_SOURCES[candidate.source] ?? candidate.source}
                        {candidate.source_detail ? ` · ${candidate.source_detail}` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full h-8 w-8 p-0"
                      onClick={() => setAiNotesOpen(true)}
                      title="Nota com IA"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant={editing ? 'default' : 'outline'}
                      className="rounded-full h-8 w-8 p-0"
                      onClick={() => (editing ? saveEdits() : setEditing(true))}
                      disabled={saving}
                      title={editing ? 'Guardar' : 'Editar'}
                    >
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : editing ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Pencil className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    {editing ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full h-8 w-8 p-0"
                        onClick={() => {
                          setForm(seedForm(candidate))
                          setEditing(false)
                        }}
                        title="Cancelar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirmDelete(true)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Fase + recrutador */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={status} onValueChange={(v) => changeStatus(v as CandidateStatus)}>
                    <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border/50 text-xs font-medium">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CANDIDATE_STATUS_DOT[status] }} />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PIPELINE_STAGES.map((s) => (
                        <SelectItem key={s} value={s}>
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CANDIDATE_STATUS_DOT[s] }} />
                            {CANDIDATE_STATUSES[s].label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={candidate.assigned_recruiter_id ?? 'none'}
                    onValueChange={(v) => changeRecruiter(v === 'none' ? null : v)}
                  >
                    <SelectTrigger className="h-8 w-auto gap-1.5 rounded-full border-border/50 text-xs">
                      <SelectValue placeholder="Sem recrutador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem recrutador</SelectItem>
                      {recruiters.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.commercial_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </SheetHeader>

              {/* Tab pills */}
              <div className="px-6 pb-2 shrink-0">
                <div className="flex items-center gap-1 p-1 rounded-full bg-background border border-border/50 w-fit max-w-full mx-auto overflow-x-auto">
                  {tabs.map((t) => {
                    const Icon = t.icon
                    const isActive = activeTab === t.key
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setActiveTab(t.key)}
                        className={cn(
                          'inline-flex items-center justify-center gap-1.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 shrink-0',
                          isActive ? 'bg-foreground text-background px-3.5' : 'text-muted-foreground hover:text-foreground h-8 w-8',
                        )}
                        title={t.label}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        {isActive && <span>{t.label}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Tab content */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pb-6">
                {activeTab === 'perfil' && (
                  <PerfilTab
                    candidate={candidate}
                    editing={editing}
                    form={form}
                    set={set}
                    onUploadCv={uploadCv}
                    cvUploading={cvUploading}
                  />
                )}
                {activeTab === 'qualificacao' &&
                  (qualLoaded ? (
                    <div className="py-1">
                      <CandidateQualificationTab
                        candidateId={candidate.id}
                        candidateSource={candidate.source}
                        originProfile={originProfile}
                        painPitchRecords={painPitch}
                        financial={financial}
                        budget={budget}
                        onSave={loadQual}
                      />
                    </div>
                  ) : (
                    <div className="grid place-items-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ))}
                {activeTab === 'atividade' && (
                  <CandidateActivityTab candidateId={candidate.id} onMutated={onMutated} />
                )}
                {activeTab === 'entrevistas' && (
                  <CandidateInterviewsTab candidateId={candidate.id} recruiters={recruiters} onMutated={onMutated} />
                )}
                {activeTab === 'decisao' && (
                  <DecisaoTab
                    candidate={candidate}
                    status={status}
                    onChangeStatus={changeStatus}
                    onSaveField={saveField}
                    onOpenOnboarding={() => setActiveTab('onboarding')}
                  />
                )}
                {activeTab === 'onboarding' &&
                  (obLoaded ? (
                    <div className="py-1">
                      <CandidateOnboardingTab
                        candidateId={candidate.id}
                        candidate={candidate}
                        onboarding={onboarding}
                        probation={probation}
                        recruiters={recruiters}
                        onReload={async () => {
                          await loadOnboarding()
                          await load()
                        }}
                      />
                    </div>
                  ) : (
                    <div className="grid place-items-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar candidato?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acção remove a candidatura e todo o histórico associado. Não pode ser anulada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {candidate && (
        <AiNotesDialog
          open={aiNotesOpen}
          onOpenChange={setAiNotesOpen}
          candidateName={candidate.full_name}
          onConfirm={handleAiNotes}
        />
      )}
    </>
  )
}

/* ---------------------------------------------------------------- Perfil */

function Field({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1 truncate">{children}</div>
    </div>
  )
}

function PerfilTab({
  candidate,
  editing,
  form,
  set,
  onUploadCv,
  cvUploading,
}: {
  candidate: RecruitmentCandidate
  editing: boolean
  form?: EditForm
  set: (k: keyof EditForm, v: string) => void
  onUploadCv: (file: File) => void
  cvUploading: boolean
}) {
  const cvInputRef = useRef<HTMLInputElement>(null)

  if (editing && form) {
    return (
      <div className="space-y-3 py-1">
        <div className="space-y-1">
          <Label className="text-[11px]">Nome</Label>
          <Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} className="h-9" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px]">Email</Label>
            <Input value={form.email} onChange={(e) => set('email', e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Telemóvel</Label>
            <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} className="h-9" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px]">LinkedIn</Label>
            <Input value={form.linkedin_url} onChange={(e) => set('linkedin_url', e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Origem</Label>
            <Select value={form.source} onValueChange={(v) => set('source', v)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CANDIDATE_SOURCES) as CandidateSource[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {CANDIDATE_SOURCES[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Detalhe da origem</Label>
          <Input value={form.source_detail} onChange={(e) => set('source_detail', e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Notas internas</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={4}
            className="resize-none rounded-xl text-[13px]"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 py-1">
      {/* Contactos */}
      <section className="rounded-2xl border border-border/40 bg-background/40 p-3.5 space-y-2.5">
        <Field icon={Mail}>
          {candidate.email ? (
            <a href={`mailto:${candidate.email}`} className="hover:underline">
              {candidate.email}
            </a>
          ) : (
            <span className="text-muted-foreground">Sem email</span>
          )}
        </Field>
        <Field icon={Phone}>
          {candidate.phone ? (
            <a href={`tel:${candidate.phone}`} className="hover:underline">
              {candidate.phone}
            </a>
          ) : (
            <span className="text-muted-foreground">Sem telemóvel</span>
          )}
        </Field>
        {candidate.linkedin_url && (
          <Field icon={Linkedin}>
            <a href={candidate.linkedin_url} target="_blank" rel="noopener" className="hover:underline text-sky-600">
              {candidate.linkedin_url}
            </a>
          </Field>
        )}
      </section>

      {/* CV */}
      <section className="rounded-2xl border border-border/40 bg-background/40 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Currículo</p>
          <div className="flex items-center gap-1.5">
            <input
              ref={cvInputRef}
              type="file"
              accept=".pdf,.doc,.docx,image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onUploadCv(f)
                e.target.value = ''
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-full gap-1.5 text-[11px]"
              onClick={() => cvInputRef.current?.click()}
              disabled={cvUploading}
            >
              {cvUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {candidate.cv_url ? 'Substituir' : 'Carregar CV'}
            </Button>
            {candidate.cv_url && (
              <Button size="sm" variant="outline" className="h-7 rounded-full gap-1.5 text-[11px]" asChild>
                <a
                  href={`/api/recrutamento/candidates/${candidate.id}/cv-preview`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText className="h-3 w-3" />
                  Abrir
                </a>
              </Button>
            )}
          </div>
        </div>
        {!candidate.cv_url && <p className="text-[12px] text-muted-foreground/60">Sem CV carregado.</p>}
      </section>

      {/* Notas */}
      {candidate.notes && (
        <section className="rounded-2xl border border-border/40 bg-background/40 p-3.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Notas internas</p>
          <p className="text-[13px] whitespace-pre-wrap break-words">{candidate.notes}</p>
        </section>
      )}

      {/* Meta */}
      <section className="rounded-2xl border border-border/40 bg-background/40 p-3.5 space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Registo</p>
        <p className="text-[12px] text-muted-foreground">
          Criado a {format(new Date(candidate.created_at), 'd MMM yyyy', { locale: pt })}
          {candidate.first_contact_date
            ? ` · Primeiro contacto a ${format(new Date(candidate.first_contact_date), 'd MMM yyyy', { locale: pt })}`
            : ''}
        </p>
      </section>
    </div>
  )
}

/* --------------------------------------------------------------- Decisão */

function DecisaoTab({
  candidate,
  status,
  onChangeStatus,
  onSaveField,
  onOpenOnboarding,
}: {
  candidate: RecruitmentCandidate
  status: CandidateStatus
  onChangeStatus: (s: CandidateStatus) => void
  onSaveField: (patch: Partial<RecruitmentCandidate>) => void
  onOpenOnboarding: () => void
}) {
  const isHired = status === 'contratado'
  const isLost = status === 'rejeitado'
  const isOnHold = status === 'em_espera'
  const isActive = !isHired && !isLost && !isOnHold

  const decisionButtons: { status: CandidateStatus; label: string }[] = [
    { status: 'contratado', label: 'Contratado' },
    { status: 'rejeitado', label: 'Rejeitado' },
    { status: 'em_espera', label: 'Em espera' },
  ]

  return (
    <div className="space-y-4 py-1">
      {isActive && (
        <section className="rounded-2xl border border-border/40 bg-background/40 p-3.5 space-y-3">
          <p className="text-[13px] text-muted-foreground">
            Move o candidato para uma fase final para registar a decisão.
          </p>
          <div className="flex flex-wrap gap-2">
            {decisionButtons.map((b) => (
              <Button
                key={b.status}
                size="sm"
                variant="outline"
                className="rounded-full gap-1.5"
                onClick={() => onChangeStatus(b.status)}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CANDIDATE_STATUS_DOT[b.status] }} />
                {b.label}
              </Button>
            ))}
          </div>
        </section>
      )}

      {isLost && (
        <>
          <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-3.5 space-y-1">
            <p className="text-[12px] font-medium text-red-700 dark:text-red-300">Rejeitado</p>
            {candidate.decision_date && (
              <p className="text-[11px] text-muted-foreground">
                Decisão registada a {format(new Date(candidate.decision_date), 'd MMM yyyy', { locale: pt })}.
              </p>
            )}
          </section>
          <section className="rounded-2xl border border-border/40 bg-background/40 p-3.5 space-y-2">
            <Label className="text-[11px]">Motivo</Label>
            <Textarea
              defaultValue={candidate.reason_no ?? ''}
              onBlur={(e) => {
                const val = e.target.value
                if (val !== (candidate.reason_no ?? '')) onSaveField({ reason_no: val || null })
              }}
              placeholder="Porque não avançou…"
              rows={3}
              className="resize-none rounded-xl text-[13px]"
            />
          </section>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => onChangeStatus('novo')}>
            Voltar ao pipeline
          </Button>
        </>
      )}

      {isOnHold && (
        <>
          <section className="rounded-2xl border border-slate-500/30 bg-slate-500/5 p-3.5 space-y-1">
            <p className="text-[12px] font-medium text-slate-700 dark:text-slate-300">Em espera</p>
            <p className="text-[11px] text-muted-foreground">
              O candidato está em pausa — fora do funil activo, sem decisão final.
            </p>
          </section>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => onChangeStatus('triagem')}>
              Retomar pipeline
            </Button>
            <Button size="sm" variant="outline" className="rounded-full gap-1.5" onClick={() => onChangeStatus('contratado')}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CANDIDATE_STATUS_DOT.contratado }} />
              Contratado
            </Button>
            <Button size="sm" variant="outline" className="rounded-full gap-1.5" onClick={() => onChangeStatus('rejeitado')}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CANDIDATE_STATUS_DOT.rejeitado }} />
              Rejeitado
            </Button>
          </div>
        </>
      )}

      {isHired && (
        <>
          <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-1">
            <p className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> Contratado
            </p>
            {candidate.decision_date && (
              <p className="text-[11px] text-muted-foreground">
                Decisão registada a {format(new Date(candidate.decision_date), 'd MMM yyyy', { locale: pt })}.
              </p>
            )}
          </section>
          <section className="rounded-2xl border border-border/40 bg-background/40 p-3.5 space-y-2">
            <Label className="text-[11px]">Porque avançou</Label>
            <Textarea
              defaultValue={candidate.reason_yes ?? ''}
              onBlur={(e) => {
                const val = e.target.value
                if (val !== (candidate.reason_yes ?? '')) onSaveField({ reason_yes: val || null })
              }}
              placeholder="Motivos da decisão…"
              rows={3}
              className="resize-none rounded-xl text-[13px]"
            />
          </section>
          <section className="rounded-2xl border border-border/40 bg-background/40 p-3.5 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Onboarding</p>
            <p className="text-[12px] text-muted-foreground">
              Contratos, acessos, email, formação inicial e plano de 66 dias vivem na tab Onboarding.
            </p>
            <Button size="sm" variant="outline" className="rounded-full gap-1.5" onClick={onOpenOnboarding}>
              <Rocket className="h-3.5 w-3.5" />
              Abrir onboarding
            </Button>
          </section>
        </>
      )}
    </div>
  )
}
