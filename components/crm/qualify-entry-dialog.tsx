// @ts-nocheck
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { SelectWithOther } from '@/components/shared/select-with-other'
import { NEGOCIO_PROPERTY_TYPES } from '@/lib/constants'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import {
  Loader2, Sparkles, ArrowRight, History, Mic, MicOff, Phone, Mail, Home, Link2, Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { invalidateAfterQualify } from '@/lib/crm/invalidator'

interface QualifyEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: any | null
  pipelineType?: string
  targetStageId?: string
  onQualified?: () => void
  /**
   * Optional handler to open the generated opportunity. When provided, the
   * "Ver oportunidade" toast action calls it (e.g. to open the négocio sheet
   * in place) instead of navigating to the contact's négocio page.
   */
  onViewOpportunity?: (negocioId: string, leadId: string) => void
}

const SECTOR_TO_PIPELINE: Record<string, string> = {
  real_estate_buy: 'comprador',
  real_estate_sell: 'vendedor',
  real_estate_rent: 'arrendatario',
  real_estate_landlord: 'arrendador',
}

// Maps pipeline types to perspectives. After the 2026 split:
//   negocios.tipo holds the perspective only (Comprador/Vendedor/Arrendatário/Senhorio).
//   negocios.business_type holds the deal type (Venda/Arrendamento/Trespasse).
const PIPELINE_TO_TIPO: Record<string, string[]> = {
  comprador:    ['Comprador'],
  vendedor:     ['Vendedor'],
  arrendatario: ['Arrendatário'],
  arrendador:   ['Senhorio'],
}

const PIPELINE_TO_BUSINESS_TYPE: Record<string, 'Venda' | 'Arrendamento' | 'Trespasse'> = {
  comprador:    'Venda',
  vendedor:     'Venda',
  arrendatario: 'Arrendamento',
  arrendador:   'Arrendamento',
}

const TIPO_LABELS: Record<string, string> = {
  Comprador:    'Comprador',
  Vendedor:     'Vendedor',
  'Arrendatário': 'Arrendatário',
  Senhorio:     'Senhorio',
}


// Internal/plumbing keys in form_data we don't feed to the extractor.
const HIDDEN_FORM_KEYS = new Set([
  'leadgen_id', 'form_id', 'meta_campaign_id', 'meta_adset_id', 'meta_ad_id',
  'property_id', 'property_external_ref', 'portal', 'raw_fields',
])

/** Flatten an entry's (unstructured, source-dependent) form_data into a plain
 *  text blob the cheap extractor can read. Handles Meta's `raw_fields` (object
 *  or array of {name, values}) and flat website/portal payloads. */
function buildFormDataText(formData: any, notes?: string | null): string {
  const lines: string[] = []
  const add = (k: string, v: any) => {
    if (v == null) return
    if (Array.isArray(v)) {
      const s = v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ')
      if (s) lines.push(`${k}: ${s}`)
      return
    }
    if (typeof v === 'object') return
    const s = String(v).trim()
    if (s) lines.push(`${k}: ${s}`)
  }
  if (formData && typeof formData === 'object') {
    const raw = formData.raw_fields
    if (Array.isArray(raw)) {
      for (const f of raw) {
        const name = f?.name ?? f?.field ?? f?.key
        const value = f?.values ?? f?.value
        if (name) add(String(name), value)
      }
    } else if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw)) add(k, v)
    }
    for (const [k, v] of Object.entries(formData)) {
      if (HIDDEN_FORM_KEYS.has(k)) continue
      add(k, v)
    }
  }
  if (notes) lines.push(`Notas: ${notes}`)
  return lines.join('\n').trim()
}

// comprador <-> vendedor, arrendatario <-> arrendador
const OPPOSITE_PIPELINE: Record<string, string> = {
  comprador: 'vendedor',
  vendedor: 'comprador',
  arrendatario: 'arrendador',
  arrendador: 'arrendatario',
}

/** Detects the Meta/portal "a compra depende da venda?" question being
 *  answered affirmatively, so we can offer to spawn the linked sale deal. */
