'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createLeadSchema, type CreateLeadInput } from '@/lib/validations/lead'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import { LEAD_ORIGENS, NEGOCIO_PROPERTY_TYPES } from '@/lib/constants'
import { SelectWithOther } from '@/components/shared/select-with-other'
import {
  Mic, MicOff, Loader2, Sparkles, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { useUser } from '@/hooks/use-user'
import { NegocioZonasField } from '@/components/negocios/zonas/negocio-zonas-field'
import type { NegocioZone } from '@/lib/matching'

interface ContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: (id: string) => void
  defaultValues?: Partial<CreateLeadInput>
}

export function ContactDialog({ open, onOpenChange, onComplete, defaultValues }: ContactDialogProps) {
  const isMobile = useIsMobile()
  const { user } = useUser()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [aiExpanded, setAiExpanded] = useState(false)

  // Inline qualification (optional) — creates a négocio after the lead.
  // 2026-06-XX: tipo split into business_type + perspectiva.
  const [negocioBusinessType, setNegocioBusinessType] = useState<string>('')
  const [negocioTipo, setNegocioTipo] = useState<string>('')
  // Detalhes do negócio (opcional) — espelha o lead-form da página completa.
  const [negocioFields, setNegocioFields] = useState({
    tipo_imovel: '',
    quartos_min: '',
    orcamento: '',
    orcamento_max: '',
  })
  const [negocioZonas, setNegocioZonas] = useState<NegocioZone[]>([])
  // Texto livre extraído pela IA (ex: "Lisboa centro") — vai como
  // `localizacao` text no insert, paralelo às zonas estruturadas.
  const [extractedLocalizacao, setExtractedLocalizacao] = useState<string>('')
  const isBuyer = negocioTipo === 'Comprador' || negocioTipo === 'Arrendatário'

  // Audio
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcription, setTranscription] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const {
    register, handleSubmit, setValue, watch, reset,
    formState: { errors },
  } = useForm<CreateLeadInput>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: defaultValues || {},
  })

  useEffect(() => {
    if (!open) {
      reset(defaultValues || {})
      setTranscription(null)
      setAiExpanded(false)
      setNegocioBusinessType('')
      setNegocioTipo('')
      setNegocioFields({ tipo_imovel: '', quartos_min: '', orcamento: '', orcamento_max: '' })
      setNegocioZonas([])
      setExtractedLocalizacao('')
    } else {
      // Pré-popula com prefixo PT editável. O consultor pode apagar e
      // escrever um número internacional se for o caso.
      reset({ telemovel: '+351 ', ...(defaultValues || {}) })
    }
  }, [open, reset, defaultValues])

  // O contacto é sempre atribuído ao consultor autenticado — sem selector.
  useEffect(() => {
    if (open && user?.id) {
      setValue('agent_id', user.id)
    }
  }, [open, user?.id, setValue])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        await processAudio(new Blob(chunksRef.current, { type: 'audio/webm' }))
      }
      mediaRecorder.start()
      setIsRecording(true)
    } catch { toast.error('Não foi possível aceder ao microfone') }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording])

  const processAudio = async (blob: Blob) => {
    setIsProcessing(true)
    try {
      const fd = new FormData()
      fd.append('audio', blob)
      const trRes = await fetch('/api/transcribe', { method: 'POST', body: fd })
      if (!trRes.ok) throw new Error()
      const { text } = await trRes.json()
      setTranscription(text)
      await extractAndFill(text)
    } catch { toast.error('Erro ao processar áudio') }
    finally { setIsProcessing(false) }
  }

  const extractAndFill = async (text: string) => {
    const res = await fetch('/api/leads/extract-from-text', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) throw new Error()
    const { fields } = await res.json()
    if (fields.nome) setValue('nome', fields.nome)
    if (fields.email) setValue('email', fields.email)
    if (fields.telemovel) setValue('telemovel', fields.telemovel)
    if (fields.origem) setValue('origem', fields.origem)
    if (fields.observacoes) {
      const cur = watch('observacoes') || ''
      setValue('observacoes', cur ? `${cur}\n\n${fields.observacoes}` : fields.observacoes)
    }
    // Negócio — business_type + perspectiva + detalhes
    const allowedBT = ['Venda', 'Arrendamento', 'Trespasse']
    if (fields.business_type && allowedBT.includes(fields.business_type)) {
      setNegocioBusinessType(fields.business_type)
    }
    const allowedTipo = ['Comprador', 'Vendedor', 'Arrendatário', 'Senhorio']
    if (fields.negocio_tipo && allowedTipo.includes(fields.negocio_tipo)) {
      setNegocioTipo(fields.negocio_tipo)
    }
    setNegocioFields((p) => ({
      ...p,
      tipo_imovel: fields.tipo_imovel || p.tipo_imovel,
      quartos_min: fields.quartos_min != null ? String(fields.quartos_min) : p.quartos_min,
      orcamento: fields.orcamento != null ? String(fields.orcamento) : p.orcamento,
      orcamento_max: fields.orcamento_max != null ? String(fields.orcamento_max) : p.orcamento_max,
    }))
    if (fields.localizacao) setExtractedLocalizacao(fields.localizacao as string)
    toast.success('Dados extraídos com sucesso')
  }

  const onSubmit = async (data: CreateLeadInput) => {
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erro') }
      const { id } = await res.json()

      // If the consultant filled in the qualification (business_type + tipo),
      // also spin up a négocio. Failure here doesn't roll back the lead — the
      // lead is the source of truth; the negocio is best-effort follow-up.
      if (negocioBusinessType && negocioTipo) {
        try {
          const isBuyer = negocioTipo === 'Comprador' || negocioTipo === 'Arrendatário'
          const negPayload: Record<string, unknown> = {
            lead_id: id,
            business_type: negocioBusinessType,
            tipo: negocioTipo,
            assigned_consultant_id: user?.id || null,
          }
          if (negocioFields.tipo_imovel) negPayload.tipo_imovel = negocioFields.tipo_imovel
          if (negocioZonas.length > 0) negPayload.zonas = negocioZonas
          if (extractedLocalizacao.trim()) negPayload.localizacao = extractedLocalizacao.trim()
          if (negocioFields.quartos_min) {
            const n = parseInt(negocioFields.quartos_min)
            if (!Number.isNaN(n)) {
              if (isBuyer) negPayload.quartos_min = n
              else negPayload.quartos = n
            }
          }
          // O campo "orçamento" único do form mapeia para colunas distintas
          // por (business_type, perspectiva) — replica a lógica do
          // new-negocio-sheet para o sheet de detalhe ler correctamente.
          const orcNum = negocioFields.orcamento ? parseFloat(negocioFields.orcamento) : null
          const orcMaxNum = negocioFields.orcamento_max ? parseFloat(negocioFields.orcamento_max) : null
          if (orcNum && Number.isFinite(orcNum) && orcNum > 0) {
            if (negocioTipo === 'Comprador') negPayload.orcamento = orcNum
            else if (negocioTipo === 'Arrendatário') negPayload.renda_max_mensal = orcNum
            else if (negocioTipo === 'Vendedor') negPayload.preco_venda = orcNum
            else if (negocioTipo === 'Senhorio') negPayload.renda_pretendida = orcNum
          }
          if (isBuyer && orcMaxNum && Number.isFinite(orcMaxNum) && orcMaxNum > 0) {
            negPayload.orcamento_max = orcMaxNum
          }

          await fetch('/api/negocios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(negPayload),
          })
        } catch { /* surface only the lead success */ }
      }

      toast.success('Contacto criado com sucesso')
      // Reset local state so subsequent opens don't carry over
      setNegocioBusinessType('')
      setNegocioTipo('')
      onOpenChange(false)
      onComplete?.(id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar contacto')
    } finally { setIsSubmitting(false) }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0',
          isMobile
            ? 'data-[side=bottom]:h-[90dvh] rounded-t-3xl'
            : 'w-full sm:max-w-[520px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        <SheetHeader className={cn('px-6 pb-4 border-b border-border/40 shrink-0', isMobile ? 'pt-8' : 'pt-6')}>
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5" />
              Novo Contacto
            </SheetTitle>
            <Popover open={aiExpanded} onOpenChange={setAiExpanded}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-full h-8 gap-1.5 text-xs"
                  title="Preencher por voz ou texto"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">IA</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={8}
                className="w-[320px] p-3 space-y-3 rounded-2xl"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <p className="text-[11px] font-medium text-muted-foreground">
                  Fala ou cola texto — a IA preenche os campos (incluindo tipo de negócio, perspectiva e detalhes).
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={isRecording ? 'destructive' : 'outline'}
                    size="sm"
                    className="rounded-full gap-2 h-8"
                    disabled={isProcessing}
                    onClick={isRecording ? stopRecording : startRecording}
                  >
                    {isRecording ? (
                      <>
                        <MicOff className="h-3.5 w-3.5" />
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </span>
                        Parar
                      </>
                    ) : (
                      <><Mic className="h-3.5 w-3.5" /> Gravar</>
                    )}
                  </Button>
                  {isProcessing && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> A processar...
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Ou cola texto com dados do contacto..."
                    rows={3}
                    className="text-xs resize-none rounded-xl flex-1"
                    id="contact-ai-text"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full text-xs gap-1 h-8 w-full"
                  disabled={isProcessing}
                  onClick={() => {
                    const el = document.getElementById('contact-ai-text') as HTMLTextAreaElement
                    if (el?.value) {
                      setIsProcessing(true)
                      extractAndFill(el.value).finally(() => setIsProcessing(false))
                    }
                  }}
                >
                  <Sparkles className="h-3 w-3" /> Extrair
                </Button>
                {transcription && (
                  <div className="rounded-lg bg-muted/40 border border-border/40 p-2.5 text-xs text-muted-foreground">
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1">Transcrição</p>
                    <p className="leading-relaxed">{transcription}</p>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
          <SheetDescription className="sr-only">
            Adiciona um contacto à agenda
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-3">
            {/* Card 1 — Identidade */}
            <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Nome *</Label>
                <Input {...register('nome')} className="rounded-xl" placeholder="Nome do contacto" />
                {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Email</Label>
                  <Input type="email" {...register('email')} className="rounded-xl" placeholder="email@exemplo.com" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Telemóvel</Label>
                  <Input
                    type="tel"
                    inputMode="tel"
                    placeholder="+351 9XX XXX XXX"
                    className="rounded-xl"
                    {...register('telemovel')}
                  />
                </div>
              </div>
            </div>

            {/* Card 3 — Qualificação (opcional, cria também a oportunidade) */}
            <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-4 space-y-4">
              {/* Step 1 — Tipo de negócio */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Tipo de negócio</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Venda', 'Arrendamento', 'Trespasse'] as const).map((bt) => {
                    const active = negocioBusinessType === bt
                    return (
                      <button
                        key={bt}
                        type="button"
                        onClick={() => {
                          if (active) {
                            setNegocioBusinessType('')
                            setNegocioTipo('')
                            return
                          }
                          setNegocioBusinessType(bt)
                          // Reset perspectiva if it doesn't fit the new business_type
                          const allowed = bt === 'Arrendamento'
                            ? ['Arrendatário', 'Senhorio']
                            : ['Comprador', 'Vendedor']
                          if (!allowed.includes(negocioTipo)) setNegocioTipo('')
                        }}
                        className={cn(
                          'inline-flex items-center justify-center h-9 rounded-full text-xs font-medium transition-all border',
                          active
                            ? 'bg-foreground text-background border-foreground'
                            : 'border-border/40 bg-background/40 text-muted-foreground hover:text-foreground hover:border-border/70',
                        )}
                      >
                        {bt}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Step 2 — Perspectiva (only when business_type set) */}
              {negocioBusinessType && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                  <Label className="text-xs font-medium">Perspectiva</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(negocioBusinessType === 'Arrendamento'
                      ? ['Arrendatário', 'Senhorio']
                      : ['Comprador', 'Vendedor']
                    ).map((p) => {
                      const active = negocioTipo === p
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setNegocioTipo(active ? '' : p)}
                          className={cn(
                            'inline-flex items-center justify-center h-9 rounded-full text-xs font-medium transition-all border',
                            active
                              ? 'bg-foreground text-background border-foreground'
                              : 'border-border/40 bg-background/40 text-muted-foreground hover:text-foreground hover:border-border/70',
                          )}
                        >
                          {p}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Detalhes do negócio (opcional) — aparece quando há perspectiva */}
              {negocioTipo && (
                <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-3 animate-in fade-in slide-in-from-top-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Detalhes do negócio (opcional)
                  </p>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-medium">Tipo de Imóvel</Label>
                    <SelectWithOther
                      scope="property_type"
                      value={negocioFields.tipo_imovel || undefined}
                      onChange={(v) => setNegocioFields((p) => ({ ...p, tipo_imovel: v }))}
                      options={NEGOCIO_PROPERTY_TYPES.map((t) => ({ value: t, label: t }))}
                      placeholder="Qualquer"
                      triggerClassName="rounded-xl text-xs"
                      inputClassName="rounded-xl text-xs"
                    />
                  </div>
                  <NegocioZonasField
                    value={negocioZonas}
                    onChange={setNegocioZonas}
                    tipo={negocioTipo}
                  />
                  <div className={cn('grid gap-2', isBuyer ? 'grid-cols-3' : 'grid-cols-2')}>
                    <div className="space-y-2">
                      <Label className="text-[11px] font-medium">{isBuyer ? 'Quartos mín.' : 'Quartos'}</Label>
                      <Input
                        type="number"
                        placeholder="2"
                        value={negocioFields.quartos_min}
                        onChange={(e) => setNegocioFields((p) => ({ ...p, quartos_min: e.target.value }))}
                        className="rounded-xl text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] font-medium">{isBuyer ? 'Orç. mín. €' : 'Preço €'}</Label>
                      <Input
                        type="number"
                        placeholder="200000"
                        value={negocioFields.orcamento}
                        onChange={(e) => setNegocioFields((p) => ({ ...p, orcamento: e.target.value }))}
                        className="rounded-xl text-xs"
                      />
                    </div>
                    {isBuyer && (
                      <div className="space-y-2">
                        <Label className="text-[11px] font-medium">Orç. máx. €</Label>
                        <Input
                          type="number"
                          placeholder="350000"
                          value={negocioFields.orcamento_max}
                          onChange={(e) => setNegocioFields((p) => ({ ...p, orcamento_max: e.target.value }))}
                          className="rounded-xl text-xs"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Origem */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Origem</Label>
                <Select onValueChange={v => setValue('origem', v)}>
                  <SelectTrigger className="rounded-xl text-xs"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {LEAD_ORIGENS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Card 4 — Observações */}
            <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-4 space-y-2">
              <Label className="text-xs font-medium">Observações</Label>
              <Textarea {...register('observacoes')} className="rounded-xl text-xs" rows={3} placeholder="Notas sobre o contacto..." />
            </div>
          </div>

          <div className="shrink-0 border-t border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md px-6 py-3 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" className="min-w-[120px]" disabled={isSubmitting}>
              {isSubmitting && <Spinner variant="infinite" size={14} className="mr-1.5" />}
              Criar Contacto
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
