'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Toaster, toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
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
  has_sales_experience: string // 'sim' | 'nao' | ''
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

// ---------------------------------------------------------------------------
// Field config type (from API)
// ---------------------------------------------------------------------------

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

function AiFilled() {
  return (
    <span
      className="inline-flex items-center gap-0.5 text-violet-600 dark:text-violet-400"
      title="Preenchido automaticamente por IA"
    >
      <Sparkles className="h-3.5 w-3.5" />
    </span>
  )
}

// ---------------------------------------------------------------------------
// File picker component
// ---------------------------------------------------------------------------

function FilePicker({
  label,
  accept,
  file,
  onChange,
  showPreview,
  dropZone,
  description,
}: {
  label: string
  accept: string
  file: FileWithPreview | null
  onChange: (f: FileWithPreview | null) => void
  showPreview?: boolean
  dropZone?: boolean
  description?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback(
    (f: File | null) => {
      if (!f) {
        onChange(null)
        return
      }
      const preview = f.type.startsWith('image/')
        ? URL.createObjectURL(f)
        : undefined
      onChange({ file: f, preview })
    },
    [onChange]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const f = e.dataTransfer.files?.[0]
      if (f) handleFile(f)
    },
    [handleFile]
  )

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
        {showPreview && file.preview ? (
          <img
            src={file.preview}
            alt="Preview"
            className="h-14 w-14 rounded-md object-cover border"
          />
        ) : (
          <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{file.file.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(file.file.size)}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => {
            if (file.preview) URL.revokeObjectURL(file.preview)
            onChange(null)
            if (inputRef.current) inputRef.current.value = ''
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  if (dropZone) {
    return (
      <div
        className={cn(
          'relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors cursor-pointer',
          dragOver
            ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/20'
            : 'border-muted-foreground/25 hover:border-muted-foreground/40 hover:bg-muted/40'
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-8 w-8 text-muted-foreground/60" />
        <div className="text-center">
          <p className="text-sm font-medium">{label}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>
    )
  }

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start gap-2"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-4 w-4" />
        {label}
      </Button>
      {description && (
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Thank You component
// ---------------------------------------------------------------------------

function ThankYou() {
  return (
    <div className="flex flex-col items-center justify-center py-16 animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
          <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        </div>
      </div>
      <h2 className="text-2xl font-bold tracking-tight mb-2">
        Formulário Enviado!
      </h2>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Os seus dados foram recebidos com sucesso. A equipa irá processar a sua
        entrada e entrará em contacto consigo brevemente.
      </p>
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          <p>Bem-vindo/a à Infinity Group!</p>
          <p className="mt-1">Pode fechar esta página.</p>
        </CardContent>
      </Card>
    </div>
  )
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

  // -- fetch field config on mount -------------------------------------------

  useEffect(() => {
    fetch('/api/entry-form/fields')
      .then((r) => r.json())
      .then((d) => setFieldConfigs(d.fields ?? []))
      .catch(() => {}) // fallback: show all fields
  }, [])

  const fieldMap = useMemo(() => {
    const map: Record<string, FieldConfig> = {}
    fieldConfigs.forEach((f) => { map[f.field_key] = f })
    return map
  }, [fieldConfigs])

  /** Check if field is visible (defaults to true if no config loaded yet) */
  const isFieldVisible = useCallback(
    (key: string) => {
      if (fieldConfigs.length === 0) return true // config not loaded yet, show all
      return fieldMap[key]?.is_visible !== false
    },
    [fieldConfigs, fieldMap]
  )

  /** Check if field is required */
  const isFieldRequired = useCallback(
    (key: string) => fieldMap[key]?.is_required === true,
    [fieldMap]
  )

  /** Get configured label (fallback to provided default) */
  const getLabel = useCallback(
    (key: string, fallback: string) => fieldMap[key]?.label || fallback,
    [fieldMap]
  )

  // -- helpers ---------------------------------------------------------------

  const set = useCallback(
    (field: keyof FormData, value: string) =>
      setForm((prev) => ({ ...prev, [field]: value })),
    []
  )

  const isAiFilled = useCallback(
    (field: string) => aiFilledFields.has(field),
    [aiFilledFields]
  )

  // -- AI extract ------------------------------------------------------------

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

      const res = await fetch('/api/entry-form/extract-id', {
        method: 'POST',
        body: fd,
      })

      if (!res.ok) throw new Error('Erro na extracção')

      const { extracted } = await res.json()

      const fieldMap: Record<string, keyof FormData> = {
        full_name: 'full_name',
        cc_number: 'cc_number',
        cc_expiry: 'cc_expiry',
        cc_issue_date: 'cc_issue_date',
        date_of_birth: 'date_of_birth',
        nif: 'nif',
        niss: 'niss',
        naturalidade: 'naturalidade',
        estado_civil: 'estado_civil',
      }

      const filled = new Set<string>()
      const updates: Partial<FormData> = {}

      for (const [apiKey, formKey] of Object.entries(fieldMap)) {
        const val = extracted?.[apiKey]
        if (val) {
          updates[formKey] = val
          filled.add(formKey)
        }
      }

      setForm((prev) => ({ ...prev, ...updates }))
      setAiFilledFields((prev) => new Set([...prev, ...filled]))

      toast.success('Dados extraídos com sucesso! Verifique os campos preenchidos.')
    } catch {
      toast.error('Não foi possível extrair os dados. Preencha manualmente.')
    } finally {
      setExtracting(false)
    }
  }, [idFront, idBack])

  // -- submit ----------------------------------------------------------------

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      // Dynamic required validation
      const requiredChecks: { key: keyof FormData; label: string }[] = [
        { key: 'full_name', label: 'Nome completo' },
        { key: 'professional_phone', label: 'Telemóvel profissional' },
        { key: 'personal_email', label: 'Email pessoal' },
      ]

      // Add any other dynamically required fields
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

        // Append all text fields
        for (const [key, value] of Object.entries(form)) {
          if (value) fd.append(key, value)
        }

        // Append files
        if (idFront) fd.append('id_document_front', idFront.file)
        if (idBack) fd.append('id_document_back', idBack.file)
        if (photo) fd.append('professional_photo', photo.file)

        const res = await fetch('/api/entry-form', {
          method: 'POST',
          body: fd,
        })

        if (!res.ok) throw new Error('Erro ao enviar')

        setSubmitted(true)
        toast.success('Formulário enviado com sucesso!')
      } catch {
        toast.error('Erro ao enviar o formulário. Tente novamente.')
      } finally {
        setSubmitting(false)
      }
    },
    [form, idFront, idBack, photo]
  )

  // -- render ----------------------------------------------------------------

  return (
    <div className="min-h-screen bg-muted/30">
      <Toaster richColors position="top-center" />

      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 mb-4">
            <User className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Formulário de Entrada
          </h1>
          <p className="text-muted-foreground mt-1">
            Infinity Group — RE/MAX
          </p>
        </div>

        {submitted ? (
          <ThankYou />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ============================================================ */}
            {/* Section 1: Documento de Identificação                        */}
            {/* ============================================================ */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  Documento de Identificação
                </CardTitle>
                <CardDescription>
                  Carregue a frente e verso do Cartão de Cidadão para extrair os
                  dados automaticamente com IA.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Upload zone */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Frente do CC</Label>
                    <FilePicker
                      label="Carregar frente"
                      description="Arraste ou clique para carregar"
                      accept="image/*"
                      file={idFront}
                      onChange={setIdFront}
                      showPreview
                      dropZone
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Verso do CC</Label>
                    <FilePicker
                      label="Carregar verso"
                      description="Arraste ou clique para carregar"
                      accept="image/*"
                      file={idBack}
                      onChange={setIdBack}
                      showPreview
                      dropZone
                    />
                  </div>
                </div>

                {/* AI Extract button */}
                <Button
                  type="button"
                  variant="default"
                  className="w-full gap-2"
                  disabled={!idFront || !idBack || extracting}
                  onClick={handleExtract}
                >
                  {extracting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      A extrair dados...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      Extrair Dados com IA
                    </>
                  )}
                </Button>

                <Separator />

                {/* Extracted / manual fields */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Nome Completo */}
                  {isFieldVisible('full_name') && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="full_name" className="flex items-center gap-1">
                      {getLabel('full_name', 'Nome Completo')}
                      {isFieldRequired('full_name') && <RequiredAsterisk />}
                      {isAiFilled('full_name') && <AiFilled />}
                    </Label>
                    <Input
                      id="full_name"
                      value={form.full_name}
                      onChange={(e) => set('full_name', e.target.value)}
                      placeholder="Nome completo conforme CC"
                      className={cn(
                        isAiFilled('full_name') &&
                          'ring-2 ring-violet-500/30 border-violet-300'
                      )}
                    />
                  </div>
                  )}

                  {/* CC Number */}
                  {isFieldVisible('cc_number') && (
                  <div className="space-y-2">
                    <Label htmlFor="cc_number" className="flex items-center gap-1">
                      {getLabel('cc_number', 'Número do CC')}
                      {isFieldRequired('cc_number') && <RequiredAsterisk />}
                      {isAiFilled('cc_number') && <AiFilled />}
                    </Label>
                    <Input
                      id="cc_number"
                      value={form.cc_number}
                      onChange={(e) => set('cc_number', e.target.value)}
                      placeholder="12345678"
                      className={cn(
                        isAiFilled('cc_number') &&
                          'ring-2 ring-violet-500/30 border-violet-300'
                      )}
                    />
                  </div>
                  )}

                  {/* CC Expiry */}
                  {isFieldVisible('cc_expiry') && (
                  <div className="space-y-2">
                    <Label htmlFor="cc_expiry" className="flex items-center gap-1">
                      {getLabel('cc_expiry', 'Validade do CC')}
                      {isFieldRequired('cc_expiry') && <RequiredAsterisk />}
                      {isAiFilled('cc_expiry') && <AiFilled />}
                    </Label>
                    <Input
                      id="cc_expiry"
                      type="date"
                      value={form.cc_expiry}
                      onChange={(e) => set('cc_expiry', e.target.value)}
                      className={cn(
                        isAiFilled('cc_expiry') &&
                          'ring-2 ring-violet-500/30 border-violet-300'
                      )}
                    />
                  </div>
                  )}

                  {/* CC Issue Date */}
                  {isFieldVisible('cc_issue_date') && (
                  <div className="space-y-2">
                    <Label
                      htmlFor="cc_issue_date"
                      className="flex items-center gap-1"
                    >
                      {getLabel('cc_issue_date', 'Data de Emissão')}
                      {isFieldRequired('cc_issue_date') && <RequiredAsterisk />}
                      {isAiFilled('cc_issue_date') && <AiFilled />}
                    </Label>
                    <Input
                      id="cc_issue_date"
                      type="date"
                      value={form.cc_issue_date}
                      onChange={(e) => set('cc_issue_date', e.target.value)}
                      className={cn(
                        isAiFilled('cc_issue_date') &&
                          'ring-2 ring-violet-500/30 border-violet-300'
                      )}
                    />
                  </div>
                  )}

                  {/* Date of Birth */}
                  {isFieldVisible('date_of_birth') && (
                  <div className="space-y-2">
                    <Label
                      htmlFor="date_of_birth"
                      className="flex items-center gap-1"
                    >
                      {getLabel('date_of_birth', 'Data de Nascimento')}
                      {isFieldRequired('date_of_birth') && <RequiredAsterisk />}
                      {isAiFilled('date_of_birth') && <AiFilled />}
                    </Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={form.date_of_birth}
                      onChange={(e) => set('date_of_birth', e.target.value)}
                      className={cn(
                        isAiFilled('date_of_birth') &&
                          'ring-2 ring-violet-500/30 border-violet-300'
                      )}
                    />
                  </div>
                  )}

                  {/* NIF */}
                  {isFieldVisible('nif') && (
                  <div className="space-y-2">
                    <Label htmlFor="nif" className="flex items-center gap-1">
                      {getLabel('nif', 'NIF')}
                      {isFieldRequired('nif') && <RequiredAsterisk />}
                      {isAiFilled('nif') && <AiFilled />}
                    </Label>
                    <Input
                      id="nif"
                      value={form.nif}
                      onChange={(e) => set('nif', e.target.value)}
                      placeholder="123456789"
                      className={cn(
                        isAiFilled('nif') &&
                          'ring-2 ring-violet-500/30 border-violet-300'
                      )}
                    />
                  </div>
                  )}

                  {/* NISS */}
                  {isFieldVisible('niss') && (
                  <div className="space-y-2">
                    <Label htmlFor="niss" className="flex items-center gap-1">
                      {getLabel('niss', 'NISS — Segurança Social')}
                      {isFieldRequired('niss') && <RequiredAsterisk />}
                      {isAiFilled('niss') && <AiFilled />}
                    </Label>
                    <Input
                      id="niss"
                      value={form.niss}
                      onChange={(e) => set('niss', e.target.value)}
                      placeholder="12345678901"
                      className={cn(
                        isAiFilled('niss') &&
                          'ring-2 ring-violet-500/30 border-violet-300'
                      )}
                    />
                  </div>
                  )}

                  {/* Naturalidade */}
                  {isFieldVisible('naturalidade') && (
                  <div className="space-y-2">
                    <Label
                      htmlFor="naturalidade"
                      className="flex items-center gap-1"
                    >
                      {getLabel('naturalidade', 'Naturalidade / Freguesia')}
                      {isFieldRequired('naturalidade') && <RequiredAsterisk />}
                      {isAiFilled('naturalidade') && <AiFilled />}
                    </Label>
                    <Input
                      id="naturalidade"
                      value={form.naturalidade}
                      onChange={(e) => set('naturalidade', e.target.value)}
                      placeholder="Ex: Lisboa"
                      className={cn(
                        isAiFilled('naturalidade') &&
                          'ring-2 ring-violet-500/30 border-violet-300'
                      )}
                    />
                  </div>
                  )}

                  {/* Estado Civil */}
                  {isFieldVisible('estado_civil') && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      {getLabel('estado_civil', 'Estado Civil')}
                      {isFieldRequired('estado_civil') && <RequiredAsterisk />}
                      {isAiFilled('estado_civil') && <AiFilled />}
                    </Label>
                    <Select
                      value={form.estado_civil}
                      onValueChange={(v) => set('estado_civil', v)}
                    >
                      <SelectTrigger
                        className={cn(
                          isAiFilled('estado_civil') &&
                            'ring-2 ring-violet-500/30 border-violet-300'
                        )}
                      >
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADO_CIVIL_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ============================================================ */}
            {/* Section 2: Dados Pessoais                                    */}
            {/* ============================================================ */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-muted-foreground" />
                  Dados Pessoais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isFieldVisible('display_name') && (
                <div className="space-y-2">
                  <Label htmlFor="display_name">
                    {getLabel('display_name', 'Nome a constar no site')}
                    {isFieldRequired('display_name') && <RequiredAsterisk />}
                  </Label>
                  <Input
                    id="display_name"
                    value={form.display_name}
                    onChange={(e) => set('display_name', e.target.value)}
                    placeholder="Ex: João Silva"
                  />
                </div>
                )}

                {isFieldVisible('full_address') && (
                <div className="space-y-2">
                  <Label htmlFor="full_address">
                    {getLabel('full_address', 'Morada Completa')}
                    {isFieldRequired('full_address') && <RequiredAsterisk />}
                  </Label>
                  <Textarea
                    id="full_address"
                    value={form.full_address}
                    onChange={(e) => set('full_address', e.target.value)}
                    placeholder="Rua, número, andar, código postal, localidade"
                    rows={3}
                  />
                </div>
                )}

                {form.date_of_birth && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Data de nascimento preenchida: {form.date_of_birth}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ============================================================ */}
            {/* Section 3: Contactos                                         */}
            {/* ============================================================ */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  Contactos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {isFieldVisible('professional_phone') && (
                  <div className="space-y-2">
                    <Label
                      htmlFor="professional_phone"
                      className="flex items-center gap-1"
                    >
                      {getLabel('professional_phone', 'Telemóvel Profissional')}
                      {isFieldRequired('professional_phone') && <RequiredAsterisk />}
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="professional_phone"
                        type="tel"
                        value={form.professional_phone}
                        onChange={(e) =>
                          set('professional_phone', e.target.value)
                        }
                        placeholder="912 345 678"
                        className="pl-9"
                      />
                    </div>
                  </div>
                  )}

                  {isFieldVisible('personal_email') && (
                  <div className="space-y-2">
                    <Label
                      htmlFor="personal_email"
                      className="flex items-center gap-1"
                    >
                      {getLabel('personal_email', 'Email Pessoal')}
                      {isFieldRequired('personal_email') && <RequiredAsterisk />}
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="personal_email"
                        type="email"
                        value={form.personal_email}
                        onChange={(e) => set('personal_email', e.target.value)}
                        placeholder="nome@email.com"
                        className="pl-9"
                      />
                    </div>
                  </div>
                  )}
                </div>

                {(isFieldVisible('emergency_contact_name') || isFieldVisible('emergency_contact_phone')) && (
                <>
                <Separator />

                <p className="text-sm text-muted-foreground">
                  Contacto de emergência (opcional)
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  {isFieldVisible('emergency_contact_name') && (
                  <div className="space-y-2">
                    <Label htmlFor="emergency_contact_name">
                      {getLabel('emergency_contact_name', 'Nome')}
                    </Label>
                    <Input
                      id="emergency_contact_name"
                      value={form.emergency_contact_name}
                      onChange={(e) =>
                        set('emergency_contact_name', e.target.value)
                      }
                      placeholder="Nome do contacto"
                    />
                  </div>
                  )}

                  {isFieldVisible('emergency_contact_phone') && (
                  <div className="space-y-2">
                    <Label htmlFor="emergency_contact_phone">
                      {getLabel('emergency_contact_phone', 'Telemóvel')}
                    </Label>
                    <Input
                      id="emergency_contact_phone"
                      type="tel"
                      value={form.emergency_contact_phone}
                      onChange={(e) =>
                        set('emergency_contact_phone', e.target.value)
                      }
                      placeholder="912 345 678"
                    />
                  </div>
                  )}
                </div>
                </>
                )}
              </CardContent>
            </Card>

            {/* ============================================================ */}
            {/* Section 4: Email RE/MAX                                      */}
            {/* ============================================================ */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  Email RE/MAX
                </CardTitle>
                <CardDescription>
                  Sugira até 3 opções para o seu email profissional @remax.pt.
                  Tentaremos atribuir a primeira opção disponível.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[1, 2, 3].map((n) => {
                  const key =
                    `email_suggestion_${n}` as keyof FormData
                  return (
                    <div key={n} className="space-y-2">
                      <Label htmlFor={key}>Sugestão {n}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={key}
                          value={form[key]}
                          onChange={(e) => set(key, e.target.value)}
                          placeholder={`ex: joao.silva`}
                          className="flex-1"
                        />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          @remax.pt
                        </span>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* ============================================================ */}
            {/* Section 5: Experiência Profissional                          */}
            {/* ============================================================ */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                  Experiência Profissional
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Has sales experience? */}
                <div className="space-y-3">
                  <Label>Tem experiência em vendas?</Label>
                  <div className="flex gap-3">
                    {['sim', 'nao'].map((val) => (
                      <Button
                        key={val}
                        type="button"
                        variant={
                          form.has_sales_experience === val
                            ? 'default'
                            : 'outline'
                        }
                        size="sm"
                        onClick={() => {
                          set('has_sales_experience', val)
                          if (val === 'nao') {
                            set('has_real_estate_experience', '')
                            set('previous_agency', '')
                          }
                        }}
                      >
                        {val === 'sim' ? 'Sim' : 'Não'}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Real estate experience - conditional */}
                {form.has_sales_experience === 'sim' && (
                  <div className="space-y-3 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                    <Label>Experiência em vendas imobiliárias?</Label>
                    <div className="flex gap-3">
                      {['sim', 'nao'].map((val) => (
                        <Button
                          key={val}
                          type="button"
                          variant={
                            form.has_real_estate_experience === val
                              ? 'default'
                              : 'outline'
                          }
                          size="sm"
                          onClick={() => {
                            set('has_real_estate_experience', val)
                            if (val === 'nao') set('previous_agency', '')
                          }}
                        >
                          {val === 'sim' ? 'Sim' : 'Não'}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Previous agency - conditional */}
                {form.has_real_estate_experience === 'sim' && (
                  <div className="space-y-2 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                    <Label htmlFor="previous_agency">
                      Em que imobiliária trabalhou?
                    </Label>
                    <Input
                      id="previous_agency"
                      value={form.previous_agency}
                      onChange={(e) => set('previous_agency', e.target.value)}
                      placeholder="Ex: Century 21, ERA, KW..."
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ============================================================ */}
            {/* Section 6: Redes Sociais & Foto                              */}
            {/* ============================================================ */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-muted-foreground" />
                  Redes Sociais & Foto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {isFieldVisible('instagram_handle') && (
                  <div className="space-y-2">
                    <Label htmlFor="instagram_handle" className="flex items-center gap-1">
                      <Instagram className="h-3.5 w-3.5" />
                      {getLabel('instagram_handle', 'Instagram Profissional')}
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">@</span>
                      <Input
                        id="instagram_handle"
                        value={form.instagram_handle}
                        onChange={(e) =>
                          set('instagram_handle', e.target.value)
                        }
                        placeholder="username"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  )}

                  {isFieldVisible('facebook_page') && (
                  <div className="space-y-2">
                    <Label htmlFor="facebook_page" className="flex items-center gap-1">
                      <Facebook className="h-3.5 w-3.5" />
                      {getLabel('facebook_page', 'Página Facebook')}
                    </Label>
                    <Input
                      id="facebook_page"
                      value={form.facebook_page}
                      onChange={(e) => set('facebook_page', e.target.value)}
                      placeholder="Nome da página ou URL"
                    />
                  </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Fotografia Profissional</Label>
                  <p className="text-xs text-muted-foreground">
                    Fotografia de rosto para o site e materiais de marketing.
                  </p>
                  {photo?.preview ? (
                    <div className="flex items-start gap-4">
                      <img
                        src={photo.preview}
                        alt="Fotografia"
                        className="h-28 w-28 rounded-xl object-cover border shadow-sm"
                      />
                      <div className="space-y-1 pt-1">
                        <p className="text-sm font-medium truncate max-w-[180px]">
                          {photo.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(photo.file.size)}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 px-0"
                          onClick={() => {
                            if (photo.preview) URL.revokeObjectURL(photo.preview)
                            setPhoto(null)
                          }}
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Remover
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <FilePicker
                      label="Carregar fotografia"
                      description="JPG ou PNG, idealmente com fundo neutro"
                      accept="image/*"
                      file={photo}
                      onChange={setPhoto}
                      showPreview
                      dropZone
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ============================================================ */}
            {/* Section 7: Submit                                            */}
            {/* ============================================================ */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>
                    Ao submeter, os seus dados serão enviados de forma segura
                    para a equipa de administração da Infinity Group. Será
                    contactado/a para os próximos passos.
                  </p>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full gap-2 text-base"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      A enviar...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      Enviar Formulário
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </form>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Infinity Group &copy; {new Date().getFullYear()}. Todos os direitos
          reservados.
        </p>
      </div>
    </div>
  )
}
