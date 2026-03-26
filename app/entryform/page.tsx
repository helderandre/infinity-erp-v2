// @ts-nocheck
'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Toaster, toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Upload,
  Sparkles,
  CheckCircle2,
  Loader2,
  Phone,
  Mail,
  User,
  FileText,
  Camera,
  Instagram,
  Facebook,
  Wand2,
  AlertCircle,
  Send,
  X,
  Briefcase,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FileWithPreview {
  file: File
  preview?: string
}

interface FormData {
  // Section 1 – Documento
  full_name: string
  cc_number: string
  cc_expiry: string
  cc_issue_date: string
  date_of_birth: string
  nif: string
  niss: string
  naturalidade: string
  estado_civil: string

  // Section 2 – Dados Pessoais
  display_name: string
  full_address: string

  // Section 3 – Contactos
  professional_phone: string
  personal_email: string
  emergency_contact_name: string
  emergency_contact_phone: string

  // Section 4 – Email RE/MAX
  email_suggestion_1: string
  email_suggestion_2: string
  email_suggestion_3: string

  // Section 5 – Experiência
  has_sales_experience: string
  has_real_estate_experience: string
  previous_agency: string

  // Section 6 – Redes Sociais
  instagram_handle: string
  facebook_page: string
}

const INITIAL_FORM: FormData = {
  full_name: '',
  cc_number: '',
  cc_expiry: '',
  cc_issue_date: '',
  date_of_birth: '',
  nif: '',
  niss: '',
  naturalidade: '',
  estado_civil: '',
  display_name: '',
  full_address: '',
  professional_phone: '',
  personal_email: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  email_suggestion_1: '',
  email_suggestion_2: '',
  email_suggestion_3: '',
  has_sales_experience: '',
  has_real_estate_experience: '',
  previous_agency: '',
  instagram_handle: '',
  facebook_page: '',
}

const ESTADO_CIVIL_OPTIONS = [
  'Solteiro/a',
  'Casado/a',
  'União de Facto',
  'Divorciado/a',
  'Viúvo/a',
]

const LOGO_URL = 'https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/landing-page/43f87d7c-92b5-4403-b7bb-618c8d4a2b9e.png'

interface FieldConfig {
  field_key: string
  label: string
  section: string
  field_type: string
  options: string[] | null
  placeholder: string | null
  is_visible: boolean
  is_required: boolean
  is_ai_extractable: boolean
  order_index: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function RequiredAsterisk() {
  return <span className="text-red-500 ml-0.5">*</span>
}

function AiBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-violet-600" title="Preenchido por IA">
      <Sparkles className="h-3 w-3" />
    </span>
  )
}

// ---------------------------------------------------------------------------
// File picker
// ---------------------------------------------------------------------------

