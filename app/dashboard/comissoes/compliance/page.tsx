'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  ShieldCheck, ShieldAlert, FileText, AlertTriangle,
  CheckCircle2, XCircle, Clock, Loader2, Banknote,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getComplianceOverview, getComplianceAlerts,
} from '@/app/dashboard/comissoes/compliance/actions'
import {
  RISK_LEVELS, COMPLIANCE_STATUSES, IMPIC_DEADLINES,
} from '@/types/compliance'
import type { RiskLevel, ComplianceStatus } from '@/types/compliance'

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })

function getCurrentQuarter(): string {
  const now = new Date()
  const q = Math.ceil((now.getMonth() + 1) / 3)
  return `Q${q}-${now.getFullYear()}`
}

function buildQuarterOptions(): string[] {
  const year = new Date().getFullYear()
  const opts: string[] = []
  for (let y = year - 1; y <= year + 1; y++) {
    for (let q = 1; q <= 4; q++) opts.push(`Q${q}-${y}`)
  }
  return opts
}

function getDeadlineForQuarter(q: string): string {
  const key = q.split('-')[0] as keyof typeof IMPIC_DEADLINES
  return IMPIC_DEADLINES[key]?.deadline ?? '—'
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface OverviewData {
  total: number
  reported: number
  pending: number
  flagged: number
  deals: DealRow[]
}

interface DealRow {
  id: string
  deal_date: string
  property_title: string
  consultant_name: string
  deal_value: number
  risk_level: RiskLevel
  buyer_kyc: boolean
  seller_kyc: boolean
  impic_reported: boolean
  status: ComplianceStatus
}

interface ComplianceAlert {
  id: string
  deal_id: string
  type: 'deadline' | 'docs_incomplete' | 'cash_not_reported'
  message: string
  deal_date: string
  property_title: string
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function CompliancePage() {
  const router = useRouter()
  const [quarter, setQuarter] = useState(getCurrentQuarter)
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [qPart, yearPart] = quarter.split('-')
      const [ovRes, alRes] = await Promise.all([
        getComplianceOverview(qPart, parseInt(yearPart)),
        getComplianceAlerts(),
      ])
      setOverview({
        total: ovRes.totals.total_deals,
        reported: ovRes.totals.reported,
        pending: ovRes.totals.pending,
        flagged: ovRes.totals.flagged,
        deals: ovRes.items.map((item) => ({
          id: item.deal?.id ?? item.compliance.deal_id,
          deal_date: item.deal?.deal_date ?? '',
          property_title: item.deal?.title ?? '',
          consultant_name: '',
          deal_value: item.deal?.deal_value ?? 0,
          risk_level: item.compliance.overall_risk_level as RiskLevel,
          buyer_kyc: item.compliance.buyer_docs_complete,
          seller_kyc: item.compliance.seller_docs_complete,
          impic_reported: item.compliance.impic_reported,
          status: item.compliance.status as ComplianceStatus,
        })),
      })
      setAlerts(alRes.map((a, i) => ({
        id: `${a.deal_id}-${i}`,
        deal_id: a.deal_id,
        type: a.type === 'high_risk' ? 'docs_incomplete' : a.type,
        message: a.message,
        deal_date: '',
        property_title: a.deal_title,
      })))
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao carregar dados de compliance.')
    }
    setLoading(false)
  }, [quarter])

  useEffect(() => { load() }, [load])

  const quarterOpts = buildQuarterOptions()
  const deadline = getDeadlineForQuarter(quarter)

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Compliance IMPIC</h1>
          <p className="text-sm text-muted-foreground">Prazo de reporte: {deadline}</p>
        </div>
        <Select value={quarter} onValueChange={setQuarter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {quarterOpts.map((q) => (
              <SelectItem key={q} value={q}>{q}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ─── KPIs ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : overview && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Total Negócios" value={overview.total} icon={FileText} color="text-slate-600" isCurrency={false} />
          <KpiCard label="Reportados ao IMPIC" value={overview.reported} icon={CheckCircle2} color="text-emerald-600" isCurrency={false} />
          <KpiCard label="Pendentes de Reporte" value={overview.pending} icon={Clock} color="text-amber-600" isCurrency={false} />
          <KpiCard label="Sinalizados" value={overview.flagged} icon={ShieldAlert} color="text-red-600" isCurrency={false} />
        </div>
      )}

      {/* ─── Alerts ─────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Alertas</h2>
          {alerts.map((alert) => (
            <Card
              key={alert.id}
              className="cursor-pointer border-amber-200 bg-amber-50/50 transition-colors hover:bg-amber-50"
              onClick={() => router.push(`/dashboard/comissoes/deals/${alert.deal_id}`)}
            >
              <CardContent className="flex items-start gap-3 p-4">
                {alert.type === 'deadline' && <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
                {alert.type === 'docs_incomplete' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
                {alert.type === 'cash_not_reported' && <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{alert.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {alert.property_title} &middot; {fmtDate(alert.deal_date)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ─── Deals Table ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Negócios — {quarter}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !overview || overview.deals.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <ShieldCheck className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Nenhum negócio neste trimestre.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Imóvel</TableHead>
                    <TableHead>Consultor</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Risco</TableHead>
                    <TableHead className="text-center">KYC Comp.</TableHead>
                    <TableHead className="text-center">KYC Vend.</TableHead>
                    <TableHead>IMPIC</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.deals.map((d) => {
                    const riskCfg = RISK_LEVELS[d.risk_level]
                    return (
                      <TableRow
                        key={d.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/dashboard/comissoes/deals/${d.id}`)}
                      >
                        <TableCell className="whitespace-nowrap text-sm">{fmtDate(d.deal_date)}</TableCell>
                        <TableCell className="max-w-[180px] truncate text-sm">{d.property_title}</TableCell>
                        <TableCell className="text-sm">{d.consultant_name}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{fmtCurrency(d.deal_value)}</TableCell>
                        <TableCell><Badge className={riskCfg.color}>{riskCfg.label}</Badge></TableCell>
                        <TableCell className="text-center">
                          {d.buyer_kyc ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" /> : <XCircle className="mx-auto h-4 w-4 text-slate-300" />}
                        </TableCell>
                        <TableCell className="text-center">
                          {d.seller_kyc ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" /> : <XCircle className="mx-auto h-4 w-4 text-slate-300" />}
                        </TableCell>
                        <TableCell>
                          {d.impic_reported
                            ? <Badge className="bg-emerald-100 text-emerald-700">Reportado</Badge>
                            : <Badge className="bg-amber-100 text-amber-700">Pendente</Badge>
                          }
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" className="text-xs">Ver</Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, color, isCurrency = true }: {
  label: string; value: number; icon: React.ElementType; color: string; isCurrency?: boolean
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className={`h-5 w-5 shrink-0 ${color}`} />
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{isCurrency ? fmtCurrency(value) : value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
