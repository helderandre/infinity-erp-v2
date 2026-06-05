'use client'

import { useMemo } from 'react'
import { Check, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PROPOSAL_STATUS_COLORS } from '@/lib/constants'
import type { CreditProposal } from '@/types/credit'
import { Button } from '@/components/ui/button'

const fmt = (value: number | null | undefined) => {
  if (value == null) return '-'
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value)
}

const fmtPct = (value: number | null | undefined) => {
  if (value == null) return '-'
  return `${value.toFixed(2)}%`
}

interface CreditProposalComparisonProps {
  proposals: CreditProposal[]
  onSelect: (proposalId: string) => Promise<void>
}

interface ComparisonRow {
  label: string
  key: string
  format: 'currency' | 'percent' | 'years' | 'text' | 'bool'
  lowerIsBetter?: boolean
}

const COMPARISON_ROWS: ComparisonRow[] = [
  { label: 'Montante Aprovado', key: 'montante_aprovado', format: 'currency' },
  { label: 'Prazo', key: 'prazo_aprovado_anos', format: 'years' },
  { label: 'Spread', key: 'spread', format: 'percent', lowerIsBetter: true },
  { label: 'TAEG', key: 'taeg', format: 'percent', lowerIsBetter: true },
  { label: 'Prestacao Mensal', key: 'prestacao_mensal', format: 'currency', lowerIsBetter: true },
  { label: 'MTIC', key: 'mtic', format: 'currency', lowerIsBetter: true },
  { label: 'LTV', key: 'ltv_aprovado', format: 'percent', lowerIsBetter: true },
  { label: 'Seguro Vida (mensal)', key: 'seguro_vida_mensal', format: 'currency', lowerIsBetter: true },
  { label: 'Seguro MR (anual)', key: 'seguro_multirriscos_anual', format: 'currency', lowerIsBetter: true },
  { label: 'Custo Avaliacao', key: 'comissao_avaliacao', format: 'currency', lowerIsBetter: true },
  { label: 'Custo Dossier', key: 'comissao_dossier', format: 'currency', lowerIsBetter: true },
  { label: 'Custo Formalizacao', key: 'comissao_formalizacao', format: 'currency', lowerIsBetter: true },
  { label: 'Domiciliacao Salario', key: 'exige_domiciliacao_salario', format: 'bool' },
  { label: 'Cartao Credito', key: 'exige_cartao_credito', format: 'bool' },
  { label: 'Seguros Banco', key: 'exige_seguros_banco', format: 'bool' },
  { label: 'Condicoes Especiais', key: 'condicoes_especiais', format: 'text' },
  { label: 'Validade', key: 'data_validade_aprovacao', format: 'text' },
]

export function CreditProposalComparison({ proposals, onSelect }: CreditProposalComparisonProps) {
  const bestValues = useMemo(() => {
    const bests: Record<string, number> = {}
    COMPARISON_ROWS.forEach((row) => {
      if (row.lowerIsBetter) {
        const values = proposals
          .map((p) => (p as unknown as Record<string, unknown>)[row.key])
          .filter((v): v is number => typeof v === 'number' && v > 0)
        if (values.length > 0) {
          bests[row.key] = Math.min(...values)
        }
      }
    })
    return bests
  }, [proposals])

  const totalCustos = (p: CreditProposal) => {
    return (p.comissao_avaliacao ?? 0) + (p.comissao_dossier ?? 0) + (p.comissao_formalizacao ?? 0)
  }

  const formatValue = (proposal: CreditProposal, row: ComparisonRow): string => {
    const val = (proposal as unknown as Record<string, unknown>)[row.key]
    switch (row.format) {
      case 'currency':
        return fmt(val as number | null)
      case 'percent':
        return fmtPct(val as number | null)
      case 'years':
        return val != null ? `${val} anos` : '-'
      case 'bool':
        return val ? 'Sim' : 'Nao'
      case 'text':
        if (row.key === 'data_validade_aprovacao' && val) {
          return new Date(val as string).toLocaleDateString('pt-PT')
        }
        return (val as string) || '-'
      default:
        return String(val ?? '-')
    }
  }

  const isBest = (proposal: CreditProposal, row: ComparisonRow): boolean => {
    if (!row.lowerIsBetter) return false
    const val = (proposal as unknown as Record<string, unknown>)[row.key]
    if (typeof val !== 'number') return false
    return val === bestValues[row.key]
  }

  const isWarning = (proposal: CreditProposal, row: ComparisonRow): boolean => {
    if (row.format !== 'bool') return false
    return !!(proposal as unknown as Record<string, unknown>)[row.key]
  }

  if (proposals.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma proposta para comparar.</p>
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-4 font-medium text-muted-foreground w-40" />
              {proposals.map((p) => {
                const statusConfig = PROPOSAL_STATUS_COLORS[p.status]
                return (
                  <th key={p.id} className="text-center py-2 px-3 min-w-[140px]">
                    <div className="space-y-1">
                      <p className="font-semibold text-sm">{p.banco}</p>
                      {statusConfig && (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                            statusConfig.bg,
                            statusConfig.text
                          )}
                        >
                          <span className={cn('h-1 w-1 rounded-full', statusConfig.dot)} />
                          {statusConfig.label}
                        </span>
                      )}
                      {p.is_selected && (
                        <span className="block text-[10px] font-medium text-primary">Seleccionada</span>
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row) => (
              <tr key={row.key} className="border-b last:border-0">
                <td className="py-2 pr-4 text-xs font-medium text-muted-foreground whitespace-nowrap">
                  {row.label}
                </td>
                {proposals.map((p) => {
                  const best = isBest(p, row)
                  const warn = isWarning(p, row)
                  return (
                    <td
                      key={p.id}
                      className={cn(
                        'py-2 px-3 text-center text-xs',
                        best && 'font-semibold text-emerald-600',
                        warn && 'text-amber-600'
                      )}
                    >
                      <span className="inline-flex items-center gap-1">
                        {formatValue(p, row)}
                        {best && <span className="text-amber-500" title="Melhor valor">&#9733;</span>}
                        {warn && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
            {/* Total custos iniciais */}
            <tr className="border-t-2">
              <td className="py-2 pr-4 text-xs font-semibold">Total Custos Iniciais</td>
              {proposals.map((p) => (
                <td key={p.id} className="py-2 px-3 text-center text-xs font-semibold">
                  {fmt(totalCustos(p))}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Accept buttons */}
      <div className="flex items-center gap-3 justify-end pt-2 border-t">
        {proposals.map((p) => (
          <Button
            key={p.id}
            size="sm"
            variant={p.is_selected ? 'default' : 'outline'}
            onClick={() => onSelect(p.id)}
            disabled={p.is_selected}
          >
            {p.is_selected ? (
              <>
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Seleccionada
              </>
            ) : (
              `Aceitar ${p.banco}`
            )}
          </Button>
        ))}
      </div>
    </div>
  )
}
