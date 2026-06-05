'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency } from '@/lib/utils'
import { CREDIT_LIMITS } from '@/lib/constants'
import {
  Wallet,
  CreditCard,
  Percent,
  AlertTriangle,
} from 'lucide-react'
import type { CreditRequestWithRelations } from '@/types/credit'

interface CreditFinancialSummaryProps {
  request: CreditRequestWithRelations
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${value.toFixed(1)}%`
}

function getRateTypeLabel(tipo: string): string {
  const map: Record<string, string> = {
    variavel: 'Variável',
    fixa: 'Fixa',
    mista: 'Mista',
  }
  return map[tipo] ?? tipo
}

export function CreditFinancialSummary({ request }: CreditFinancialSummaryProps) {
  const totalEncargos =
    request.encargos_creditos_existentes +
    request.encargos_cartoes +
    request.encargos_pensao_alimentos +
    request.outros_encargos +
    request.despesas_fixas_mensais

  const rendimentoTotal =
    (request.rendimento_mensal_liquido ?? 0) +
    (request.outros_rendimentos ?? 0) +
    (request.tem_segundo_titular ? (request.segundo_titular_rendimento_liquido ?? 0) : 0)

  const disponivel = rendimentoTotal - totalEncargos

  const taxaEsforco = request.taxa_esforco

  // Build alerts
  const alerts: { message: string; severity: 'high' | 'medium' | 'low' }[] = []

  const docsPendentes = request.documentos.filter(
    (d) => d.obrigatorio && (d.status === 'pendente' || d.status === 'solicitado')
  ).length
  if (docsPendentes > 0) {
    alerts.push({
      message: `${docsPendentes} documento${docsPendentes > 1 ? 's' : ''} obrigatório${docsPendentes > 1 ? 's' : ''} em falta`,
      severity: 'high',
    })
  }

  if (request.propostas.length < CREDIT_LIMITS.MIN_PROPOSTAS_REGULATORIO) {
    alerts.push({
      message: `Menos de ${CREDIT_LIMITS.MIN_PROPOSTAS_REGULATORIO} propostas (DL 81-C/2017)`,
      severity: 'medium',
    })
  }

  if (taxaEsforco != null && taxaEsforco >= CREDIT_LIMITS.TAXA_ESFORCO_MAX) {
    alerts.push({ message: 'Taxa de esforco excede 50%', severity: 'high' })
  } else if (taxaEsforco != null && taxaEsforco >= CREDIT_LIMITS.TAXA_ESFORCO_RECOMENDADO) {
    alerts.push({ message: 'Taxa de esforco acima de 35%', severity: 'medium' })
  }

  const ltvLimit = getLtvLimit(request.imovel_finalidade)
  if (request.ltv_calculado != null && ltvLimit != null && request.ltv_calculado > ltvLimit) {
    alerts.push({
      message: `LTV (${formatPercent(request.ltv_calculado)}) acima do limite de ${ltvLimit}%`,
      severity: 'high',
    })
  }

  // Proposal expiring within 15 days
  const now = new Date()
  for (const p of request.propostas) {
    if (p.data_validade_aprovacao && p.status === 'aprovada') {
      const expiry = new Date(p.data_validade_aprovacao)
      const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysLeft >= 0 && daysLeft <= 15) {
        alerts.push({
          message: `Proposta ${p.banco} expira em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}`,
          severity: daysLeft <= 5 ? 'high' : 'medium',
        })
      }
    }
  }

  // Age + term > 75
  if (request.data_nascimento_titular && request.prazo_anos) {
    const birthDate = new Date(request.data_nascimento_titular)
    const age = Math.floor(
      (now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    )
    if (age + request.prazo_anos > CREDIT_LIMITS.IDADE_MAX_FIM_CONTRATO) {
      alerts.push({
        message: `Idade (${age}) + prazo (${request.prazo_anos} anos) = ${age + request.prazo_anos}, excede ${CREDIT_LIMITS.IDADE_MAX_FIM_CONTRATO}`,
        severity: 'high',
      })
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Perfil Financeiro */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            Perfil Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rendimento total</span>
            <span className="font-medium">{formatCurrency(rendimentoTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Encargos mensais</span>
            <span className="font-medium text-red-600">-{formatCurrency(totalEncargos)}</span>
          </div>
          <div className="border-t pt-2 flex justify-between">
            <span className="text-muted-foreground">Disponivel</span>
            <span className={cn('font-semibold', disponivel >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {formatCurrency(disponivel)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Credito Pretendido */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Credito Pretendido
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Montante</span>
            <span className="font-medium">{formatCurrency(request.montante_solicitado)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Prazo</span>
            <span className="font-medium">
              {request.prazo_anos != null ? `${request.prazo_anos} anos` : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tipo de taxa</span>
            <span className="font-medium">{getRateTypeLabel(request.tipo_taxa)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">LTV</span>
            <span className="font-medium">{formatPercent(request.ltv_calculado)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Taxa de Esforco */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Percent className="h-4 w-4 text-muted-foreground" />
            Taxa de Esforco
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-2">
            <span
              className={cn(
                'text-4xl font-bold',
                taxaEsforco == null
                  ? 'text-muted-foreground'
                  : taxaEsforco < CREDIT_LIMITS.TAXA_ESFORCO_RECOMENDADO
                    ? 'text-emerald-600'
                    : taxaEsforco < CREDIT_LIMITS.TAXA_ESFORCO_MAX
                      ? 'text-amber-500'
                      : 'text-red-600'
              )}
            >
              {taxaEsforco != null ? `${taxaEsforco.toFixed(1)}%` : '—'}
            </span>
            <span className="text-xs text-muted-foreground text-center">
              Ref. BdP: max. recomendado {CREDIT_LIMITS.TAXA_ESFORCO_RECOMENDADO}% | max. absoluto {CREDIT_LIMITS.TAXA_ESFORCO_MAX}%
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Alertas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            Alertas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Sem alertas de momento.</p>
          ) : (
            <ul className="space-y-1.5">
              {alerts.map((alert, i) => (
                <li
                  key={i}
                  className={cn(
                    'flex items-start gap-2 text-xs rounded-md px-2 py-1.5',
                    alert.severity === 'high' && 'bg-red-500/10 text-red-700',
                    alert.severity === 'medium' && 'bg-amber-500/10 text-amber-700',
                    alert.severity === 'low' && 'bg-blue-500/10 text-blue-700'
                  )}
                >
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{alert.message}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
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
