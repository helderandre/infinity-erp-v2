'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { acquisitionSchema } from '@/lib/validations/acquisition'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { SheetHeader, SheetFooter, SheetTitle } from '@/components/ui/sheet'
import { toast } from 'sonner'
import { Check, Sparkles, Save, X } from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { StepProperty } from './step-1-property'
import { StepLocation } from './step-2-location'
import { StepOwners } from './step-3-owners'
import { StepContract } from './step-4-contract'
import { StepDocuments } from './step-5-documents'
import { AcquisitionQuickFill } from './acquisition-quick-fill'

type AcquisitionFormData = z.infer<typeof acquisitionSchema>

const TABS = [
  {
    value: 'property',
    label: 'Dados do Imóvel',
  },
  {
    value: 'location',
    label: 'Localização',
  },
  {
    value: 'owners',
    label: 'Proprietários',
  },
  {
    value: 'contract',
    label: 'Contrato',
  },
  {
    value: 'documents',
    label: 'Documentos',
  },
]

// Map field keys to PT labels for error messages
const FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  property_type: 'Tipo de Imóvel',
  business_type: 'Tipo de Negócio',
  listing_price: 'Preço',
  address_street: 'Morada',
  city: 'Cidade',
  postal_code: 'Código Postal',
  owners: 'Proprietários',
  contract_regime: 'Regime de Contrato',
  commission_agreed: 'Comissão',
}

// Map field key to which tab it belongs
function getTabForField(field: string): string {
  if (['title', 'property_type', 'business_type', 'listing_price', 'description', 'property_condition', 'energy_certificate'].includes(field)) return 'property'
  if (['address_street', 'city', 'postal_code', 'zone', 'address_parish', 'latitude', 'longitude'].includes(field)) return 'location'
  if (field === 'owners') return 'owners'
  if (['contract_regime', 'commission_agreed', 'commission_type', 'contract_term', 'contract_expiry', 'imi_value', 'condominium_fee', 'internal_notes'].includes(field)) return 'contract'
  return 'documents'
}

export interface AcquisitionFormV2Props {
  mode: 'standalone' | 'dialog'
  draftId?: string
  prefillData?: Partial<AcquisitionFormData>
  negocioId?: string
  onComplete?: (procInstanceId: string) => void
  onClose?: () => void
}

