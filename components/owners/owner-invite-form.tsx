'use client'

import { useMemo, useState } from 'react'
import { toast, Toaster } from 'sonner'
import {
  CheckCircle2,
  Loader2,
  Upload,
  Sparkles,
  X,
  Plus,
  Building2,
  User,
  FileText,
  ChevronRight,
  Mail,
  Phone,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  getSlots,
  type OwnerInviteContext,
  type OwnerDocSlot,
} from '@/lib/owner-invites/doc-slots'
import { MARITAL_STATUS, MARITAL_REGIMES } from '@/lib/constants'

type Mode = 'singular' | 'coletiva'

// Only fields that cannot be reliably extracted from the uploaded docs,
// plus `name` as a manual fallback in case AI extraction from the CC /
// certidão fails. Everything else (NIF, birth date, address, company
// fields etc.) is extracted server-side.
interface OwnerData {
  name: string
  email: string
  phone: string
  marital_status: string
  marital_regime: string
  profession: string
  ownership_percentage: number
}

interface HeirData {
  name: string
  email: string
  phone: string
  ownership_percentage: number
}

interface UploadedFile {
  slot_slug: string
  file_url: string
  r2_key: string
  file_name: string
  file_size: number
  mime_type: string
  heir_index?: number
}

const EMPTY_OWNER: OwnerData = {
  name: '',
  email: '',
  phone: '',
  marital_status: '',
  marital_regime: '',
  profession: '',
  ownership_percentage: 100,
}

const EMPTY_HEIR: HeirData = {
  name: '',
  email: '',
  phone: '',
  ownership_percentage: 0,
}

interface Props {
  token: string
  expiresAt: string
  note: string | null
  property: { title: string; address: string; cover_url: string | null }
  consultant: {
    name: string
    email: string
    photo_url: string | null
    phone: string | null
  }
}

