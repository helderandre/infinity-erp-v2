'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { dealFormSchema, validateDealForm, getStepForField } from '@/lib/validations/deal'
import type { DealFormData } from '@/lib/validations/deal'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Send, Save, X, AlertCircle, Sparkles, Briefcase, Link2,
  Handshake, Users, FileSignature, SlidersHorizontal, ArrowRightLeft,
} from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { cn } from '@/lib/utils'
import { DealQuickFill } from './deal-quick-fill'
import { StepPartilha } from './step-1-partilha'
import { StepClientes } from './step-2-clientes'
import { StepCondicoes } from './step-3-condicoes'
import { StepExtra } from './step-4-extra'
import { StepReferenciacao } from './step-5-referenciacao'
import { NegocioPickerDialog, type NegocioPickerItem } from '@/components/negocios/negocio-picker-dialog'
import { buildDealPropertyContextFromNegocio, mapNegocioContactsToParticipants } from '@/lib/negocios/prefill-from-negocio'

const TABS = [
  { value: 'partilha', label: 'Partilha', icon: Handshake },
  { value: 'clientes', label: 'Clientes', icon: Users },
  { value: 'condicoes', label: 'Condições', icon: FileSignature },
  { value: 'extra', label: 'Extra', icon: SlidersHorizontal },
  { value: 'referenciacao', label: 'Referenciação', icon: ArrowRightLeft },
] as const

const TAB_FIELDS: Record<string, string[]> = {
  partilha: ['proposal_file_url', 'scenario', 'property_id', 'internal_colleague_id', 'colleague_property_id', 'external_consultant_name', 'external_consultant_phone', 'external_consultant_email', 'partner_agency_name', 'share_pct', 'share_network_type'],
  clientes: ['clients'],
  condicoes: ['business_type', 'deal_value', 'commission_pct', 'commission_type', 'cpcv_pct', 'deposit_value', 'contract_signing_date', 'max_deadline', 'external_property_id', 'external_property_type', 'external_property_typology', 'external_property_construction_year'],
  extra: ['has_guarantor', 'has_furniture', 'is_bilingual', 'has_financing', 'has_financing_condition', 'has_signature_recognition', 'housing_regime'],
  referenciacao: ['has_referral', 'referral_pct', 'referral_type', 'referral_info'],
}

export interface DealFormProps {
  onComplete?: (dealId: string) => void
  onClose?: () => void
  /** Resume an existing draft by ID */
  draftId?: string | null
  /** When opened from a property, prefill and lock property + hide angariacao_externa */
  propertyContext?: {
    id: string
    title: string
    external_ref?: string | null
    business_type?: string | null
    listing_price?: number | null
    city?: string | null
    commission_agreed?: number | null
  }
  /** When opened from a negocio (e.g. accepting a proposal), pre-fill the
   *  buyer client info from the lead. */
  negocioContext?: {
    id: string
    leadName?: string | null
    leadEmail?: string | null
    leadPhone?: string | null
    /** Contactos associados à oportunidade (negocio_contacts não-titulares) —
     *  semeados como clientes adicionais a seguir ao titular. */
    participants?: Array<{ name: string; email?: string | null; phone?: string | null }>
  }
}

