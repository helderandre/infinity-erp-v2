'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CreditStatusBadge } from '@/components/credit/credit-status-badge'
import { CreditStepper } from '@/components/credit/credit-stepper'
import { CreditFinancialSummary } from '@/components/credit/credit-financial-summary'
import { CreditAlerts } from '@/components/credit/credit-alerts'
import { CreditProposalsTab } from '@/components/credit/credit-proposals-tab'
import { CreditDocumentsTab } from '@/components/credit/credit-documents-tab'
import { CreditSimulator } from '@/components/credit/credit-simulator'
import { CreditActivityTimeline } from '@/components/credit/credit-activity-timeline'
import { useCreditRequest } from '@/hooks/use-credit-request'
import { useCreditProposals } from '@/hooks/use-credit-proposals'
import { useCreditDocuments } from '@/hooks/use-credit-documents'
import { useCreditActivities } from '@/hooks/use-credit-activities'
import { useCreditBanks } from '@/hooks/use-credit-banks'
import { ArrowLeft, Pencil } from 'lucide-react'

export default function CreditoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const { request, metrics, isLoading, error, refetch } = useCreditRequest(id)
  const { proposals, refetch: refetchProposals } = useCreditProposals(id)
  const { documents, progress, refetch: refetchDocs } = useCreditDocuments(id)
  const { activities, addActivity } = useCreditActivities(id)
  const { banks } = useCreditBanks()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    )
  }

  if (error || !request) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12">
        <p className="text-muted-foreground">{error || 'Pedido não encontrado'}</p>
        <Button variant="outline" onClick={() => router.back()}>Voltar</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/credito')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{request.reference}</h1>
              <CreditStatusBadge status={request.status} />
            </div>
            <p className="text-muted-foreground">
              Cliente: {request.lead?.nome}
              {request.property && ` — Imóvel: ${request.property.title}`}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => router.push(`/dashboard/credito/${id}/editar`)}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </Button>
      </div>

      {/* Stepper */}
      <CreditStepper currentStatus={request.status} />

      {/* Tabs */}
      <Tabs defaultValue="resumo">
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="propostas">
            Propostas ({proposals.length})
          </TabsTrigger>
          <TabsTrigger value="documentos">
            Documentos ({progress.completed}/{progress.total})
          </TabsTrigger>
          <TabsTrigger value="simulacoes">Simulações</TabsTrigger>
          <TabsTrigger value="actividade">Actividade</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="mt-4 space-y-6">
          <CreditAlerts request={request} metrics={metrics} />
          <CreditFinancialSummary request={request} />
        </TabsContent>

        <TabsContent value="propostas" className="mt-4">
          <CreditProposalsTab
            creditId={id}
            proposals={proposals}
            onRefresh={() => { refetchProposals(); refetch() }}
          />
        </TabsContent>

        <TabsContent value="documentos" className="mt-4">
          <CreditDocumentsTab
            creditId={id}
            documents={documents}
            progress={progress}
            onRefresh={() => { refetchDocs(); refetch() }}
            banks={banks}
          />
        </TabsContent>

        <TabsContent value="simulacoes" className="mt-4">
          <CreditSimulator
            creditId={id}
            initialValues={{
              valor_imovel: request.imovel_valor_avaliacao || undefined,
              montante_credito: request.montante_solicitado || undefined,
              prazo_anos: request.prazo_anos || undefined,
              rendimento_mensal: request.rendimento_mensal_liquido || undefined,
            }}
          />
        </TabsContent>

        <TabsContent value="actividade" className="mt-4">
          <CreditActivityTimeline
            activities={activities}
            onAddActivity={addActivity}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