export function OwnerInviteForm(props: Props) {
  const [mode, setMode] = useState<Mode>('singular')
  const [isHeranca, setIsHeranca] = useState(false)
  const [primary, setPrimary] = useState<OwnerData>({ ...EMPTY_OWNER })
  const [heirs, setHeirs] = useState<HeirData[]>([])
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const context: OwnerInviteContext = useMemo(() => {
    if (mode === 'coletiva') return 'coletiva'
    return isHeranca ? 'singular_heranca_cabeca' : 'singular'
  }, [mode, isHeranca])

  const primarySlots = getSlots(context)

  const updatePrimary = (patch: Partial<OwnerData>) =>
    setPrimary((s) => ({ ...s, ...patch }))

  // ───────── Uploads ─────────
  const uploadOne = async (file: File, slotSlug: string, heirIndex?: number) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('slot_slug', slotSlug)
    const res = await fetch(`/api/owner-invites/${props.token}/upload`, {
      method: 'POST',
      body: fd,
    })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Upload falhou' }))
      throw new Error(error)
    }
    const data = (await res.json()) as UploadedFile
    if (heirIndex !== undefined) data.heir_index = heirIndex
    return data
  }

  const handleSlotUpload = async (
    slotSlug: string,
    fileList: FileList | null,
    heirIndex?: number
  ) => {
    if (!fileList || fileList.length === 0) return
    setUploading(true)
    try {
      const uploaded: UploadedFile[] = []
      for (const f of Array.from(fileList)) {
        uploaded.push(await uploadOne(f, slotSlug, heirIndex))
      }
      setFiles((prev) => [...prev, ...uploaded])
      toast.success(
        uploaded.length === 1 ? 'Ficheiro carregado' : `${uploaded.length} ficheiros carregados`
      )
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const handleSmartUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setUploading(true)
    try {
      const uploaded: UploadedFile[] = []
      for (const f of Array.from(fileList)) {
        uploaded.push(await uploadOne(f, 'unknown'))
      }
      setFiles((prev) => [...prev, ...uploaded])
      toast.success('Ficheiros carregados. A IA está a identificar...')

      // Classify them.
      setClassifying(true)
      try {
        const res = await fetch(`/api/owner-invites/${props.token}/classify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context,
            files: uploaded.map((u) => ({
              file_url: u.file_url,
              file_name: u.file_name,
              mime_type: u.mime_type,
            })),
          }),
        })
        if (res.ok) {
          const data = (await res.json()) as {
            results: { file_url: string; suggested_slot: string }[]
          }
          setFiles((prev) =>
            prev.map((f) => {
              const match = data.results.find((r) => r.file_url === f.file_url)
              if (match && match.suggested_slot !== 'unknown') {
                return { ...f, slot_slug: match.suggested_slot }
              }
              return f
            })
          )
          toast.success('Documentos classificados — verifique e ajuste se necessário')
        }
      } finally {
        setClassifying(false)
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const removeFile = (fileUrl: string) => {
    setFiles((prev) => prev.filter((f) => f.file_url !== fileUrl))
  }

  const reassignSlot = (fileUrl: string, slotSlug: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.file_url === fileUrl ? { ...f, slot_slug: slotSlug } : f))
    )
  }

  // ───────── Heirs ─────────
  const addHeir = () => setHeirs((prev) => [...prev, { ...EMPTY_HEIR }])
  const removeHeir = (idx: number) => {
    setHeirs((prev) => prev.filter((_, i) => i !== idx))
    setFiles((prev) =>
      prev
        .filter((f) => f.heir_index !== idx)
        .map((f) =>
          f.heir_index !== undefined && f.heir_index > idx
            ? { ...f, heir_index: f.heir_index - 1 }
            : f
        )
    )
  }
  const updateHeir = (idx: number, patch: Partial<HeirData>) =>
    setHeirs((prev) => prev.map((h, i) => (i === idx ? { ...h, ...patch } : h)))

  // ───────── Submit ─────────
  const validate = (): string | null => {
    if (!primary.name || primary.name.trim().length < 2) {
      return mode === 'coletiva'
        ? 'Indique a designação da empresa.'
        : 'Indique o nome e apelido.'
    }
    if (!primary.email && !primary.phone) {
      return 'Indique email ou telemóvel para contacto.'
    }
    for (const slot of primarySlots.filter((s) => s.required)) {
      const hasFile = files.some(
        (f) =>
          f.slot_slug === slot.slug &&
          (mode !== 'singular' || !isHeranca || f.heir_index === undefined)
      )
      if (!hasFile) {
        return `Falta carregar: ${slot.label}`
      }
    }
    if (mode === 'singular' && isHeranca) {
      for (let i = 0; i < heirs.length; i++) {
        const heirSlots = getSlots('singular_heranca_herdeiro').filter((s) => s.required)
        for (const slot of heirSlots) {
          const hasFile = files.some(
            (f) => f.slot_slug === slot.slug && f.heir_index === i
          )
          if (!hasFile) {
            return `Falta ${slot.label} do herdeiro #${i + 1}.`
          }
        }
      }
    }
    return null
  }

  const handleSubmit = async () => {
    const err = validate()
    if (err) {
      toast.error(err)
      return
    }

    setSubmitting(true)
    try {
      const sharedFiles = files
        .filter((f) => f.heir_index === undefined)
        .map((f) => ({
          slot_slug: f.slot_slug,
          file_url: f.file_url,
          r2_key: f.r2_key,
          file_name: f.file_name,
          file_size: f.file_size,
          mime_type: f.mime_type,
        }))

      let body: any
      if (mode === 'coletiva') {
        body = { mode: 'coletiva', primary, files: sharedFiles }
      } else if (!isHeranca) {
        body = {
          mode: 'singular',
          is_heranca: false,
          primary,
          files: sharedFiles,
        }
      } else {
        const heirFiles = files
          .filter((f) => f.heir_index !== undefined)
          .map((f) => ({
            slot_slug: f.slot_slug,
            file_url: f.file_url,
            r2_key: f.r2_key,
            file_name: f.file_name,
            file_size: f.file_size,
            mime_type: f.mime_type,
            heir_index: f.heir_index!,
          }))
        body = {
          mode: 'singular',
          is_heranca: true,
          primary,
          heirs,
          files: sharedFiles,
          heir_files: heirFiles,
        }
      }

      const res = await fetch(`/api/owner-invites/${props.token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const { error, details } = await res.json().catch(() => ({}))
        throw new Error(error || 'Erro ao submeter')
      }
      setDone(true)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return <InviteSuccess propertyTitle={props.property.title} consultantName={props.consultant.name} />
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Toaster richColors position="top-center" />

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {props.property.cover_url ? (
              <img
                src={props.property.cover_url}
                alt=""
                className="h-10 w-10 rounded-lg object-cover"
              />
            ) : null}
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Dados de proprietário
              </p>
              <p className="text-sm font-semibold truncate">{props.property.title}</p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Consultor
            </p>
            <p className="text-sm font-medium">{props.consultant.name}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {props.note ? (
          <div className="rounded-xl bg-sky-50 border border-sky-100 text-sky-900 p-4 text-sm">
            {props.note}
          </div>
        ) : null}

        {/* Step 1 — tipo */}
        <Section
          step={1}
          icon={User}
          title="Quem vai ser o proprietário?"
          description="Indique se é pessoa singular ou uma empresa. Se a titularidade vier de uma herança, active o selector."
        >
          <div className="grid grid-cols-2 gap-3">
            <ModeCard
              icon={User}
              title="Pessoa singular"
              active={mode === 'singular'}
              onClick={() => setMode('singular')}
            />
            <ModeCard
              icon={Building2}
              title="Empresa"
              active={mode === 'coletiva'}
              onClick={() => {
                setMode('coletiva')
                setIsHeranca(false)
              }}
            />
          </div>

          {mode === 'singular' && (
            <div className="flex items-center justify-between rounded-lg border p-3 bg-white">
              <div>
                <Label className="text-sm font-medium">É uma herança?</Label>
                <p className="text-xs text-muted-foreground">
                  Active se o imóvel faz parte de um processo de herança.
                </p>
              </div>
              <Switch checked={isHeranca} onCheckedChange={setIsHeranca} />
            </div>
          )}
        </Section>

        {/* Step 2 — identidade */}
        <Section
          step={2}
          icon={User}
          title={
            mode === 'coletiva'
              ? 'Dados da empresa'
              : isHeranca
                ? 'Dados do cabeça de casal'
                : 'Os seus dados'
          }
        >
          <OwnerFields data={primary} onChange={updatePrimary} mode={mode} />
        </Section>

        {/* Step 2b — herdeiros */}
        {mode === 'singular' && isHeranca && (
          <Section
            step={3}
            icon={User}
            title="Outros herdeiros"
            description="Adicione todos os co-herdeiros. Cada um precisa do CC e NIF."
          >
            {heirs.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Ainda não adicionou nenhum herdeiro.
              </p>
            ) : (
              heirs.map((heir, idx) => (
                <div key={idx} className="rounded-xl border bg-white p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">Herdeiro #{idx + 1}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeHeir(idx)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <HeirFields
                    data={heir}
                    onChange={(p) => updateHeir(idx, p)}
                  />
                  <div className="pt-2 border-t space-y-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Documentos do herdeiro
                    </p>
                    {getSlots('singular_heranca_herdeiro').map((slot) => (
                      <SlotUpload
                        key={slot.slug}
                        slot={slot}
                        files={files.filter(
                          (f) => f.slot_slug === slot.slug && f.heir_index === idx
                        )}
                        onUpload={(fl) => handleSlotUpload(slot.slug, fl, idx)}
                        onRemove={removeFile}
                        uploading={uploading}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
            <Button
              type="button"
              variant="outline"
              onClick={addHeir}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" /> Adicionar herdeiro
            </Button>
          </Section>
        )}

        {/* Step 3/4 — docs */}
        <Section
          step={mode === 'singular' && isHeranca ? 4 : 3}
          icon={FileText}
          title="Documentos"
          description="Carregue cada documento no slot correspondente, ou use o carregamento inteligente e deixe a IA identificar cada um."
        >
          {/* Smart upload */}
          <div className="rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-violet-600" />
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <p className="text-sm font-semibold text-violet-900">
                    Carregamento inteligente
                  </p>
                  <p className="text-xs text-violet-800/80">
                    Envie todos os documentos de uma vez e a IA identifica qual é
                    cada um. Pode sempre corrigir a seguir.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm font-medium bg-white hover:bg-violet-50 border border-violet-200 text-violet-700 px-3 py-1.5 rounded-lg cursor-pointer transition-colors">
                  {classifying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {classifying ? 'A classificar...' : 'Carregar tudo de uma vez'}
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx"
                    className="hidden"
                    disabled={uploading || classifying}
                    onChange={(e) => {
                      handleSmartUpload(e.target.files)
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Slot-by-slot */}
          <div className="space-y-3">
            {primarySlots.map((slot) => (
              <SlotUpload
                key={slot.slug}
                slot={slot}
                files={files.filter(
                  (f) => f.slot_slug === slot.slug && f.heir_index === undefined
                )}
                onUpload={(fl) => handleSlotUpload(slot.slug, fl)}
                onRemove={removeFile}
                uploading={uploading}
              />
            ))}
          </div>

          {/* Unclassified */}
          {files.filter(
            (f) =>
              f.heir_index === undefined &&
              !primarySlots.some((s) => s.slug === f.slot_slug)
          ).length > 0 && (
            <div className="rounded-xl border bg-amber-50 border-amber-200 p-4 space-y-2">
              <p className="text-sm font-medium text-amber-900">
                Documentos por classificar
              </p>
              <p className="text-xs text-amber-800">
                Estes ficheiros não foram associados a nenhum tipo. Escolha o tipo
                ou remova-os.
              </p>
              {files
                .filter(
                  (f) =>
                    f.heir_index === undefined &&
                    !primarySlots.some((s) => s.slug === f.slot_slug)
                )
                .map((f) => (
                  <div
                    key={f.file_url}
                    className="flex items-center gap-2 bg-white rounded-lg p-2 border border-amber-200"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs truncate flex-1" title={f.file_name}>
                      {f.file_name}
                    </span>
                    <Select
                      value=""
                      onValueChange={(v) => reassignSlot(f.file_url, v)}
                    >
                      <SelectTrigger className="h-8 w-44 text-xs">
                        <SelectValue placeholder="Escolher tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {primarySlots.map((s) => (
                          <SelectItem key={s.slug} value={s.slug}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(f.file_url)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </Section>

        {/* Submit */}
        <div className="pt-4 pb-10">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || uploading || classifying}
            className="w-full h-12 text-base"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" /> A submeter...
              </>
            ) : (
              <>
                Submeter dados <ChevronRight className="h-5 w-5 ml-1" />
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Ao submeter, confirma que os dados e documentos são verdadeiros.
          </p>
        </div>
      </main>
    </div>
  )
}

// ───────── Sub-components ─────────

function Section({
  step,
  icon: Icon,
  title,
  description,
  children,
}: {
  step: number
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border bg-white shadow-sm p-5 sm:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-neutral-900 text-white flex items-center justify-center text-sm font-semibold shrink-0">
          {step}
        </div>
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" /> {title}
          </h2>
          {description ? (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function ModeCard({
  icon: Icon,
  title,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl border-2 p-4 text-left transition-all',
        active
          ? 'border-neutral-900 bg-neutral-900 text-white'
          : 'border-neutral-200 bg-white hover:border-neutral-400'
      )}
    >
      <Icon className={cn('h-5 w-5 mb-2', active ? 'text-white' : 'text-neutral-500')} />
      <p className="font-medium text-sm">{title}</p>
    </button>
  )
}

function OwnerFields({
  data,
  onChange,
  mode,
}: {
  data: OwnerData
  onChange: (patch: Partial<OwnerData>) => void
  mode: Mode
}) {
  const isCompany = mode === 'coletiva'
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted/40 border border-dashed p-3 text-xs text-muted-foreground flex items-start gap-2">
        <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <p>
          Os restantes dados (NIF, morada
          {isCompany ? ', dados da empresa' : ', data de nascimento'}…) são
          extraídos automaticamente dos documentos que carregar abaixo.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label={isCompany ? 'Designação da empresa' : 'Nome e apelido'}
          required
          className="sm:col-span-2"
        >
          <Input
            value={data.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={isCompany ? 'Empresa Lda' : 'João Silva'}
          />
        </Field>
        <Field label="Email" required>
          <Input
            type="email"
            value={data.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="nome@exemplo.pt"
          />
        </Field>
        <Field label="Telemóvel" required>
          <Input
            value={data.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="+351 912 345 678"
          />
        </Field>

        {!isCompany && (
          <>
            <Field label="Estado civil">
              <Select
                value={data.marital_status}
                onValueChange={(v) => onChange({ marital_status: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MARITAL_STATUS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {data.marital_status === 'casado' && (
              <Field label="Regime de bens">
                <Select
                  value={data.marital_regime}
                  onValueChange={(v) => onChange({ marital_regime: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MARITAL_REGIMES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field
              label="Profissão"
              className={
                data.marital_status === 'casado' ? '' : 'sm:col-span-2'
              }
            >
              <Input
                value={data.profession}
                onChange={(e) => onChange({ profession: e.target.value })}
              />
            </Field>
          </>
        )}

        <Field
          label="Percentagem de propriedade"
          className="sm:col-span-2"
        >
          <Input
            type="number"
            min={0}
            max={100}
            step={1}
            value={data.ownership_percentage}
            onChange={(e) =>
              onChange({
                ownership_percentage: Math.max(
                  0,
                  Math.min(100, Number(e.target.value) || 0)
                ),
              })
            }
          />
        </Field>
      </div>
    </div>
  )
}

function HeirFields({
  data,
  onChange,
}: {
  data: HeirData
  onChange: (patch: Partial<HeirData>) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="Nome e apelido" required className="sm:col-span-2">
        <Input
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="João Silva"
        />
      </Field>
      <Field label="Email">
        <Input
          type="email"
          value={data.email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="nome@exemplo.pt"
        />
      </Field>
      <Field label="Telemóvel">
        <Input
          value={data.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
          placeholder="+351 912 345 678"
        />
      </Field>
      <Field label="Quota-parte (%)">
        <Input
          type="number"
          min={0}
          max={100}
          step={1}
          value={data.ownership_percentage}
          onChange={(e) =>
            onChange({
              ownership_percentage: Math.max(
                0,
                Math.min(100, Number(e.target.value) || 0)
              ),
            })
          }
        />
      </Field>
    </div>
  )
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string
  required?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-xs font-medium">
        {label}
        {required ? <span className="text-red-500 ml-0.5">*</span> : null}
      </Label>
      {children}
    </div>
  )
}

function SlotUpload({
  slot,
  files,
  onUpload,
  onRemove,
  uploading,
}: {
  slot: OwnerDocSlot
  files: UploadedFile[]
  onUpload: (fl: FileList | null) => void
  onRemove: (fileUrl: string) => void
  uploading: boolean
}) {
  const filled = files.length > 0
  return (
    <div
      className={cn(
        'rounded-lg border p-3 flex flex-col gap-2 transition-colors',
        filled ? 'bg-emerald-50/40 border-emerald-200' : 'bg-white'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {filled ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <p className="text-sm font-medium truncate">{slot.label}</p>
            {slot.required ? (
              <span className="text-[10px] font-medium text-red-500 uppercase">
                Obrigatório
              </span>
            ) : (
              <span className="text-[10px] font-medium text-muted-foreground uppercase">
                Opcional
              </span>
            )}
          </div>
          {slot.description ? (
            <p className="text-xs text-muted-foreground mt-0.5 ml-6">
              {slot.description}
            </p>
          ) : null}
        </div>
        <label className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium bg-white hover:bg-neutral-50 border px-2.5 py-1.5 rounded-lg cursor-pointer">
          <Upload className="h-3.5 w-3.5" />
          {filled ? 'Adicionar' : 'Carregar'}
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              onUpload(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      </div>
      {files.length > 0 && (
        <div className="flex flex-col gap-1">
          {files.map((f) => (
            <div
              key={f.file_url}
              className="flex items-center gap-2 bg-white rounded-md px-2 py-1.5 border text-xs"
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate flex-1" title={f.file_name}>
                {f.file_name}
              </span>
              <button
                type="button"
                onClick={() => onRemove(f.file_url)}
                className="text-muted-foreground hover:text-red-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function InviteSuccess({
  propertyTitle,
  consultantName,
}: {
  propertyTitle: string
  consultantName: string
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border p-8 text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        </div>
        <h1 className="text-xl font-semibold">Obrigado!</h1>
        <p className="text-sm text-muted-foreground">
          Os seus dados e documentos foram submetidos com sucesso para{' '}
          <span className="font-medium">{propertyTitle}</span>.
          {consultantName ? (
            <>
              {' '}
              O consultor{' '}
              <span className="font-medium">{consultantName}</span> irá rever e
              contactá-lo.
            </>
          ) : null}
        </p>
      </div>
    </div>
  )
}
