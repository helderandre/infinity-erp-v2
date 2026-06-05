'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  Check, Clock, AlertCircle, CheckCircle2, XCircle,
  FileStack, ChevronDown, Upload,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { getPortalProcess } from '../actions'
import type { PortalProcessData, ProcessStage, ProcessDocument, ProcessEvent } from '../actions'

const DOC_STATUS_CONFIG = {
  missing: { label: 'Em Falta', icon: AlertCircle, className: 'bg-red-500/15 text-red-600' },
  pending: { label: 'Pendente', icon: Clock, className: 'bg-amber-500/15 text-amber-600' },
  approved: { label: 'Aprovado', icon: CheckCircle2, className: 'bg-emerald-500/15 text-emerald-600' },
  rejected: { label: 'Rejeitado', icon: XCircle, className: 'bg-red-500/15 text-red-600' },
} as const

export default function PortalProcessoPage() {
  const [data, setData] = useState<PortalProcessData | null>(null)
  const [loading, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      try {
        const result = await getPortalProcess()
        setData(result)
      } catch { /* empty state */ }
    })
  }, [])

  if (!data) return <ProcessSkeleton />

  if (!data.process) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Processo</h1>
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-6 text-center space-y-3">
            <FileStack className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="text-sm font-medium">Nenhum processo activo</p>
            <p className="text-xs text-muted-foreground">
              Quando o seu consultor iniciar um processo, podera acompanha-lo aqui.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { process, documents, events } = data
  const missingDocs = documents.filter(d => d.status === 'missing')
  const pendingDocs = documents.filter(d => d.status === 'pending')
  const approvedDocs = documents.filter(d => d.status === 'approved')
  const rejectedDocs = documents.filter(d => d.status === 'rejected')

  // Find the current (active) stage
  const activeStage = process.stages.find(s => s.status === 'active')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Processo</h1>
        <p className="text-xs text-muted-foreground">Ref: {process.external_ref}</p>
      </div>

      {/* Progress bar */}
      <Card className="rounded-xl shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Progresso geral</p>
            <Badge variant="secondary" className="text-xs">{process.percent_complete}%</Badge>
          </div>
          <Progress value={process.percent_complete} className="h-2.5" />
        </CardContent>
      </Card>

      {/* Stepper */}
      {process.stages.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Fases do Processo
          </h2>
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-4">
              <ProcessStepper stages={process.stages} />
            </CardContent>
          </Card>
        </section>
      )}

      {/* Current stage action */}
      {activeStage && (
        <Card className="rounded-xl shadow-sm border-primary/30">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <p className="text-sm font-medium">Fase actual: {activeStage.name}</p>
            </div>
            {missingDocs.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {missingDocs.length} documento{missingDocs.length !== 1 ? 's' : ''} em falta
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Documents by status */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Documentos
        </h2>

        {missingDocs.length > 0 && (
          <DocumentGroup title="Em Falta" docs={missingDocs} defaultOpen />
        )}
        {pendingDocs.length > 0 && (
          <DocumentGroup title="Pendentes" docs={pendingDocs} defaultOpen />
        )}
        {rejectedDocs.length > 0 && (
          <DocumentGroup title="Rejeitados" docs={rejectedDocs} defaultOpen />
        )}
        {approvedDocs.length > 0 && (
          <DocumentGroup title="Aprovados" docs={approvedDocs} />
        )}

        {documents.length === 0 && (
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Sem documentos associados.</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Timeline */}
      {events.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Historico
          </h2>
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-4 space-y-4">
              {events.map((event) => (
                <EventItem key={event.id} event={event} />
              ))}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  )
}

function ProcessStepper({ stages }: { stages: ProcessStage[] }) {
  return (
    <div className="space-y-0">
      {stages.map((stage, i) => {
        const isLast = i === stages.length - 1
        return (
          <div key={stage.id} className="flex gap-3">
            {/* Dot and line column */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 border-2',
                  stage.status === 'completed'
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : stage.status === 'active'
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-background border-muted-foreground/30 text-muted-foreground'
                )}
              >
                {stage.status === 'completed' ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'w-0.5 flex-1 min-h-6',
                    stage.status === 'completed' ? 'bg-emerald-500' : 'bg-muted'
                  )}
                />
              )}
            </div>

            {/* Content */}
            <div className={cn('pb-4', isLast && 'pb-0')}>
              <p className={cn(
                'text-sm font-medium leading-7',
                stage.status === 'active' && 'text-primary',
                stage.status === 'pending' && 'text-muted-foreground',
              )}>
                {stage.name}
              </p>
              {stage.status === 'active' && (
                <p className="text-xs text-muted-foreground mt-0.5">Em progresso</p>
              )}
              {stage.status === 'completed' && (
                <p className="text-xs text-emerald-600 mt-0.5">Concluida</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DocumentGroup({
  title, docs, defaultOpen = false,
}: {
  title: string
  docs: ProcessDocument[]
  defaultOpen?: boolean
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <Card className="rounded-xl shadow-sm">
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{title}</p>
              <Badge variant="secondary" className="text-xs">{docs.length}</Badge>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-2">
            {docs.map((doc) => (
              <DocumentItem key={doc.id} doc={doc} />
            ))}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function DocumentItem({ doc }: { doc: ProcessDocument }) {
  const config = DOC_STATUS_CONFIG[doc.status]
  const Icon = config.icon
  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
      <div className={cn('shrink-0 h-8 w-8 rounded-lg flex items-center justify-center', config.className)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{doc.name}</p>
        <Badge className={cn('text-[10px] mt-0.5', config.className)}>{config.label}</Badge>
      </div>
      {doc.status === 'missing' && (
        <Button variant="outline" size="sm" className="shrink-0 rounded-lg text-xs h-8">
          <Upload className="h-3 w-3 mr-1" />
          Enviar
        </Button>
      )}
    </div>
  )
}

function EventItem({ event }: { event: ProcessEvent }) {
  const date = new Date(event.created_at)
  const formatted = date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
  return (
    <div className="flex gap-3 items-start">
      <div className="h-2 w-2 rounded-full bg-muted-foreground/40 mt-1.5 shrink-0" />
      <div className="flex-1">
        <p className="text-sm">{event.description}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{formatted}</p>
      </div>
    </div>
  )
}

function ProcessSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    </div>
  )
}
