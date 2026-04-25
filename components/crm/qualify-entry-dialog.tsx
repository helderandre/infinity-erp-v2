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
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import {
  Loader2, Sparkles, ArrowRight, History, Mic, MicOff, Phone, Mail,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'

interface QualifyEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: any | null
  pipelineType?: string
  targetStageId?: string
  onQualified?: () => void
}

const SECTOR_TO_PIPELINE: Record<string, string> = {
  real_estate_buy: 'comprador',
  real_estate_sell: 'vendedor',
  real_estate_rent: 'arrendatario',
  real_estate_landlord: 'arrendador',
}

const PIPELINE_TO_TIPO: Record<string, string[]> = {
  comprador: ['Compra'],
  vendedor: ['Venda'],
  arrendatario: ['Arrendatário'],
  arrendador: ['Arrendador'],
}

const TIPO_LABELS: Record<string, string> = {
  Compra: 'Compra',
  Venda: 'Venda',
  'Compra e Venda': 'Compra e Venda',
  'Arrendatário': 'Arrendamento (procura)',
  'Arrendador': 'Arrendamento (proprietário)',
}

const PROPERTY_TYPES = [
  'Apartamento', 'Moradia', 'Quinta', 'Prédio',
  'Comércio', 'Garagem', 'Terreno Urbano', 'Terreno Rústico',
]

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
}: QualifyEntryDialogProps) {
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

  const detectedPipeline = entry?.sector ? SECTOR_TO_PIPELINE[entry.sector] : null
  const pipelineType = pipelineTypeProp || detectedPipeline || 'comprador'

  const defaultTipo = PIPELINE_TO_TIPO[pipelineType]?.[0] || 'Compra'
  const [form, setForm] = useState({
    tipo: defaultTipo,
    tipo_imovel: '',
    localizacao: '',
    quartos_min: '',
    orcamento: '',
    orcamento_max: '',
    observacoes: '',
  })

  useEffect(() => {
    if (entry) {
      const pt = entry.sector ? SECTOR_TO_PIPELINE[entry.sector] : pipelineType
      setForm({
        tipo: PIPELINE_TO_TIPO[pt || pipelineType]?.[0] || 'Compra',
        tipo_imovel: '',
        localizacao: '',
        quartos_min: '',
        orcamento: '',
        orcamento_max: '',
        observacoes: entry.notes || '',
      })
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

  const handleSubmit = async () => {
    if (!contactId) {
      toast.error('Contacto não encontrado')
      return
    }

    setSubmitting(true)
    try {
      const stageId = targetStageId || stages[0]?.id
      if (!stageId) {
        toast.error('Fase de pipeline não encontrada')
        return
      }

      const payload: Record<string, any> = {
        lead_id: contactId,
        entry_id: entry.id,
        tipo: form.tipo,
        pipeline_stage_id: stageId,
        assigned_consultant_id: entry.assigned_consultant?.id || contact?.agent_id || null,
        observacoes: form.observacoes || null,
      }

      if (form.tipo_imovel) payload.tipo_imovel = form.tipo_imovel
      if (form.localizacao) payload.localizacao = form.localizacao
      if (form.quartos_min) payload.quartos_min = parseInt(form.quartos_min)

      // Map the generic "orçamento" field onto the semantically correct
      // column for each pipeline. expected_value is always set so the kanban
      // forecast totals work regardless.
      const orcVal = form.orcamento ? parseFloat(form.orcamento) : null
      const orcMaxVal = form.orcamento_max ? parseFloat(form.orcamento_max) : null
      if (orcVal !== null) {
        payload.expected_value = orcVal
        payload.orcamento = orcVal
        if (pipelineType === 'vendedor') payload.preco_venda = orcVal
        else if (pipelineType === 'arrendador') payload.renda_pretendida = orcVal
        else if (pipelineType === 'arrendatario') payload.renda_max_mensal = orcVal
      }
      if (orcMaxVal !== null) {
        payload.orcamento_max = orcMaxVal
        if (pipelineType === 'arrendatario') payload.renda_max_mensal = orcMaxVal
      }

      const res = await fetch('/api/crm/negocios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao qualificar')
      }

      await fetch(`/api/lead-entries/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'converted' }),
      }).catch(() => {})

      toast.success('Lead qualificado — negócio criado no pipeline')
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

          {/* Deal type */}
          <div>
            <Label className="text-[11px] text-muted-foreground font-medium">Tipo de Negócio</Label>
            <div className="grid grid-cols-4 gap-1.5 mt-1.5">
              {[
                { key: 'Compra', label: 'Compra' },
                { key: 'Venda', label: 'Venda' },
                { key: 'Arrendatário', label: 'Arrendatário' },
                { key: 'Arrendador', label: 'Senhorio' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, tipo: t.key }))}
                  className={cn(
                    'rounded-lg py-2 text-[11px] font-medium transition-all text-center',
                    form.tipo === t.key
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Property type */}
          <div>
            <Label className="text-[11px] text-muted-foreground font-medium">Tipo de Imóvel</Label>
            <Select value={form.tipo_imovel || '_none'} onValueChange={(v) => setForm((p) => ({ ...p, tipo_imovel: v === '_none' ? '' : v }))}>
              <SelectTrigger className="rounded-lg mt-1 h-9 text-xs">
                <SelectValue placeholder="Qualquer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Qualquer</SelectItem>
                {PROPERTY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            Qualificar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
