'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { acquisitionSchema } from '@/lib/validations/acquisition'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Check, Sparkles, Save } from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import {
  Stepper,
  StepperContent,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperList,
  StepperNext,
  StepperPrev,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from '@/components/ui/stepper'
import { StepProperty } from './step-1-property'
import { StepLocation } from './step-2-location'
import { StepOwners } from './step-3-owners'
import { StepContract } from './step-4-contract'
import { StepDocuments } from './step-5-documents'
import { AcquisitionQuickFill } from './acquisition-quick-fill'

type AcquisitionFormData = z.infer<typeof acquisitionSchema>

const STEPS = [
  {
    value: 'property',
    title: 'Dados do Imóvel',
    description: 'Informações gerais',
    stepNumber: 1,
    fields: ['title', 'property_type', 'business_type', 'listing_price'] as const,
  },
  {
    value: 'location',
    title: 'Localização',
    description: 'Morada e coordenadas',
    stepNumber: 2,
    fields: ['city', 'address_street', 'postal_code'] as const,
  },
  {
    value: 'owners',
    title: 'Proprietários',
    description: 'Dados dos proprietários',
    stepNumber: 3,
    fields: ['owners'] as const,
  },
  {
    value: 'contract',
    title: 'Contrato',
    description: 'Comissões e termos',
    stepNumber: 4,
    fields: ['contract_regime', 'commission_agreed'] as const,
  },
  {
    value: 'documents',
    title: 'Documentos',
    description: 'Upload opcional',
    stepNumber: 5,
    fields: [] as const,
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

// Map field key to which step it belongs
function getStepForField(field: string): number {
  if (['title', 'property_type', 'business_type', 'listing_price', 'description', 'property_condition', 'energy_certificate'].includes(field)) return 0
  if (['address_street', 'city', 'postal_code', 'zone', 'address_parish', 'latitude', 'longitude'].includes(field)) return 1
  if (field === 'owners') return 2
  if (['contract_regime', 'commission_agreed', 'commission_type', 'contract_term', 'contract_expiry', 'imi_value', 'condominium_fee', 'internal_notes'].includes(field)) return 3
  return 4
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
  const [step, setStep] = useState('property')
  const [isSubmitting, setIsSubmitting] = useState(false)
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

          const lastStep = data.last_completed_step || 0
          if (lastStep > 0 && lastStep < STEPS.length) {
            setStep(STEPS[lastStep].value)
          }
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

  // Save all completed steps to DB
  const saveAllSteps = useCallback(
    async (procId: string) => {
      for (let i = 1; i <= 5; i++) {
        await saveStep(i, procId)
      }
    },
    [saveStep]
  )

  const stepIndex = STEPS.findIndex((s) => s.value === step)

  // Navigate steps locally — no DB save
  const handleStepChange = useCallback(
    (newStep: string) => {
      setStep(newStep)
    },
    []
  )

  const handleSaveDraft = async () => {
    setIsSubmitting(true)
    try {
      const { procId } = await ensureDraft()
      await saveAllSteps(procId)
      toast.success('Rascunho guardado. Pode retomar em Processos.')
      onClose?.()
    } catch (error: any) {
      console.error('Erro ao guardar rascunho:', error)
      toast.error(error.message || 'Erro ao guardar rascunho')
    } finally {
      setIsSubmitting(false)
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

      // Navigate to the first step that has errors
      let firstErrorStep = 4
      for (const field of errorFields) {
        const s = getStepForField(field)
        if (s < firstErrorStep) firstErrorStep = s
      }
      setStep(STEPS[firstErrorStep].value)
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
      <div className="flex items-center justify-center py-12">
        <Spinner variant="infinite" size={32} className="text-muted-foreground" />
      </div>
    )
  }

  const containerClass = mode === 'dialog' ? '' : 'container max-w-4xl mx-auto py-8'

  return (
    <div className={containerClass}>
      <Form {...form}>
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          {/* QuickFill floating bubble */}
          <AcquisitionQuickFill form={form} open={quickFillOpen} onOpenChange={setQuickFillOpen} />

          <Stepper value={step} onValueChange={handleStepChange}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSaveDraft}
                  className="gap-1.5 rounded-full px-3 h-8 text-xs shadow-sm"
                >
                  <Save className="h-3.5 w-3.5" />
                  Guardar Rascunho
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setQuickFillOpen(true)}
                  className="gap-1.5 rounded-full px-3 h-8 text-xs shadow-sm"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Preencher com IA
                </Button>
              </div>
            </div>

            <StepperList>
              {STEPS.map((s) => (
                <StepperItem key={s.value} value={s.value}>
                  <StepperTrigger>
                    <StepperIndicator />
                    <div className="flex flex-col gap-px">
                      <StepperTitle>{s.title}</StepperTitle>
                      <StepperDescription className="hidden sm:block">
                        {s.description}
                      </StepperDescription>
                    </div>
                  </StepperTrigger>
                  <StepperSeparator />
                </StepperItem>
              ))}
            </StepperList>

            <Card>
              <CardContent>
                <StepperContent value="property">
                  <StepProperty form={form} />
                </StepperContent>
                <StepperContent value="location">
                  <StepLocation form={form} />
                </StepperContent>
                <StepperContent value="owners">
                  <StepOwners form={form} />
                </StepperContent>
                <StepperContent value="contract">
                  <StepContract form={form} />
                </StepperContent>
                <StepperContent value="documents">
                  <StepDocuments form={form} />
                </StepperContent>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between pt-4">
              <StepperPrev asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Voltar
                </Button>
              </StepperPrev>

              <span className="text-sm text-muted-foreground">
                Passo {stepIndex + 1} de {STEPS.length}
              </span>

              {stepIndex === STEPS.length - 1 ? (
                <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
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
              ) : (
                <StepperNext asChild>
                  <Button type="button" disabled={isSubmitting}>
                    Avançar
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </StepperNext>
              )}
            </div>
          </Stepper>
        </form>
      </Form>
    </div>
  )
}
