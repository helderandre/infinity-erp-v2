'use client'

import { cn } from '@/lib/utils'
import { CREDIT_LIMITS } from '@/lib/constants'
import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react'
import type { CreditRequestWithRelations, CreditMetrics } from '@/types/credit'

interface CreditAlertsProps {
  request: CreditRequestWithRelations
  metrics: CreditMetrics | null
}

interface Alert {
  severity: 'high' | 'medium' | 'low'
  message: string
}

function getLtvLimit(finalidade: string | null | undefined): number | null {
  switch (finalidade) {
    case 'habitacao_propria_permanente':
      return CREDIT_LIMITS.LTV_MAX_HPP
    case 'habitacao_propria_secundaria':
      return CREDIT_LIMITS.LTV_MAX_HPS
    case 'investimento':
      return CREDIT_LIMITS.LTV_MAX_INVESTIMENTO
    default:
      return null
  }
}

function buildAlerts(
  request: CreditRequestWithRelations,
  metrics: CreditMetrics | null
): Alert[] {
  const alerts: Alert[] = []
  const now = new Date()

  // Docs pendentes obrigatorios
  const docsPendentes = request.documentos.filter(
    (d) => d.obrigatorio && (d.status === 'pendente' || d.status === 'solicitado')
  ).length
  if (docsPendentes > 0) {
    alerts.push({
      severity: 'high',
      message: `${docsPendentes} documento${docsPendentes > 1 ? 's' : ''} obrigatório${docsPendentes > 1 ? 's' : ''} em falta`,
    })
  }

  // Propostas < 3 (DL 81-C/2017)
  const totalPropostas = metrics?.total_propostas ?? request.propostas.length
  if (totalPropostas < CREDIT_LIMITS.MIN_PROPOSTAS_REGULATORIO) {
    alerts.push({
      severity: 'medium',
      message: `Apenas ${totalPropostas} proposta${totalPropostas !== 1 ? 's' : ''} — regulamento DL 81-C/2017 exige mínimo de ${CREDIT_LIMITS.MIN_PROPOSTAS_REGULATORIO}`,
    })
  }

  // Taxa de esforco
  const taxaEsforco = request.taxa_esforco
  if (taxaEsforco != null) {
    if (taxaEsforco >= CREDIT_LIMITS.TAXA_ESFORCO_MAX) {
      alerts.push({
        severity: 'high',
        message: `Taxa de esforco de ${taxaEsforco.toFixed(1)}% excede o limite máximo de ${CREDIT_LIMITS.TAXA_ESFORCO_MAX}%`,
      })
    } else if (taxaEsforco >= CREDIT_LIMITS.TAXA_ESFORCO_RECOMENDADO) {
      alerts.push({
        severity: 'medium',
        message: `Taxa de esforco de ${taxaEsforco.toFixed(1)}% acima do recomendado pelo BdP (${CREDIT_LIMITS.TAXA_ESFORCO_RECOMENDADO}%)`,
      })
    }
  }

  // LTV acima do limite
  const ltvLimit = getLtvLimit(request.imovel_finalidade)
  if (request.ltv_calculado != null && ltvLimit != null && request.ltv_calculado > ltvLimit) {
    alerts.push({
      severity: 'high',
      message: `LTV de ${request.ltv_calculado.toFixed(1)}% excede o limite de ${ltvLimit}% para esta finalidade`,
    })
  }

  // Propostas a expirar dentro de 15 dias
  for (const p of request.propostas) {
    if (p.data_validade_aprovacao && p.status === 'aprovada') {
      const expiry = new Date(p.data_validade_aprovacao)
      const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysLeft >= 0 && daysLeft <= 15) {
        alerts.push({
          severity: daysLeft <= 5 ? 'high' : 'medium',
          message: `Aprovação do ${p.banco} expira em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''} (${new Intl.DateTimeFormat('pt-PT').format(expiry)})`,
        })
      }
    }
  }

  // Idade + prazo > 75
  if (request.data_nascimento_titular && request.prazo_anos) {
    const birthDate = new Date(request.data_nascimento_titular)
    const age = Math.floor(
      (now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    )
    const total = age + request.prazo_anos
    if (total > CREDIT_LIMITS.IDADE_MAX_FIM_CONTRATO) {
      alerts.push({
        severity: 'high',
        message: `Idade do titular (${age}) + prazo (${request.prazo_anos} anos) = ${total}, excede o limite de ${CREDIT_LIMITS.IDADE_MAX_FIM_CONTRATO} anos`,
      })
    }
  }

  return alerts
}

const severityConfig = {
  high: {
    bg: 'bg-red-500/10',
    text: 'text-red-700',
    icon: AlertCircle,
  },
  medium: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-700',
    icon: AlertTriangle,
  },
  low: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-700',
    icon: AlertTriangle,
  },
}

export function CreditAlerts({ request, metrics }: CreditAlertsProps) {
  const alerts = buildAlerts(request, metrics)

  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
        <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
        <span className="text-sm text-emerald-700">
          Sem alertas. Todos os indicadores dentro dos limites.
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => {
        const config = severityConfig[alert.severity]
        const Icon = config.icon
        return (
          <div
            key={i}
            className={cn(
              'flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm',
              config.bg,
              config.text
            )}
          >
            <Icon className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{alert.message}</span>
          </div>
        )
      })}
    </div>
  )
}
