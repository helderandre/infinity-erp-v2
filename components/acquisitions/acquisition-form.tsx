'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { acquisitionSchema } from '@/lib/validations/acquisition'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { toast } from 'sonner'
import { Loader2, ChevronLeft, ChevronRight, Check } from 'lucide-react'
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
  type StepperProps,
} from '@/components/ui/stepper'
import { StepProperty } from './step-1-property'
import { StepLocation } from './step-2-location'
import { StepOwners } from './step-3-owners'
import { StepContract } from './step-4-contract'
import { StepDocuments } from './step-5-documents'

type AcquisitionFormData = z.infer<typeof acquisitionSchema>

const STEPS = [
  {
    value: 'property',
    title: 'Dados do Imóvel',
    description: 'Informações gerais',
    fields: ['title', 'property_type', 'business_type', 'listing_price'] as const,
  },
  {
    value: 'location',
    title: 'Localização',
    description: 'Morada e coordenadas',
    fields: ['city', 'address_street', 'postal_code'] as const,
  },
  {
    value: 'owners',
    title: 'Proprietários',
    description: 'Dados dos proprietários',
    fields: ['owners'] as const,
  },
  {
    value: 'contract',
    title: 'Contrato',
    description: 'Comissões e termos',
    fields: ['contract_regime', 'commission_agreed'] as const,
  },
  {
    value: 'documents',
    title: 'Documentos',
    description: 'Upload opcional',
    fields: [] as const,
  },
]

export function AcquisitionForm() {
  const router = useRouter()
  const [step, setStep] = useState('property')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)

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
      imi_value: 0,
      condominium_fee: 0,
      internal_notes: '',
      documents: [],
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

  const stepIndex = STEPS.findIndex((s) => s.value === step)

  const onValidate: NonNullable<StepperProps['onValidate']> = useCallback(
    async (_value, direction) => {
      if (direction === 'prev') return true

      const currentStepData = STEPS.find((s) => s.value === step)
      if (!currentStepData || currentStepData.fields.length === 0) return true

      const isValid = await form.trigger(currentStepData.fields as any)
      if (!isValid) {
        toast.error('Por favor, preencha todos os campos obrigatórios')
      }
      return isValid
    },
    [form, step],
  )

  const onSubmit = async (data: any) => {
    console.log('[AcquisitionForm] onSubmit chamado — dados validados:', data)
    setIsSubmitting(true)
    try {
      // 1. Extrair ficheiros pendentes do form data
      const pendingFiles: Array<{ file: File; doc_type_id: string }> = []
      const jsonDocuments: typeof data.documents = []

      for (const doc of (data.documents || [])) {
        if (doc.file instanceof File) {
          pendingFiles.push({ file: doc.file, doc_type_id: doc.doc_type_id })
        } else if (doc.file_url) {
          jsonDocuments.push(doc)
        }
      }

      // 2. Enviar JSON sem File objects
      const payload = { ...data, documents: jsonDocuments }

      const response = await fetch('/api/acquisitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()
      console.log('[AcquisitionForm] Resposta da API:', { status: response.status, result })

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar angariação')
      }

      // 3. Upload dos ficheiros pendentes (com property_id real)
      if (pendingFiles.length > 0) {
        let uploaded = 0
        let failed = 0

        for (const pending of pendingFiles) {
          setUploadProgress(`A carregar documentos... (${uploaded + 1}/${pendingFiles.length})`)

          try {
            const formData = new FormData()
            formData.append('file', pending.file)
            formData.append('doc_type_id', pending.doc_type_id)
            formData.append('property_id', result.property_id)

            const uploadRes = await fetch('/api/documents/upload', {
              method: 'POST',
              body: formData,
            })

            if (!uploadRes.ok) {
              const err = await uploadRes.json()
              console.error(`Erro no upload de ${pending.file.name}:`, err)
              failed++
            } else {
              uploaded++
            }
          } catch (err) {
            console.error(`Erro no upload de ${pending.file.name}:`, err)
            failed++
          }
        }

        if (failed > 0) {
          toast.warning(
            `${failed} documento(s) não carregado(s). Pode adicioná-los depois na página do processo.`
          )
        }
      }

      toast.success('Angariação criada com sucesso!')
      router.push(`/dashboard/processos/${result.proc_instance_id}`)
    } catch (error: any) {
      console.error('[AcquisitionForm] Erro no submit:', error)
      toast.error(error.message || 'Erro ao criar angariação')
    } finally {
      setIsSubmitting(false)
      setUploadProgress(null)
    }
  }

  const onSubmitError = (errors: any) => {
    console.error('[AcquisitionForm] Erros de validação Zod:', errors)
    console.error('[AcquisitionForm] Valores actuais do form:', form.getValues())

    const fieldNames = Object.keys(errors)
    const errorMessages = fieldNames.map((field) => {
      const err = errors[field]
      const msg = err?.message || err?.root?.message || JSON.stringify(err)
      return `• ${field}: ${msg}`
    })

    console.error('[AcquisitionForm] Campos com erro:\n' + errorMessages.join('\n'))
    toast.error(`Erros de validação em ${fieldNames.length} campo(s):\n${fieldNames.join(', ')}`)
  }

  return (
    <div className="container max-w-4xl mx-auto py-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, onSubmitError)} className="space-y-6">
          <Stepper value={step} onValueChange={setStep} onValidate={onValidate}>
            {/* Header do Stepper */}
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

            {/* Conteúdo de cada passo */}
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

            {/* Navegação */}
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
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {uploadProgress || 'A criar angariação...'}
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Criar Angariação
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
