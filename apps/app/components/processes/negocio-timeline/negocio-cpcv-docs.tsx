'use client'

import { PropertyCpcvReadiness } from '@/components/properties/property-cpcv-readiness'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Documentos do CPCV (passo "Guardar e verificar documentação").
 *
 * Delega no `PropertyCpcvReadiness`: card de prontidão Imóvel + Vendedores
 * (reaproveitado do CMI) + Compradores como cards idênticos, com upload e
 * "Adicionar comprador". Sem imóvel interno (angariação externa) → aviso.
 */
export function NegocioCpcvDocs({
  tasks,
  processId,
  deal,
  process,
  onTaskUpdate,
}: {
  tasks?: any[]
  processId: string
  deal?: any
  process?: any
  onTaskUpdate?: () => void
}) {
  const propertyId: string = process?.instance?.property_id ?? ''

  const compradorTasks = (tasks ?? []).filter((t) => {
    const title = String(t.title ?? '')
    return title.startsWith('Documentos do Comprador') || title === 'Compliance KYC'
  })

  if (!propertyId) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        Este negócio não tem imóvel interno (angariação externa) — os documentos
        do imóvel/vendedores vêm da agência angariadora.
      </p>
    )
  }

  return (
    <PropertyCpcvReadiness
      propertyId={propertyId}
      processId={processId}
      dealId={deal?.id ?? null}
      compradorTasks={compradorTasks}
      onRefresh={onTaskUpdate ?? (() => {})}
    />
  )
}
