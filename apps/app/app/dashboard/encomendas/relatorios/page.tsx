'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { useEncomendaReports } from '@/hooks/use-encomenda-reports'
import { formatCurrency } from '@/lib/constants'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BarChart3, Loader2 } from 'lucide-react'

export default function RelatoriosPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const {
    agentCosts,
    productCosts,
    loading,
    fetchCostsByAgent,
    fetchCostsByProduct,
  } = useEncomendaReports()

  const handleLoadAgentReport = async () => {
    if (!dateFrom || !dateTo) {
      toast.error('Seleccione as datas de inicio e fim')
      return
    }
    try {
      await fetchCostsByAgent(dateFrom, dateTo)
    } catch {
      toast.error('Erro ao carregar relatorio')
    }
  }

  const handleLoadProductReport = async () => {
    if (!dateFrom || !dateTo) {
      toast.error('Seleccione as datas de inicio e fim')
      return
    }
    try {
      await fetchCostsByProduct(dateFrom, dateTo)
    } catch {
      toast.error('Erro ao carregar relatorio')
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Relatorios de Encomendas</h1>
        <p className="text-muted-foreground">
          Analise de custos por consultor e por produto
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="date-from">Data inicio</Label>
          <Input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[180px]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date-to">Data fim</Label>
          <Input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[180px]"
          />
        </div>
      </div>

      {/* Custos por Consultor */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Custos por Consultor</h2>
          <Button
            onClick={handleLoadAgentReport}
            disabled={loading}
            variant="outline"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Carregar
          </Button>
        </div>

        {loading ? (
          <div className="rounded-lg border p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : agentCosts.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="Sem dados"
            description="Seleccione o periodo e clique em Carregar, ou nao foram encontradas requisicoes no periodo seleccionado"
          />
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consultor</TableHead>
                  <TableHead className="text-right">N. Requisicoes</TableHead>
                  <TableHead className="text-right">Total Gasto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentCosts.map((row) => (
                  <TableRow key={row.agent_id}>
                    <TableCell className="font-medium">{row.commercial_name}</TableCell>
                    <TableCell className="text-right">{row.total_requisitions}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(row.total_amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Custos por Produto */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Custos por Produto</h2>
          <Button
            onClick={handleLoadProductReport}
            disabled={loading}
            variant="outline"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Carregar
          </Button>
        </div>

        {loading ? (
          <div className="rounded-lg border p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : productCosts.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="Sem dados"
            description="Seleccione o periodo e clique em Carregar, ou nao foram encontrados produtos no periodo seleccionado"
          />
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Quantidade Total</TableHead>
                  <TableHead className="text-right">Total Gasto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productCosts.map((row) => (
                  <TableRow key={row.product_id}>
                    <TableCell className="font-medium">{row.product_name}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {row.sku || '—'}
                    </TableCell>
                    <TableCell className="text-right">{row.total_quantity}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(row.total_amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}
