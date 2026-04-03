// @ts-nocheck
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  Mic, MicOff, Loader2, Sparkles, Handshake, Building2, UserPlus, Landmark,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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

const TOP_CATEGORIES: { value: TopCategory; label: string; icon: React.ElementType }[] = [
  { value: 'imobiliario', label: 'Imobiliário', icon: Building2 },
  { value: 'recrutamento', label: 'Recrutamento', icon: UserPlus },
  { value: 'credito', label: 'Crédito', icon: Landmark },
]

// ─── Component ──────────────────────────────────────────────────

export function LeadEntryDialog({ open, onOpenChange, onComplete, realEstateOnly }: LeadEntryDialogProps) {
  const [dialogMode, setDialogMode] = useState<DialogMode>('criar')
  const [category, setCategory] = useState<TopCategory>('imobiliario')
  const [creating, setCreating] = useState(false)
  const [consultantsList, setConsultantsList] = useState<{ id: string; commercial_name: string }[]>([])

  const [form, setForm] = useState({
    raw_name: '', raw_email: '', raw_phone: '', source: 'other', notes: '',
    sector: '',
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

  useEffect(() => {
    if (open) {
      fetch('/api/consultants?limit=100')
        .then((r) => r.json())
        .then((d) => setConsultantsList((d.data || d || []).map((c: any) => ({ id: c.id, commercial_name: c.commercial_name }))))
        .catch(() => {})
    }
  }, [open])

  const resetForm = () => {
    setForm({
      raw_name: '', raw_email: '', raw_phone: '', source: 'other', notes: '', sector: '',
      has_referral: false, referral_pct: '25', referral_consultant_id: '',
      referral_external_name: '', referral_external_phone: '', referral_external_email: '', referral_external_agency: '',
      has_experience: false, previous_agency: '', credit_purpose: '',
    })
    setDialogMode('criar')
    setCategory('imobiliario')
    setAiText('')
  }

  // ── AI: voice + text ──────────────────────────────────────────

  const applyExtracted = (ext: Record<string, any>) => {
    setForm((p) => ({
      ...p,
      raw_name: ext.name || p.raw_name,
      raw_email: ext.email || p.raw_email,
      raw_phone: ext.phone || p.raw_phone,
      notes: ext.notes ? (p.notes ? p.notes + '\n' + ext.notes : ext.notes) : p.notes,
    }))
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
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm() }}>
      <DialogContent className="sm:max-w-md !rounded-2xl !p-0 !gap-0 !ring-0 overflow-hidden" showCloseButton={false}>
        <VisuallyHidden><DialogTitle>Registar Lead</DialogTitle></VisuallyHidden>
        {/* Dark header: tabs + AI button */}
        <div className="bg-neutral-900 rounded-t-2xl px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 p-0.5 rounded-full bg-white/10">
              {([
                { key: 'criar' as const, label: 'Criar Lead' },
                { key: 'referenciar' as const, label: 'Referenciar Lead' },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setDialogMode(tab.key)}
                  className={cn(
                    'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all',
                    dialogMode === tab.key ? 'bg-white text-neutral-900 shadow-sm' : 'text-white/60 hover:text-white'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <Popover open={aiOpen} onOpenChange={setAiOpen}>
              <PopoverTrigger asChild>
                <button className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center transition-colors',
                  isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white/10 border border-white/15 text-white/60 hover:text-white hover:bg-white/15',
                  isProcessing && 'bg-white/10 text-white/60'
                )}>
                  {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isRecording ? <MicOff className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                </button>
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
          </div>
          {isRecording && (
            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />A gravar...
            </div>
          )}
        </div>

        {/* Form body */}
        <div className="px-5 pt-4 pb-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* ── REFERENCIAR: referral details first ── */}
          {dialogMode === 'referenciar' && (
            <div className="space-y-3">
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

          {/* ── Top category: Imobiliário / Recrutamento / Crédito ── */}
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

          {/* ── Imobiliário sub-type ── */}
          {category === 'imobiliario' && (
            <div>
              <Label className="text-[11px] text-muted-foreground font-medium">Tipo de Lead</Label>
              <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                {IMOB_SECTORS.map((opt) => {
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

          {/* ── Shared contact fields ── */}
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

          {/* ── Recruitment-specific fields ── */}
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

          {/* ── Credit-specific fields ── */}
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

          {/* ── Notes ── */}
          <div>
            <Label className="text-[11px] text-muted-foreground font-medium">Notas</Label>
            <Textarea rows={2} placeholder="Observações..." value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="rounded-lg mt-1 text-xs" />
          </div>

          {/* ── CRIAR: referral toggle (imobiliário only) ── */}
          {dialogMode === 'criar' && category === 'imobiliario' && (
            <>
              <div className="flex items-center justify-between pt-1">
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
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="rounded-full text-xs">Cancelar</Button>
          <Button size="sm" onClick={handleCreate} disabled={creating} className="rounded-full text-xs">
            {creating && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {dialogMode === 'referenciar' ? 'Referenciar' : 'Registar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