function FilePicker({
  label,
  accept,
  file,
  onChange,
  showPreview,
  description,
}: {
  label: string
  accept: string
  file: FileWithPreview | null
  onChange: (f: FileWithPreview | null) => void
  showPreview?: boolean
  description?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    (f: File | null) => {
      if (!f) { onChange(null); return }
      const preview = f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined
      onChange({ file: f, preview })
    },
    [onChange]
  )

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-neutral-50 p-3">
        {showPreview && file.preview ? (
          <img src={file.preview} alt="Preview" className="h-16 w-16 rounded-lg object-cover border" />
        ) : (
          <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{file.file.name}</p>
          <p className="text-[10px] text-muted-foreground">{formatFileSize(file.file.size)}</p>
        </div>
        <button type="button" onClick={() => { if (file.preview) URL.revokeObjectURL(file.preview); onChange(null) }}
          className="text-muted-foreground hover:text-red-600 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div>
      <button type="button" onClick={() => inputRef.current?.click()}
        className="w-full h-20 rounded-lg border-2 border-dashed bg-neutral-50/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:bg-neutral-100/50 hover:border-neutral-300 transition-colors">
        <Upload className="h-5 w-5" />
        <span className="text-xs">{label}</span>
      </button>
      {description && <p className="text-[10px] text-muted-foreground mt-1">{description}</p>}
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Thank You
// ---------------------------------------------------------------------------

function ThankYou() {
  return (
    <div className="flex flex-col items-center justify-center py-12 animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
      </div>
      <h2 className="text-lg font-bold mb-2">Formulário Enviado!</h2>
      <p className="text-muted-foreground text-center text-sm max-w-sm mb-4">
        Os seus dados foram recebidos com sucesso. A equipa irá processar a sua entrada e entrará em contacto brevemente.
      </p>
      <p className="text-xs text-muted-foreground">Bem-vindo/a à Infinity Group! Pode fechar esta página.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section definitions
// ---------------------------------------------------------------------------

const SECTIONS = [
  { key: 'document', label: 'Documento de Identificação', icon: FileText },
  { key: 'personal', label: 'Dados Pessoais', icon: User },
  { key: 'contacts', label: 'Contactos', icon: Phone },
  { key: 'email', label: 'Email RE/MAX', icon: Mail },
  { key: 'experience', label: 'Experiência Profissional', icon: Briefcase },
  { key: 'social', label: 'Redes Sociais & Foto', icon: Camera },
] as const

// Map field keys to sections
const FIELD_SECTIONS: Record<string, string> = {
  full_name: 'document', cc_number: 'document', cc_expiry: 'document',
  cc_issue_date: 'document', date_of_birth: 'document', nif: 'document',
  niss: 'document', naturalidade: 'document', estado_civil: 'document',
  display_name: 'personal', full_address: 'personal',
  professional_phone: 'contacts', personal_email: 'contacts',
  emergency_contact_name: 'contacts', emergency_contact_phone: 'contacts',
  email_suggestion_1: 'email', email_suggestion_2: 'email', email_suggestion_3: 'email',
  has_sales_experience: 'experience', has_real_estate_experience: 'experience', previous_agency: 'experience',
  instagram_handle: 'social', facebook_page: 'social',
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function EntryFormPage() {
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set())
  const [idFront, setIdFront] = useState<FileWithPreview | null>(null)
  const [idBack, setIdBack] = useState<FileWithPreview | null>(null)
  const [photo, setPhoto] = useState<FileWithPreview | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>([])
  const [currentStep, setCurrentStep] = useState(0)

  // Fetch field config
  useEffect(() => {
    fetch('/api/entry-form/fields')
      .then((r) => r.json())
      .then((d) => setFieldConfigs(d.fields ?? []))
      .catch(() => {})
  }, [])

  const fieldMap = useMemo(() => {
    const map: Record<string, FieldConfig> = {}
    fieldConfigs.forEach((f) => { map[f.field_key] = f })
    return map
  }, [fieldConfigs])

  const isFieldVisible = useCallback(
    (key: string) => {
      if (fieldConfigs.length === 0) return true
      return fieldMap[key]?.is_visible !== false
    },
    [fieldConfigs, fieldMap]
  )

  const isFieldRequired = useCallback(
    (key: string) => fieldMap[key]?.is_required === true,
    [fieldMap]
  )

  const getLabel = useCallback(
    (key: string, fallback: string) => fieldMap[key]?.label || fallback,
    [fieldMap]
  )

  // Visible sections — skip sections where all fields are hidden
  const visibleSections = useMemo(() => {
    return SECTIONS.filter(s => {
      const sectionFields = Object.entries(FIELD_SECTIONS).filter(([, sec]) => sec === s.key).map(([key]) => key)
      // Document and social sections always visible (have file uploads)
      if (s.key === 'document' || s.key === 'social') return true
      return sectionFields.some(key => isFieldVisible(key))
    })
  }, [isFieldVisible])

  const set = useCallback(
    (field: keyof FormData, value: string) => setForm((prev) => ({ ...prev, [field]: value })),
    []
  )

  const isAiFilled = useCallback(
    (field: string) => aiFilledFields.has(field),
    [aiFilledFields]
  )

  // AI extract
  const handleExtract = useCallback(async () => {
    if (!idFront || !idBack) {
      toast.error('Carregue a frente e o verso do Cartão de Cidadão.')
      return
    }
    setExtracting(true)
    try {
      const fd = new window.FormData()
      fd.append('front', idFront.file)
      fd.append('back', idBack.file)
      const res = await fetch('/api/entry-form/extract-id', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Erro na extracção')
      const { extracted } = await res.json()
      const fMap: Record<string, keyof FormData> = {
        full_name: 'full_name', cc_number: 'cc_number', cc_expiry: 'cc_expiry',
        cc_issue_date: 'cc_issue_date', date_of_birth: 'date_of_birth', nif: 'nif',
        niss: 'niss', naturalidade: 'naturalidade', estado_civil: 'estado_civil',
      }
      const filled = new Set<string>()
      const updates: Partial<FormData> = {}
      for (const [apiKey, formKey] of Object.entries(fMap)) {
        const val = extracted?.[apiKey]
        if (val) { updates[formKey] = val; filled.add(formKey) }
      }
      setForm((prev) => ({ ...prev, ...updates }))
      setAiFilledFields((prev) => new Set([...prev, ...filled]))
      toast.success('Dados extraídos com sucesso!')
    } catch {
      toast.error('Não foi possível extrair os dados. Preencha manualmente.')
    } finally {
      setExtracting(false)
    }
  }, [idFront, idBack])

  // Submit
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const requiredChecks: { key: keyof FormData; label: string }[] = [
        { key: 'full_name', label: 'Nome completo' },
        { key: 'professional_phone', label: 'Telemóvel profissional' },
        { key: 'personal_email', label: 'Email pessoal' },
      ]
      for (const cfg of fieldConfigs) {
        if (cfg.is_required && cfg.is_visible && cfg.field_key in form) {
          if (!requiredChecks.some((r) => r.key === cfg.field_key)) {
            requiredChecks.push({ key: cfg.field_key as keyof FormData, label: cfg.label })
          }
        }
      }
      for (const { key, label } of requiredChecks) {
        if (isFieldVisible(key) && !form[key]?.trim()) {
          toast.error(`O campo "${label}" é obrigatório.`)
          return
        }
      }
      setSubmitting(true)
      try {
        const fd = new window.FormData()
        for (const [key, value] of Object.entries(form)) { if (value) fd.append(key, value) }
        if (idFront) fd.append('id_document_front', idFront.file)
        if (idBack) fd.append('id_document_back', idBack.file)
        if (photo) fd.append('professional_photo', photo.file)
        const res = await fetch('/api/entry-form', { method: 'POST', body: fd })
        if (!res.ok) throw new Error('Erro ao enviar')
        setSubmitted(true)
        toast.success('Formulário enviado com sucesso!')
      } catch {
        toast.error('Erro ao enviar o formulário. Tente novamente.')
      } finally {
        setSubmitting(false)
      }
    },
    [form, idFront, idBack, photo, fieldConfigs, isFieldVisible]
  )

  // Navigation
  const totalSteps = visibleSections.length
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === totalSteps - 1
  const currentSection = visibleSections[currentStep]

  const goNext = () => { if (!isLastStep) setCurrentStep(s => s + 1); window.scrollTo(0, 0) }
  const goPrev = () => { if (!isFirstStep) setCurrentStep(s => s - 1); window.scrollTo(0, 0) }

  // ---------------------------------------------------------------------------
  // Field renderer helper
  // ---------------------------------------------------------------------------

  const renderField = (key: keyof FormData, label: string, opts?: {
    type?: string
    placeholder?: string
    icon?: any
    colSpan?: number
  }) => {
    if (!isFieldVisible(key)) return null
    const Icon = opts?.icon
    return (
      <div key={key} className={cn('space-y-1', opts?.colSpan === 2 && 'sm:col-span-2')}>
        <label className="text-xs font-medium text-neutral-700 flex items-center gap-1">
          {getLabel(key, label)}
          {isFieldRequired(key) && <RequiredAsterisk />}
          {isAiFilled(key) && <AiBadge />}
        </label>
        <div className={cn(Icon && 'relative')}>
          {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />}
          <input
            type={opts?.type || 'text'}
            value={form[key]}
            onChange={(e) => set(key, e.target.value)}
            placeholder={opts?.placeholder || ''}
            className={cn(
              'w-full h-9 rounded-lg border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 transition-shadow',
              Icon && 'pl-9',
              isAiFilled(key) && 'ring-2 ring-violet-500/30 border-violet-300'
            )}
          />
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-neutral-100/50">
      <Toaster richColors position="top-center" />

      <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="rounded-t-2xl bg-neutral-900 px-6 py-8 text-center">
          <img src={LOGO_URL} alt="Infinity Group" className="h-14 mx-auto mb-3" />
          <h1 className="text-white text-lg font-bold">Formulário de Entrada</h1>
          <p className="text-neutral-400 text-xs mt-1">Preencha os dados para iniciar o processo de onboarding</p>
        </div>

        {/* Progress bar */}
        <div className="bg-white border-x px-6 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Passo {currentStep + 1} de {totalSteps}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {currentSection?.label}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-neutral-900 transition-all duration-500"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            />
          </div>
          {/* Step dots */}
          <div className="flex justify-center gap-1.5 mt-3">
            {visibleSections.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setCurrentStep(i)}
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  i === currentStep ? 'w-6 bg-neutral-900' : i < currentStep ? 'w-2 bg-neutral-400' : 'w-2 bg-neutral-200'
                )}
              />
            ))}
          </div>
        </div>

        {/* Form body */}
        {submitted ? (
          <div className="bg-white border border-t-0 rounded-b-2xl shadow-sm p-6">
            <ThankYou />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="bg-white border border-t-0 rounded-b-2xl shadow-sm px-6 py-6">
              {/* ─── Step: Documento ─── */}
              {currentSection?.key === 'document' && (
                <div className="space-y-5 animate-in fade-in-0 slide-in-from-right-4 duration-300">
                  <h2 className="text-sm font-bold text-neutral-800">Documento de Identificação</h2>
                  <p className="text-xs text-muted-foreground">
                    Carregue a frente e verso do Cartão de Cidadão para extrair os dados automaticamente com IA.
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-neutral-700">Frente do CC</label>
                      <FilePicker label="Carregar frente" accept="image/*" file={idFront} onChange={setIdFront} showPreview />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-neutral-700">Verso do CC</label>
                      <FilePicker label="Carregar verso" accept="image/*" file={idBack} onChange={setIdBack} showPreview />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-full h-9 rounded-lg bg-neutral-900 text-white text-xs font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
                    disabled={!idFront || !idBack || extracting}
                    onClick={handleExtract}
                  >
                    {extracting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />A extrair dados...</>
                      : <><Wand2 className="h-3.5 w-3.5" />Extrair Dados com IA</>}
                  </button>

                  <Separator />

                  <div className="grid gap-3 sm:grid-cols-2">
                    {renderField('full_name', 'Nome Completo', { colSpan: 2 })}
                    {renderField('cc_number', 'Número do CC')}
                    {isFieldVisible('estado_civil') && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-neutral-700">
                          {getLabel('estado_civil', 'Estado Civil')}
                          {isAiFilled('estado_civil') && <AiBadge />}
                        </label>
                        <select
                          value={form.estado_civil}
                          onChange={(e) => set('estado_civil', e.target.value)}
                          className={cn(
                            'w-full h-9 rounded-lg border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10',
                            isAiFilled('estado_civil') && 'ring-2 ring-violet-500/30 border-violet-300'
                          )}
                        >
                          <option value="">Seleccionar...</option>
                          {ESTADO_CIVIL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    )}
                    {renderField('cc_expiry', 'Validade do CC', { type: 'date' })}
                    {renderField('cc_issue_date', 'Data de Emissão', { type: 'date' })}
                    {renderField('date_of_birth', 'Data de Nascimento', { type: 'date' })}
                    {renderField('nif', 'NIF', { placeholder: '123 456 789' })}
                    {renderField('niss', 'NISS', { placeholder: 'Número de Segurança Social' })}
                    {renderField('naturalidade', 'Naturalidade', { placeholder: 'Ex: Lisboa' })}
                  </div>
                </div>
              )}

              {/* ─── Step: Dados Pessoais ─── */}
              {currentSection?.key === 'personal' && (
                <div className="space-y-4 animate-in fade-in-0 slide-in-from-right-4 duration-300">
                  <h2 className="text-sm font-bold text-neutral-800">Dados Pessoais</h2>
                  <div className="space-y-3">
                    {renderField('display_name', 'Nome a constar no site', { placeholder: 'Ex: João Silva', colSpan: 2 })}
                    {isFieldVisible('full_address') && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-neutral-700">
                          {getLabel('full_address', 'Morada Completa')}
                          {isFieldRequired('full_address') && <RequiredAsterisk />}
                        </label>
                        <textarea
                          value={form.full_address}
                          onChange={(e) => set('full_address', e.target.value)}
                          placeholder="Rua, número, andar, código postal, localidade"
                          rows={3}
                          className="w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 resize-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ─── Step: Contactos ─── */}
              {currentSection?.key === 'contacts' && (
                <div className="space-y-4 animate-in fade-in-0 slide-in-from-right-4 duration-300">
                  <h2 className="text-sm font-bold text-neutral-800">Contactos</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {renderField('professional_phone', 'Telemóvel Profissional', { type: 'tel', placeholder: '912 345 678', icon: Phone })}
                    {renderField('personal_email', 'Email Pessoal', { type: 'email', placeholder: 'nome@email.com', icon: Mail })}
                  </div>

                  {(isFieldVisible('emergency_contact_name') || isFieldVisible('emergency_contact_phone')) && (
                    <>
                      <Separator />
                      <p className="text-xs text-muted-foreground">Contacto de emergência (opcional)</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {renderField('emergency_contact_name', 'Nome', { placeholder: 'Nome do contacto' })}
                        {renderField('emergency_contact_phone', 'Telemóvel', { type: 'tel', placeholder: '912 345 678' })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ─── Step: Email RE/MAX ─── */}
              {currentSection?.key === 'email' && (
                <div className="space-y-4 animate-in fade-in-0 slide-in-from-right-4 duration-300">
                  <h2 className="text-sm font-bold text-neutral-800">Email RE/MAX</h2>
                  <p className="text-xs text-muted-foreground">
                    Sugira até 3 opções para o seu email profissional @remax.pt.
                  </p>
                  <div className="space-y-3">
                    {[1, 2, 3].map((n) => {
                      const key = `email_suggestion_${n}` as keyof FormData
                      return (
                        <div key={n} className="space-y-1">
                          <label className="text-xs font-medium text-neutral-700">Sugestão {n}</label>
                          <div className="flex items-center gap-2">
                            <input
                              value={form[key]}
                              onChange={(e) => set(key, e.target.value)}
                              placeholder="ex: joao.silva"
                              className="flex-1 h-9 rounded-lg border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                            />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">@remax.pt</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ─── Step: Experiência ─── */}
              {currentSection?.key === 'experience' && (
                <div className="space-y-5 animate-in fade-in-0 slide-in-from-right-4 duration-300">
                  <h2 className="text-sm font-bold text-neutral-800">Experiência Profissional</h2>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-neutral-700">Tem experiência em vendas?</label>
                    <div className="flex gap-2">
                      {['sim', 'nao'].map((val) => (
                        <button key={val} type="button"
                          className={cn('px-4 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                            form.has_sales_experience === val
                              ? 'bg-neutral-900 text-white border-neutral-900'
                              : 'bg-white text-neutral-700 hover:bg-neutral-50'
                          )}
                          onClick={() => { set('has_sales_experience', val); if (val === 'nao') { set('has_real_estate_experience', ''); set('previous_agency', '') } }}
                        >
                          {val === 'sim' ? 'Sim' : 'Não'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {form.has_sales_experience === 'sim' && (
                    <div className="space-y-2 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                      <label className="text-xs font-medium text-neutral-700">Experiência em vendas imobiliárias?</label>
                      <div className="flex gap-2">
                        {['sim', 'nao'].map((val) => (
                          <button key={val} type="button"
                            className={cn('px-4 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                              form.has_real_estate_experience === val
                                ? 'bg-neutral-900 text-white border-neutral-900'
                                : 'bg-white text-neutral-700 hover:bg-neutral-50'
                            )}
                            onClick={() => { set('has_real_estate_experience', val); if (val === 'nao') set('previous_agency', '') }}
                          >
                            {val === 'sim' ? 'Sim' : 'Não'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {form.has_real_estate_experience === 'sim' && (
                    <div className="space-y-1 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                      <label className="text-xs font-medium text-neutral-700">Em que imobiliária trabalhou?</label>
                      <input
                        value={form.previous_agency}
                        onChange={(e) => set('previous_agency', e.target.value)}
                        placeholder="Ex: Century 21, ERA, KW..."
                        className="w-full h-9 rounded-lg border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ─── Step: Redes Sociais & Foto ─── */}
              {currentSection?.key === 'social' && (
                <div className="space-y-4 animate-in fade-in-0 slide-in-from-right-4 duration-300">
                  <h2 className="text-sm font-bold text-neutral-800">Redes Sociais & Foto</h2>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {isFieldVisible('instagram_handle') && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-neutral-700 flex items-center gap-1">
                          <Instagram className="h-3 w-3" />
                          {getLabel('instagram_handle', 'Instagram Profissional')}
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">@</span>
                          <input value={form.instagram_handle} onChange={(e) => set('instagram_handle', e.target.value)}
                            placeholder="username"
                            className="flex-1 h-9 rounded-lg border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10" />
                        </div>
                      </div>
                    )}

                    {isFieldVisible('facebook_page') && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-neutral-700 flex items-center gap-1">
                          <Facebook className="h-3 w-3" />
                          {getLabel('facebook_page', 'Página Facebook')}
                        </label>
                        <input value={form.facebook_page} onChange={(e) => set('facebook_page', e.target.value)}
                          placeholder="Nome da página ou URL"
                          className="w-full h-9 rounded-lg border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10" />
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-neutral-700">Fotografia Profissional</label>
                    <p className="text-[10px] text-muted-foreground">Fotografia de rosto para o site e materiais de marketing.</p>
                    {photo?.preview ? (
                      <div className="flex items-start gap-4">
                        <img src={photo.preview} alt="Fotografia" className="h-24 w-24 rounded-lg object-cover border" />
                        <div className="space-y-1 pt-1">
                          <p className="text-xs font-medium truncate max-w-[160px]">{photo.file.name}</p>
                          <p className="text-[10px] text-muted-foreground">{formatFileSize(photo.file.size)}</p>
                          <button type="button" className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                            onClick={() => { if (photo.preview) URL.revokeObjectURL(photo.preview); setPhoto(null) }}>
                            <X className="h-3 w-3" />Remover
                          </button>
                        </div>
                      </div>
                    ) : (
                      <FilePicker label="Carregar fotografia" description="JPG ou PNG, idealmente com fundo neutro"
                        accept="image/*" file={photo} onChange={setPhoto} showPreview />
                    )}
                  </div>
                </div>
              )}

              {/* ─── Navigation ─── */}
              <div className="flex items-center justify-between pt-6 mt-6 border-t">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={isFirstStep}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-neutral-700 hover:bg-neutral-50 border transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Anterior
                </button>

                {isLastStep ? (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-neutral-900 text-white text-xs font-medium disabled:opacity-50 transition-opacity"
                  >
                    {submitting ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" />A enviar...</>
                    ) : (
                      <><Send className="h-3.5 w-3.5" />Submeter Formulário</>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={goNext}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-neutral-900 text-white text-xs font-medium transition-opacity hover:opacity-90"
                  >
                    Seguinte
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </form>
        )}

        {/* Footer */}
        <p className="text-center text-[10px] text-muted-foreground mt-6">
          Infinity Group &copy; {new Date().getFullYear()}. Todos os direitos reservados.
        </p>
      </div>
    </div>
  )
}
