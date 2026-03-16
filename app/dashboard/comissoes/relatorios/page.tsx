"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { toast } from "sonner"
import {
  UserCircle,
  Receipt,
  Clock,
  Share2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  ArrowLeft,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  generateCommissionReport,
  generateTimeToSaleReport,
  generateSharesReport,
  generateCustomReport,
  getCommissionTiers,
} from "@/app/dashboard/comissoes/actions"
import { getRecruiters } from "@/app/dashboard/recrutamento/actions"
import {
  REPORT_DIMENSIONS,
  REPORT_METRICS,
  SHARE_TYPES,
  type ReportDimension,
  type ReportMetric,
  type ReportFilters,
  type CustomReportConfig,
} from "@/types/financial"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Consultant {
  id: string
  commercial_name: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v)
}

function exportCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return toast.error("Sem dados para exportar")
  const keys = Object.keys(rows[0])
  const csv = [keys.join(";"), ...rows.map((r) => keys.map((k) => String(r[k] ?? "")).join(";"))].join("\n")
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

// ─── Report Cards Config ──────────────────────────────────────────────────────

const REPORT_CARDS = [
  { key: "agent", icon: UserCircle, title: "Analise de Agente", desc: "Relatorio detalhado por consultor com comparacao anual" },
  { key: "commission", icon: Receipt, title: "Comissoes Detalhado", desc: "Decomposicao de comissoes por negocio" },
  { key: "time", icon: Clock, title: "Tempo Medio de Venda", desc: "Analise do tempo entre angariacao e venda" },
  { key: "shares", icon: Share2, title: "Partilhas", desc: "Analise de negocios partilhados" },
  { key: "custom", icon: SlidersHorizontal, title: "Relatorio Dinamico", desc: "Construa o seu proprio relatorio" },
] as const