function detectCompraDependeVenda(formData: any): boolean {
  if (!formData || typeof formData !== 'object') return false
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const affirmative = (v: any) => {
    const s = norm(String(Array.isArray(v) ? v.join(' ') : v ?? '')).trim()
    return /\b(sim|yes|true|verdadeiro)\b/.test(s) || s === 's' || s === '1'
  }
  const pairs: Array<[string, any]> = []
  const raw = formData.raw_fields
  if (Array.isArray(raw)) {
    for (const f of raw) { const k = f?.name ?? f?.field ?? f?.key; if (k) pairs.push([String(k), f?.values ?? f?.value]) }
  } else if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) pairs.push([k, v])
  }
  for (const [k, v] of Object.entries(formData)) pairs.push([k, v])
  for (const [k, v] of pairs) {
    const key = norm(k)
    if (key.includes('depende') && (key.includes('venda') || key.includes('vender')) && affirmative(v)) return true
    if (key.replace(/[^a-z]/g, '').includes('compradepende') && affirmative(v)) return true
  }
  return false
}

const SOURCE_CONFIG: Record<string, { label: string; class: string }> = {
  meta_ads: { label: 'Meta Ads', class: 'bg-blue-500/10 text-blue-600' },
  google_ads: { label: 'Google Ads', class: 'bg-red-500/10 text-red-600' },
  website: { label: 'Website', class: 'bg-emerald-500/10 text-emerald-600' },
  landing_page: { label: 'Landing Page', class: 'bg-indigo-500/10 text-indigo-600' },
  partner: { label: 'Parceiro', class: 'bg-amber-500/10 text-amber-600' },
  organic: { label: 'Orgânico', class: 'bg-green-500/10 text-green-600' },
  walk_in: { label: 'Presencial', class: 'bg-orange-500/10 text-orange-600' },
  phone_call: { label: 'Chamada', class: 'bg-cyan-500/10 text-cyan-600' },
  social_media: { label: 'Redes Sociais', class: 'bg-pink-500/10 text-pink-600' },
  other: { label: 'Outro', class: 'bg-gray-500/10 text-gray-600' },
}

