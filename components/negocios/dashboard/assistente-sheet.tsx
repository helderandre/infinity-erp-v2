'use client'

import { NegocioChat } from '@/components/negocios/negocio-chat'
import { DashboardSheet } from './dashboard-sheet'

interface AssistenteSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  negocioId: string
  onFieldsExtracted: (fields: Record<string, unknown>) => void
}

export function AssistenteSheet({
  open,
  onOpenChange,
  negocioId,
  onFieldsExtracted,
}: AssistenteSheetProps) {
  return (
    <DashboardSheet
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="IA"
      title="Assistente"
      description="Descreva alterações ao perfil — o assistente aplica os campos por si."
      size="md"
    >
      <NegocioChat negocioId={negocioId} onFieldsExtracted={onFieldsExtracted} />
    </DashboardSheet>
  )
}
