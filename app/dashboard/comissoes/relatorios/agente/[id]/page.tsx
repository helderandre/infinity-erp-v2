"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Minus,
  FileDown,
  Loader2,
  TrendingUp,
  TrendingDown,
  Trophy,
  Target,
  Building2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { generateAgentReport, getCommissionTiers } from "@/app/dashboard/comissoes/actions"
import type { AgentAnalysisReport, CommissionTier, TrendIndicator } from "@/types/financial"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

function fmt(v: number, decimals = 0): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: decimals }).format(v)
}

function fmtN(v: number): string {
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 }).format(v)
}

function diffColor(curr: number, prev: number): string {
  if (curr > prev) return "text-emerald-600"
  if (curr < prev) return "text-red-600"
  return "text-muted-foreground"
}

function TrendIcon({ dir }: { dir: TrendIndicator["direction"] }) {
  if (dir === "up") return <ArrowUp className="h-4 w-4 text-emerald-600" />
  if (dir === "down") return <ArrowDown className="h-4 w-4 text-red-600" />
  return <Minus className="h-4 w-4 text-amber-500" />
}

function trendBg(dir: TrendIndicator["direction"]): string {
  if (dir === "up") return "bg-emerald-50 border-emerald-200"
  if (dir === "down") return "bg-red-50 border-red-200"
  return "bg-amber-50 border-amber-200"
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentReportPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()

  const consultantId = params.id as string
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10)

  const [report, setReport] = useState<AgentAnalysisReport | null>(null)
  const [tiers, setTiers] = useState<CommissionTier[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!consultantId) return
    setLoading(true)
    Promise.all([
      generateAgentReport(consultantId, year),
      getCommissionTiers(),
    ]).then(([reportRes, tiersRes]) => {
      if (reportRes.error) toast.error(reportRes.error)
      setReport(reportRes.report)
      setTiers(tiersRes.tiers ?? [])
      setLoading(false)
    })
  }, [consultantId, year])

  if (loading) return <LoadingSkeleton />

  if (!report) {
    return (
      <div className="space-y-4">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </button>
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Relatorio nao encontrado ou sem dados para este consultor.</p>
        </Card>
      </div>
    )
  }

  const { agent, objective, monthly_comparison, totals, summary, trends } = report

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </button>
          <div>
            <h1 className="text-xl font-bold">{agent.name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
              <Building2 className="h-3.5 w-3.5" />
              <span>{agent.agency}</span>
              <span className="mx-1">|</span>
              <span>Entrada: {agent.entry_date}</span>
              {agent.tier && (
                <>
                  <span className="mx-1">|</span>
                  <Badge variant="outline" className="text-xs">{agent.tier}</Badge>
                </>
              )}
              <span className="mx-1">|</span>
              <div className="flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
                <span>#{agent.ranking_position}</span>
              </div>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast.info("Funcionalidade em desenvolvimento")}
        >
          <FileDown className="h-4 w-4 mr-1.5" />
          Exportar PDF
        </Button>
      </div>

      {/* Objective + Tiers row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Objective */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4" /> Objectivo {year}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Facturacao Prevista</p>
                <p className="text-lg font-bold">{fmt(objective.forecast)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Em Valor</p>
                <p className={cn("text-lg font-bold", objective.in_value >= 0 ? "text-emerald-600" : "text-red-600")}>
                  {objective.in_value >= 0 ? "+" : ""}{fmt(objective.in_value)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Crescimento</p>
                <p className={cn("text-lg font-bold", objective.growth_pct >= 0 ? "text-emerald-600" : "text-red-600")}>
                  {objective.growth_pct >= 0 ? "+" : ""}{objective.growth_pct.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Commission tiers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Escaloes de Comissao</CardTitle>
          </CardHeader>
          <CardContent>
            {tiers.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem escaloes configurados</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tiers.filter((t) => t.is_active).map((t) => (
                  <Badge key={t.id} variant="outline" className="text-xs py-1 px-2">
                    {t.name}: {fmt(t.min_value, 0)} — {t.max_value ? fmt(t.max_value, 0) : "+"} ({t.consultant_rate}%)
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main layout: table + sidebar */}
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        {/* Monthly comparison table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Comparacao Mensal {year - 1} vs {year}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-muted/70">
                  <TableHead rowSpan={2} className="sticky left-0 bg-muted/70 z-10 text-[10px] font-bold w-12">Mes</TableHead>
                  <TableHead colSpan={2} className="text-center text-[10px] border-l">Facturacao</TableHead>
                  <TableHead colSpan={2} className="text-center text-[10px] border-l">Ang. Novas</TableHead>
                  <TableHead colSpan={2} className="text-center text-[10px] border-l">Total Ang.</TableHead>
                  <TableHead colSpan={2} className="text-center text-[10px] border-l">Produtividade</TableHead>
                  <TableHead className="text-center text-[10px] border-l">Trim.</TableHead>
                  <TableHead colSpan={2} className="text-center text-[10px] border-l">Transaccoes</TableHead>
                </TableRow>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-center text-[10px] border-l w-20">{year - 1}</TableHead>
                  <TableHead className="text-center text-[10px] font-bold w-20">{year}</TableHead>
                  <TableHead className="text-center text-[10px] border-l w-14">{year - 1}</TableHead>
                  <TableHead className="text-center text-[10px] font-bold w-14">{year}</TableHead>
                  <TableHead className="text-center text-[10px] border-l w-14">{year - 1}</TableHead>
                  <TableHead className="text-center text-[10px] font-bold w-14">{year}</TableHead>
                  <TableHead className="text-center text-[10px] border-l w-20">{year - 1}</TableHead>
                  <TableHead className="text-center text-[10px] font-bold w-20">{year}</TableHead>
                  <TableHead className="text-center text-[10px] border-l w-20">Media</TableHead>
                  <TableHead className="text-center text-[10px] border-l w-14">{year - 1}</TableHead>
                  <TableHead className="text-center text-[10px] font-bold w-14">{year}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthly_comparison.map((m, i) => (
                  <TableRow key={i} className={cn(i % 2 === 0 ? "bg-background" : "bg-muted/30")}>
                    <TableCell className="sticky left-0 bg-inherit z-10 font-medium">{MONTHS[i]}</TableCell>
                    <TableCell className="text-right border-l text-muted-foreground">{fmt(m.billing_prev)}</TableCell>
                    <TableCell className={cn("text-right font-semibold", diffColor(m.billing_curr, m.billing_prev))}>{fmt(m.billing_curr)}</TableCell>
                    <TableCell className="text-center border-l text-muted-foreground">{m.new_acq_prev}</TableCell>
                    <TableCell className={cn("text-center font-semibold", diffColor(m.new_acq_curr, m.new_acq_prev))}>{m.new_acq_curr}</TableCell>
                    <TableCell className="text-center border-l text-muted-foreground">{m.total_acq_prev}</TableCell>
                    <TableCell className={cn("text-center font-semibold", diffColor(m.total_acq_curr, m.total_acq_prev))}>{m.total_acq_curr}</TableCell>
                    <TableCell className="text-right border-l text-muted-foreground">{fmt(m.productivity_prev)}</TableCell>
                    <TableCell className={cn("text-right font-semibold", diffColor(m.productivity_curr, m.productivity_prev))}>{fmt(m.productivity_curr)}</TableCell>
                    <TableCell className="text-right border-l text-muted-foreground">{fmt(m.quarter_avg)}</TableCell>
                    <TableCell className="text-center border-l text-muted-foreground">{m.transactions_prev}</TableCell>
                    <TableCell className={cn("text-center font-semibold", diffColor(m.transactions_curr, m.transactions_prev))}>{m.transactions_curr}</TableCell>
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="bg-muted font-bold border-t-2">
                  <TableCell className="sticky left-0 bg-muted z-10">TOTAL</TableCell>
                  <TableCell className="text-right border-l">{fmt(totals.billing_prev)}</TableCell>
                  <TableCell className={cn("text-right", diffColor(totals.billing_curr, totals.billing_prev))}>{fmt(totals.billing_curr)}</TableCell>
                  <TableCell className="text-center border-l">{totals.new_acq_prev}</TableCell>
                  <TableCell className={cn("text-center", diffColor(totals.new_acq_curr, totals.new_acq_prev))}>{totals.new_acq_curr}</TableCell>
                  <TableCell className="text-center border-l">{totals.total_acq_prev}</TableCell>
                  <TableCell className={cn("text-center", diffColor(totals.total_acq_curr, totals.total_acq_prev))}>{totals.total_acq_curr}</TableCell>
                  <TableCell className="text-right border-l">{fmt(totals.productivity_prev)}</TableCell>
                  <TableCell className={cn("text-right", diffColor(totals.productivity_curr, totals.productivity_prev))}>{fmt(totals.productivity_curr)}</TableCell>
                  <TableCell className="text-right border-l">—</TableCell>
                  <TableCell className="text-center border-l">{totals.transactions_prev}</TableCell>
                  <TableCell className={cn("text-center", diffColor(totals.transactions_curr, totals.transactions_prev))}>{totals.transactions_curr}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Summary sidebar */}
        <div className="space-y-4">
          {/* Acquisitions summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Angariacao</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold">{summary.total_acquisitions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Venda</span>
                <span>{summary.sale_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Arrendamento</span>
                <span>{summary.rent_count}</span>
              </div>
            </CardContent>
          </Card>

          {/* Shares summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Partilhas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Internas</span>
                <span>{summary.internal_shares_pct.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Externas</span>
                <span>{summary.external_shares_pct.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Na Rede</span>
                <span>{summary.network_shares_pct.toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>

          {/* YTD comparison */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">YTD</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{year}</span>
                <span className="font-semibold">{fmt(summary.ytd_current)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{year - 1}</span>
                <span>{fmt(summary.ytd_previous)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">Diferenca</span>
                <span className={cn("font-semibold", summary.ytd_diff >= 0 ? "text-emerald-600" : "text-red-600")}>
                  {summary.ytd_diff >= 0 ? "+" : ""}{fmt(summary.ytd_diff)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Sale breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Facturacao Venda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">T.Ang</span>
                <span>{fmt(summary.sale_acq_amount)} <span className="text-xs text-muted-foreground">({summary.sale_acq_pct.toFixed(1)}%)</span></span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">T.Vnd</span>
                <span>{fmt(summary.sale_sold_amount)} <span className="text-xs text-muted-foreground">({summary.sale_sold_pct.toFixed(1)}%)</span></span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Trend indicators */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <TrendCard label="Facturacao" trend={trends.billing} isCurrency />
        <TrendCard label="Produtividade" trend={trends.productivity} isCurrency />
        <TrendCard label="Novas Angariacao" trend={trends.new_acquisitions} />
        <TrendCard label="Total Angariacao" trend={trends.total_acquisitions} />
      </div>
    </div>
  )
}

// ─── Trend Card ───────────────────────────────────────────────────────────────

function TrendCard({ label, trend, isCurrency }: { label: string; trend: TrendIndicator; isCurrency?: boolean }) {
  return (
    <Card className={cn("border", trendBg(trend.direction))}>
      <CardContent className="p-3 flex items-center gap-3">
        <TrendIcon dir={trend.direction} />
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-bold">
            {trend.direction === "up" ? "+" : trend.direction === "down" ? "" : ""}
            {isCurrency ? fmt(trend.value) : fmtN(trend.value)}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
      <Skeleton className="h-[480px] rounded-lg" />
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
      </div>
    </div>
  )
}
