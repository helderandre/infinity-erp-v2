'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, Building2, MapPin, Users, Pause, Play, Clock } from 'lucide-react'
import { StatusBadge } from '@/components/shared/status-badge'
import { ProcessStepper } from '@/components/processes/process-stepper'
import { ProcessReviewSection } from '@/components/processes/process-review-section'
import { ProcessTasksSection } from '@/components/processes/process-tasks-section'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'
import type { ProcessDetail } from '@/types/process'

export default function ProcessoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [process, setProcess] = useState<ProcessDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadProcess()
  }, [params.id])

  const loadProcess = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/processes/${params.id}`)
      if (!response.ok) {
        throw new Error('Processo não encontrado')
      }
      const data = await response.json()
      setProcess(data)
    } catch (error: any) {
      console.error('Erro ao carregar processo:', error)
      toast.error(error.message || 'Erro ao carregar processo')
      router.push('/dashboard/processos')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprove = async (tplProcessId: string) => {
    try {
      console.log('[DEBUG handleApprove] Enviando POST com tpl_process_id:', tplProcessId)
      const response = await fetch(`/api/processes/${params.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tpl_process_id: tplProcessId }),
      })

      console.log('[DEBUG handleApprove] Response status:', response.status, 'method enviado: POST')

      const responseText = await response.text()
      console.log('[DEBUG handleApprove] Response body:', responseText)

      if (!response.ok) {
        let errorMessage = 'Erro ao aprovar processo'
        if (responseText) {
          try {
            const errorData = JSON.parse(responseText)
            errorMessage = errorData.error || errorMessage
          } catch {
            errorMessage = `Erro ${response.status}: ${responseText || 'Resposta vazia do servidor'}`
          }
        } else {
          errorMessage = `Erro ${response.status}: Resposta vazia do servidor (verifique se o método HTTP está correcto)`
        }
        throw new Error(errorMessage)
      }

      let result: any = {}
      if (responseText) {
        try {
          result = JSON.parse(responseText)
        } catch {
          console.warn('[DEBUG handleApprove] Não foi possível parsear resposta como JSON')
        }
      }

      toast.success(
        result.template_name
          ? `Processo aprovado com template "${result.template_name}"!`
          : 'Processo aprovado com sucesso!'
      )
      loadProcess()
    } catch (error: any) {
      console.error('[DEBUG handleApprove] Erro:', error)
      toast.error(error.message)
    }
  }

  const handleReturn = async (reason: string) => {
    try {
      const response = await fetch(`/api/processes/${params.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao devolver processo')
      }

      toast.success('Processo devolvido com sucesso!')
      loadProcess()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleReject = async (reason: string) => {
    try {
      const response = await fetch(`/api/processes/${params.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao rejeitar processo')
      }

      toast.success('Processo rejeitado com sucesso!')
      loadProcess()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleHold = async (action: 'pause' | 'resume', reason?: string) => {
    try {
      const response = await fetch(`/api/processes/${params.id}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Erro ao ${action === 'pause' ? 'pausar' : 'reactivar'} processo`)
      }

      toast.success(
        action === 'pause'
          ? 'Processo pausado com sucesso!'
          : 'Processo reactivado com sucesso!'
      )
      loadProcess()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!process) {
    return null
  }

  const { instance, stages, owners, documents } = process
  const property = instance.property

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/processos">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{instance.external_ref}</h1>
            <StatusBadge status={instance.current_status ?? 'pending_approval'} type="process" />
            {/* Botões de Pausa/Reactivação */}
            {instance.current_status === 'active' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleHold('pause')}
              >
                <Pause className="mr-2 h-4 w-4" />
                Pausar
              </Button>
            )}
            {instance.current_status === 'on_hold' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleHold('resume')}
              >
                <Play className="mr-2 h-4 w-4" />
                Reactivar
              </Button>
            )}
          </div>
          <p className="text-muted-foreground">{property?.title}</p>
        </div>
      </div>

      {/* Barra de Progresso Geral */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Progresso Geral</span>
            </div>
            <span className="text-sm font-semibold">{instance.percent_complete}%</span>
          </div>
          <Progress value={instance.percent_complete ?? 0} className="h-3" />
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>
              {instance.started_at ? `Iniciado: ${formatDate(instance.started_at)}` : 'Não iniciado'}
            </span>
            {instance.completed_at && (
              <span>Concluído: {formatDate(instance.completed_at)}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stepper de Progresso */}
      {stages && stages.length > 0 && <ProcessStepper stages={stages} />}

      {/* Secção de Revisão (apenas para pending_approval e returned) */}
      {['pending_approval', 'returned'].includes(instance.current_status ?? '') && (
        <ProcessReviewSection
          process={instance}
          property={property}
          owners={owners}
          documents={documents}
          onApprove={handleApprove}
          onReturn={handleReturn}
          onReject={handleReject}
        />
      )}

      {/* Motivo de Rejeição */}
      {instance.current_status === 'rejected' && instance.rejected_reason && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-red-800 mb-1">Motivo da Rejeição:</p>
            <p className="text-sm text-red-700">{instance.rejected_reason}</p>
            {instance.rejected_by_user && (
              <p className="text-xs text-red-600 mt-2">
                Por: {instance.rejected_by_user.commercial_name} em {formatDate(instance.rejected_at)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Processo Pausado */}
      {instance.current_status === 'on_hold' && instance.notes && (
        <Card className="border-slate-200 bg-slate-50/50">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-slate-800 mb-1">Processo Pausado</p>
            <p className="text-sm text-slate-700">{instance.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Informação do Imóvel */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Imóvel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tipo</span>
              <span className="font-medium">{property?.property_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Preço</span>
              <span className="font-medium">
                {property?.listing_price ? formatCurrency(property.listing_price) : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estado</span>
              <StatusBadge status={property?.status ?? ''} type="property" showDot={false} />
            </div>
            {instance.requested_by_user && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Consultor</span>
                <span className="font-medium">{instance.requested_by_user.commercial_name}</span>
              </div>
            )}
            {instance.approved_by_user && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aprovado por</span>
                <span className="font-medium">{instance.approved_by_user.commercial_name}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Localização
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cidade</span>
              <span className="font-medium">{property?.city || '—'}</span>
            </div>
            {instance.started_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Iniciado</span>
                <span className="font-medium">{formatDate(instance.started_at)}</span>
              </div>
            )}
            {instance.approved_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aprovado</span>
                <span className="font-medium">{formatDate(instance.approved_at)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Proprietários */}
      {owners && owners.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Proprietários ({owners.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {owners.map((owner: any) => (
                <div
                  key={owner.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium">{owner.name}</p>
                    <p className="text-xs text-muted-foreground">
                      NIF: {owner.nif || '—'} • {owner.person_type === 'singular' ? 'Pessoa Singular' : 'Pessoa Colectiva'}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <div>{owner.ownership_percentage}%</div>
                    {owner.is_main_contact && (
                      <div className="text-xs text-primary">Contacto Principal</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tarefas (apenas para processos activos) */}
      {['active', 'on_hold', 'completed'].includes(instance.current_status ?? '') && stages && (
        <ProcessTasksSection
          processId={instance.id}
          propertyId={instance.property_id}
          stages={stages}
          processDocuments={documents}
          onTaskUpdate={loadProcess}
        />
      )}
    </div>
  )
}