export function AcquisitionFormV2({
  mode,
  draftId,
  prefillData,
  negocioId,
  onComplete,
  onClose,
}: AcquisitionFormV2Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('property')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [isInitializing, setIsInitializing] = useState(!!draftId)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [quickFillOpen, setQuickFillOpen] = useState(false)

  // Draft state
  const [procInstanceId, setProcInstanceId] = useState<string | null>(draftId || null)
  const [propertyId, setPropertyId] = useState<string | null>(null)
  const draftCreated = useRef(false)

  const form = useForm({
    resolver: zodResolver(acquisitionSchema) as any,
    defaultValues: {
      title: '',
      description: '',
      property_type: '',
      business_type: 'venda',
      listing_price: 0,
      city: '',
      zone: '',
      address_parish: '',
      address_street: '',
      postal_code: '',
      latitude: null,
      longitude: null,
      property_condition: '',
      energy_certificate: '',
      owners: [],
      contract_regime: '',
      commission_agreed: 0,
      commission_type: 'percentage',
      contract_term: '',
      contract_expiry: '',
      imi_value: 0,
      condominium_fee: 0,
      internal_notes: '',
      documents: [] as Array<{ doc_type_id: string; file?: File; file_url?: string; file_name?: string; owner_index?: number }>,
      specifications: {
        typology: '',
        bedrooms: 0,
        bathrooms: 0,
        area_gross: 0,
        area_util: 0,
        construction_year: null,
        parking_spaces: 0,
        garage_spaces: 0,
        has_elevator: false,
        features: [],
      },
    },
  })

  // Watch required fields for submit button state
  const title = form.watch('title')
  const propertyType = form.watch('property_type')
  const businessType = form.watch('business_type')
  const listingPrice = form.watch('listing_price')

  const canSubmit = !!(title && propertyType && businessType && listingPrice > 0)

  // Apply prefill data locally on mount (no DB write)
  useEffect(() => {
    if (draftCreated.current) return
    draftCreated.current = true

    if (draftId) {
      // Resume existing draft — load saved data from DB
      const loadDraft = async () => {
        try {
          const res = await fetch(`/api/acquisitions/${draftId}`)
          if (!res.ok) throw new Error('Erro ao carregar rascunho')
          const data = await res.json()

          setProcInstanceId(data.proc_instance_id)
          setPropertyId(data.property_id)

          const fd = data.formData
          const currentValues = form.getValues()
          const merged = { ...currentValues } as Record<string, unknown>
          for (const [key, value] of Object.entries(fd)) {
            if (value !== undefined && value !== null) {
              merged[key] = value
            }
          }
          form.reset(merged as any)
        } catch (error) {
          console.error('Erro na inicialização:', error)
          toast.error('Erro ao carregar rascunho')
        } finally {
          setIsInitializing(false)
        }
      }
      loadDraft()
    } else if (prefillData) {
      // New form with prefill — apply to form locally only
      const currentValues = form.getValues()
      const merged = { ...currentValues } as Record<string, unknown>
      for (const [key, value] of Object.entries(prefillData)) {
        if (value !== undefined && value !== null) {
          merged[key] = value
        }
      }
      form.reset(merged as any)
    }
  }, [draftId, prefillData, negocioId, form])

  // Create draft in DB (called lazily on first save/submit)
  const ensureDraft = useCallback(async (): Promise<{ procId: string; propId: string }> => {
    if (procInstanceId && propertyId) {
      return { procId: procInstanceId, propId: propertyId }
    }

    const values = form.getValues()
    const res = await fetch('/api/acquisitions/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prefillData: {
          title: values.title || prefillData?.title,
          property_type: values.property_type || prefillData?.property_type,
          business_type: values.business_type || prefillData?.business_type,
          listing_price: values.listing_price || prefillData?.listing_price,
          description: values.description || prefillData?.description,
          property_condition: values.property_condition || prefillData?.property_condition,
          city: values.city || prefillData?.city,
          zone: values.zone || prefillData?.zone,
          specifications: values.specifications || prefillData?.specifications,
        },
        negocioId: negocioId || null,
      }),
    })
    if (!res.ok) throw new Error('Erro ao criar rascunho')
    const data = await res.json()

    setProcInstanceId(data.proc_instance_id)
    setPropertyId(data.property_id)
    return { procId: data.proc_instance_id, propId: data.property_id }
  }, [procInstanceId, propertyId, form, prefillData, negocioId])

  // Save step data to API
  const saveStep = useCallback(
    async (stepNumber: number, procId: string) => {
      const values = form.getValues()
      let stepData: Record<string, any> = {}

      switch (stepNumber) {
        case 1:
          stepData = {
            title: values.title,
            property_type: values.property_type,
            business_type: values.business_type,
            listing_price: values.listing_price,
            description: values.description,
            property_condition: values.property_condition,
            energy_certificate: values.energy_certificate,
            specifications: values.specifications,
          }
          break
        case 2:
          stepData = {
            address_street: values.address_street,
            city: values.city,
            address_parish: values.address_parish,
            postal_code: values.postal_code,
            zone: values.zone,
            latitude: values.latitude,
            longitude: values.longitude,
          }
          break
        case 3:
          stepData = { owners: values.owners }
          break
        case 4:
          stepData = {
            contract_regime: values.contract_regime,
            commission_agreed: values.commission_agreed,
            commission_type: values.commission_type,
            contract_term: values.contract_term,
            contract_expiry: values.contract_expiry,
            imi_value: values.imi_value,
            condominium_fee: values.condominium_fee,
            internal_notes: values.internal_notes,
          }
          break
        case 5:
          stepData = { documents: values.documents }
          break
      }

      try {
        const res = await fetch(`/api/acquisitions/${procId}/step/${stepNumber}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stepData),
        })
        if (!res.ok) {
          const err = await res.json()
          console.error('Erro ao guardar step:', err)
        }
      } catch (error) {
        console.error('Erro ao guardar step:', error)
      }
    },
    [form]
  )

  // Save all steps to DB
  const saveAllSteps = useCallback(
    async (procId: string) => {
      for (let i = 1; i <= 5; i++) {
        await saveStep(i, procId)
      }
    },
    [saveStep]
  )

  const handleSaveDraft = async () => {
    setIsSavingDraft(true)
    try {
      const { procId } = await ensureDraft()
      await saveAllSteps(procId)
      toast.success('Rascunho guardado. Pode retomar em Processos.')
      onClose?.()
    } catch (error: any) {
      console.error('Erro ao guardar rascunho:', error)
      toast.error(error.message || 'Erro ao guardar rascunho')
    } finally {
      setIsSavingDraft(false)
    }
  }

  const handleSubmit = async () => {
    // Validate all fields
    const isValid = await form.trigger()
    if (!isValid) {
      const errors = form.formState.errors
      const errorFields = Object.keys(errors)
      const labels = errorFields.map((f) => FIELD_LABELS[f] || f)

      toast.error(`Campos obrigatórios em falta: ${labels.join(', ')}`)

      // Navigate to the first tab that has errors
      for (const field of errorFields) {
        const tab = getTabForField(field)
        setActiveTab(tab)
        break
      }
      return
    }

    setIsSubmitting(true)
    try {
      // Create draft if it doesn't exist yet, then save all steps
      const { procId, propId } = await ensureDraft()
      await saveAllSteps(procId)

      // Upload pending files
      const documents = form.getValues('documents') || []
      const pendingFiles: Array<{ file: File; doc_type_id: string; owner_index?: number }> = []
      for (const doc of documents) {
        if (doc.file instanceof File) {
          pendingFiles.push({
            file: doc.file,
            doc_type_id: doc.doc_type_id,
            owner_index: doc.owner_index,
          })
        }
      }

      if (pendingFiles.length > 0) {
        let uploaded = 0
        for (const pending of pendingFiles) {
          setUploadProgress(`A carregar documentos... (${uploaded + 1}/${pendingFiles.length})`)
          try {
            const formData = new FormData()
            formData.append('file', pending.file)
            formData.append('doc_type_id', pending.doc_type_id)
            formData.append('property_id', propId)
            const uploadRes = await fetch('/api/documents/upload', {
              method: 'POST',
              body: formData,
            })
            if (uploadRes.ok) uploaded++
          } catch (err) {
            console.error('Erro no upload:', err)
          }
        }
      }

      // Finalize the draft
      const res = await fetch(`/api/acquisitions/${procId}/finalize`, {
        method: 'POST',
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Erro ao finalizar angariação')
      }

      toast.success('Angariação submetida com sucesso!')

      if (onComplete) {
        onComplete(procId)
      } else {
        router.push(`/dashboard/processos/${procId}`)
      }
    } catch (error: any) {
      console.error('Erro no submit:', error)
      toast.error(error.message || 'Erro ao criar angariação')
    } finally {
      setIsSubmitting(false)
      setUploadProgress(null)
    }
  }

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center py-12 flex-1">
        <Spinner variant="infinite" size={32} className="text-muted-foreground" />
      </div>
    )
  }

  // Standalone mode (full page)
  if (mode === 'standalone') {
    return (
      <div className="container max-w-4xl mx-auto py-8">
        <Form {...form}>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
            <AcquisitionQuickFill form={form} open={quickFillOpen} onOpenChange={setQuickFillOpen} />
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList variant="line" className="w-full justify-start">
                {TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="property"><StepProperty form={form} /></TabsContent>
              <TabsContent value="location"><StepLocation form={form} /></TabsContent>
              <TabsContent value="owners"><StepOwners form={form} /></TabsContent>
              <TabsContent value="contract"><StepContract form={form} /></TabsContent>
              <TabsContent value="documents"><StepDocuments form={form} /></TabsContent>
            </Tabs>
            <div className="flex justify-end">
              <Button type="button" onClick={handleSubmit} disabled={isSubmitting || !canSubmit}>
                {isSubmitting ? (
                  <>
                    <Spinner variant="infinite" size={16} className="mr-2" />
                    {uploadProgress || 'A submeter...'}
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Submeter Angariação
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    )
  }

  // Dialog (Sheet) mode
  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()} className="flex flex-col h-full overflow-hidden">
        <AcquisitionQuickFill form={form} open={quickFillOpen} onOpenChange={setQuickFillOpen} />

        {/* Header */}
        <SheetHeader className="flex-shrink-0 border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-semibold">
              {draftId ? 'Retomar Angariação' : 'Nova Angariação'}
            </SheetTitle>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={isSavingDraft || isSubmitting}
              >
                {isSavingDraft ? (
                  <Spinner variant="infinite" size={14} className="mr-1.5" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Guardar Rascunho
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickFillOpen(true)}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Preencher com IA
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
        </SheetHeader>

        {/* Content with Tabs */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full gap-0">
            <div className="flex-shrink-0 border-b px-6">
              <TabsList variant="line" className="w-full justify-start -mb-px">
                {TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <TabsContent value="property" className="mt-0"><StepProperty form={form} /></TabsContent>
              <TabsContent value="location" className="mt-0"><StepLocation form={form} /></TabsContent>
              <TabsContent value="owners" className="mt-0"><StepOwners form={form} /></TabsContent>
              <TabsContent value="contract" className="mt-0"><StepContract form={form} /></TabsContent>
              <TabsContent value="documents" className="mt-0"><StepDocuments form={form} /></TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Footer */}
        <SheetFooter className="flex-shrink-0 border-t px-6 py-4">
          <div className="flex items-center justify-end w-full">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !canSubmit}
            >
              {isSubmitting ? (
                <>
                  <Spinner variant="infinite" size={16} className="mr-2" />
                  {uploadProgress || 'A submeter...'}
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Submeter Angariação
                </>
              )}
            </Button>
          </div>
        </SheetFooter>
      </form>
    </Form>
  )
}
