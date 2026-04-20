// @ts-nocheck
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import {
  Mic, MicOff, Loader2, Sparkles, ArrowDownLeft, ArrowUpRight,
  ShoppingCart, Store, Key, Building2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { cn } from '@/lib/utils'

interface LeadFormProps {
  consultants: { id: string; commercial_name: string }[]
  onSuccess?: (id: string) => void
  onCancel?: () => void
  initialValues?: {
    nome?: string
    email?: string
    telemovel?: string
    observacoes?: string
    negocio_tipo?: string
    tipo_imovel?: string
    localizacao?: string
    quartos_min?: string | number
    orcamento?: string | number
    orcamento_max?: string | number
  }
  /**
   * Transcript fed to the AI extractor in the background when the form mounts.
   * Extracted fields are applied silently — the AI panel is NOT opened and the
   * user doesn't see the raw text.
   */
  autoExtractText?: string
}

const LEAD_ORIGENS_OPTIONS = [
  'Website', 'Meta Ads', 'Google Ads', 'Landing Page', 'Referência',
  'Presencial', 'Chamada', 'Redes Sociais', 'Parceiro', 'Outro',
]

const NEGOCIO_TYPES = [
  { value: 'Compra', label: 'Comprador', icon: ShoppingCart },
  { value: 'Venda', label: 'Vendedor', icon: Store },
  { value: 'Arrendatário', label: 'Arrendatário', icon: Key },
  { value: 'Arrendador', label: 'Senhorio', icon: Building2 },
]

const PROPERTY_TYPES = [
  'Apartamento', 'Moradia', 'Quinta', 'Prédio',
  'Comércio', 'Garagem', 'Terreno Urbano', 'Terreno Rústico',
]

export function LeadForm({ consultants, onSuccess, onCancel, initialValues, autoExtractText }: LeadFormProps) {
  const router = useRouter()
  const { user } = useUser()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Contact fields
  const [form, setForm] = useState({
    nome: initialValues?.nome || '',
    email: initialValues?.email || '',
    telemovel: initialValues?.telemovel || '',
    origem: '',
    observacoes: initialValues?.observacoes || '',
    agent_id: user?.id || '',
  })

  // Track which fields were pre-filled from the caller so AI extraction
  // doesn't overwrite canonical data (e.g. the WhatsApp contact's phone).
  const lockedFieldsRef = useRef({
    telemovel: !!initialValues?.telemovel,
    email: !!initialValues?.email,
  })

  useEffect(() => {
    if (user?.id && !form.agent_id) setForm((p) => ({ ...p, agent_id: user.id }))
  }, [user?.id])

  // Negócio inline (required: at least tipo)
  const [negocioTipo, setNegocioTipo] = useState<string>(initialValues?.negocio_tipo || '')
  const [negocioFields, setNegocioFields] = useState({
    tipo_imovel: initialValues?.tipo_imovel || '',
    localizacao: initialValues?.localizacao || '',
    quartos_min: initialValues?.quartos_min !== undefined ? String(initialValues.quartos_min) : '',
    orcamento: initialValues?.orcamento !== undefined ? String(initialValues.orcamento) : '',
    orcamento_max: initialValues?.orcamento_max !== undefined ? String(initialValues.orcamento_max) : '',
  })

  // Referral
  const [referralDir, setReferralDir] = useState<null | 'incoming' | 'outgoing'>(null)
  const [referralConsultantId, setReferralConsultantId] = useState('')
  const [referralNotes, setReferralNotes] = useState('')

  // AI
  const [aiOpen, setAiOpen] = useState(false)
  const [aiText, setAiText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isAutoExtracting, setIsAutoExtracting] = useState(!!autoExtractText)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const autoExtractRanRef = useRef(false)

  // ── AI ────────────────────────────────────────────────────────

  const applyExtracted = (fields: Record<string, any>) => {
    setForm((p) => ({
      ...p,
      // Name: let AI override push-name-style defaults (they're often incomplete)
      nome: fields.nome || fields.name || p.nome,
      // Email + phone: NEVER overwrite when the field was pre-filled by the caller
      // (e.g. the WhatsApp contact's canonical phone number).
      email: lockedFieldsRef.current.email ? p.email : (fields.email || p.email),
      telemovel: lockedFieldsRef.current.telemovel ? p.telemovel : (fields.telemovel || fields.phone || p.telemovel),
      observacoes: fields.observacoes ? (p.observacoes ? p.observacoes + '\n' + fields.observacoes : fields.observacoes) : p.observacoes,
    }))
    if (fields.negocio_tipo && ['Compra', 'Venda', 'Arrendatário', 'Arrendador'].includes(fields.negocio_tipo)) {
      setNegocioTipo(fields.negocio_tipo)
    }
    if (fields.localizacao) setNegocioFields((p) => ({ ...p, localizacao: fields.localizacao }))
    if (fields.quartos_min || fields.quartos) setNegocioFields((p) => ({ ...p, quartos_min: String(fields.quartos_min || fields.quartos) }))
    if (fields.orcamento) setNegocioFields((p) => ({ ...p, orcamento: String(fields.orcamento) }))
    if (fields.orcamento_max) setNegocioFields((p) => ({ ...p, orcamento_max: String(fields.orcamento_max) }))
    if (fields.tipo_imovel) setNegocioFields((p) => ({ ...p, tipo_imovel: fields.tipo_imovel }))
  }

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
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
      applyExtracted(fields)
      toast.success('Dados extraídos')
      setAiOpen(false)
    } catch { toast.error('Erro ao extrair dados') }
    finally { setIsProcessing(false) }
  }

  // ── Auto-extract on mount from provided transcript ───────────────

  useEffect(() => {
    if (!autoExtractText?.trim() || autoExtractRanRef.current) return
    autoExtractRanRef.current = true
    // Show the banner as soon as we know there's a transcript to process.
    // The transcript often arrives AFTER mount (prop updates), so we can't
    // rely on the useState initializer.
    setIsAutoExtracting(true)

    ;(async () => {
      try {
        const res = await fetch('/api/leads/extract-from-text', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: autoExtractText }),
        })
        if (!res.ok) return
        const { fields } = await res.json()
        applyExtracted(fields)
      } catch {
        // fail silently — agent can still fill manually
      } finally {
        setIsAutoExtracting(false)
      }
    })()
  }, [autoExtractText])

  // ── Submit ────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!form.nome.trim()) { toast.error('Nome é obrigatório'); return }
    if (!negocioTipo) { toast.error('Seleccione o tipo de negócio (compra, venda, etc.)'); return }

    setIsSubmitting(true)
    try {
      // 1. Create contact
      const leadPayload: Record<string, any> = {
        nome: form.nome,
        email: form.email || null,
        telemovel: form.telemovel || null,
        origem: form.origem || null,
        observacoes: form.observacoes || null,
        agent_id: form.agent_id || null,
        estado: 'Contactado',
      }

      const leadRes = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadPayload),
      })

      if (!leadRes.ok) {
        const err = await leadRes.json()
        throw new Error(err.error || 'Erro ao criar contacto')
      }

      const { id: contactId } = await leadRes.json()

      // 2. Create negócio (qualification)
      const pipelineMap: Record<string, string> = {
        Compra: 'comprador', Venda: 'vendedor',
        'Arrendatário': 'arrendatario', 'Arrendador': 'arrendador',
      }
      const pt = pipelineMap[negocioTipo] || 'comprador'

      // Fetch first non-terminal stage
      let stageId: string | null = null
      try {
        const stagesRes = await fetch(`/api/crm/pipeline-stages?pipeline_type=${pt}`)
        const stagesData = await stagesRes.json()
        const stages = (stagesData.data || stagesData || [])
          .filter((s: any) => !s.is_terminal)
          .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
        stageId = stages[0]?.id
      } catch {}

      if (stageId) {
        const negPayload: Record<string, any> = {
          lead_id: contactId,
          tipo: negocioTipo,
          pipeline_stage_id: stageId,
          assigned_consultant_id: form.agent_id || null,
        }
        if (negocioFields.tipo_imovel) negPayload.tipo_imovel = negocioFields.tipo_imovel
        if (negocioFields.localizacao) negPayload.localizacao = negocioFields.localizacao
        if (negocioFields.quartos_min) negPayload.quartos_min = parseInt(negocioFields.quartos_min)
        if (negocioFields.orcamento) {
          negPayload.orcamento = parseFloat(negocioFields.orcamento)
          negPayload.expected_value = parseFloat(negocioFields.orcamento)
        }
        if (negocioFields.orcamento_max) negPayload.orcamento_max = parseFloat(negocioFields.orcamento_max)

        await fetch('/api/crm/negocios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(negPayload),
        })
      }

      // 3. Create referral if set
      if (referralDir && referralConsultantId && user?.id) {
        try {
          await fetch('/api/crm/referrals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contact_id: contactId,
              referral_type: 'internal',
              from_consultant_id: referralDir === 'incoming' ? referralConsultantId : user.id,
              to_consultant_id: referralDir === 'incoming' ? user.id : referralConsultantId,
              notes: referralNotes || null,
            }),
          })
        } catch {}
      }

      toast.success('Contacto e negócio criados com sucesso')
      if (onSuccess) onSuccess(contactId)
      else router.push(`/dashboard/leads/${contactId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar contacto')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isBuyer = negocioTipo === 'Compra' || negocioTipo === 'Arrendatário'

  return (
    <div className="flex flex-col max-h-[85vh]">
      {/* ─── Dark header ─── */}
      <div className="bg-neutral-900 rounded-t-2xl px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/50 text-[10px] font-medium tracking-widest uppercase">Novo</p>
            <p className="text-white font-semibold text-base mt-0.5">Contacto</p>
          </div>

          {/* AI popover */}
          <Popover open={aiOpen} onOpenChange={setAiOpen}>
            <PopoverTrigger asChild>
              <button className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center transition-colors',
                isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white/10 border border-white/15 text-white/60 hover:text-white hover:bg-white/15',
                (isProcessing || isAutoExtracting) && 'bg-white/10 text-white/60'
              )}>
                {(isProcessing || isAutoExtracting) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isRecording ? <MicOff className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
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
              <Textarea placeholder="Cole texto com dados do contacto..." rows={3} className="text-xs resize-none rounded-lg" value={aiText} onChange={(e) => setAiText(e.target.value)} />
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

      {/* ─── Form body ─── */}
      <div className="px-5 pt-4 pb-5 space-y-4 overflow-y-auto flex-1">

        {/* Auto-extract loading banner */}
        {isAutoExtracting && (
          <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 via-violet-50/70 to-transparent px-3.5 py-2.5 animate-pulse">
            <div className="relative flex-shrink-0">
              <Sparkles className="h-4 w-4 text-violet-600" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-violet-900">A analisar conversa...</p>
              <p className="text-[11px] text-violet-700/70">Os campos serão preenchidos automaticamente</p>
            </div>
            <Loader2 className="h-4 w-4 animate-spin text-violet-500 flex-shrink-0" />
          </div>
        )}

        {/* Tipo de negócio (required) */}
        <div>
          <Label className="text-[11px] text-muted-foreground font-medium">Tipo de Negócio *</Label>
          <div className="grid grid-cols-4 gap-1.5 mt-1.5">
            {NEGOCIO_TYPES.map((t) => {
              const isActive = negocioTipo === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setNegocioTipo(isActive ? '' : t.value)}
                  className={cn(
                    'rounded-lg py-2 text-[11px] font-medium transition-all text-center',
                    isActive
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  )}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Contact fields */}
        <div>
          <Label className="text-[11px] text-muted-foreground font-medium">Nome *</Label>
          <Input
            placeholder="Nome completo"
            value={form.nome}
            onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
            className="rounded-lg mt-1 h-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] text-muted-foreground font-medium">Email</Label>
            <Input
              type="email"
              placeholder="email@exemplo.pt"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="rounded-lg mt-1 h-9"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground font-medium">Telemóvel</Label>
            <Input
              placeholder="+351 912 345 678"
              value={form.telemovel}
              onChange={(e) => setForm((p) => ({ ...p, telemovel: e.target.value }))}
              className="rounded-lg mt-1 h-9"
            />
          </div>
        </div>

        {/* Origem + Consultor */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] text-muted-foreground font-medium">Origem</Label>
            <Select value={form.origem || '_none'} onValueChange={(v) => setForm((p) => ({ ...p, origem: v === '_none' ? '' : v }))}>
              <SelectTrigger className="rounded-lg mt-1 h-9 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">—</SelectItem>
                {LEAD_ORIGENS_OPTIONS.map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground font-medium">Consultor</Label>
            <Select value={form.agent_id || '_none'} onValueChange={(v) => setForm((p) => ({ ...p, agent_id: v === '_none' ? '' : v }))}>
              <SelectTrigger className="rounded-lg mt-1 h-9 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">—</SelectItem>
                {consultants.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.commercial_name}{c.id === user?.id ? ' (eu)' : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Negócio details (optional, expandable if tipo selected) */}
        {negocioTipo && (
          <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Detalhes do negócio (opcional)</p>
            <div>
              <Label className="text-[11px] text-muted-foreground font-medium">Tipo de Imóvel</Label>
              <Select value={negocioFields.tipo_imovel || '_none'} onValueChange={(v) => setNegocioFields((p) => ({ ...p, tipo_imovel: v === '_none' ? '' : v }))}>
                <SelectTrigger className="rounded-lg mt-1 h-9 text-xs"><SelectValue placeholder="Qualquer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Qualquer</SelectItem>
                  {PROPERTY_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground font-medium">Localização</Label>
              <Input placeholder="ex: Lisboa, Cascais..." value={negocioFields.localizacao} onChange={(e) => setNegocioFields((p) => ({ ...p, localizacao: e.target.value }))} className="rounded-lg mt-1 h-9" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground font-medium">{isBuyer ? 'Quartos mín.' : 'Quartos'}</Label>
                <Input type="number" placeholder="2" value={negocioFields.quartos_min} onChange={(e) => setNegocioFields((p) => ({ ...p, quartos_min: e.target.value }))} className="rounded-lg mt-1 h-9" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground font-medium">{isBuyer ? 'Orç. mín. €' : 'Preço €'}</Label>
                <Input type="number" placeholder="200000" value={negocioFields.orcamento} onChange={(e) => setNegocioFields((p) => ({ ...p, orcamento: e.target.value }))} className="rounded-lg mt-1 h-9" />
              </div>
              {isBuyer && (
                <div>
                  <Label className="text-[11px] text-muted-foreground font-medium">Orç. máx. €</Label>
                  <Input type="number" placeholder="350000" value={negocioFields.orcamento_max} onChange={(e) => setNegocioFields((p) => ({ ...p, orcamento_max: e.target.value }))} className="rounded-lg mt-1 h-9" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Referral */}
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Referência</p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setReferralDir(referralDir === 'incoming' ? null : 'incoming')}
              className={cn(
                'flex-1 rounded-lg py-2 text-[11px] font-medium transition-all text-center flex items-center justify-center gap-1.5',
                referralDir === 'incoming'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              <ArrowDownLeft className="h-3 w-3" />
              Recebi
            </button>
            <button
              type="button"
              onClick={() => setReferralDir(referralDir === 'outgoing' ? null : 'outgoing')}
              className={cn(
                'flex-1 rounded-lg py-2 text-[11px] font-medium transition-all text-center flex items-center justify-center gap-1.5',
                referralDir === 'outgoing'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              <ArrowUpRight className="h-3 w-3" />
              Estou a referenciar
            </button>
          </div>

          {referralDir && (
            <div className="space-y-3 mt-3">
              <div>
                <Label className="text-[11px] text-muted-foreground font-medium">
                  {referralDir === 'incoming' ? 'Quem me referenciou?' : 'Referenciar para quem?'}
                </Label>
                <Select value={referralConsultantId || '_none'} onValueChange={(v) => setReferralConsultantId(v === '_none' ? '' : v)}>
                  <SelectTrigger className="rounded-lg mt-1 h-9 text-xs"><SelectValue placeholder="Seleccionar consultor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">—</SelectItem>
                    {consultants.filter((c) => c.id !== user?.id).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground font-medium">Notas da referência</Label>
                <Input placeholder="Ex: contacto do cliente X..." value={referralNotes} onChange={(e) => setReferralNotes(e.target.value)} className="rounded-lg mt-1 h-9 text-xs" />
              </div>
            </div>
          )}
        </div>

        {/* Observations */}
        <div>
          <Label className="text-[11px] text-muted-foreground font-medium">Observações</Label>
          <Textarea
            rows={2}
            placeholder="Notas sobre o contacto..."
            value={form.observacoes}
            onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
            className="rounded-lg mt-1 text-xs"
          />
        </div>
      </div>

      {/* ─── Footer ─── */}
      <div className="px-5 py-3 border-t flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel || (() => router.back())}
          className="px-4 py-2 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 shadow-sm transition-all duration-200 disabled:opacity-50"
        >
          {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Criar Contacto
        </button>
      </div>
    </div>
  )
}
