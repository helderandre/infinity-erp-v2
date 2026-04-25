'use client'

import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NegocioDataCard } from '@/components/negocios/negocio-data-card'
import { DashboardSheet } from './dashboard-sheet'

interface BriefingSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tipo: string
  negocioId: string
  form: Record<string, unknown>
  onFieldChange: (field: string, value: unknown) => void
  onSave: () => Promise<void>
  isSaving: boolean
  refreshKey?: number
  onAiFillClick: () => void
}

/**
 * Sheet do "Briefing" — envolve o NegocioDataCard apenas com a tab "Dados",
 * sem extraTabs. É a única forma de editar os critérios do negócio na nova
 * versão dashboard.
 */
export function BriefingSheet({
  open,
  onOpenChange,
  tipo,
  negocioId,
  form,
  onFieldChange,
  onSave,
  isSaving,
  refreshKey,
  onAiFillClick,
}: BriefingSheetProps) {
  return (
    <DashboardSheet
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Briefing"
      title={titleFor(tipo)}
      description="Critérios e perfil do cliente. Clique no lápis para editar."
      size="lg"
      headerActions={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 rounded-full text-xs"
          onClick={onAiFillClick}
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          Preencher com IA
        </Button>
      }
    >
      {/* O NegocioDataCard sem extraTabs renderiza só o form de dados. */}
      <div className="-mx-2">
        <NegocioDataCard
          tipo={tipo}
          negocioId={negocioId}
          form={form}
          onFieldChange={onFieldChange}
          onSave={onSave}
          isSaving={isSaving}
          refreshKey={refreshKey}
          extraTabs={[]}
          onAiFillClick={onAiFillClick}
        />
      </div>
    </DashboardSheet>
  )
}

function titleFor(tipo: string): string {
  switch (tipo) {
    case 'Compra':
      return 'Briefing de Compra'
    case 'Venda':
      return 'Briefing de Venda'
    case 'Arrendatário':
      return 'Briefing de Arrendamento'
    case 'Arrendador':
      return 'Briefing do Imóvel'
    case 'Compra e Venda':
      return 'Briefing do Negócio'
    default:
      return 'Briefing'
  }
}
