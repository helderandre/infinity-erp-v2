// @ts-nocheck
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useUser } from '@/hooks/use-user'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetTitle,
} from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Popover, PopoverAnchor, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command, CommandEmpty, CommandGroup, CommandItem, CommandList,
} from '@/components/ui/command'
import {
  Mic, MicOff, Loader2, Sparkles, Handshake, Building2, UserPlus, Landmark, Search, X, Users,
} from 'lucide-react'
import { SheetHeader, SheetDescription } from '@/components/ui/sheet'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'

// ─── Types ──────────────────────────────────────────────────────

type DialogMode = 'criar' | 'referenciar'
type TopCategory = 'imobiliario' | 'recrutamento' | 'credito'

interface LeadEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: () => void
  /** When true, hides the category selector and locks to real estate only */
  realEstateOnly?: boolean
}

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'website', label: 'Website' },
  { value: 'landing_page', label: 'Landing Page' },
  { value: 'partner', label: 'Parceiro' },
  { value: 'organic', label: 'Orgânico' },
  { value: 'walk_in', label: 'Presencial' },
  { value: 'phone_call', label: 'Chamada' },
  { value: 'social_media', label: 'Redes Sociais' },
  { value: 'other', label: 'Outro' },
]

const IMOB_SECTORS = [
  { value: 'real_estate_buy', label: 'Comprador' },
  { value: 'real_estate_sell', label: 'Vendedor' },
  { value: 'real_estate_rent', label: 'Arrendatário' },
  { value: 'real_estate_landlord', label: 'Senhorio' },
]

const BUSINESS_TYPE_OPTIONS = [
  { value: 'Venda',        label: 'Venda' },
  { value: 'Arrendamento', label: 'Arrendamento' },
  { value: 'Trespasse',    label: 'Trespasse' },
] as const

// Quais perspectivas (sectors) fazem sentido por business_type.
// Trespasse: comprador/vendedor de negócio.
const SECTORS_BY_BT: Record<string, string[]> = {
  Venda:        ['real_estate_buy', 'real_estate_sell'],
  Arrendamento: ['real_estate_rent', 'real_estate_landlord'],
  Trespasse:    ['real_estate_buy', 'real_estate_sell'],
}

const TOP_CATEGORIES: { value: TopCategory; label: string; icon: React.ElementType }[] = [
  { value: 'imobiliario', label: 'Imobiliário', icon: Building2 },
  { value: 'recrutamento', label: 'Recrutamento', icon: UserPlus },
  { value: 'credito', label: 'Crédito', icon: Landmark },
]

// ─── Component ──────────────────────────────────────────────────

