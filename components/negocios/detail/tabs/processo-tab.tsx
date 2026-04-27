'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProcessPipelinePanel } from '@/components/processes/process-pipeline-panel'
import { Workflow, ExternalLink } from 'lucide-react'

interface ProcessoTabProps {
  procInstanceId: string | null
  procExternalRef: string | null
  procStatus: string | null
}

export function ProcessoTab({ procInstanceId, procExternalRef, procStatus }: ProcessoTabProps) {
  if (!procInstanceId) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-8 flex items-start gap-3 animate-in fade-in duration-200">
        <div className="h-9 w-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
          <Workflow className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium">Processo ainda não iniciado</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quando o negócio for submetido para fecho, o processo PROC-NEG aparece aqui com todas as fases,
            tarefas e progresso.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{procExternalRef ?? 'Processo'}</h3>
          {procStatus && (
            <Badge variant="outline" className="text-[10px]">
              {procStatus}
            </Badge>
          )}
        </div>
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link href={`/dashboard/processos/${procInstanceId}`}>
            Abrir página completa
            <ExternalLink className="h-3 w-3" />
          </Link>
        </Button>
      </div>
      <ProcessPipelinePanel processId={procInstanceId} />
    </div>
  )
}
