"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { pt } from "date-fns/locale/pt"
import { toast } from "sonner"
import {
  BarChart3,
  Filter,
  TrendingUp,
  Users,
  Clock,
  Target,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { getRecruitmentReportData } from "@/app/dashboard/recrutamento/actions"
import { CANDIDATE_SOURCES, CANDIDATE_STATUSES } from "@/types/recruitment"
import type { CandidateSource, CandidateStatus } from "@/types/recruitment"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportData {
  candidatesByMonth: { month: string; count: number }[]
  sourceEffectiveness: { source: string; total: number; joined: number; rate: number }[]
  avgTimeByStage: Record<string, number>
  recruiterPerformance: { recruiter_name: string; total: number; joined: number; avg_time: number }[]
  conversionFunnel: { stage: string; count: number }[]
}

// ─── Stage Colors ─────────────────────────────────────────────────────────────

const STAGE_COLORS: Record<string, string> = {
  prospect: "bg-slate-500",
  in_contact: "bg-blue-500",
  in_process: "bg-purple-500",
  decision_pending: "bg-amber-500",
  joined: "bg-emerald-500",
  declined: "bg-red-500",
  on_hold: "bg-orange-500",
}

const STAGE_BG_LIGHT: Record<string, string> = {
  prospect: "bg-slate-100",
  in_contact: "bg-blue-100",
  in_process: "bg-purple-100",
  decision_pending: "bg-amber-100",
  joined: "bg-emerald-100",
  declined: "bg-red-100",
  on_hold: "bg-orange-100",
}

// ─── PT month names ───────────────────────────────────────────────────────────

const PT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

function monthLabel(yyyyMM: string) {
  const [, mm] = yyyyMM.split("-")
  const idx = parseInt(mm, 10) - 1
  return PT_MONTHS[idx] ?? mm
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const fetchData = useCallback(async (from?: string, to?: string) => {
    setLoading(true)
    const result = await getRecruitmentReportData(from || undefined, to || undefined)
    if (result.error) {
      toast.error("Erro ao carregar relatorios")
    } else {
      setData({
        candidatesByMonth: result.candidatesByMonth,
        sourceEffectiveness: result.sourceEffectiveness,
        avgTimeByStage: result.avgTimeByStage,
        recruiterPerformance: result.recruiterPerformance,
        conversionFunnel: result.conversionFunnel,
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleFilter = () => {
    fetchData(dateFrom, dateTo)
  }

  if (loading) return <ReportsSkeleton />

  if (!data) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <h1 className="text-2xl font-bold tracking-tight">Relatorios de Recrutamento</h1>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Erro ao carregar dados. Tente novamente.
          </CardContent>
        </Card>
      </div>
    )
  }

  const maxFunnel = Math.max(...data.conversionFunnel.map((f) => f.count), 1)
  const funnelTotal = data.conversionFunnel.reduce((s, f) => s + f.count, 0)
  const maxMonthCount = Math.max(...data.candidatesByMonth.map((m) => m.count), 1)
  const maxStageTime = Math.max(...Object.values(data.avgTimeByStage), 1)
  const sortedSources = [...data.sourceEffectiveness].sort((a, b) => b.rate - a.rate)
  const sortedRecruiters = [...data.recruiterPerformance].sort((a, b) => b.joined - a.joined)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatorios de Recrutamento</h1>
        <p className="text-muted-foreground text-sm">
          Analise o desempenho e metricas do pipeline de recrutamento
        </p>
      </div>

      {/* Date Filter */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="grid gap-1.5">
            <Label className="text-xs">Data Inicio</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[160px]" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Data Fim</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[160px]" />
          </div>
          <Button onClick={handleFilter} size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filtrar
          </Button>
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom("")
                setDateTo("")
                fetchData()
              }}
            >
              Limpar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 1. Conversion Funnel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4" />
            Funil de Conversao
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.conversionFunnel.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">Sem dados</p>
          ) : (
            <div className="flex flex-col gap-3">
              {data.conversionFunnel.map((item) => {
                const status = item.stage as CandidateStatus
                const label = CANDIDATE_STATUSES[status]?.label ?? item.stage
                const pct = funnelTotal > 0 ? Math.round((item.count / funnelTotal) * 100) : 0
                const widthPct = Math.max((item.count / maxFunnel) * 100, 4)

                return (
                  <div key={item.stage} className="flex items-center gap-3">
                    <span className="w-32 text-sm font-medium shrink-0 truncate">{label}</span>
                    <div className="flex-1 h-8 rounded-md overflow-hidden bg-muted">
                      <div
                        className={cn("h-full rounded-md flex items-center px-2 transition-all", STAGE_COLORS[item.stage] ?? "bg-slate-500")}
                        style={{ width: `${widthPct}%` }}
                      >
                        <span className="text-xs font-medium text-white whitespace-nowrap">
                          {item.count}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right shrink-0">{pct}%</span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 2. Source Effectiveness */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Eficacia por Origem
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sortedSources.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">Sem dados</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Aderiu</TableHead>
                    <TableHead className="text-right">Taxa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSources.map((s) => (
                    <TableRow key={s.source}>
                      <TableCell className="font-medium">
                        {CANDIDATE_SOURCES[s.source as CandidateSource] ?? s.source}
                      </TableCell>
                      <TableCell className="text-right">{s.total}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">
                          {s.joined}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {s.rate}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 3. Recruiter Performance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Desempenho por Recrutador
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sortedRecruiters.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">Sem dados</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recrutador</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Aderiu</TableHead>
                    <TableHead className="text-right">Tempo Medio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRecruiters.map((r) => (
                    <TableRow key={r.recruiter_name}>
                      <TableCell className="font-medium">{r.recruiter_name}</TableCell>
                      <TableCell className="text-right">{r.total}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">
                          {r.joined}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.avg_time > 0 ? `${r.avg_time}d` : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 4. Average Time by Stage */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Tempo Medio por Fase
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(data.avgTimeByStage).length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">Sem dados suficientes</p>
            ) : (
              <div className="flex flex-col gap-3">
                {Object.entries(data.avgTimeByStage).map(([stage, days]) => {
                  const status = stage as CandidateStatus
                  const label = CANDIDATE_STATUSES[status]?.label ?? stage
                  const widthPct = Math.max((days / maxStageTime) * 100, 6)

                  return (
                    <div key={stage} className="flex items-center gap-3">
                      <span className="w-32 text-sm shrink-0 truncate">{label}</span>
                      <div className="flex-1 h-7 rounded-md overflow-hidden bg-muted">
                        <div
                          className={cn("h-full rounded-md flex items-center px-2 transition-all", STAGE_COLORS[stage] ?? "bg-slate-500")}
                          style={{ width: `${widthPct}%` }}
                        >
                          <span className="text-xs font-medium text-white whitespace-nowrap">
                            {days}d
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 5. Candidates by Month */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Candidatos por Mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.candidatesByMonth.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">Sem dados</p>
            ) : (
              <div className="flex items-end gap-1.5" style={{ height: 180 }}>
                {data.candidatesByMonth.map((m) => {
                  const heightPct = maxMonthCount > 0 ? Math.max((m.count / maxMonthCount) * 100, 3) : 3

                  return (
                    <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {m.count > 0 ? m.count : ""}
                      </span>
                      <div className="w-full flex items-end" style={{ height: 140 }}>
                        <div
                          className="w-full rounded-t-md bg-primary/80 transition-all hover:bg-primary"
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{monthLabel(m.month)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function ReportsSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>
      <Skeleton className="h-14 rounded-lg" />
      <Skeleton className="h-48 rounded-lg" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    </div>
  )
}