export function LeadEntryDialog({ open, onOpenChange, onComplete, realEstateOnly }: LeadEntryDialogProps) {
  const isMobile = useIsMobile()
  const { user: currentUser } = useUser()
  const [dialogMode, setDialogMode] = useState<DialogMode>('criar')
  const [category, setCategory] = useState<TopCategory>('imobiliario')
  const [creating, setCreating] = useState(false)
  const [consultantsList, setConsultantsList] = useState<{ id: string; commercial_name: string }[]>([])

  const [form, setForm] = useState({
    raw_name: '', raw_email: '', raw_phone: '', source: 'other', notes: '',
    sector: '',
    business_type: '',
    // Assignment + linked angariação (criar mode)
    assigned_consultant_id: '',
    property_id: '',
    property_label: '',
    // Referral
    has_referral: false, referral_pct: '25', referral_consultant_id: '',
    referral_external_name: '', referral_external_phone: '', referral_external_email: '', referral_external_agency: '',
    // Recruitment-specific
    has_experience: false, previous_agency: '',
    // Credit-specific
    credit_purpose: '',
  })

  // AI
  const [aiOpen, setAiOpen] = useState(false)
  const [aiText, setAiText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Property search (imóvel relacionado / angariação)
  const [propQuery, setPropQuery] = useState('')
  const [propResults, setPropResults] = useState<{ id: string; external_ref: string | null; title: string; city: string | null }[]>([])
  const [propPopoverOpen, setPropPopoverOpen] = useState(false)
  const [isPropLoading, setIsPropLoading] = useState(false)
  const [hasPropTyped, setHasPropTyped] = useState(false)
  const debouncedPropQuery = useDebounce(propQuery, 300)

  useEffect(() => {
    if (!hasPropTyped || debouncedPropQuery.trim().length < 2) {
      setPropResults([])
      return
    }
    let cancelled = false
    const run = async () => {
      setIsPropLoading(true)
      try {
        const res = await fetch(`/api/properties?search=${encodeURIComponent(debouncedPropQuery.trim())}&per_page=10`)
        if (!res.ok) throw new Error()
        const json = await res.json()
        const rows: any[] = Array.isArray(json) ? json : (json.data ?? [])
        if (cancelled) return
        const mapped = rows.map((r) => ({
          id: r.id, external_ref: r.external_ref ?? null, title: r.title ?? '(sem título)', city: r.city ?? null,
        }))
        setPropResults(mapped)
        if (mapped.length > 0) setPropPopoverOpen(true)
      } catch {
        if (!cancelled) setPropResults([])
      } finally {
        if (!cancelled) setIsPropLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [debouncedPropQuery, hasPropTyped])

  useEffect(() => {
    if (open) {
      fetch('/api/consultants?limit=100')
        .then((r) => r.json())
        .then((d) => setConsultantsList((d.data || d || []).map((c: any) => ({ id: c.id, commercial_name: c.commercial_name }))))
        .catch(() => {})
    }
  }, [open])

  // Default "Para quem" para o utilizador actual quando o dialog abre.
  // Só corre se o campo ainda estiver vazio — não sobrepõe escolhas explícitas.
  useEffect(() => {
    if (!open || !currentUser?.id) return
    setForm((p) => (p.assigned_consultant_id ? p : { ...p, assigned_consultant_id: currentUser.id }))
  }, [open, currentUser?.id])

  const resetForm = () => {
    setForm({
      raw_name: '', raw_email: '', raw_phone: '', source: 'other', notes: '', sector: '',
      business_type: '',
      assigned_consultant_id: '', property_id: '', property_label: '',
      has_referral: false, referral_pct: '25', referral_consultant_id: '',
      referral_external_name: '', referral_external_phone: '', referral_external_email: '', referral_external_agency: '',
      has_experience: false, previous_agency: '', credit_purpose: '',
    })
    setDialogMode('criar')
    setCategory('imobiliario')
    setAiText('')
    setPropQuery('')
    setPropResults([])
  }

  // ── AI: voice + text ──────────────────────────────────────────

  const applyExtracted = (ext: Record<string, any>) => {
    setForm((p) => {
      const next = { ...p }
      if (ext.name) next.raw_name = ext.name
      if (ext.email) next.raw_email = ext.email
      if (ext.phone) next.raw_phone = ext.phone
      if (ext.source && SOURCE_OPTIONS.some((s) => s.value === ext.source)) next.source = ext.source
      if (ext.business_type && BUSINESS_TYPE_OPTIONS.some((b) => b.value === ext.business_type)) {
        next.business_type = ext.business_type
      }
      if (ext.sector && IMOB_SECTORS.some((s) => s.value === ext.sector)) {
        // Só aplica se for compatível com o business_type (já existente OU acabado de extrair).
        const bt = next.business_type
        if (!bt || (SECTORS_BY_BT[bt] ?? []).includes(ext.sector)) next.sector = ext.sector
      }
      // Assignment: only trust consultant_id (UUID) — name alone could collide.
      if (ext.consultant_id && consultantsList.some((c) => c.id === ext.consultant_id)) {
        next.assigned_consultant_id = ext.consultant_id
      }
      if (ext.property_id) {
        next.property_id = ext.property_id
        const label = [ext.property_external_ref, ext.property_title].filter(Boolean).join(' — ')
        if (label) next.property_label = label
      } else if (ext.property_external_ref) {
        // Couldn't resolve to an actual angariação: surface as a hint in notes
        // so the gestora can investigate manually.
        next.notes = next.notes
          ? `${next.notes}\nReferência mencionada: ${ext.property_external_ref}`
          : `Referência mencionada: ${ext.property_external_ref}`
      }
      if (ext.notes) next.notes = next.notes ? `${next.notes}\n${ext.notes}` : ext.notes
      return next
    })
  }

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      audioChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setIsProcessing(true)
        try {
          const fd = new FormData()
          fd.append('audio', blob, 'recording.webm')
          const res = await fetch('/api/lead-entries/transcribe', { method: 'POST', body: fd })
          if (!res.ok) throw new Error()
          const data = await res.json()
          applyExtracted(data.extracted || {})
          setAiText(data.transcription || '')
          toast.success('Transcrição concluída')
        } catch { toast.error('Erro na transcrição') }
        finally { setIsProcessing(false) }
      }
      mr.start()
      setIsRecording(true)
    } catch { toast.error('Erro ao aceder ao microfone') }
  }, [])

  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false) }

  const extractFromText = async (text: string) => {
    if (!text.trim()) return
    setIsProcessing(true)
    try {
      const res = await fetch('/api/leads/extract-from-text', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error()
      const { fields } = await res.json()
      applyExtracted({ name: fields.nome, email: fields.email, phone: fields.telemovel, notes: fields.observacoes })
      toast.success('Dados extraídos')
      setAiOpen(false)
    } catch { toast.error('Erro ao extrair dados') }
    finally { setIsProcessing(false) }
  }

  // ── Submit ────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!form.raw_name.trim()) { toast.error('Nome obrigatório'); return }
    setCreating(true)
    try {
      const isRef = dialogMode === 'referenciar'

      // Determine sector
      let sector = form.sector || null
      if (category === 'recrutamento') sector = 'recruitment'
      if (category === 'credito') sector = 'credit'

      const payload: Record<string, any> = {
        raw_name: form.raw_name,
        raw_email: form.raw_email,
        raw_phone: form.raw_phone,
        source: form.source,
        notes: form.notes,
        sector,
        business_type: category === 'imobiliario' ? (form.business_type || null) : null,
        assigned_consultant_id: form.assigned_consultant_id || null,
        property_id: form.property_id || null,
      }

      // Recruitment extras
      if (category === 'recrutamento') {
        const extra = []
        if (form.has_experience) extra.push('Tem experiência imobiliária')
        if (form.previous_agency) extra.push(`Agência anterior: ${form.previous_agency}`)
        if (extra.length) payload.notes = [form.notes, ...extra].filter(Boolean).join('\n')
      }

      // Credit extras
      if (category === 'credito' && form.credit_purpose) {
        payload.notes = [form.notes, `Finalidade: ${form.credit_purpose}`].filter(Boolean).join('\n')
      }

      // Referral
      if (isRef || form.has_referral) {
        payload.has_referral = true
        payload.referral_pct = form.referral_pct ? parseFloat(form.referral_pct) : null
        payload.referral_consultant_id = form.referral_consultant_id || null
        payload.referral_external_name = form.referral_external_name || null
        payload.referral_external_phone = form.referral_external_phone || null
        payload.referral_external_email = form.referral_external_email || null
        payload.referral_external_agency = form.referral_external_agency || null
      }

      const res = await fetch('/api/lead-entries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      toast.success(isRef ? 'Lead referenciado com sucesso' : 'Lead registado com sucesso')
      onOpenChange(false)
      resetForm()
      onComplete?.()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar lead')
    } finally { setCreating(false) }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm() }}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        showCloseButton={false}
        className={cn(
          'p-0 gap-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[90dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[480px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        {/* Glass header — match feedback dialog design language */}
        <SheetHeader className={cn('px-6 pb-3 border-b border-border/40 shrink-0', isMobile ? 'pt-8' : 'pt-6')}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="flex items-center gap-2 text-base">
                <UserPlus className="h-5 w-5" />
                {dialogMode === 'referenciar' ? 'Referenciar Lead' : 'Registar Lead'}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Adiciona um lead à base de contactos
              </SheetDescription>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Popover open={aiOpen} onOpenChange={setAiOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant={isRecording ? 'destructive' : 'outline'}
                    size="sm"
                    className={cn('rounded-full h-8 text-xs gap-1.5', isRecording && 'animate-pulse')}
                  >
                    {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isRecording ? <MicOff className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">{isRecording ? 'A gravar' : isProcessing ? 'A processar' : 'Preencher com IA'}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" sideOffset={8} className="w-72 rounded-xl p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    {isRecording ? (
                      <Button type="button" variant="destructive" size="sm" className="rounded-full gap-2 h-7 text-xs" onClick={() => { stopRecording(); setAiOpen(false) }}>
                        <MicOff className="h-3 w-3" />
                        <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" /></span>
                        Parar
                      </Button>
                    ) : (
                      <Button type="button" variant="outline" size="sm" className="rounded-full gap-1.5 h-7 text-xs" disabled={isProcessing} onClick={() => { startRecording(); setAiOpen(false) }}>
                        <Mic className="h-3 w-3" /> Gravar
                      </Button>
                    )}
                    {isProcessing && <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> A processar...</span>}
                  </div>
                  <Textarea placeholder="Cole texto com dados do lead..." rows={3} className="text-xs resize-none rounded-lg" value={aiText} onChange={(e) => setAiText(e.target.value)} />
                  <Button type="button" size="sm" className="rounded-full text-xs gap-1.5 w-full h-7" disabled={isProcessing || !aiText.trim()} onClick={() => extractFromText(aiText)}>
                    <Sparkles className="h-3 w-3" /> Extrair dados
                  </Button>
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Fechar</span>
              </Button>
            </div>
          </div>
          {/* Pill tabs — Criar / Referenciar */}
          <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-muted/50 p-1 w-full sm:w-auto">
            {([
              { key: 'criar' as const, label: 'Criar Lead' },
              { key: 'referenciar' as const, label: 'Referenciar Lead' },
            ]).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setDialogMode(tab.key)}
                className={cn(
                  'inline-flex items-center justify-center rounded-full px-3 py-1.5 text-[12px] font-medium transition-all flex-1 sm:flex-none',
                  dialogMode === tab.key
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </SheetHeader>

        {/* Form body — sections wrapped in white cards */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-3">
          {/* Card 1 — Referenciação details (only in referenciar mode) */}
          {dialogMode === 'referenciar' && (
            <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-4 space-y-3">
              <div>
                <Label className="text-[11px] text-muted-foreground font-medium">Referência (%)</Label>
                <div className="relative mt-1">
                  <Input type="number" placeholder="25" value={form.referral_pct} onChange={(e) => setForm((p) => ({ ...p, referral_pct: e.target.value }))} className="rounded-lg pr-8 h-9" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground font-medium">Para quem é o lead</Label>
                <Select value={form.referral_consultant_id || ''} onValueChange={(v) => setForm((p) => ({ ...p, referral_consultant_id: v }))}>
                  <SelectTrigger className="rounded-lg mt-1 h-9 text-xs"><SelectValue placeholder="Seleccionar consultor..." /></SelectTrigger>
                  <SelectContent>{consultantsList.map((c) => (<SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Card 2 — Categoria (Área + Tipo de Lead + Origem) + específicos */}
          <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-4 space-y-4">
            {/* ── Área ── */}
            {!realEstateOnly && (
              <div>
                <Label className="text-[11px] text-muted-foreground font-medium">Área</Label>
                <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                  {TOP_CATEGORIES.map((cat) => {
                    const isActive = category === cat.value
                    return (
                      <button key={cat.value} type="button" onClick={() => { setCategory(cat.value); setForm((p) => ({ ...p, sector: '' })) }}
                        className={cn('rounded-lg py-2 text-[11px] font-medium transition-all text-center flex items-center justify-center gap-1.5', isActive ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-muted/50 text-muted-foreground hover:bg-muted')}>
                        <cat.icon className="h-3.5 w-3.5" />
                        {cat.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Tipo de Negócio (Imobiliário) ── */}
            {category === 'imobiliario' && (
              <div>
                <Label className="text-[11px] text-muted-foreground font-medium">Tipo de Negócio</Label>
                <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                  {BUSINESS_TYPE_OPTIONS.map((t) => {
                    const isActive = form.business_type === t.value
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => {
                          if (isActive) {
                            setForm((p) => ({ ...p, business_type: '', sector: '' }))
                            return
                          }
                          const allowed = SECTORS_BY_BT[t.value] ?? []
                          setForm((p) => ({
                            ...p,
                            business_type: t.value,
                            sector: allowed.includes(p.sector) ? p.sector : '',
                          }))
                        }}
                        className={cn(
                          'rounded-lg py-2 text-[11px] font-medium transition-all text-center',
                          isActive ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {t.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Tipo de Lead (Imobiliário) ── */}
            {category === 'imobiliario' && (
              <div className={cn(!form.business_type && 'opacity-50 pointer-events-none')}>
                <Label className="text-[11px] text-muted-foreground font-medium">Perspectiva</Label>
                <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                  {IMOB_SECTORS
                    .filter((opt) => !form.business_type || (SECTORS_BY_BT[form.business_type] ?? []).includes(opt.value))
                    .map((opt) => {
                      const isActive = form.sector === opt.value
                      return (
                        <button key={opt.value} type="button" onClick={() => setForm((p) => ({ ...p, sector: isActive ? '' : opt.value }))}
                          className={cn('rounded-lg py-1.5 text-[11px] font-medium transition-all text-center', isActive ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-muted/50 text-muted-foreground hover:bg-muted')}>
                          {opt.label}
                        </button>
                      )
                    })}
                </div>
              </div>
            )}

            {/* ── Origem ── */}
            <div>
              <Label className="text-[11px] text-muted-foreground font-medium">Origem</Label>
              <Select value={form.source} onValueChange={(v) => setForm((p) => ({ ...p, source: v }))}>
                <SelectTrigger className="rounded-lg mt-1 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{SOURCE_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>

            {/* ── Recruitment-specific ── */}
            {category === 'recrutamento' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Experiência imobiliária?</span>
                  <Switch checked={form.has_experience} onCheckedChange={(v) => setForm((p) => ({ ...p, has_experience: v }))} />
                </div>
                {form.has_experience && (
                  <div>
                    <Label className="text-[11px] text-muted-foreground font-medium">Agência anterior</Label>
                    <Input placeholder="Nome da agência" value={form.previous_agency} onChange={(e) => setForm((p) => ({ ...p, previous_agency: e.target.value }))} className="rounded-lg mt-1 h-9" />
                  </div>
                )}
              </div>
            )}

            {/* ── Credit-specific ── */}
            {category === 'credito' && (
              <div>
                <Label className="text-[11px] text-muted-foreground font-medium">Finalidade</Label>
                <Select value={form.credit_purpose} onValueChange={(v) => setForm((p) => ({ ...p, credit_purpose: v }))}>
                  <SelectTrigger className="rounded-lg mt-1 h-9 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="habitacao_propria_permanente">Habitação Própria Permanente</SelectItem>
                    <SelectItem value="habitacao_propria_secundaria">Habitação Secundária</SelectItem>
                    <SelectItem value="investimento">Investimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {/* /Card 2 */}

          {/* Card 3 — Imóvel relacionado + Para quem (criar mode) */}
          {dialogMode === 'criar' && (
            <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-4 space-y-4">
              {/* Imóvel relacionado FIRST (apenas imobiliário) */}
              {category === 'imobiliario' && (
                <div>
                  <Label className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    Imóvel relacionado <span className="text-muted-foreground/60 font-normal">(opcional)</span>
                  </Label>
                  {form.property_id ? (
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-1.5 mt-1 h-9">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs truncate flex-1">{form.property_label}</span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => setForm((p) => ({ ...p, property_id: '', property_label: '' }))}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <Popover open={propPopoverOpen} onOpenChange={setPropPopoverOpen}>
                      <PopoverAnchor asChild>
                        <div className="relative mt-1">
                          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          {isPropLoading && (
                            <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                          )}
                          <Input
                            value={propQuery}
                            onChange={(e) => { setPropQuery(e.target.value); setHasPropTyped(true) }}
                            onFocus={() => propResults.length > 0 && setPropPopoverOpen(true)}
                            placeholder="Pesquisar por referência ou título..."
                            autoComplete="off"
                            className="rounded-lg h-9 pl-8 text-xs"
                          />
                        </div>
                      </PopoverAnchor>
                      <PopoverContent
                        className="w-[var(--radix-popover-trigger-width)] p-0"
                        sideOffset={4}
                        align="start"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                        onCloseAutoFocus={(e) => e.preventDefault()}
                      >
                        <Command shouldFilter={false}>
                          <CommandList>
                            <CommandEmpty className="py-3 text-xs text-center text-muted-foreground">
                              {isPropLoading ? 'A pesquisar...' : 'Sem resultados.'}
                            </CommandEmpty>
                            <CommandGroup>
                              {propResults.map((p) => (
                                <CommandItem
                                  key={p.id}
                                  value={p.id}
                                  onSelect={() => {
                                    const label = [p.external_ref, p.title].filter(Boolean).join(' — ')
                                    setForm((prev) => ({ ...prev, property_id: p.id, property_label: label }))
                                    setPropQuery('')
                                    setHasPropTyped(false)
                                    setPropResults([])
                                    setPropPopoverOpen(false)
                                  }}
                                  className="cursor-pointer gap-2"
                                >
                                  <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-xs truncate font-medium">
                                      {p.external_ref ? `${p.external_ref} — ${p.title}` : p.title}
                                    </span>
                                    {p.city && (<span className="text-[10px] text-muted-foreground truncate">{p.city}</span>)}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              )}

              {/* Para quem — default = utilizador actual */}
              <div>
                <Label className="text-[11px] text-muted-foreground font-medium">Para quem</Label>
                <Select
                  value={form.assigned_consultant_id || '_auto'}
                  onValueChange={(v) => setForm((p) => ({ ...p, assigned_consultant_id: v === '_auto' ? '' : v }))}
                >
                  <SelectTrigger className="rounded-lg mt-1 h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_auto">Automático (via regras)</SelectItem>
                    {consultantsList.map((c) => (<SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {/* /Card 3 */}

          {/* Card 4 — Identidade (Nome, Email, Telefone, Notas) */}
          <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-4 space-y-4">
            <div>
              <Label className="text-[11px] text-muted-foreground font-medium">Nome *</Label>
              <Input placeholder="Nome completo" value={form.raw_name} onChange={(e) => setForm((p) => ({ ...p, raw_name: e.target.value }))} className="rounded-lg mt-1 h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground font-medium">Email</Label>
                <Input type="email" placeholder="email@exemplo.pt" value={form.raw_email} onChange={(e) => setForm((p) => ({ ...p, raw_email: e.target.value }))} className="rounded-lg mt-1 h-9" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground font-medium">Telefone</Label>
                <Input placeholder="+351 912 345 678" value={form.raw_phone} onChange={(e) => setForm((p) => ({ ...p, raw_phone: e.target.value }))} className="rounded-lg mt-1 h-9" />
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground font-medium">Notas</Label>
              <Textarea rows={2} placeholder="Observações..." value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="rounded-lg mt-1 text-xs" />
            </div>
          </div>
          {/* /Card 4 */}

          {/* Card 4 — Referenciação opcional (criar + imobiliário only) */}
          {dialogMode === 'criar' && category === 'imobiliario' && (
            <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Tem referenciação?</span>
                <Switch checked={form.has_referral} onCheckedChange={(v) => setForm((p) => ({ ...p, has_referral: v }))} />
              </div>
              {form.has_referral && (
                <div className="space-y-3 pt-1">
                  <div>
                    <Label className="text-[11px] text-muted-foreground font-medium">Percentagem</Label>
                    <div className="relative mt-1">
                      <Input type="number" placeholder="25" value={form.referral_pct} onChange={(e) => setForm((p) => ({ ...p, referral_pct: e.target.value }))} className="rounded-lg pr-8 h-9" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground font-medium">Referenciado por</Label>
                    <Select value={form.referral_consultant_id || '_none'} onValueChange={(v) => setForm((p) => ({ ...p, referral_consultant_id: v === '_none' ? '' : v }))}>
                      <SelectTrigger className="rounded-lg mt-1 h-9 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Pessoa externa</SelectItem>
                        {consultantsList.map((c) => (<SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  {!form.referral_consultant_id && (
                    <div className="space-y-2">
                      <Input placeholder="Nome do referenciador" value={form.referral_external_name} onChange={(e) => setForm((p) => ({ ...p, referral_external_name: e.target.value }))} className="rounded-lg h-9" />
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Telefone" value={form.referral_external_phone} onChange={(e) => setForm((p) => ({ ...p, referral_external_phone: e.target.value }))} className="rounded-lg h-9" />
                        <Input placeholder="Email" value={form.referral_external_email} onChange={(e) => setForm((p) => ({ ...p, referral_external_email: e.target.value }))} className="rounded-lg h-9" />
                      </div>
                      <Input placeholder="Agência (se aplicável)" value={form.referral_external_agency} onChange={(e) => setForm((p) => ({ ...p, referral_external_agency: e.target.value }))} className="rounded-lg h-9" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer translúcido */}
        <div className="shrink-0 border-t border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md px-6 py-3 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleCreate} disabled={creating} className="min-w-[120px]">
            {creating && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {dialogMode === 'referenciar' ? 'Referenciar' : 'Registar'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