export function QualifyEntryDialog({
  open,
  onOpenChange,
  entry,
  pipelineType: pipelineTypeProp,
  targetStageId,
  onQualified,
  onViewOpportunity,
}: QualifyEntryDialogProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [stages, setStages] = useState<any[]>([])
  const [contactHistory, setContactHistory] = useState<any[] | null>(null)

  // AI
  const [aiOpen, setAiOpen] = useState(false)
  const [aiText, setAiText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  // Tracks the entry whose form_data we already auto-extracted, so the AI
  // pre-fill runs at most once per entry.
  const prefilledEntryRef = useRef<string | null>(null)

  const detectedPipeline = entry?.sector ? SECTOR_TO_PIPELINE[entry.sector] : null
  const pipelineType = pipelineTypeProp || detectedPipeline || 'comprador'

  const defaultTipo = PIPELINE_TO_TIPO[pipelineType]?.[0] || 'Comprador'
  // Se a entry foi criada com business_type explícito (UI nova), respeita-o.
  // Caso contrário, deriva do pipeline detectado.
  const entryBT = (entry as { business_type?: string } | null)?.business_type
  const defaultBT = (entryBT === 'Venda' || entryBT === 'Arrendamento' || entryBT === 'Trespasse')
    ? entryBT
    : (PIPELINE_TO_BUSINESS_TYPE[pipelineType] || 'Venda')
  const [form, setForm] = useState({
    business_type: defaultBT as 'Venda' | 'Arrendamento' | 'Trespasse',
    tipo: defaultTipo,
    tipo_imovel: '',
    localizacao: '',
    quartos_min: '',
    orcamento: '',
    orcamento_max: '',
    observacoes: '',
  })

  // Linked opportunity ("compra depende da venda"): when on, a second négocio
  // for the opposite side is created and tied to this one via a shared group.
  const [linkedEnabled, setLinkedEnabled] = useState(false)
  const [linkedForm, setLinkedForm] = useState({
    localizacao: '',
    tipo_imovel: '',
    valor: '',
    quartos_min: '',
    observacoes: '',
  })

  useEffect(() => {
    if (entry) {
      const pt = entry.sector ? SECTOR_TO_PIPELINE[entry.sector] : pipelineType
      const bt = (entry as { business_type?: string }).business_type
      const resolvedBT: 'Venda' | 'Arrendamento' | 'Trespasse' =
        bt === 'Venda' || bt === 'Arrendamento' || bt === 'Trespasse'
          ? bt
          : (PIPELINE_TO_BUSINESS_TYPE[pt || pipelineType] || 'Venda')
      setForm({
        business_type: resolvedBT,
        tipo: PIPELINE_TO_TIPO[pt || pipelineType]?.[0] || 'Comprador',
        tipo_imovel: '',
        localizacao: '',
        quartos_min: '',
        orcamento: '',
        orcamento_max: '',
        observacoes: entry.notes || '',
      })
      setLinkedForm({ localizacao: '', tipo_imovel: '', valor: '', quartos_min: '', observacoes: '' })
      // Pre-arm the linked sale deal when the form said the purchase depends on
      // a sale. Only meaningful for sale-type business (not arrendamento).
      setLinkedEnabled(
        resolvedBT === 'Venda' && detectCompraDependeVenda((entry as { form_data?: any }).form_data),
      )
      setContactHistory(null)
      setAiText('')
    }
  }, [entry, pipelineType])

  useEffect(() => {
    if (!open) return
    fetch(`/api/crm/pipeline-stages?pipeline_type=${pipelineType}`)
      .then((r) => r.json())
      .then((data) => {
        const stageList = (data.data || data || [])
          .filter((s: any) => !s.is_terminal)
          .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
        setStages(stageList)
      })
      .catch(() => {})
  }, [open, pipelineType])

  useEffect(() => {
    if (!open || !entry) return
    const contactId = entry.contact?.id || entry.contact_id
    if (!contactId) return
    fetch(`/api/lead-entries?contact_id=${contactId}&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        const otherEntries = (data.data || []).filter((e: any) => e.id !== entry.id)
        setContactHistory(otherEntries.length > 0 ? otherEntries : null)
      })
      .catch(() => {})
  }, [open, entry])

  // ── AI: voice + text ──────────────────────────────────────────

  const applyExtracted = (fields: Record<string, any>) => {
    setForm((p) => ({
      ...p,
      localizacao: fields.localizacao || fields.zona || p.localizacao,
      quartos_min: fields.quartos_min ? String(fields.quartos_min) : (fields.quartos ? String(fields.quartos) : p.quartos_min),
      orcamento: fields.orcamento ? String(fields.orcamento) : p.orcamento,
      orcamento_max: fields.orcamento_max ? String(fields.orcamento_max) : p.orcamento_max,
      tipo_imovel: fields.tipo_imovel || p.tipo_imovel,
      observacoes: fields.observacoes ? (p.observacoes ? p.observacoes + '\n' + fields.observacoes : fields.observacoes) : p.observacoes,
    }))
  }

  // ── AI: auto pre-fill from the entry's original form ──────────────
  // Forms vary by source (Meta Ads / portal / website) and aren't structured,
  // so a cheap extraction pass beats making the consultant re-type location /
  // budget / property type that the lead already gave. Runs once per entry on
  // open; only fills fields the consultant hasn't touched (applyExtracted keeps
  // existing values), never the perspective/business_type (sector-derived).
  useEffect(() => {
    if (!open || !entry?.id) return
    if (prefilledEntryRef.current === entry.id) return
    prefilledEntryRef.current = entry.id
    const text = buildFormDataText(entry.form_data, entry.notes)
    if (!text) return
    setIsProcessing(true)
    fetch('/api/leads/extract-from-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.fields) applyExtracted(d.fields) })
      .catch(() => {})
      .finally(() => setIsProcessing(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?.id])

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
          if (data.extracted) applyExtracted(data.extracted)
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
      applyExtracted(fields)
      toast.success('Dados extraídos')
      setAiOpen(false)
    } catch { toast.error('Erro ao extrair dados') }
    finally { setIsProcessing(false) }
  }

  const contact = entry?.contact
  const contactId = contact?.id || entry?.contact_id
  const contactName = contact?.nome || entry?.raw_name || '—'
  const contactPhone = contact?.telemovel || entry?.raw_phone
  const contactEmail = contact?.email || entry?.raw_email

  // Whether the "compra depende da venda" linked deal is applicable + active.
  const linkedApplicable = form.business_type === 'Venda'
    && (pipelineType === 'comprador' || pipelineType === 'vendedor')
  const linkedActive = linkedApplicable && linkedEnabled

  // Maps a side's generic value onto the semantically correct négocio columns.
  const buildPayload = (opts: {
    tipo: string; business_type: string; pipeline: string; stageId: string
    localizacao?: string; tipo_imovel?: string; valor?: string; valorMax?: string
    quartos?: string; observacoes?: string
  }) => {
    const p: Record<string, any> = {
      lead_id: contactId,
      entry_id: entry.id,
      business_type: opts.business_type,
      tipo: opts.tipo,
      pipeline_stage_id: opts.stageId,
      assigned_consultant_id: entry.assigned_consultant?.id || contact?.agent_id || null,
      observacoes: opts.observacoes || null,
    }
    if (opts.tipo_imovel) p.tipo_imovel = opts.tipo_imovel
    if (opts.localizacao) p.localizacao = opts.localizacao
    if (opts.quartos) p.quartos_min = parseInt(opts.quartos)
    const v = opts.valor ? parseFloat(opts.valor) : null
    const vMax = opts.valorMax ? parseFloat(opts.valorMax) : null
    if (v !== null && Number.isFinite(v)) {
      p.expected_value = v
      p.orcamento = v
      if (opts.pipeline === 'vendedor') p.preco_venda = v
      else if (opts.pipeline === 'arrendador') p.renda_pretendida = v
      else if (opts.pipeline === 'arrendatario') p.renda_max_mensal = v
    }
    if (vMax !== null && Number.isFinite(vMax)) {
      p.orcamento_max = vMax
      if (opts.pipeline === 'arrendatario') p.renda_max_mensal = vMax
    }
    return p
  }

  const postNegocio = async (payload: Record<string, any>) => {
    const res = await fetch('/api/crm/negocios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      throw new Error(e.error || 'Erro ao criar negócio')
    }
    return res.json()
  }

  const handleSubmit = async () => {
    if (!contactId) {
      toast.error('Contacto não encontrado')
      return
    }

    // Mandatory négocio fields — same rule as the CRM "Novo negócio" dialog.
    if (!form.localizacao.trim()) {
      toast.error('Localização é obrigatória')
      return
    }
    const orcMin = parseFloat(form.orcamento)
    const orcMax = parseFloat(form.orcamento_max)
    const isBuyerLike = pipelineType === 'comprador'
    if (!form.orcamento || !Number.isFinite(orcMin) || orcMin <= 0) {
      toast.error(isBuyerLike ? 'Orçamento mínimo é obrigatório' : 'Valor é obrigatório')
      return
    }
    if (isBuyerLike) {
      if (!form.orcamento_max || !Number.isFinite(orcMax) || orcMax <= 0) {
        toast.error('Orçamento máximo é obrigatório')
        return
      }
      if (orcMax < orcMin) {
        toast.error('O máximo tem de ser ≥ ao mínimo')
        return
      }
    }

    // Linked deal validation.
    if (linkedActive) {
      if (!linkedForm.localizacao.trim()) {
        toast.error('Localização do negócio ligado é obrigatória')
        return
      }
      const lv = parseFloat(linkedForm.valor)
      if (!linkedForm.valor || !Number.isFinite(lv) || lv <= 0) {
        toast.error('Valor do negócio ligado é obrigatório')
        return
      }
    }

    setSubmitting(true)
    try {
      const stageId = targetStageId || stages[0]?.id
      if (!stageId) {
        toast.error('Fase de pipeline não encontrada')
        return
      }

      const primaryOpts = {
        tipo: form.tipo, business_type: form.business_type, pipeline: pipelineType, stageId,
        localizacao: form.localizacao, tipo_imovel: form.tipo_imovel,
        valor: form.orcamento, valorMax: form.orcamento_max, quartos: form.quartos_min,
        observacoes: form.observacoes,
      }

      let primaryNegocioId: string | undefined

      if (!linkedActive) {
        // ── Single deal (today's behaviour) ──
        const created = await postNegocio(buildPayload(primaryOpts))
        primaryNegocioId = created?.id
      } else {
        // ── Two linked deals: a sale + a dependent purchase ──
        const secPipeline = OPPOSITE_PIPELINE[pipelineType] // comprador<->vendedor
        const secTipo = secPipeline === 'vendedor' ? 'Vendedor' : 'Comprador'
        const secStagesRaw = await fetch(`/api/crm/pipeline-stages?pipeline_type=${secPipeline}`)
          .then((r) => r.json()).catch(() => null)
        const secStageId = ((secStagesRaw?.data || secStagesRaw || []) as any[])
          .filter((s) => !s.is_terminal)
          .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))[0]?.id
        if (!secStageId) {
          toast.error('Fase do pipeline ligado não encontrada')
          return
        }
        const secondaryOpts = {
          tipo: secTipo, business_type: 'Venda', pipeline: secPipeline, stageId: secStageId,
          localizacao: linkedForm.localizacao, tipo_imovel: linkedForm.tipo_imovel,
          valor: linkedForm.valor,
          valorMax: secPipeline === 'comprador' ? linkedForm.valor : undefined,
          quartos: linkedForm.quartos_min, observacoes: linkedForm.observacoes,
        }

        // The purchase depends on the sale → create the sale first to point at.
        const groupId = crypto.randomUUID()
        const saleOpts = primaryOpts.pipeline === 'vendedor' ? primaryOpts : secondaryOpts
        const buyOpts = primaryOpts.pipeline === 'comprador' ? primaryOpts : secondaryOpts

        const sale = await postNegocio({ ...buildPayload(saleOpts), deal_group_id: groupId })
        const buy = await postNegocio({
          ...buildPayload(buyOpts),
          deal_group_id: groupId,
          depends_on_negocio_id: sale.id,
        })
        primaryNegocioId = pipelineType === 'vendedor' ? sale.id : buy.id
      }

      await fetch(`/api/lead-entries/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'converted' }),
      }).catch(() => {})

      // Deep-link to the generated opportunity so the consultant can keep
      // accompanying it — the qualified lead otherwise just disappears.
      const successMsg = linkedActive
        ? 'Lead qualificado — 2 negócios ligados criados'
        : 'Lead qualificado — negócio criado'
      if (primaryNegocioId) {
        toast.success(successMsg, {
          action: {
            label: 'Ver oportunidade',
            onClick: () =>
              onViewOpportunity
                ? onViewOpportunity(primaryNegocioId!, contactId)
                : router.push(`/dashboard/leads/${contactId}/negocios/${primaryNegocioId}`),
          },
        })
      } else {
        toast.success(successMsg)
      }
      // Invalida listas (kanban, lead-entries inbox, contactos, négocios)
      // — qualquer vista subscrita ao invalidator vai re-fetch silenciosa.
      // Ver lib/crm/invalidator.ts.
      invalidateAfterQualify()
      onOpenChange(false)
      onQualified?.()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao qualificar lead')
    } finally {
      setSubmitting(false)
    }
  }

  const isBuyer = pipelineType === 'comprador' || pipelineType === 'arrendatario'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md !rounded-2xl !p-0 !gap-0 !ring-0 overflow-hidden" showCloseButton={false}>
        <VisuallyHidden><DialogTitle>Qualificar Lead</DialogTitle></VisuallyHidden>

        {/* ─── Dark header ─── */}
        <div className="bg-neutral-900 rounded-t-2xl px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-white/50 text-[10px] font-medium tracking-widest uppercase">Qualificar</p>
              <p className="text-white font-semibold text-base truncate mt-0.5">{contactName}</p>
            </div>

            {/* AI popover */}
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
                <Textarea placeholder="Cole texto com o que o cliente procura..." rows={3} className="text-xs resize-none rounded-lg" value={aiText} onChange={(e) => setAiText(e.target.value)} />
                <Button type="button" size="sm" className="rounded-full text-xs gap-1.5 w-full h-7" disabled={isProcessing || !aiText.trim()} onClick={() => extractFromText(aiText)}>
                  <Sparkles className="h-3 w-3" /> Extrair dados
                </Button>
              </PopoverContent>
            </Popover>
          </div>

          {/* Contact chips */}
          <div className="flex items-center gap-2 mt-2.5">
            {contactPhone && (
              <span className="inline-flex items-center gap-1 text-[10px] text-white/50 bg-white/8 rounded-full px-2 py-0.5">
                <Phone className="h-2.5 w-2.5" />{contactPhone}
              </span>
            )}
            {contactEmail && (
              <span className="inline-flex items-center gap-1 text-[10px] text-white/50 bg-white/8 rounded-full px-2 py-0.5 truncate max-w-[180px]">
                <Mail className="h-2.5 w-2.5 shrink-0" />{contactEmail}
              </span>
            )}
            {entry?.has_referral && (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/15 rounded-full px-2 py-0.5">
                <Sparkles className="h-2.5 w-2.5" />Ref.{entry.referral_pct ? ` ${entry.referral_pct}%` : ''}
              </span>
            )}
            {(entry?.property_external_ref || entry?.property_id) && (() => {
              // The entry's property is only carried into the négocio for
              // buyer-side perspectives. For seller/landlord it stays mere
              // campaign attribution, so the chip says so to avoid implying a
              // wrong association.
              const buyerSide = form.tipo === 'Comprador' || form.tipo === 'Arrendatário'
              return (
                <span
                  className="inline-flex items-center gap-1 text-[10px] text-sky-300 bg-sky-500/15 rounded-full px-2 py-0.5 max-w-[200px]"
                  title={
                    buyerSide
                      ? 'Imóvel de origem deste lead — será associado ao negócio.'
                      : 'Anúncio de origem do lead — não associado a um negócio de venda.'
                  }
                >
                  <Home className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">
                    {buyerSide ? '' : 'Anúncio: '}{entry.property_external_ref || 'Imóvel'}
                  </span>
                </span>
              )
            })()}
          </div>

          {isRecording && (
            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />A gravar...
            </div>
          )}
        </div>

        {/* ─── Form body ─── */}
        <div className="px-5 pt-4 pb-5 space-y-4 max-h-[65vh] overflow-y-auto">

          {/* Contact history alert */}
          {contactHistory && contactHistory.length > 0 && (
            <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <History className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  Apareceu {contactHistory.length + 1}x anteriormente
                </p>
              </div>
              <div className="space-y-1 ml-5.5">
                {contactHistory.slice(0, 4).map((h: any) => {
                  const hSrc = SOURCE_CONFIG[h.source] || SOURCE_CONFIG.other
                  return (
                    <div key={h.id} className="flex items-center gap-1.5">
                      <span className={cn('inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium', hSrc.class)}>
                        {hSrc.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(h.created_at), 'MMM yyyy', { locale: pt })}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tipo de negócio (Step 1) */}
          <div>
            <Label className="text-[11px] text-muted-foreground font-medium">Tipo de negócio</Label>
            <div className="grid grid-cols-3 gap-1.5 mt-1.5">
              {(['Venda', 'Arrendamento', 'Trespasse'] as const).map((bt) => (
                <button
                  key={bt}
                  type="button"
                  onClick={() => {
                    // Switching business type → reset tipo if no longer compatible
                    const allowed = bt === 'Arrendamento'
                      ? ['Arrendatário', 'Senhorio']
                      : ['Comprador', 'Vendedor']
                    setForm((p) => ({
                      ...p,
                      business_type: bt,
                      tipo: allowed.includes(p.tipo) ? p.tipo : allowed[0],
                    }))
                  }}
                  className={cn(
                    'rounded-lg py-2 text-[11px] font-medium transition-all text-center',
                    form.business_type === bt
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                  )}
                >
                  {bt}
                </button>
              ))}
            </div>
          </div>

          {/* Perspectiva (Step 2) */}
          <div>
            <Label className="text-[11px] text-muted-foreground font-medium">Perspectiva</Label>
            <div className="grid grid-cols-2 gap-1.5 mt-1.5">
              {(form.business_type === 'Arrendamento'
                ? [{ key: 'Arrendatário' }, { key: 'Senhorio' }]
                : [{ key: 'Comprador' }, { key: 'Vendedor' }]
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, tipo: t.key }))}
                  className={cn(
                    'rounded-lg py-2 text-[11px] font-medium transition-all text-center',
                    form.tipo === t.key
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                  )}
                >
                  {t.key}
                </button>
              ))}
            </div>
          </div>

          {/* Property type */}
          <div>
            <Label className="text-[11px] text-muted-foreground font-medium">Tipo de Imóvel</Label>
            <div className="mt-1">
              <SelectWithOther
                scope="property_type"
                value={form.tipo_imovel || undefined}
                onChange={(v) => setForm((p) => ({ ...p, tipo_imovel: v }))}
                options={NEGOCIO_PROPERTY_TYPES.map((t) => ({ value: t, label: t }))}
                placeholder="Qualquer"
                triggerClassName="rounded-lg h-9 text-xs"
                inputClassName="rounded-lg h-9 text-xs"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <Label className="text-[11px] text-muted-foreground font-medium">Localização</Label>
            <Input
              placeholder="ex: Lisboa, Cascais, Sintra..."
              value={form.localizacao}
              onChange={(e) => setForm((p) => ({ ...p, localizacao: e.target.value }))}
              className="rounded-lg mt-1 h-9"
            />
          </div>

          {/* Bedrooms + Budget */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-[11px] text-muted-foreground font-medium">{isBuyer ? 'Quartos mín.' : 'Quartos'}</Label>
              <Input
                type="number"
                placeholder="ex: 2"
                value={form.quartos_min}
                onChange={(e) => setForm((p) => ({ ...p, quartos_min: e.target.value }))}
                className="rounded-lg mt-1 h-9"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground font-medium">{isBuyer ? 'Orç. mín. €' : 'Preço €'}</Label>
              <Input
                type="number"
                placeholder="200000"
                value={form.orcamento}
                onChange={(e) => setForm((p) => ({ ...p, orcamento: e.target.value }))}
                className="rounded-lg mt-1 h-9"
              />
            </div>
            {isBuyer && (
              <div>
                <Label className="text-[11px] text-muted-foreground font-medium">Orç. máx. €</Label>
                <Input
                  type="number"
                  placeholder="350000"
                  value={form.orcamento_max}
                  onChange={(e) => setForm((p) => ({ ...p, orcamento_max: e.target.value }))}
                  className="rounded-lg mt-1 h-9"
                />
              </div>
            )}
          </div>

          {/* Observations */}
          <div>
            <Label className="text-[11px] text-muted-foreground font-medium">Observações</Label>
            <Textarea
              rows={3}
              placeholder="Notas sobre o que o cliente procura, detalhes da chamada..."
              value={form.observacoes}
              onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
              className="rounded-lg mt-1 text-xs"
            />
          </div>

          {/* Compra depende de venda — spawn a linked deal for the other side. */}
          {linkedApplicable && (
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 space-y-3">
              <button
                type="button"
                onClick={() => setLinkedEnabled((v) => !v)}
                className="flex w-full items-start gap-2 text-left"
              >
                <span
                  className={cn(
                    'mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                    linkedEnabled ? 'bg-sky-600 border-sky-600 text-white' : 'border-muted-foreground/40',
                  )}
                >
                  {linkedEnabled && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[12px] font-medium">
                    <Link2 className="h-3.5 w-3.5 text-sky-600 shrink-0" /> Compra depende de venda
                  </span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5">
                    Cria também o negócio {pipelineType === 'comprador' ? 'de venda' : 'de compra'} e liga os dois.
                  </span>
                </span>
              </button>

              {linkedEnabled && (
                <div className="space-y-2.5 pt-0.5">
                  <p className="text-[10px] font-semibold text-sky-700 dark:text-sky-300 uppercase tracking-wide">
                    {pipelineType === 'comprador' ? 'Imóvel que o cliente vai vender' : 'Imóvel que o cliente quer comprar'}
                  </p>
                  <Input
                    placeholder="Localização"
                    value={linkedForm.localizacao}
                    onChange={(e) => setLinkedForm((p) => ({ ...p, localizacao: e.target.value }))}
                    className="rounded-lg h-9 text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      placeholder={pipelineType === 'comprador' ? 'Preço venda €' : 'Orçamento €'}
                      value={linkedForm.valor}
                      onChange={(e) => setLinkedForm((p) => ({ ...p, valor: e.target.value }))}
                      className="rounded-lg h-9 text-xs"
                    />
                    <Input
                      placeholder="Tipo (ex: T2)"
                      value={linkedForm.tipo_imovel}
                      onChange={(e) => setLinkedForm((p) => ({ ...p, tipo_imovel: e.target.value }))}
                      className="rounded-lg h-9 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div className="px-5 py-3 border-t flex items-center justify-between">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 shadow-sm transition-all duration-200 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
            {linkedActive ? 'Qualificar (2 negócios)' : 'Qualificar'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
