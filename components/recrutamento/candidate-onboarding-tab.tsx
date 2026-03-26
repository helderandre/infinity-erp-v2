'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, Circle, Save, Loader2, UserCheck, Target, Calendar, Briefcase, FileText, Send, Download, Eye, UserPlus, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  upsertOnboarding, upsertProbation,
  getContractTemplates, generateContract, getContracts, getLinkedSubmission,
  createConsultorFromCandidate,
} from '@/app/dashboard/recrutamento/actions'
import type { RecruitmentCandidate, RecruitmentOnboarding, RecruitmentProbation, ProbationStatus } from '@/types/recruitment'
import { PROBATION_STATUSES } from '@/types/recruitment'

interface CandidateOnboardingTabProps {
  candidateId: string
  candidate: RecruitmentCandidate
  onboarding: RecruitmentOnboarding | null
  probation: RecruitmentProbation | null
  recruiters: Array<{ id: string; commercial_name: string }>
  onReload: () => Promise<void>
}

const cardClass = 'rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm p-6'

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export function CandidateOnboardingTab({ candidateId, candidate, onboarding, probation, recruiters, onReload }: CandidateOnboardingTabProps) {
  // ─── Guard: candidate must be 'joined' ──────────────────────────────────
  if (candidate.status !== 'joined') {
    return (
      <div className={cn(cardClass, 'flex flex-col items-center justify-center gap-3 py-16')}>
        <UserCheck className="h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground text-center max-w-md">
          O candidato ainda nao aderiu. O onboarding fica disponivel quando o estado for alterado para &quot;Aderiu&quot;.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <OnboardingChecklist candidateId={candidateId} onboarding={onboarding} recruiters={recruiters} onReload={onReload} />
      <ContractSection candidateId={candidateId} candidate={candidate} onReload={onReload} />
      <ConsultorSection candidateId={candidateId} candidate={candidate} onReload={onReload} />
      <ProbationSection candidateId={candidateId} probation={probation} onReload={onReload} />
    </div>
  )
}

// ─── Contract Section ───────────────────────────────────────────────────────

function ContractSection({ candidateId, candidate, onReload }: {
  candidateId: string
  candidate: RecruitmentCandidate
  onReload: () => Promise<void>
}) {
  const [templates, setTemplates] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [submission, setSubmission] = useState<any | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [generating, setGenerating] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Contract data fields
  const [contractFields, setContractFields] = useState({
    nome_completo: candidate.full_name || '',
    nif: '', niss: '', cc_numero: '', morada: '',
    data_nascimento: '', estado_civil: '', naturalidade: '',
    iban: '', telemovel: candidate.phone || '', email_profissional: candidate.email || '',
    taxa_comissao: '', salario_base: '', data_inicio: '',
  })

  useEffect(() => {
    async function load() {
      const [tplRes, ctrRes, subRes] = await Promise.all([
        getContractTemplates(),
        getContracts(candidateId),
        getLinkedSubmission(candidateId),
      ])
      setTemplates(tplRes.templates)
      setContracts(ctrRes.contracts)
      if (subRes.submission) {
        setSubmission(subRes.submission)
        // Auto-fill from submission
        setContractFields(prev => ({
          ...prev,
          nome_completo: subRes.submission.full_name || prev.nome_completo,
          nif: subRes.submission.nif || prev.nif,
          niss: subRes.submission.niss || prev.niss,
          cc_numero: subRes.submission.cc_number || prev.cc_numero,
          morada: subRes.submission.full_address || prev.morada,
          data_nascimento: subRes.submission.date_of_birth || prev.data_nascimento,
          estado_civil: subRes.submission.estado_civil || prev.estado_civil,
          naturalidade: subRes.submission.naturalidade || prev.naturalidade,
          iban: subRes.submission.iban || prev.iban,
          telemovel: subRes.submission.professional_phone || prev.telemovel,
        }))
      }
      setLoaded(true)
    }
    load()
  }, [candidateId, candidate])

  const handleGenerate = async () => {
    if (!selectedTemplate) { toast.error('Seleccione um template de contrato'); return }
    setGenerating(true)
    const data: Record<string, string> = {
      ...contractFields,
      data_contrato: new Date().toISOString().slice(0, 10),
      empresa: 'Infinity Group',
    }
    const { contract, error } = await generateContract(candidateId, selectedTemplate, data)
    setGenerating(false)
    if (error) { toast.error(error); return }
    toast.success('Contrato gerado com sucesso')
    setPreviewHtml(contract?.generated_html || null)
    const res = await getContracts(candidateId)
    setContracts(res.contracts)
  }

  const updateField = (key: string, value: string) => setContractFields(prev => ({ ...prev, [key]: value }))

  const fieldDefs = [
    { key: 'nome_completo', label: 'Nome completo', required: true },
    { key: 'nif', label: 'NIF' },
    { key: 'niss', label: 'NISS' },
    { key: 'cc_numero', label: 'Nº Cartão Cidadão' },
    { key: 'data_nascimento', label: 'Data de Nascimento', type: 'date' },
    { key: 'naturalidade', label: 'Naturalidade' },
    { key: 'estado_civil', label: 'Estado Civil' },
    { key: 'morada', label: 'Morada completa' },
    { key: 'iban', label: 'IBAN' },
    { key: 'telemovel', label: 'Telemóvel profissional' },
    { key: 'email_profissional', label: 'Email profissional' },
    { key: 'taxa_comissao', label: 'Taxa de comissão (%)', type: 'number' },
    { key: 'salario_base', label: 'Salário base (€)', type: 'number' },
    { key: 'data_inicio', label: 'Data de início', type: 'date' },
  ]

  if (!loaded) return <div className={cn(cardClass, 'animate-pulse h-40')} />

  return (
    <>
      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Dados para Contrato</h3>
          {submission && <Badge variant="outline" className="ml-auto text-[10px]">Pré-preenchido do formulário</Badge>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
          {fieldDefs.map(f => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{f.label}{f.required ? ' *' : ''}</Label>
              <Input
                type={f.type || 'text'}
                value={contractFields[f.key as keyof typeof contractFields]}
                onChange={e => updateField(f.key, e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          ))}
        </div>

        <Separator className="my-4" />

        {/* Generate contract */}
        <div className="flex items-center gap-3">
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger className="w-64 h-9 text-sm">
              <SelectValue placeholder="Seleccionar template de contrato..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleGenerate} disabled={generating || !selectedTemplate}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Gerar Contrato
          </Button>
        </div>

        {templates.length === 0 && (
          <p className="text-xs text-muted-foreground mt-2">Nenhum template de contrato disponível. Crie um na secção de Configuração.</p>
        )}

        {/* Existing contracts */}
        {contracts.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contratos Gerados</p>
            {contracts.map(c => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border/20 bg-muted/20 p-3">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.template?.name || 'Contrato'}</p>
                  <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString('pt-PT')}</p>
                </div>
                <Badge variant="outline" className={cn('text-[10px]',
                  c.status === 'draft' && 'bg-amber-50 text-amber-700 border-amber-200',
                  c.status === 'sent' && 'bg-blue-50 text-blue-700 border-blue-200',
                  c.status === 'signed' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                )}>{c.status === 'draft' ? 'Rascunho' : c.status === 'sent' ? 'Enviado' : 'Assinado'}</Badge>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setPreviewHtml(c.generated_html)}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contract Preview Dialog */}
      <Dialog open={!!previewHtml} onOpenChange={() => setPreviewHtml(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview do Contrato</DialogTitle>
          </DialogHeader>
          {previewHtml && (
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Consultor Creation Section ─────────────────────────────────────────────

function ConsultorSection({ candidateId, candidate, onReload }: {
  candidateId: string
  candidate: RecruitmentCandidate & { consultant_user_id?: string | null }
  onReload: () => Promise<void>
}) {
  const [creating, setCreating] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Already created
  if (candidate.consultant_user_id) {
    return (
      <div className={cn(cardClass, 'border-emerald-200/50 bg-emerald-50/30')}>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <h3 className="font-semibold text-emerald-800">Consultor Criado</h3>
        </div>
        <p className="text-sm text-emerald-700 mt-2">
          Este candidato foi convertido em consultor com sucesso.
        </p>
      </div>
    )
  }

  const handleCreate = async () => {
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
    toast.success(`Consultor ${candidate.full_name} criado com sucesso!`)
    await onReload()
  }

  const canCreate = candidate.email && candidate.full_name

  return (
    <>
      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Criar Consultor</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Cria automaticamente o utilizador no sistema: auth, perfil público e dados privados.
        </p>
        {!canCreate && (
          <div className="flex items-center gap-2 mb-3 text-amber-700 text-xs">
            <AlertTriangle className="h-3.5 w-3.5" />
            O candidato precisa de ter email e nome preenchidos.
          </div>
        )}
        <Button onClick={() => setShowConfirm(true)} disabled={creating || !canCreate}>
          {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
          Criar Consultor
        </Button>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Criar consultor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende criar o consultor <strong>{candidate.full_name}</strong>?
              Será criado um utilizador com email <strong>{candidate.email}</strong> e atribuído o role de Consultor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreate}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─── Onboarding Checklist ────────────────────────────────────────────────────

function OnboardingChecklist({ candidateId, onboarding, recruiters, onReload }: {
  candidateId: string
  onboarding: RecruitmentOnboarding | null
  recruiters: Array<{ id: string; commercial_name: string }>
  onReload: () => Promise<void>
}) {
  const [contractSent, setContractSent] = useState(onboarding?.contract_sent ?? false)
  const [contractSentBy, setContractSentBy] = useState(onboarding?.contract_sent_by ?? '')
  const [formSent, setFormSent] = useState(onboarding?.form_sent ?? false)
  const [accessCreated, setAccessCreated] = useState(onboarding?.access_created ?? false)
  const [startDate, setStartDate] = useState(onboarding?.onboarding_start_date ?? '')
  const [saving, setSaving] = useState(false)

  const checked = [contractSent, formSent, accessCreated].filter(Boolean).length
  const progress = Math.round((checked / 3) * 100)

  const handleSave = useCallback(async () => {
    setSaving(true)
    const res = await upsertOnboarding(candidateId, {
      contract_sent: contractSent,
      contract_sent_by: contractSentBy || null,
      form_sent: formSent,
      access_created: accessCreated,
      onboarding_start_date: startDate || null,
    })
    setSaving(false)
    if (res.success) { toast.success('Onboarding guardado'); await onReload() }
    else toast.error(res.error ?? 'Erro ao guardar')
  }, [candidateId, contractSent, contractSentBy, formSent, accessCreated, startDate, onReload])

  const items: Array<{ key: string; label: string; checked: boolean; toggle: () => void }> = [
    { key: 'contract', label: 'Contrato enviado', checked: contractSent, toggle: () => setContractSent(v => !v) },
    { key: 'form', label: 'Formulario de entrada enviado', checked: formSent, toggle: () => setFormSent(v => !v) },
    { key: 'access', label: 'Acessos criados (email, ERP)', checked: accessCreated, toggle: () => setAccessCreated(v => !v) },
  ]

  return (
    <div className={cardClass}>
      <div className="flex items-center gap-2 mb-4">
        <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">Checklist de Onboarding</h3>
        <Badge variant="outline" className="ml-auto">{progress}%</Badge>
      </div>
      <Progress value={progress} className="mb-4 h-2" />
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.key} className="flex items-center gap-3">
            <button type="button" onClick={item.toggle} className="shrink-0 focus:outline-none">
              {item.checked
                ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                : <Circle className="h-5 w-5 text-muted-foreground/40" />}
            </button>
            <span className={cn('text-sm', item.checked && 'line-through text-muted-foreground')}>{item.label}</span>
          </div>
        ))}
        {contractSent && (
          <div className="ml-8 max-w-xs">
            <Label className="text-xs text-muted-foreground">Enviado por</Label>
            <Select value={contractSentBy} onValueChange={setContractSentBy}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {recruiters.map(r => <SelectItem key={r.id} value={r.id}>{r.commercial_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-3 pt-1">
          <Calendar className="h-5 w-5 text-muted-foreground/40 shrink-0" />
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Data de inicio do onboarding</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 w-48 text-xs" />
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-5">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar Onboarding
        </Button>
      </div>
    </div>
  )
}

// ─── Probation Section ───────────────────────────────────────────────────────

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
    if (res.success) { toast.success('Periodo de experiencia guardado'); await onReload() }
    else toast.error(res.error ?? 'Erro ao guardar')
  }, [candidateId, startDate, endDate, status, m30, m30Notes, m60, m60Notes, m90, m90Notes, bt1, ba1, bt2, ba2, bt3, ba3, notes, onReload])

  const milestones = [
    { days: 30, checked: m30, toggle: () => setM30(v => !v), notes: m30Notes, setNotes: setM30Notes },
    { days: 60, checked: m60, toggle: () => setM60(v => !v), notes: m60Notes, setNotes: setM60Notes },
    { days: 90, checked: m90, toggle: () => setM90(v => !v), notes: m90Notes, setNotes: setM90Notes },
  ]

  const billing = [
    { label: 'Mes 1', target: bt1, setTarget: setBt1, actual: ba1, setActual: setBa1 },
    { label: 'Mes 2', target: bt2, setTarget: setBt2, actual: ba2, setActual: setBa2 },
    { label: 'Mes 3', target: bt3, setTarget: setBt3, actual: ba3, setActual: setBa3 },
  ]

  function pct(target: string, actual: string) {
    const t = parseFloat(target), a = parseFloat(actual)
    if (!t || isNaN(t) || !a || isNaN(a)) return 0
    return Math.min(Math.round((a / t) * 100), 100)
  }

  return (
    <div className={cardClass}>
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">Periodo de Experiencia</h3>
      </div>

      {/* Dates + Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <Label className="text-xs text-muted-foreground">Data de inicio</Label>
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

      {/* Milestones */}
      <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Marcos</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {milestones.map(ms => (
          <div key={ms.days} className="rounded-xl border border-border/20 bg-muted/20 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <button type="button" onClick={ms.toggle} className="shrink-0 focus:outline-none">
                {ms.checked ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-muted-foreground/40" />}
              </button>
              <span className="text-sm font-medium">{ms.days} Dias</span>
              {ms.checked && <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-200">Concluido</Badge>}
            </div>
            <Textarea placeholder="Notas..." value={ms.notes} onChange={e => ms.setNotes(e.target.value)} rows={2} className="text-xs resize-none" />
          </div>
        ))}
      </div>

      <Separator className="my-4" />

      {/* Billing targets */}
      <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Facturacao: Objectivo vs Real</p>
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
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-1 text-sm resize-none" placeholder="Observacoes sobre o periodo de experiencia..." />
      </div>

      <div className="flex justify-end mt-5">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar Experiencia
        </Button>
      </div>
    </div>
  )
}
