'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VisitForm } from '@/components/visits/visit-form'
import type { CreateVisitInput } from '@/lib/validations/visit'
import { DashboardSheet } from './dashboard-sheet'

const FORM_ID = 'negocio-visit-form'

interface VisitSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** ID do imóvel a pré-seleccionar. */
  defaultPropertyId?: string | null
  /** ID do lead — usado server-side, não é mostrado no UI. */
  leadId: string
  /** ID do consultor (current user) — usado server-side, não é mostrado no UI. */
  consultantId: string
  /** Lista restrita de imóveis para o selector (ex.: dossier do negócio).
   *  Quando não passada, o form vai buscar todos os imóveis. */
  propertyOptions?: Array<{ id: string; title: string; external_ref: string | null }>
  /** Nome do cliente — só para a descrição do header. */
  clientName?: string
  onSubmit: (data: CreateVisitInput) => Promise<any>
}

export function VisitSheet({
  open,
  onOpenChange,
  defaultPropertyId,
  leadId,
  consultantId,
  propertyOptions,
  clientName,
  onSubmit,
}: VisitSheetProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (data: CreateVisitInput) => {
    setIsSubmitting(true)
    try {
      const result = await onSubmit(data)
      if (result) {
        onOpenChange(false)
      }
      return result
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardSheet
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Visita"
      title="Agendar visita"
      description={clientName ? `Agende uma visita para ${clientName.split(' ')[0]}.` : 'Agende uma visita.'}
      size="md"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full flex-1"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            size="sm"
            className="rounded-full flex-1"
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Agendar visita
          </Button>
        </>
      }
    >
      <VisitForm
        formId={FORM_ID}
        defaultLeadId={leadId}
        defaultConsultantId={consultantId}
        defaultPropertyId={defaultPropertyId || undefined}
        propertyOptions={propertyOptions}
        hideConsultant
        hideClient
        hideFooter
        onSubmit={handleSubmit}
      />
    </DashboardSheet>
  )
}
