'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calculator, Save, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { CREDIT_LIMITS } from '@/lib/constants'
import { useCreditSimulator } from '@/hooks/use-credit-simulator'
import type { SimulationInput } from '@/types/credit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const fmt = (value: number | null | undefined) => {
  if (value == null) return '-'
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value)
}

const fmtPct = (value: number | null | undefined) => {
  if (value == null) return '-'
  return `${value.toFixed(2)}%`
}

interface CreditSimulatorProps {
  creditId?: string
  initialValues?: Partial<SimulationInput>
}

export function CreditSimulator({ creditId, initialValues }: CreditSimulatorProps) {
  const { result, stressTest, isCalculating, calculate, save } = useCreditSimulator()

  const [valorImovel, setValorImovel] = useState(initialValues?.valor_imovel?.toString() ?? '200000')
  const [montanteCredito, setMontanteCredito] = useState(initialValues?.montante_credito?.toString() ?? '160000')
  const [prazoAnos, setPrazoAnos] = useState(initialValues?.prazo_anos ?? 30)
  const [euribor, setEuribor] = useState(initialValues?.euribor?.toString() ?? '3.00')
  const [spread, setSpread] = useState(initialValues?.spread?.toString() ?? '0.90')
  const [rendimentoMensal, setRendimentoMensal] = useState(
    initialValues?.rendimento_mensal?.toString() ?? ''
  )
  const [isSaving, setIsSaving] = useState(false)

  const capitalProprio = (parseFloat(valorImovel) || 0) - (parseFloat(montanteCredito) || 0)

  const handleCalculate = useCallback(() => {
    const vi = parseFloat(valorImovel)
    const mc = parseFloat(montanteCredito)
    const e = parseFloat(euribor)
    const s = parseFloat(spread)
    const rm = parseFloat(rendimentoMensal) || undefined

    if (!vi || !mc || isNaN(e) || isNaN(s) || !prazoAnos) {
      toast.error('Preencha todos os campos obrigatorios.')
      return
    }

    if (mc > vi) {
      toast.error('O montante de credito nao pode exceder o valor do imovel.')
      return
    }

    const params: SimulationInput = {
      valor_imovel: vi,
      montante_credito: mc,
      prazo_anos: prazoAnos,
      euribor: e,
      spread: s,
      rendimento_mensal: rm,
    }

    calculate(params)
  }, [valorImovel, montanteCredito, prazoAnos, euribor, spread, rendimentoMensal, calculate])

  const handleSave = async () => {
    if (!creditId || !result) return
    setIsSaving(true)
    try {
      await save(creditId, {
        valor_imovel: parseFloat(valorImovel),
        montante_credito: parseFloat(montanteCredito),
        prazo_anos: prazoAnos,
        euribor: parseFloat(euribor),
        spread: parseFloat(spread),
        rendimento_mensal: parseFloat(rendimentoMensal) || undefined,
      })
      toast.success('Simulacao guardada com sucesso')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar simulacao')
    } finally {
      setIsSaving(false)
    }
  }

  // Auto-calculate montante when valor changes
  useEffect(() => {
    if (!initialValues?.montante_credito) {
      const vi = parseFloat(valorImovel) || 0
      setMontanteCredito(Math.round(vi * 0.8).toString())
    }
  }, []) // Only on mount if no initial montante

  return (
    <div className="space-y-6">
      {/* Input fields */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Parametros da Simulacao
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="sim-valor-imovel">Valor do Imovel</Label>
              <Input
                id="sim-valor-imovel"
                type="number"
                step="1000"
                value={valorImovel}
                onChange={(e) => setValorImovel(e.target.value)}
                placeholder="200000"
              />
            </div>
            <div>
              <Label htmlFor="sim-montante">Montante de Credito</Label>
              <Input
                id="sim-montante"
                type="number"
                step="1000"
                value={montanteCredito}
                onChange={(e) => setMontanteCredito(e.target.value)}
                placeholder="160000"
              />
            </div>
            <div>
              <Label>Capital Proprio</Label>
              <div className="h-9 flex items-center px-3 rounded-md border bg-muted/50 text-sm font-medium">
                {fmt(capitalProprio)}
              </div>
            </div>
          </div>

          {/* Prazo slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Prazo: {prazoAnos} anos ({prazoAnos * 12} prestacoes)</Label>
              <span className="text-xs text-muted-foreground">Max. {CREDIT_LIMITS.PRAZO_MAX_ANOS} anos</span>
            </div>
            <Slider
              value={[prazoAnos]}
              onValueChange={([v]) => setPrazoAnos(v)}
              min={5}
              max={CREDIT_LIMITS.PRAZO_MAX_ANOS}
              step={1}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="sim-euribor">Euribor (%)</Label>
              <Input
                id="sim-euribor"
                type="number"
                step="0.01"
                value={euribor}
                onChange={(e) => setEuribor(e.target.value)}
                placeholder="3.00"
              />
            </div>
            <div>
              <Label htmlFor="sim-spread">Spread (%)</Label>
              <Input
                id="sim-spread"
                type="number"
                step="0.01"
                value={spread}
                onChange={(e) => setSpread(e.target.value)}
                placeholder="0.90"
              />
            </div>
            <div>
              <Label htmlFor="sim-rendimento">Rendimento Mensal Liquido</Label>
              <Input
                id="sim-rendimento"
                type="number"
                step="100"
                value={rendimentoMensal}
                onChange={(e) => setRendimentoMensal(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button onClick={handleCalculate} disabled={isCalculating}>
              {isCalculating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="mr-2 h-4 w-4" />
              )}
              Calcular
            </Button>
            {creditId && result && (
              <Button variant="outline" onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Guardar Simulacao
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Main results */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Resultados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <ResultCard
                  label="Prestacao Mensal"
                  value={fmt(result.prestacao_mensal)}
                  highlight
                />
                <ResultCard label="Total Juros" value={fmt(result.total_juros)} />
                <ResultCard label="MTIC" value={fmt(result.mtic)} />
                <ResultCard
                  label="LTV"
                  value={fmtPct(result.ltv)}
                  warning={result.ltv > CREDIT_LIMITS.LTV_MAX_HPP}
                />
                <ResultCard
                  label="Taxa de Esforco"
                  value={result.taxa_esforco != null ? fmtPct(result.taxa_esforco) : 'N/A'}
                  warning={
                    result.taxa_esforco != null &&
                    result.taxa_esforco > CREDIT_LIMITS.TAXA_ESFORCO_ALERTA
                  }
                  danger={
                    result.taxa_esforco != null &&
                    result.taxa_esforco > CREDIT_LIMITS.TAXA_ESFORCO_MAX
                  }
                />
                <ResultCard
                  label="Encargo Mensal Total"
                  value={fmt(result.encargo_credito_mensal)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Custos Portugal */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Custos e Impostos (Portugal)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <ResultCard
                  label="IS sobre Credito (0,6%)"
                  value={fmt(result.imposto_selo_credito)}
                />
                <ResultCard
                  label="IS sobre Juros (4%)"
                  value={fmt(result.total_imposto_selo_juros)}
                />
                <ResultCard
                  label="Seguro Vida (mensal est.)"
                  value={fmt(result.seguro_vida_mensal_estimado)}
                />
                <ResultCard
                  label="Seguro MR (anual est.)"
                  value={fmt(result.seguro_multirriscos_anual_estimado)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Stress test */}
          {stressTest && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Teste de Stress (Euribor)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cenario</TableHead>
                      <TableHead className="text-right">Euribor</TableHead>
                      <TableHead className="text-right">Prestacao</TableHead>
                      <TableHead className="text-right">Variacao</TableHead>
                      <TableHead className="text-right">Total Juros</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Base */}
                    <TableRow className="font-medium">
                      <TableCell>Cenario Actual</TableCell>
                      <TableCell className="text-right">{fmtPct(parseFloat(euribor))}</TableCell>
                      <TableCell className="text-right">{fmt(stressTest.cenario_base.prestacao)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-right">{fmt(stressTest.cenario_base.total_juros)}</TableCell>
                    </TableRow>
                    {/* Scenarios */}
                    {stressTest.cenarios.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="flex items-center gap-1.5">
                          {i >= 2 && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                          Euribor +{((c.euribor - parseFloat(euribor)) || 0).toFixed(0)}pp
                        </TableCell>
                        <TableCell className="text-right">{fmtPct(c.euribor)}</TableCell>
                        <TableCell className="text-right">{fmt(c.prestacao)}</TableCell>
                        <TableCell
                          className={cn(
                            'text-right',
                            c.variacao > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'
                          )}
                        >
                          {c.variacao > 0 ? '+' : ''}
                          {fmt(c.variacao)}
                        </TableCell>
                        <TableCell className="text-right">{fmt(c.total_juros)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function ResultCard({
  label,
  value,
  highlight,
  warning,
  danger,
}: {
  label: string
  value: string
  highlight?: boolean
  warning?: boolean
  danger?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3 space-y-1',
        highlight && 'border-primary bg-primary/5',
        danger && 'border-red-500 bg-red-50',
        warning && !danger && 'border-amber-500 bg-amber-50'
      )}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          'text-sm font-semibold',
          highlight && 'text-primary',
          danger && 'text-red-600',
          warning && !danger && 'text-amber-600'
        )}
      >
        {value}
        {warning && !danger && (
          <AlertTriangle className="inline-block ml-1 h-3.5 w-3.5 text-amber-500" />
        )}
        {danger && (
          <AlertTriangle className="inline-block ml-1 h-3.5 w-3.5 text-red-500" />
        )}
      </p>
    </div>
  )
}