export function DealForm({ onComplete, onClose, draftId: initialDraftId, propertyContext, negocioContext }: DealFormProps) {
  const [activeTab, setActiveTab] = useState('partilha')
  const [dealId, setDealId] = useState<string | null>(initialDraftId || null)
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [quickFillOpen, setQuickFillOpen] = useState(false)
  const [scanningProposal, setScanningProposal] = useState(false)
  const [isLoading, setIsLoading] = useState(!!initialDraftId)
  const draftLoaded = useRef(false)

  const fromProperty = !!propertyContext

  // Picker "É de um negócio existente?" — só aparece em modo standalone
  // (sem propertyContext, sem negocioContext, sem draft).
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickedNegocio, setPickedNegocio] = useState<NegocioPickerItem | null>(null)
  const isStandalone = !propertyContext && !negocioContext && !initialDraftId
  const linkedLabel = pickedNegocio
    ? `${pickedNegocio.lead?.full_name || pickedNegocio.lead?.nome || 'Lead'} · ${pickedNegocio.tipo}`
    : null

  const form = useForm<DealFormData>({
    resolver: zodResolver(dealFormSchema) as any,
    defaultValues: {
      scenario: 'pleno',
      commission_type: 'percentage',
      person_type: 'singular',
      // Pre-fill clientes: titular (lead) + contactos associados da oportunidade.
      clients: [
        {
          person_type: 'singular',
          name: negocioContext?.leadName || '',
          email: negocioContext?.leadEmail || '',
          phone: negocioContext?.leadPhone || '',
          order_index: 0,
        },
        ...(negocioContext?.participants ?? [])
          .filter((p) => p.name?.trim())
          .map((p, i) => ({
            person_type: 'singular' as const,
            name: p.name,
            email: p.email || '',
            phone: p.phone || '',
            order_index: i + 1,
          })),
      ],
      share_pct: 50,
      // Prefill from property context
      property_id: propertyContext?.id || undefined,
      business_type: (propertyContext?.business_type as any) || undefined,
      deal_value: propertyContext?.listing_price || undefined,
      commission_pct: propertyContext?.commission_agreed || undefined,
    },
  })

  const applyPickedNegocio = useCallback(async (n: NegocioPickerItem) => {
    setPickedNegocio(n)
    const { businessType } = buildDealPropertyContextFromNegocio(n as any, null)
    const dealValue =
      n.preco_venda ??
      n.orcamento_max ??
      n.orcamento ??
      n.renda_pretendida ??
      n.renda_max_mensal ??
      undefined
    // Contactos associados da oportunidade → clientes adicionais.
    let participants: Array<{ name: string; email?: string | null; phone?: string | null }> = []
    try {
      const res = await fetch(`/api/crm/negocios/${n.id}/contactos`)
      if (res.ok) participants = mapNegocioContactsToParticipants((await res.json()).data)
    } catch { /* sem associados → só o titular */ }
    const current = form.getValues()
    form.reset({
      ...current,
      clients: [
        {
          person_type: 'singular',
          name: n.lead?.full_name || n.lead?.nome || '',
          email: n.lead?.email || '',
          phone: n.lead?.telemovel || '',
          order_index: 0,
        },
        ...participants
          .filter((p) => p.name?.trim())
          .map((p, i) => ({
            person_type: 'singular' as const,
            name: p.name,
            email: p.email || '',
            phone: p.phone || '',
            order_index: i + 1,
          })),
      ],
      business_type: businessType as any,
      deal_value: dealValue,
      property_id: n.property_id || current.property_id,
    } as any)
    toast.success('Pré-preenchido a partir do negócio')
  }, [form])

  const clearPickedNegocio = useCallback(() => {
    setPickedNegocio(null)
  }, [])

  // Load existing draft
  useEffect(() => {
    if (!initialDraftId || draftLoaded.current) return
    draftLoaded.current = true

    const loadDraft = async () => {
      try {
        const res = await fetch(`/api/deals/${initialDraftId}`)
        if (!res.ok) throw new Error()
        const data = await res.json()

        const fieldMap: Record<string, string> = {
          deal_type: 'scenario',
        }

        const currentValues = form.getValues()
        const merged = { ...currentValues } as Record<string, unknown>

        for (const [key, value] of Object.entries(data)) {
          if (value == null || key === 'id' || key === 'created_at' || key === 'updated_at') continue
          const formKey = fieldMap[key] || key
          if (formKey in currentValues) {
            merged[formKey] = value
          }
        }

        // Map deal_type to scenario
        if (data.deal_type) merged.scenario = data.deal_type
        // Load clients
        if (data.clients?.length > 0) merged.clients = data.clients

        form.reset(merged as any)
      } catch {
        toast.error('Erro ao carregar rascunho')
      } finally {
        setIsLoading(false)
      }
    }
    loadDraft()
  }, [initialDraftId, form])

  // Auto-fill from uploaded proposal
  const handleProposalScan = useCallback(async (fileUrl: string) => {
    setScanningProposal(true)
    try {
      const res = await fetch('/api/deals/fill-from-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_url: fileUrl }),
      })
      if (!res.ok) return

      const data = await res.json()
      delete data._raw

      let fieldsApplied = 0
      for (const [key, value] of Object.entries(data)) {
        if (value == null || value === '' || key.startsWith('_')) continue
        if (key === 'property_id' && fromProperty) continue
        form.setValue(key as any, value, { shouldValidate: true })
        fieldsApplied++
      }

      if (fieldsApplied > 0) {
        toast.success(`${fieldsApplied} campo${fieldsApplied > 1 ? 's' : ''} preenchido${fieldsApplied > 1 ? 's' : ''} a partir da proposta`)
      }
    } catch {
      // silent — scan is best-effort
    } finally {
      setScanningProposal(false)
    }
  }, [form, fromProperty])

  // Count missing required fields for badge
  const missingCount = useMemo(() => {
    const values = form.getValues()
    const { errors } = validateDealForm(values)
    return Object.keys(errors).length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.watch('scenario'), form.watch('business_type'), form.watch('deal_value'), form.watch('commission_pct'), form.watch('proposal_file_url')])

  // Count errors per tab for indicators
  const tabErrors = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const [tab, fields] of Object.entries(TAB_FIELDS)) {
      counts[tab] = fields.filter(f => validationErrors[f]).length
    }
    return counts
  }, [validationErrors])

  // Create draft on first interaction
  const ensureDraft = useCallback(async () => {
    if (dealId) return dealId

    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: form.getValues('scenario'),
          property_id: form.getValues('property_id') || null,
          share_pct: form.getValues('share_pct'),
          // Liga o deal ao negócio quando há contexto (Aceitar proposta ou
          // picker "É de um negócio existente?").
          negocio_id: negocioContext?.id || pickedNegocio?.id || null,
        }),
      })
      const data = await res.json()
      if (data.id) {
        setDealId(data.id)
        return data.id
      }
    } catch {
      toast.error('Erro ao criar rascunho')
    }
    return null
  }, [dealId, form, negocioContext, pickedNegocio])

  // Save current state
  const saveDraft = useCallback(async (silent = true) => {
    const id = await ensureDraft()
    if (!id) return

    const values = form.getValues()
    try {
      await fetch(`/api/deals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!silent) toast.success('Rascunho guardado')
    } catch {
      if (!silent) toast.error('Erro ao guardar rascunho')
    }
  }, [ensureDraft, form])

  const handleSaveDraft = async () => {
    setSavingDraft(true)
    await saveDraft(false)
    setSavingDraft(false)
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value)
  }

  const handleSubmit = async () => {
    const values = form.getValues()
    const { success, errors } = validateDealForm(values)

    if (!success) {
      setValidationErrors(errors)
      // Focus first error tab
      const firstErrorField = Object.keys(errors)[0]
      const errorStep = getStepForField(firstErrorField)
      const tabValue = TABS[errorStep]?.value
      if (tabValue) setActiveTab(tabValue)
      toast.error('Existem campos por preencher')
      return
    }

    setValidationErrors({})
    setSubmitting(true)

    try {
      const id = await ensureDraft()
      if (!id) return

      // Save final state
      await fetch(`/api/deals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      // Submit
      const res = await fetch(`/api/deals/${id}/submit`, { method: 'POST' })
      const data = await res.json()

      if (data.success) {
        toast.success('Fecho de negócio submetido com sucesso!')
        onComplete?.(id)
      } else {
        toast.error(data.error || 'Erro ao submeter')
      }
    } catch {
      toast.error('Erro ao submeter')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 flex-1">
        <Spinner variant="infinite" size={32} className="text-muted-foreground" />
      </div>
    )
  }

  // Step counter — current tab index (1-based) and total
  const currentStepIndex = Math.max(0, TABS.findIndex((t) => t.value === activeTab))
  const stepLabel = `Passo ${currentStepIndex + 1}/${TABS.length}`

  return (
    <Form {...(form as any)}>
      <form onSubmit={(e) => e.preventDefault()} className="flex flex-col h-full overflow-hidden">
        <DealQuickFill form={form} open={quickFillOpen} onOpenChange={setQuickFillOpen} />

        {/* Glass header — matches feedback dialog's design language */}
        <div className="px-6 pt-6 pb-3 border-b border-border/40 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle asChild>
                <div className="text-base font-semibold tracking-tight flex items-center gap-2 min-w-0">
                  <Briefcase className="h-5 w-5 shrink-0" />
                  <span className="truncate">{initialDraftId ? 'Retomar Negócio' : 'Novo Negócio'}</span>
                </div>
              </DialogTitle>
              {propertyContext && (
                <p className="text-[11px] text-muted-foreground truncate mt-1 ml-7">
                  {propertyContext.external_ref || propertyContext.title}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickFillOpen(true)}
                className="rounded-full h-8 text-xs gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Preencher com IA</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Fechar</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Banner: associar a oportunidade existente (só em modo standalone) — em card claro */}
        {isStandalone && (
          <div className="shrink-0 px-6 pt-3">
            <div className="rounded-2xl bg-card border border-border/50 shadow-sm px-4 py-2.5 flex items-center gap-2 flex-wrap">
              <Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {pickedNegocio ? (
                <>
                  <span className="text-xs text-muted-foreground">Vinculado a</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                    <Link2 className="h-3 w-3 text-muted-foreground" />
                    {linkedLabel}
                  </span>
                  <button
                    type="button"
                    onClick={clearPickedNegocio}
                    className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline ml-auto"
                  >
                    Limpar
                  </button>
                </>
              ) : (
                <>
                  <span className="text-xs font-medium text-foreground">É de uma oportunidade existente?</span>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-primary/90 transition-colors"
                  >
                    <Briefcase className="h-3.5 w-3.5" />
                    Escolher oportunidade
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Content with pill tabs + white card wrapper for each tab */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col h-full gap-0">
            {/* Pill tabs — mobile: ícone só + label no activo. Desktop: label always. */}
            <div className="flex-shrink-0 px-6 pt-4 pb-2">
              <div className="overflow-x-auto scrollbar-none">
                <div className="inline-flex items-center gap-1 rounded-full bg-muted/50 p-1">
                  {TABS.map((tab) => {
                    const isActive = activeTab === tab.value
                    const TabIcon = tab.icon
                    const errorCount = tabErrors[tab.value] || 0
                    return (
                      <button
                        key={tab.value}
                        type="button"
                        onClick={() => handleTabChange(tab.value)}
                        aria-label={tab.label}
                        className={cn(
                          'relative inline-flex items-center justify-center gap-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-all shrink-0',
                          isActive
                            ? 'bg-background shadow-sm text-foreground px-3 py-1.5'
                            : 'text-muted-foreground hover:text-foreground px-2.5 py-1.5 sm:px-3',
                        )}
                      >
                        <TabIcon className="h-3.5 w-3.5 shrink-0" />
                        <span className={cn(isActive ? 'inline' : 'hidden sm:inline')}>
                          {tab.label}
                        </span>
                        {errorCount > 0 && (
                          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] text-destructive-foreground flex items-center justify-center">
                            {errorCount}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Tab content — wrapped in a white card with step counter inside */}
            <div className="flex-1 overflow-y-auto px-6 pt-2 pb-5">
              <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-4 sm:p-5">
                <div className="flex justify-end mb-3">
                  <span className="inline-flex items-center rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">
                    {stepLabel}
                  </span>
                </div>
                <TabsContent value="partilha" className="mt-0">
                  <StepPartilha
                    form={form}
                    errors={validationErrors}
                    dealId={dealId}
                    fromProperty={fromProperty}
                    onProposalUploaded={handleProposalScan}
                    scanningProposal={scanningProposal}
                    ensureDraft={ensureDraft}
                  />
                </TabsContent>
                <TabsContent value="clientes" className="mt-0">
                  <StepClientes form={form} errors={validationErrors} />
                </TabsContent>
                <TabsContent value="condicoes" className="mt-0">
                  <StepCondicoes form={form} errors={validationErrors} />
                </TabsContent>
                <TabsContent value="extra" className="mt-0">
                  <StepExtra form={form} errors={validationErrors} />
                </TabsContent>
                <TabsContent value="referenciacao" className="mt-0">
                  <StepReferenciacao form={form} errors={validationErrors} />
                </TabsContent>
              </div>
            </div>
          </Tabs>
        </div>

        {/* Footer translúcido — Guardar rascunho + Fazer pedido lado-a-lado */}
        <div className="shrink-0 border-t border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md px-6 py-3 flex items-center justify-end gap-2 flex-wrap">
          {missingCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-medium px-2.5 py-1 dark:bg-amber-950 dark:text-amber-300 mr-auto">
              <AlertCircle className="h-3 w-3" />
              <span className="tabular-nums">{missingCount}</span>
              <span className="hidden sm:inline">{' '}campo{missingCount > 1 ? 's' : ''} em falta</span>
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={savingDraft || submitting}
            className="rounded-full text-xs h-8 gap-1.5"
          >
            {savingDraft ? (
              <Spinner variant="infinite" size={14} />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Guardar rascunho
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-full text-xs h-8 px-4 gap-1.5 min-w-[120px]"
          >
            {submitting ? (
              <>
                <Spinner variant="infinite" size={14} />
                A enviar...
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Fazer pedido
              </>
            )}
          </Button>
        </div>
      </form>
      <NegocioPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Escolher negócio existente"
        description="Pré-preenche o cliente, valor e tipo. Podes ajustar depois."
        filterTipos={[
          // Novos valores (pós-refactor de tipo)
          'Comprador', 'Vendedor', 'Arrendatário', 'Senhorio',
          // Legacy (rows pré-migração)
          'Compra', 'Venda', 'Arrendador',
        ]}
        onSelect={(n) => applyPickedNegocio(n)}
      />
    </Form>
  )
}