type ReportKey = (typeof REPORT_CARDS)[number]["key"]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const router = useRouter()

  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [activeDialog, setActiveDialog] = useState<ReportKey | null>(null)
  const [loading, setLoading] = useState<ReportKey | null>(null)
  const [openResults, setOpenResults] = useState<Set<ReportKey>>(new Set())

  // Results
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [commissionRows, setCommissionRows] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [timeRows, setTimeRows] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sharesRows, setSharesRows] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [customRows, setCustomRows] = useState<any[]>([])
  const [customColumns, setCustomColumns] = useState<string[]>([])

  // Filters state
  const [agentConsultant, setAgentConsultant] = useState("")
  const [agentYear, setAgentYear] = useState(String(currentYear))

  const [commFilters, setCommFilters] = useState<ReportFilters>({})
  const [timeFilters, setTimeFilters] = useState<ReportFilters>({})
  const [sharesFilters, setSharesFilters] = useState<ReportFilters>({})

  const [customDimensions, setCustomDimensions] = useState<ReportDimension[]>([])
  const [customMetrics, setCustomMetrics] = useState<ReportMetric[]>([])
  const [customFilters, setCustomFilters] = useState<ReportFilters>({})

  useEffect(() => {
    getRecruiters().then(({ recruiters }) => setConsultants(recruiters ?? []))
  }, [])

  const toggleResult = useCallback((key: ReportKey) => {
    setOpenResults((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }, [])

  // ─── Generate Handlers ────────────────────────────────────────────────────

  const handleAgentGenerate = useCallback(() => {
    if (!agentConsultant) return toast.error("Seleccione um consultor")
    router.push(`/dashboard/comissoes/relatorios/agente/${agentConsultant}?year=${agentYear}`)
    setActiveDialog(null)
  }, [agentConsultant, agentYear, router])

  const handleCommissionGenerate = useCallback(async () => {
    setActiveDialog(null)
    setLoading("commission")
    const { rows, error } = await generateCommissionReport(commFilters)
    setLoading(null)
    if (error) return toast.error(error)
    setCommissionRows(rows)
    setOpenResults((prev) => new Set(prev).add("commission"))
    toast.success(`${rows.length} registos encontrados`)
  }, [commFilters])

  const handleTimeGenerate = useCallback(async () => {
    setActiveDialog(null)
    setLoading("time")
    const { rows, error } = await generateTimeToSaleReport(timeFilters)
    setLoading(null)
    if (error) return toast.error(error)
    setTimeRows(rows)
    setOpenResults((prev) => new Set(prev).add("time"))
    toast.success(`${rows.length} registos encontrados`)
  }, [timeFilters])

  const handleSharesGenerate = useCallback(async () => {
    setActiveDialog(null)
    setLoading("shares")
    const { rows, error } = await generateSharesReport(sharesFilters)
    setLoading(null)
    if (error) return toast.error(error)
    setSharesRows(rows)
    setOpenResults((prev) => new Set(prev).add("shares"))
    toast.success(`${rows.length} grupos encontrados`)
  }, [sharesFilters])

  const handleCustomGenerate = useCallback(async () => {
    if (!customDimensions.length || !customMetrics.length) {
      return toast.error("Seleccione pelo menos uma dimensao e uma metrica")
    }
    setActiveDialog(null)
    setLoading("custom")
    const config: CustomReportConfig = { dimensions: customDimensions, metrics: customMetrics, filters: customFilters }
    const { rows, columns, error } = await generateCustomReport(config)
    setLoading(null)
    if (error) return toast.error(error)
    setCustomRows(rows)
    setCustomColumns(columns)
    setOpenResults((prev) => new Set(prev).add("custom"))
    toast.success(`${rows.length} registos encontrados`)
  }, [customDimensions, customMetrics, customFilters])

  // ─── Render Helpers ───────────────────────────────────────────────────────

  const consultantSelect = (value: string, onChange: (v: string) => void) => (
    <div className="space-y-1.5">
      <Label>Consultor</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos</SelectItem>
          {consultants.map((c) => <SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )

  const dateRangeInputs = (filters: ReportFilters, setFilters: (f: ReportFilters) => void) => (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label>Data Inicio</Label>
        <Input type="date" value={filters.date_from ?? ""} onChange={(e) => setFilters({ ...filters, date_from: e.target.value || undefined })} />
      </div>
      <div className="space-y-1.5">
        <Label>Data Fim</Label>
        <Input type="date" value={filters.date_to ?? ""} onChange={(e) => setFilters({ ...filters, date_to: e.target.value || undefined })} />
      </div>
    </div>
  )

  const businessTypeSelect = (filters: ReportFilters, setFilters: (f: ReportFilters) => void) => (
    <div className="space-y-1.5">
      <Label>Tipo de Negocio</Label>
      <Select value={filters.business_type ?? "__all__"} onValueChange={(v) => setFilters({ ...filters, business_type: v === "__all__" ? undefined : v })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos</SelectItem>
          <SelectItem value="venda">Venda</SelectItem>
          <SelectItem value="arrendamento">Arrendamento</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatórios Financeiros</h1>
        <p className="text-sm text-muted-foreground">Gere e exporte relatórios de comissões e desempenho</p>
      </div>

      {/* Report cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_CARDS.map((rc) => {
          const Icon = rc.icon
          const isLoading = loading === rc.key
          return (
            <Card key={rc.key} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{rc.title}</CardTitle>
                    <CardDescription className="text-xs mt-1">{rc.desc}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="mt-auto pt-0">
                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => setActiveDialog(rc.key)}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {isLoading ? "A gerar..." : "Gerar"}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ─── Results ─────────────────────────────────────────────────────────── */}

      {/* Commission results */}
      {commissionRows.length > 0 && (
        <ResultCard
          title="Comissoes Detalhado"
          count={commissionRows.length}
          open={openResults.has("commission")}
          onToggle={() => toggleResult("commission")}
          onExport={() => exportCsv(commissionRows.map((r) => ({
            Consultor: r.consultant?.commercial_name ?? "",
            Imovel: r.property?.title ?? "",
            Ref: r.property?.external_ref ?? "",
            Tipo: r.transaction_type,
            Valor_Negocio: r.deal_value,
            Comissao_Agencia: r.agency_commission_amount,
            Comissao_Consultor: r.consultant_commission_amount,
            Estado: r.status,
            Data: r.transaction_date,
          })), "comissoes-detalhado")}
        >
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>Consultor</TableHead>
                <TableHead>Imovel</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Com. Agencia</TableHead>
                <TableHead className="text-right">Com. Consultor</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissionRows.map((r, i) => (
                <TableRow key={r.id ?? i} className="text-xs">
                  <TableCell>{r.consultant?.commercial_name ?? "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.property?.title ?? "—"}</TableCell>
                  <TableCell className="text-right">{fmt(r.deal_value ?? 0)}</TableCell>
                  <TableCell className="text-right">{fmt(r.agency_commission_amount ?? 0)}</TableCell>
                  <TableCell className="text-right">{fmt(r.consultant_commission_amount ?? 0)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{r.status}</Badge></TableCell>
                  <TableCell>{r.transaction_date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResultCard>
      )}

      {/* Time to sale results */}
      {timeRows.length > 0 && (
        <ResultCard
          title="Tempo Medio de Venda"
          count={timeRows.length}
          open={openResults.has("time")}
          onToggle={() => toggleResult("time")}
          onExport={() => exportCsv(timeRows.map((r) => ({
            Imovel: r.title,
            Ref: r.external_ref,
            Tipo: r.property_type,
            Cidade: r.city,
            Preco: r.listing_price,
            Dias: r.days_to_sale,
            Escalao: r.price_tier,
            Consultor: r.consultant_name,
          })), "tempo-medio-venda")}
        >
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>Imovel</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Escalao</TableHead>
                <TableHead className="text-right">Preco</TableHead>
                <TableHead className="text-right">Dias</TableHead>
                <TableHead>Consultor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timeRows.map((r, i) => (
                <TableRow key={r.id ?? i} className="text-xs">
                  <TableCell className="max-w-[180px] truncate">{r.title}</TableCell>
                  <TableCell>{r.property_type ?? "—"}</TableCell>
                  <TableCell>{r.city ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{r.price_tier}</Badge></TableCell>
                  <TableCell className="text-right">{fmt(r.listing_price ?? 0)}</TableCell>
                  <TableCell className="text-right font-medium">{r.days_to_sale}d</TableCell>
                  <TableCell>{r.consultant_name ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResultCard>
      )}

      {/* Shares results */}
      {sharesRows.length > 0 && (
        <ResultCard
          title="Partilhas"
          count={sharesRows.reduce((s, r) => s + r.count, 0)}
          open={openResults.has("shares")}
          onToggle={() => toggleResult("shares")}
          onExport={() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const flat = sharesRows.flatMap((g: any) => g.transactions.map((t: any) => ({
              Tipo_Partilha: SHARE_TYPES[g.share_type as keyof typeof SHARE_TYPES] ?? g.share_type,
              Consultor: t.consultant?.commercial_name ?? "",
              Imovel: t.property?.title ?? "",
              Valor: t.agency_commission_amount,
              Percentagem: t.share_pct,
              Data: t.transaction_date,
            })))
            exportCsv(flat, "partilhas")
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3 mb-4">
            {sharesRows.map((g) => (
              <Card key={g.share_type} className="bg-muted/50">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">{SHARE_TYPES[g.share_type as keyof typeof SHARE_TYPES] ?? g.share_type}</p>
                  <p className="text-lg font-bold">{g.count}</p>
                  <p className="text-xs text-muted-foreground">{fmt(g.total_amount)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>Tipo</TableHead>
                <TableHead>Consultor</TableHead>
                <TableHead>Imovel</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {sharesRows.flatMap((g: any) => g.transactions.map((t: any, i: number) => (
                <TableRow key={t.id ?? `${g.share_type}-${i}`} className="text-xs">
                  <TableCell><Badge variant="outline" className="text-[10px]">{SHARE_TYPES[g.share_type as keyof typeof SHARE_TYPES] ?? g.share_type}</Badge></TableCell>
                  <TableCell>{t.consultant?.commercial_name ?? "—"}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{t.property?.title ?? "—"}</TableCell>
                  <TableCell className="text-right">{fmt(t.agency_commission_amount ?? 0)}</TableCell>
                  <TableCell className="text-right">{t.share_pct ?? 0}%</TableCell>
                  <TableCell>{t.transaction_date}</TableCell>
                </TableRow>
              )))}
            </TableBody>
          </Table>
        </ResultCard>
      )}

      {/* Custom results */}
      {customRows.length > 0 && (
        <ResultCard
          title="Relatorio Dinamico"
          count={customRows.length}
          open={openResults.has("custom")}
          onToggle={() => toggleResult("custom")}
          onExport={() => {
            const mapped = customRows.map((r) => {
              const row: Record<string, unknown> = {}
              customColumns.forEach((c) => {
                const label = REPORT_DIMENSIONS[c as ReportDimension] ?? REPORT_METRICS[c as ReportMetric] ?? c
                row[label] = r[c]
              })
              return row
            })
            exportCsv(mapped, "relatorio-dinamico")
          }}
        >
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                {customColumns.map((c) => (
                  <TableHead key={c}>{REPORT_DIMENSIONS[c as ReportDimension] ?? REPORT_METRICS[c as ReportMetric] ?? c}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {customRows.map((r, i) => (
                <TableRow key={i} className="text-xs">
                  {customColumns.map((c) => (
                    <TableCell key={c} className={typeof r[c] === "number" ? "text-right" : ""}>
                      {typeof r[c] === "number" ? (
                        ["revenue", "commission_agency", "commission_consultant", "volume"].includes(c)
                          ? fmt(r[c] as number)
                          : (r[c] as number).toFixed(1)
                      ) : (
                        String(r[c] ?? "—")
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResultCard>
      )}

      {/* ─── Dialogs ─────────────────────────────────────────────────────────── */}

      {/* Agent dialog */}
      <Dialog open={activeDialog === "agent"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Analise de Agente</DialogTitle>
            <DialogDescription>Seleccione o consultor e o ano para gerar o relatorio</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {consultantSelect(agentConsultant, setAgentConsultant)}
            <div className="space-y-1.5">
              <Label>Ano</Label>
              <Select value={agentYear} onValueChange={setAgentYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancelar</Button>
            <Button onClick={handleAgentGenerate}>Gerar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Commission dialog */}
      <Dialog open={activeDialog === "commission"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comissoes Detalhado</DialogTitle>
            <DialogDescription>Filtre os dados do relatorio de comissoes</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {consultantSelect(commFilters.consultant_id ?? "__all__", (v) => setCommFilters({ ...commFilters, consultant_id: v === "__all__" ? undefined : v }))}
            {dateRangeInputs(commFilters, setCommFilters)}
            {businessTypeSelect(commFilters, setCommFilters)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancelar</Button>
            <Button onClick={handleCommissionGenerate}>Gerar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Time to sale dialog */}
      <Dialog open={activeDialog === "time"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tempo Medio de Venda</DialogTitle>
            <DialogDescription>Filtre por tipo de imovel, cidade e periodo</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tipo de Imovel</Label>
              <Input placeholder="Ex: apartamento" value={timeFilters.property_type ?? ""} onChange={(e) => setTimeFilters({ ...timeFilters, property_type: e.target.value || undefined })} />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input placeholder="Ex: Lisboa" value={timeFilters.city ?? ""} onChange={(e) => setTimeFilters({ ...timeFilters, city: e.target.value || undefined })} />
            </div>
            {dateRangeInputs(timeFilters, setTimeFilters)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancelar</Button>
            <Button onClick={handleTimeGenerate}>Gerar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shares dialog */}
      <Dialog open={activeDialog === "shares"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Partilhas</DialogTitle>
            <DialogDescription>Analise negocios partilhados por tipo e periodo</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {dateRangeInputs(sharesFilters, setSharesFilters)}
            <div className="space-y-1.5">
              <Label>Tipo de Partilha</Label>
              <Select
                value={sharesFilters.status ?? "__all__"}
                onValueChange={(v) => setSharesFilters({ ...sharesFilters, status: v === "__all__" ? undefined : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  <SelectItem value="internal">Interna</SelectItem>
                  <SelectItem value="external">Externa</SelectItem>
                  <SelectItem value="network">Na Rede</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancelar</Button>
            <Button onClick={handleSharesGenerate}>Gerar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom report dialog */}
      <Dialog open={activeDialog === "custom"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Relatorio Dinamico</DialogTitle>
            <DialogDescription>Escolha dimensoes, metricas e filtros</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
            {/* Dimensions */}
            <div className="space-y-2">
              <Label className="font-semibold">Dimensoes</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(REPORT_DIMENSIONS) as [ReportDimension, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={customDimensions.includes(key)}
                      onCheckedChange={(checked) => {
                        setCustomDimensions((prev) =>
                          checked ? [...prev, key] : prev.filter((d) => d !== key)
                        )
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {/* Metrics */}
            <div className="space-y-2">
              <Label className="font-semibold">Metricas</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(REPORT_METRICS) as [ReportMetric, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={customMetrics.includes(key)}
                      onCheckedChange={(checked) => {
                        setCustomMetrics((prev) =>
                          checked ? [...prev, key] : prev.filter((m) => m !== key)
                        )
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="space-y-3">
              <Label className="font-semibold">Filtros</Label>
              {consultantSelect(customFilters.consultant_id ?? "__all__", (v) => setCustomFilters({ ...customFilters, consultant_id: v === "__all__" ? undefined : v }))}
              {dateRangeInputs(customFilters, setCustomFilters)}
              {businessTypeSelect(customFilters, setCustomFilters)}
              <div className="space-y-1.5">
                <Label>Tipo de Imovel</Label>
                <Input placeholder="Ex: apartamento" value={customFilters.property_type ?? ""} onChange={(e) => setCustomFilters({ ...customFilters, property_type: e.target.value || undefined })} />
              </div>
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input placeholder="Ex: Lisboa" value={customFilters.city ?? ""} onChange={(e) => setCustomFilters({ ...customFilters, city: e.target.value || undefined })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancelar</Button>
            <Button onClick={handleCustomGenerate}>Gerar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Result Card Component ──────────────────────────────────────────────────

function ResultCard({
  title,
  count,
  open,
  onToggle,
  onExport,
  children,
}: {
  title: string
  count: number
  open: boolean
  onToggle: () => void
  onExport: () => void
  children: React.ReactNode
}) {
  return (
    <Collapsible open={open} onOpenChange={onToggle}>
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CardTitle className="text-sm">{title}</CardTitle>
              <Badge variant="secondary" className="text-xs">{count} registos</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 overflow-x-auto">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
