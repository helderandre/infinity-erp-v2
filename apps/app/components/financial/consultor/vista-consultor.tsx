'use client'

import { CircleDollarSign } from 'lucide-react'
import { ConsultorResumo } from './consultor-resumo'

interface VistaConsultorProps {
  agentId: string
  agentName?: string | null
  /** Quando true, mostra o nome do consultor a ser visto (drill-down de gestão). */
  readOnly?: boolean
}

// Vista pessoal do consultor (e drill-down read-only para gestão).
// Conta Corrente vive numa rota separada (/dashboard/financeiro/conta-corrente).
export function VistaConsultor({ agentId, agentName, readOnly = false }: VistaConsultorProps) {
  return (
    <div className="space-y-4">
      {readOnly && agentName && (
        <div className="flex items-center gap-2">
          <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold tracking-tight">{agentName}</h2>
          <span className="text-xs text-muted-foreground">· somente leitura</span>
        </div>
      )}
      <ConsultorResumo agentId={agentId} />
    </div>
  )
}
