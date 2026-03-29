'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { dealFormSchema, validateDealForm, getStepForField } from '@/lib/validations/deal'
import type { DealFormData } from '@/lib/validations/deal'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DialogHeader, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Check, Save, X, AlertCircle, Sparkles } from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { DealQuickFill } from './deal-quick-fill'
import { StepPartilha } from './step-1-partilha'
import { StepClientes } from './step-2-clientes'
import { StepCondicoes } from './step-3-condicoes'
import { StepExtra } from './step-4-extra'
import { StepReferenciacao } from './step-5-referenciacao'

const TABS = [
  { value: 'partilha', label: 'Partilha' },
  { value: 'clientes', label: 'Clientes' },
  { value: 'condicoes', label: 'Condições' },
  { value: 'extra', label: 'Extra' },
  { value: 'referenciacao', label: 'Referenciação' },
]

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
}

export function DealForm({ onComplete, onClose, draftId: initialDraftId, propertyContext }: DealFormProps) {
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

  const form = useForm<DealFormData>({
    resolver: zodResolver(dealFormSchema) as any,
    defaultValues: {
      scenario: 'pleno',
      commission_type: 'percentage',
      person_type: 'singular',
      clients: [{ person_type: 'singular', name: '', email: '', phone: '', order_index: 0 }],
      share_pct: 50,
      // Prefill from property context
      property_id: propertyContext?.id || undefined,
      business_type: (propertyContext?.business_type as any) || undefined,
      deal_value: propertyContext?.listing_price || undefined,
      commission_pct: propertyContext?.commission_agreed || undefined,
    },
  })

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
  }, [dealId, form])

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

  return (
    <Form {...(form as any)}>
      <form onSubmit={(e) => e.preventDefault()} className="flex flex-col h-full overflow-hidden">
        <DealQuickFill form={form} open={quickFillOpen} onOpenChange={setQuickFillOpen} />
        {/* Header */}
        <DialogHeader className="flex-shrink-0 border-b px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-base sm:text-lg font-semibold shrink min-w-0">
              <span className="truncate block">{initialDraftId ? 'Retomar Fecho' : 'Fecho de Negócio'}</span>
              {propertyContext && (
                <span className="text-xs sm:text-sm font-normal text-muted-foreground truncate block">
                  {propertyContext.external_ref || propertyContext.title}
                </span>
              )}
            </DialogTitle>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2 sm:px-3"
                onClick={handleSaveDraft}
                disabled={savingDraft || submitting}
              >
                {savingDraft ? (
                  <Spinner variant="infinite" size={14} className="sm:mr-1.5" />
                ) : (
                  <Save className="h-3.5 w-3.5 sm:mr-1.5" />
                )}
                <span className="hidden sm:inline">Guardar Rascunho</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2 sm:px-3"
                onClick={() => setQuickFillOpen(true)}
              >
                <Sparkles className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Preencher com IA</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content with Tabs */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col h-full gap-0">
            <div className="flex-shrink-0 border-b px-4 sm:px-6 overflow-x-auto scrollbar-none">
              <TabsList variant="line" className="w-max sm:w-full justify-start -mb-px">
                {TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="relative shrink-0 text-xs sm:text-sm">
                    {tab.label}
                    {tabErrors[tab.value] > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] text-destructive-foreground flex items-center justify-center">
                        {tabErrors[tab.value]}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
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
          </Tabs>
        </div>

        {/* Footer */}
        <DialogFooter className="flex-shrink-0 border-t px-4 sm:px-6 py-3 sm:py-4 !m-0 !rounded-none items-center">
          <div className="flex items-center justify-end gap-2 sm:gap-3 w-full">
            {missingCount > 0 && (
              <Badge className="bg-amber-100 text-amber-700 border-0 text-xs font-medium px-2.5 py-1 dark:bg-amber-950 dark:text-amber-300">
                <AlertCircle className="h-3 w-3 mr-1" />
                {missingCount} campo{missingCount > 1 ? 's' : ''} em falta
              </Badge>
            )}
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Spinner variant="infinite" size={16} className="mr-2" />
                  A submeter...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Submeter Fecho
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </Form>
  )
}
