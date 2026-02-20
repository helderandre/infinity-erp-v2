'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { acquisitionSchema } from '@/lib/validations/acquisition'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { toast } from 'sonner'
import { Loader2, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StepProperty } from './step-1-property'
import { StepLocation } from './step-2-location'
import { StepOwners } from './step-3-owners'
import { StepContract } from './step-4-contract'
import { StepDocuments } from './step-5-documents'

type AcquisitionFormData = z.infer<typeof acquisitionSchema>

const STEPS = [
  { id: 1, title: 'Dados do Imóvel', description: 'Informações gerais' },
  { id: 2, title: 'Localização', description: 'Morada e coordenadas' },
  { id: 3, title: 'Proprietários', description: 'Dados dos proprietários' },
  { id: 4, title: 'Contrato', description: 'Comissões e termos' },
  { id: 5, title: 'Documentos', description: 'Upload opcional' },
]

export function AcquisitionForm() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  const onSubmit = async (data: any) => {
    console.log('[AcquisitionForm] onSubmit chamado — dados validados:', data)
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/acquisitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()
      console.log('[AcquisitionForm] Resposta da API:', { status: response.status, result })

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar angariação')
      }

      toast.success('Angariação criada com sucesso!')
      router.push(`/dashboard/processos/${result.proc_instance_id}`)
    } catch (error: any) {
      console.error('[AcquisitionForm] Erro no submit:', error)
      toast.error(error.message || 'Erro ao criar angariação')
    } finally {
      setIsSubmitting(false)
    }
  }

  const onSubmitError = (errors: any) => {
    console.error('[AcquisitionForm] Erros de validação Zod:', errors)
    console.error('[AcquisitionForm] Valores actuais do form:', form.getValues())

    // Mostrar os campos com erro
    const fieldNames = Object.keys(errors)
    const errorMessages = fieldNames.map((field) => {
      const err = errors[field]
      const msg = err?.message || err?.root?.message || JSON.stringify(err)
      return `• ${field}: ${msg}`
    })

    console.error('[AcquisitionForm] Campos com erro:\n' + errorMessages.join('\n'))
    toast.error(`Erros de validação em ${fieldNames.length} campo(s):\n${fieldNames.join(', ')}`)
  }

  const handleNext = async () => {
    const fields = getFieldsForStep(currentStep)
    const isValid = await form.trigger(fields as any)

    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length))
    } else {
      toast.error('Por favor, preencha todos os campos obrigatórios')
    }
  }

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  const getFieldsForStep = (step: number): string[] => {
    switch (step) {
      case 1:
        return ['title', 'property_type', 'business_type', 'listing_price']
      case 2:
        return ['city', 'address_street', 'postal_code']
      case 3:
        return ['owners']
      case 4:
        return ['contract_regime', 'commission_agreed']
      case 5:
        return []
      default:
        return []
    }
  }

  return (
    <div className="container max-w-4xl mx-auto py-8">
      {/* Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors',
                    currentStep > step.id &&
                      'border-emerald-500 bg-emerald-500 text-white',
                    currentStep === step.id &&
                      'border-blue-500 bg-blue-500 text-white',
                    currentStep < step.id && 'border-slate-300 bg-white text-slate-400'
                  )}
                >
                  {currentStep > step.id ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-semibold">{step.id}</span>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <div
                    className={cn(
                      'text-sm font-medium',
                      currentStep >= step.id ? 'text-slate-900' : 'text-slate-400'
                    )}
                  >
                    {step.title}
                  </div>
                  <div className="text-xs text-slate-500">{step.description}</div>
                </div>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 w-full transition-colors',
                    currentStep > step.id ? 'bg-emerald-500' : 'bg-slate-200'
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
          <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onSubmitError)} className="space-y-6">
              {currentStep === 1 && <StepProperty form={form} />}
              {currentStep === 2 && <StepLocation form={form} />}
              {currentStep === 3 && <StepOwners form={form} />}
              {currentStep === 4 && <StepContract form={form} />}
              {currentStep === 5 && <StepDocuments form={form} />}

              {/* Navegação */}
              <div className="flex items-center justify-between pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 1 || isSubmitting}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>

                {currentStep < STEPS.length ? (
                  <Button type="button" onClick={handleNext} disabled={isSubmitting}>
                    Avançar
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        A criar...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Criar Angariação
                      </>
                    )}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
