"use client"

import { useState, useTransition, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  User as UserIcon,
  Building2 as BuildingIcon,
  Phone as PhoneIcon,
  Mail as EnvelopeIcon,
  Clock as ClockIcon,
  Search as MagnifyingGlassIcon,
  ChevronLeft as CaretLeftIcon,
  ChevronRight as CaretRightIcon,
  ChevronDown as CaretDownIcon,
  ArrowUp as ArrowUpIcon,
  ArrowDown as ArrowDownIcon,
  ArrowUpDown as ArrowsDownUpIcon,
  Users as UsersIcon,
  Filter as FunnelSimpleIcon,
  AlertCircle as WarningCircleIcon,
  Circle as CircleIcon,
  PauseCircle as PauseCircleIcon,
  CheckCircle2 as CheckCircleIcon,
  RefreshCw as ArrowsClockwiseIcon,
  Loader2 as SpinnerIcon,
  Layers as StackIcon,
  Image as ImageIcon,
  Euro as CurrencyEurIcon,
  Eye as EyeIcon,
  MousePointerClick as CursorClickIcon,
  Target as TargetIcon,
  Calendar as CalendarIcon,
  ShoppingBag as ShoppingBagIcon,
  MapPin,
  ExternalLink,
  X as XIcon,
  Check as CheckIcon,
  ChevronRight,
} from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { CAMPAIGN_OBJECTIVES } from "@/lib/constants"
import type { Lead, LeadStatus } from "@/types/meta-lead"
import type { MetaCampaign, MetaAdSet, MetaAd, MetaInsights, LeadQualityStats, MetaPage } from "./actions"
import { syncMetaLeads, createMetaCampaign } from "./actions"
import type { MetaDatePreset } from "./constants"
import { META_DATE_PRESETS } from "./constants"
import { createClient } from "@/lib/supabase/client"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getLeadsForCampaign(leads: Lead[], campaignId: string, campaignName: string): Lead[] {
  return leads.filter((lead) => {
    const meta = lead.meta_data as Record<string, unknown> | null
    return meta?.campaign_id === campaignId || meta?.campaign_name === campaignName
  })
}

function getCampaignLabel(lead: Lead): string {
  const meta = lead.meta_data as Record<string, unknown> | null
  const campaignName = meta?.campaign_name as string | undefined
  if (campaignName) return campaignName
  if (lead.source_detail) return lead.source_detail.replace("Formulário: ", "").replace("Meta Lead Ads — Form ", "")
  return "Meta Ads"
}

// ─── Shared constants ────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<LeadStatus, { label: string; dot: string; badge: string }> = {
  new:           { label: "Novo",        dot: "bg-blue-500",    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  contacted:     { label: "Contactado",  dot: "bg-purple-500",  badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  qualified:     { label: "Qualificado", dot: "bg-amber-500",   badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  proposal_sent: { label: "Proposta",    dot: "bg-orange-500",  badge: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  negotiation:   { label: "Negociação",  dot: "bg-pink-500",    badge: "bg-pink-500/10 text-pink-600 dark:text-pink-400" },
  won:           { label: "Ganho",       dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  lost:          { label: "Perdido",     dot: "bg-red-500",     badge: "bg-red-500/10 text-red-600 dark:text-red-400" },
  cancelled:     { label: "Cancelado",   dot: "bg-muted-foreground/50", badge: "bg-muted text-muted-foreground" },
  junk:          { label: "Engano",      dot: "bg-muted-foreground/40", badge: "bg-muted text-muted-foreground" },
}

const CAMPAIGN_STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; badge: string }> = {
  ACTIVE:   { label: "Ativa",    icon: CheckCircleIcon,  color: "text-emerald-500", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  PAUSED:   { label: "Pausada",  icon: PauseCircleIcon,  color: "text-amber-500", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  ARCHIVED: { label: "Arquivada", icon: CircleIcon,      color: "text-muted-foreground", badge: "bg-muted text-muted-foreground" },
  DELETED:  { label: "Eliminada", icon: CircleIcon,      color: "text-red-500", badge: "bg-red-500/10 text-red-600 dark:text-red-400" },
}

function timeAgo(dateString: string): string {
  const s = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (s < 60) return "agora mesmo"
  const m = Math.floor(s / 60)
  if (m < 60) return `há ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `há ${d}d`
  return `há ${Math.floor(d / 30)}m`
}

function formatBudget(cents: string | null): string | null {
  if (!cents) return null
  const value = parseInt(cents, 10) / 100
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(value)
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(value)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-PT").format(value)
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}

function getDateCutoff(preset: MetaDatePreset): Date | null {
  const now = new Date()
  switch (preset) {
    case "last_7d":    return new Date(now.getTime() - 7 * 86400000)
    case "last_14d":   return new Date(now.getTime() - 14 * 86400000)
    case "last_30d":   return new Date(now.getTime() - 30 * 86400000)
    case "last_90d":   return new Date(now.getTime() - 90 * 86400000)
    case "this_month": return new Date(now.getFullYear(), now.getMonth(), 1)
    case "last_month": return new Date(now.getFullYear(), now.getMonth() - 1, 1)
    case "maximum":    return null
  }
}

function getDateEnd(preset: MetaDatePreset): Date | null {
  if (preset !== "last_month") return null
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
}

function filterLeadsByPeriod(leads: Lead[], preset: MetaDatePreset): Lead[] {
  const cutoff = getDateCutoff(preset)
  if (!cutoff) return leads
  const end = getDateEnd(preset)
  return leads.filter((l) => {
    const d = new Date(l.created_at)
    if (d < cutoff) return false
    if (end && d > end) return false
    return true
  })
}

// ─── Period Selector ────────────────────────────────────────────────────────

function PeriodSelector({
  current,
  onChange,
}: {
  current: MetaDatePreset
  onChange: (preset: MetaDatePreset) => void
}) {
  return (
    <div className="overflow-x-auto">
      <div className="flex items-center gap-1 rounded-lg border bg-muted p-0.5 w-fit">
        <CalendarIcon className="h-3.25 w-3.25 text-muted-foreground ml-2 mr-0.5 shrink-0" />
        {META_DATE_PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => onChange(p.key)}
            className={cn(
              "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150 whitespace-nowrap",
              current === p.key
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Sortable Header ─────────────────────────────────────────────────────────

function SortableHeader({
  label,
  column,
}: {
  label: string
  column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (asc?: boolean) => void }
}) {
  const sorted = column.getIsSorted()
  return (
    <button
      onClick={() => column.toggleSorting(sorted === "asc")}
      className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors group"
    >
      {label}
      {sorted === "asc"  ? <ArrowUpIcon className="h-2.75 w-2.75 opacity-70" /> :
       sorted === "desc" ? <ArrowDownIcon className="h-2.75 w-2.75 opacity-70" /> :
       <ArrowsDownUpIcon className="h-2.75 w-2.75 opacity-0 group-hover:opacity-40 transition-opacity" />}
    </button>
  )
}

// ─── Metric Card ────────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={cn("h-3.5 w-3.5", color ?? "text-muted-foreground")} />
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        <p className={cn("text-xl font-bold", color ?? "text-foreground")}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

// ─── Status Badge ───────────────────────────────────────────────────────────

function AdStatusBadge({ status }: { status: string }) {
  const cfg = CAMPAIGN_STATUS_CONFIG[status] ?? CAMPAIGN_STATUS_CONFIG.PAUSED
  const Icon = cfg.icon
  return (
    <Badge variant="outline" className={cn("gap-1 text-[10px] font-medium border-transparent", cfg.badge)}>
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </Badge>
  )
}

// ─── Eye / Detail Button ────────────────────────────────────────────────────

function DetailButton({ href }: { href: string }) {
  return (
    <Button
      variant="outline"
      size="icon"
      className="h-7 w-7 shrink-0"
      asChild
    >
      <Link
        href={href}
        onClick={(e) => e.stopPropagation()}
        title="Ver detalhes"
      >
        <EyeIcon className="h-3.5 w-3.5" />
      </Link>
    </Button>
  )
}

// ─── Insights Inline ────────────────────────────────────────────────────────

function InsightsRow({ insights, leadCount, costPerLead }: {
  insights?: MetaInsights
  leadCount: number
  costPerLead?: number
}) {
  if (!insights) return <span className="text-[10px] text-muted-foreground">Sem dados</span>
  return (
    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
      <span title="Gasto">{formatCurrency(insights.spend)}</span>
      <span className="text-border">|</span>
      <span title="Impressoes">{formatNumber(insights.impressions)} imp</span>
      <span className="text-border">|</span>
      <span title="Cliques">{formatNumber(insights.clicks)} cliques</span>
      {costPerLead !== undefined && (
        <>
          <span className="text-border">|</span>
          <span title="Custo por lead" className="font-semibold text-[#1877F2]">CPL: {formatCurrency(costPerLead)}</span>
        </>
      )}
    </div>
  )
}

// ─── Leads Table ─────────────────────────────────────────────────────────────

function MetaLeadsTable({ leads, showCampaign = true }: { leads: Lead[]; showCampaign?: boolean }) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState("")

  const columns: ColumnDef<Lead>[] = [
    {
      accessorKey: "full_name",
      filterFn: "includesString",
      header: ({ column }) => <SortableHeader label="Lead" column={column} />,
      cell: ({ row }) => {
        const lead = row.original
        return (
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
              <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <Link
                href={`/leads/${lead.id}`}
                className="text-sm font-medium text-foreground hover:underline truncate block"
              >
                {lead.full_name}
              </Link>
              {lead.company_name && (
                <div className="flex items-center gap-1 mt-0.5">
                  <BuildingIcon className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground truncate">
                    {lead.company_name}
                  </span>
                </div>
              )}
              {lead.job_title && (
                <div className="flex items-center gap-1 mt-0.5">
                  <UserIcon className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground truncate">
                    {lead.job_title}
                  </span>
                </div>
              )}
            </div>
          </div>
        )
      },
    },
    {
      id: "contact",
      header: () => (
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Contacto
        </span>
      ),
      cell: ({ row }) => {
        const lead = row.original
        if (!lead.email && !lead.phone) return <span className="text-xs text-muted-foreground">--</span>
        return (
          <div className="space-y-0.5">
            {lead.email && (
              <div className="flex items-center gap-1.5">
                <EnvelopeIcon className="h-2.75 w-2.75 shrink-0 text-muted-foreground" />
                <span className="text-xs text-muted-foreground truncate max-w-[160px]">{lead.email}</span>
              </div>
            )}
            {lead.phone && (
              <div className="flex items-center gap-1.5">
                <PhoneIcon className="h-2.75 w-2.75 shrink-0 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{lead.phone}</span>
              </div>
            )}
          </div>
        )
      },
    },
    ...(showCampaign
      ? [
          {
            id: "campaign",
            header: () => (
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Campanha
              </span>
            ),
            cell: ({ row }: { row: { original: Lead } }) => (
              <Badge variant="outline" className="border-transparent bg-[#1877F2]/10 text-[#1877F2] max-w-[180px] truncate text-[11px]">
                {getCampaignLabel(row.original)}
              </Badge>
            ),
          } as ColumnDef<Lead>,
        ]
      : []),
    {
      accessorKey: "status",
      header: ({ column }) => <SortableHeader label="Estado" column={column} />,
      cell: ({ row }) => {
        const sc = STATUS_CONFIG[row.getValue("status") as LeadStatus]
        return (
          <Badge variant="outline" className={cn("gap-1.5 text-xs font-medium border-transparent", sc.badge)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
            {sc.label}
          </Badge>
        )
      },
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => <SortableHeader label="Criado" column={column} />,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ClockIcon className="h-2.75 w-2.75" />
          {timeAgo(row.getValue("created_at"))}
        </div>
      ),
    },
  ]

  const table = useReactTable({
    data: leads,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  })

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon
            className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Pesquisar leads..."
            className="pl-9"
          />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {table.getFilteredRowModel().rows.length} resultado{table.getFilteredRowModel().rows.length !== 1 ? "s" : ""}
        </span>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="bg-muted/50 hover:bg-muted/50"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="h-14 px-4">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/leads/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                  Sem resultados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </Card>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Pagina {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <CaretLeftIcon className="h-3.25 w-3.25" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <CaretRightIcon className="h-3.25 w-3.25" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Accordion Row Components ───────────────────────────────────────────────

function AccordionCampaignRow({
  campaign,
  adSets,
  ads,
  expanded,
  onToggle,
}: {
  campaign: MetaCampaign
  adSets: MetaAdSet[]
  ads: MetaAd[]
  expanded: boolean
  onToggle: () => void
}) {
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set())
  const campaignAdSets = adSets.filter((as_) => as_.campaign_id === campaign.id)
  const budget = formatBudget(campaign.daily_budget) ?? formatBudget(campaign.lifetime_budget)

  function toggleAdSet(id: string) {
    setExpandedAdSets((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      {/* Campaign row */}
      <tr
        onClick={onToggle}
        className={cn(
          "border-b transition-colors cursor-pointer",
          expanded
            ? "bg-[#1877F2]/[0.03] dark:bg-[#1877F2]/[0.06]"
            : "bg-card hover:bg-muted/50"
        )}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <CaretDownIcon
              className={cn("h-3 w-3", 
                "text-muted-foreground transition-transform duration-200 shrink-0",
                !expanded && "-rotate-90"
              )}
            />
            <div className="h-8 w-8 rounded-lg bg-[#1877F2]/10 flex items-center justify-center shrink-0">
              <FunnelSimpleIcon className="h-3.5 w-3.5 text-[#1877F2]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate max-w-[250px]">{campaign.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <AdStatusBadge status={campaign.status} />
                {budget && (
                  <>
                    <span className="text-border">.</span>
                    <span className="text-[10px] text-muted-foreground">
                      {campaign.daily_budget ? `${budget}/dia` : budget}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-right text-xs text-foreground">{campaign.insights ? formatCurrency(campaign.insights.spend) : "--"}</td>
        <td className="px-4 py-3 text-right text-xs text-foreground">{campaign.insights ? formatNumber(campaign.insights.impressions) : "--"}</td>
        <td className="px-4 py-3 text-right text-xs text-foreground">{campaign.insights ? formatNumber(campaign.insights.clicks) : "--"}</td>
        <td className="px-4 py-3 text-right text-xs text-foreground">{campaign.insights ? formatPercent(campaign.insights.ctr) : "--"}</td>
        <td className="px-4 py-3 text-right">
          <span className={cn("text-xs font-bold", campaign.leadCount > 0 ? "text-[#1877F2]" : "text-muted-foreground")}>{campaign.leadCount}</span>
        </td>
        <td className="px-4 py-3 text-right">
          <span className={cn("text-xs font-semibold", campaign.costPerLead ? "text-[#1877F2]" : "text-muted-foreground")}>
            {campaign.costPerLead ? formatCurrency(campaign.costPerLead) : "--"}
          </span>
        </td>
        <td className="px-4 py-3">
          <DetailButton href={`/meta-ads/campaigns/${campaign.id}`} />
        </td>
      </tr>

      {/* Expanded: Ad Sets */}
      {expanded && campaignAdSets.map((adSet) => {
        const adSetAds = ads.filter((a) => a.adset_id === adSet.id)
        const isExpanded = expandedAdSets.has(adSet.id)

        return (
          <AccordionAdSetRow
            key={adSet.id}
            adSet={adSet}
            ads={adSetAds}
            expanded={isExpanded}
            onToggle={() => toggleAdSet(adSet.id)}
          />
        )
      })}

      {expanded && campaignAdSets.length === 0 && (
        <tr className="bg-muted/30">
          <td colSpan={8} className="px-12 py-3 text-xs text-muted-foreground italic">
            Sem conjuntos de anuncios nesta campanha
          </td>
        </tr>
      )}
    </>
  )
}

function AccordionAdSetRow({
  adSet,
  ads,
  expanded,
  onToggle,
}: {
  adSet: MetaAdSet
  ads: MetaAd[]
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      {/* Ad Set row */}
      <tr
        onClick={onToggle}
        className={cn(
          "border-b transition-colors cursor-pointer",
          expanded
            ? "bg-muted/50"
            : "bg-muted/30 hover:bg-muted/50"
        )}
      >
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2 pl-8">
            <CaretDownIcon
              className={cn("h-2.75 w-2.75", 
                "text-muted-foreground transition-transform duration-200 shrink-0",
                !expanded && "-rotate-90"
              )}
            />
            <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center shrink-0">
              <StackIcon className="h-2.75 w-2.75 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate max-w-[220px]">{adSet.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <AdStatusBadge status={adSet.status} />
                {adSet.targeting_summary && (
                  <span className="text-[9px] text-muted-foreground">{adSet.targeting_summary}</span>
                )}
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-2.5 text-right text-[11px] text-foreground">{adSet.insights ? formatCurrency(adSet.insights.spend) : "--"}</td>
        <td className="px-4 py-2.5 text-right text-[11px] text-foreground">{adSet.insights ? formatNumber(adSet.insights.impressions) : "--"}</td>
        <td className="px-4 py-2.5 text-right text-[11px] text-foreground">{adSet.insights ? formatNumber(adSet.insights.clicks) : "--"}</td>
        <td className="px-4 py-2.5 text-right text-[11px] text-foreground">{adSet.insights ? formatPercent(adSet.insights.ctr) : "--"}</td>
        <td className="px-4 py-2.5 text-right">
          <span className={cn("text-[11px] font-bold", adSet.leadCount > 0 ? "text-[#1877F2]" : "text-muted-foreground")}>{adSet.leadCount}</span>
        </td>
        <td className="px-4 py-2.5 text-right">
          <span className={cn("text-[11px] font-semibold", adSet.costPerLead ? "text-[#1877F2]" : "text-muted-foreground")}>
            {adSet.costPerLead ? formatCurrency(adSet.costPerLead) : "--"}
          </span>
        </td>
        <td className="px-4 py-2.5">
          <DetailButton href={`/meta-ads/adsets/${adSet.id}`} />
        </td>
      </tr>

      {/* Expanded: Ads */}
      {expanded && ads.map((ad) => (
        <tr
          key={ad.id}
          className="border-b bg-muted/20 hover:bg-muted/40 transition-colors"
        >
          <td className="px-4 py-2">
            <div className="flex items-center gap-2 pl-16">
              <div className="h-5 w-5 rounded-md bg-purple-500/10 flex items-center justify-center shrink-0">
                <ImageIcon className="h-2.5 w-2.5 text-purple-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-foreground truncate max-w-[200px]">{ad.name}</p>
                <AdStatusBadge status={ad.status} />
              </div>
            </div>
          </td>
          <td className="px-4 py-2 text-right text-[10px] text-foreground">{ad.insights ? formatCurrency(ad.insights.spend) : "--"}</td>
          <td className="px-4 py-2 text-right text-[10px] text-foreground">{ad.insights ? formatNumber(ad.insights.impressions) : "--"}</td>
          <td className="px-4 py-2 text-right text-[10px] text-foreground">{ad.insights ? formatNumber(ad.insights.clicks) : "--"}</td>
          <td className="px-4 py-2 text-right text-[10px] text-foreground">{ad.insights ? formatPercent(ad.insights.ctr) : "--"}</td>
          <td className="px-4 py-2 text-right">
            <span className={cn("text-[10px] font-bold", ad.leadCount > 0 ? "text-[#1877F2]" : "text-muted-foreground")}>{ad.leadCount}</span>
          </td>
          <td className="px-4 py-2 text-right">
            <span className={cn("text-[10px] font-semibold", ad.costPerLead ? "text-[#1877F2]" : "text-muted-foreground")}>
              {ad.costPerLead ? formatCurrency(ad.costPerLead) : "--"}
            </span>
          </td>
          <td className="px-4 py-2">
            <DetailButton href={`/meta-ads/ads/${ad.id}`} />
          </td>
        </tr>
      ))}

      {expanded && ads.length === 0 && (
        <tr className="bg-muted/20">
          <td colSpan={8} className="px-20 py-2 text-[10px] text-muted-foreground italic">
            Sem anuncios neste conjunto
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Lead Quality Section ───────────────────────────────────────────────────

function LeadQualitySection({ stats }: { stats: LeadQualityStats[] }) {
  if (stats.length === 0) return null

  const STATUS_COLORS: Record<string, string> = {
    new: "bg-blue-500",
    contacted: "bg-purple-500",
    qualified: "bg-amber-500",
    proposal_sent: "bg-orange-500",
    negotiation: "bg-pink-500",
    won: "bg-emerald-500",
    lost: "bg-red-500",
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <TargetIcon className="h-3.5 w-3.5 text-muted-foreground" />
        Qualidade dos Leads por Campanha
      </h3>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Campanha</th>
              <th className="text-center px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[200px]">Pipeline</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Qualificacao</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Conversao</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => {
              const stages = [
                { key: "new", count: s.new },
                { key: "contacted", count: s.contacted },
                { key: "qualified", count: s.qualified },
                { key: "proposal_sent", count: s.proposal_sent },
                { key: "negotiation", count: s.negotiation },
                { key: "won", count: s.won },
                { key: "lost", count: s.lost },
              ].filter((st) => st.count > 0)

              return (
                <tr key={s.campaignId} className="border-b bg-card hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/meta-ads/campaigns/${s.campaignId}`} className="text-xs font-medium text-foreground hover:underline truncate max-w-[200px] block">
                      {s.campaignName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs font-bold text-[#1877F2]">{s.total}</span>
                  </td>
                  <td className="px-4 py-3">
                    {/* Pipeline bar */}
                    <div className="flex items-center gap-0.5 h-4 rounded-full overflow-hidden bg-muted">
                      {stages.map((st) => (
                        <div
                          key={st.key}
                          className={cn("h-full transition-all", STATUS_COLORS[st.key])}
                          style={{ width: `${(st.count / s.total) * 100}%`, minWidth: st.count > 0 ? "4px" : 0 }}
                          title={`${st.key}: ${st.count}`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {stages.map((st) => (
                        <span key={st.key} className="flex items-center gap-1 text-[9px] text-muted-foreground">
                          <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_COLORS[st.key])} />
                          {st.count}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn("text-xs font-semibold", s.qualificationRate > 30 ? "text-emerald-600" : s.qualificationRate > 10 ? "text-amber-600" : "text-muted-foreground")}>
                      {formatPercent(s.qualificationRate)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn("text-xs font-bold", s.conversionRate > 10 ? "text-emerald-600" : s.conversionRate > 0 ? "text-amber-600" : "text-muted-foreground")}>
                      {formatPercent(s.conversionRate)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

// ─── Campanhas Tab (Accordion) ──────────────────────────────────────────────

function CampanhasTab({
  campaigns,
  adSets,
  ads,
  totalLeads,
  leadQuality,
}: {
  campaigns: MetaCampaign[]
  adSets: MetaAdSet[]
  ads: MetaAd[]
  totalLeads: number
  leadQuality: LeadQualityStats[]
}) {
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set())

  const totalSpend = campaigns.reduce((sum, c) => sum + (c.insights?.spend ?? 0), 0)
  const totalImpressions = campaigns.reduce((sum, c) => sum + (c.insights?.impressions ?? 0), 0)
  const totalClicks = campaigns.reduce((sum, c) => sum + (c.insights?.clicks ?? 0), 0)
  const totalReach = campaigns.reduce((sum, c) => sum + (c.insights?.reach ?? 0), 0)
  const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0
  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0

  function toggleCampaign(id: string) {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in duration-500">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-5">
          <FunnelSimpleIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1">Sem campanhas</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Nao foram encontradas campanhas na conta de anuncios configurada.
        </p>
      </div>
    )
  }

  const thClass = "text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard icon={CurrencyEurIcon} label="Gasto total" value={formatCurrency(totalSpend)} color="text-red-500" />
        <MetricCard icon={TargetIcon} label="Custo por lead" value={avgCPL > 0 ? formatCurrency(avgCPL) : "--"} color="text-[#1877F2]" />
        <MetricCard icon={EyeIcon} label="Impressoes" value={formatNumber(totalImpressions)} sub={`Alcance: ${formatNumber(totalReach)}`} />
        <MetricCard icon={CursorClickIcon} label="Cliques" value={formatNumber(totalClicks)} sub={`CTR: ${formatPercent(avgCTR)} . CPC: ${formatCurrency(avgCPC)}`} />
      </div>

      {/* Accordion table */}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome</th>
              <th className={thClass}>Gasto</th>
              <th className={thClass}>Impressoes</th>
              <th className={thClass}>Cliques</th>
              <th className={thClass}>CTR</th>
              <th className={thClass}>Leads</th>
              <th className={thClass}>CPL</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => (
              <AccordionCampaignRow
                key={campaign.id}
                campaign={campaign}
                adSets={adSets}
                ads={ads}
                expanded={expandedCampaigns.has(campaign.id)}
                onToggle={() => toggleCampaign(campaign.id)}
              />
            ))}
          </tbody>
        </table>
      </Card>

      {/* Lead Quality Section */}
      <LeadQualitySection stats={leadQuality} />
    </div>
  )
}

// ─── Create Ad Tab ───────────────────────────────────────────────────────────

const OBJECTIVES = [
  { value: "OUTCOME_LEADS", label: "Geracao de leads" },
  { value: "OUTCOME_TRAFFIC", label: "Trafego" },
  { value: "OUTCOME_AWARENESS", label: "Reconhecimento" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engajamento" },
  { value: "OUTCOME_SALES", label: "Vendas" },
]

const CTA_TYPES = [
  { value: "LEARN_MORE", label: "Saber mais" },
  { value: "SIGN_UP", label: "Inscrever-se" },
  { value: "CONTACT_US", label: "Contactar" },
  { value: "GET_QUOTE", label: "Pedir orcamento" },
  { value: "SHOP_NOW", label: "Comprar agora" },
  { value: "BOOK_TRAVEL", label: "Reservar" },
  { value: "APPLY_NOW", label: "Candidatar-se" },
]

function CreateAdTab({ pages }: { pages: MetaPage[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ success: boolean; error: string | null } | null>(null)

  const [name, setName] = useState("")
  const [objective, setObjective] = useState("OUTCOME_LEADS")
  const [dailyBudget, setDailyBudget] = useState("5")
  const [ageMin, setAgeMin] = useState("18")
  const [ageMax, setAgeMax] = useState("65")
  const [countries, setCountries] = useState("PT")
  const [pageId, setPageId] = useState(pages[0]?.id ?? "")
  const [imageUrl, setImageUrl] = useState("")
  const [headline, setHeadline] = useState("")
  const [body, setBody] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [cta, setCta] = useState("LEARN_MORE")

  function handleSubmit() {
    if (!name.trim() || !headline.trim() || !body.trim() || !linkUrl.trim() || !pageId) return
    setResult(null)
    startTransition(async () => {
      const res = await createMetaCampaign({
        name: name.trim(),
        objective,
        dailyBudget: parseFloat(dailyBudget) || 5,
        targeting: {
          ageMin: parseInt(ageMin) || 18,
          ageMax: parseInt(ageMax) || 65,
          countries: countries.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean),
        },
        adCreative: {
          pageId,
          imageUrl: imageUrl.trim() || undefined,
          headline: headline.trim(),
          body: body.trim(),
          linkUrl: linkUrl.trim(),
          callToAction: cta,
        },
      })
      setResult(res)
      if (res.success) router.refresh()
    })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Criar campanha</CardTitle>
          <CardDescription>
            A campanha sera criada como PAUSADA. Ativa-a depois de rever no Meta Ads Manager.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Campaign name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Nome da campanha</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Infinity -- Lead Gen Marco" />
          </div>

          {/* Objective */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Objetivo</label>
            <Select value={objective} onValueChange={setObjective}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OBJECTIVES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Budget + Targeting */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Orcamento diario (EUR)</label>
              <Input type="number" min="1" step="1" value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Paises (ISO, virgula)</label>
              <Input value={countries} onChange={(e) => setCountries(e.target.value)} placeholder="PT, BR, ES" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Idade minima</label>
              <Input type="number" min="13" max="65" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Idade maxima</label>
              <Input type="number" min="13" max="65" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} />
            </div>
          </div>

          {/* Page selection */}
          {pages.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Pagina Facebook</label>
              <Select value={pageId} onValueChange={setPageId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pages.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Creative */}
          <Separator />
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Criativo</h3>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">URL da imagem (publico)</label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Titulo</label>
              <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Ex: Transforme o seu negocio" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Texto do anuncio</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                placeholder="Descricao do anuncio..."
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 outline-none resize-none transition-colors dark:bg-input/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">URL de destino</label>
                <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://infinity-erp.vercel.app" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Call to Action</label>
                <Select value={cta} onValueChange={setCta}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CTA_TYPES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className={cn("flex items-center gap-2 rounded-lg px-4 py-3 text-sm", result.success ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>
              {result.success ? <CheckCircleIcon className="h-4 w-4" /> : <WarningCircleIcon className="h-4 w-4" />}
              {result.success ? "Campanha criada como PAUSED. Ativa no Meta Ads Manager." : result.error}
            </div>
          )}

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={isPending || !name.trim() || !headline.trim() || !body.trim() || !linkUrl.trim()}
            className="w-full bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
            size="lg"
          >
            {isPending ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <TargetIcon className="h-4 w-4" />}
            {isPending ? "A criar campanha..." : "Criar campanha (pausada)"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Campaign Request Status Config ──────────────────────────────────────────

const PEDIDO_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending:   { label: "Pendente",   bg: "bg-amber-500/10", text: "text-amber-600", dot: "bg-amber-500" },
  approved:  { label: "Aprovado",   bg: "bg-emerald-500/10", text: "text-emerald-600", dot: "bg-emerald-500" },
  active:    { label: "Ativo",     bg: "bg-blue-500/10", text: "text-blue-600", dot: "bg-blue-500" },
  completed: { label: "Concluído",  bg: "bg-slate-500/10", text: "text-slate-600", dot: "bg-slate-500" },
  rejected:  { label: "Rejeitado",  bg: "bg-red-500/10", text: "text-red-600", dot: "bg-red-500" },
  cancelled: { label: "Cancelado",  bg: "bg-slate-400/10", text: "text-slate-500", dot: "bg-slate-400" },
}

interface CampaignRequest {
  id: string
  objective: string
  property_id: string | null
  promote_url: string | null
  target_zone: string | null
  target_age_min: number | null
  target_age_max: number | null
  target_interests: string | null
  budget_type: string
  budget_amount: number
  duration_days: number
  total_cost: number
  creative_notes: string | null
  status: string
  rejection_reason: string | null
  payment_method: string | null
  created_at: string
  updated_at: string | null
  agent: { id: string; commercial_name: string } | null
  property: { id: string; title: string; slug: string } | null
}

function PedidosTab({ onCountChange }: { onCountChange?: (count: number) => void }) {
  const [requests, setRequests] = useState<CampaignRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("all")
  const [selectedRequest, setSelectedRequest] = useState<CampaignRequest | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")

  useEffect(() => {
    fetchRequests()
  }, [])

  async function fetchRequests() {
    try {
      const res = await fetch("/api/marketing/campaigns")
      if (res.ok) {
        const data = await res.json()
        setRequests(data)
        onCountChange?.(data.filter((r: CampaignRequest) => r.status === "pending").length)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(id: string) {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/marketing/campaigns/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      })
      if (res.ok) {
        setRequests((prev) => {
          const next = prev.map((r) => (r.id === id ? { ...r, status: "approved" } : r))
          onCountChange?.(next.filter((r) => r.status === "pending").length)
          return next
        })
        if (selectedRequest?.id === id) setSelectedRequest((prev) => prev ? { ...prev, status: "approved" } : null)
      }
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReject(id: string) {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/marketing/campaigns/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected", rejection_reason: rejectionReason || undefined }),
      })
      if (res.ok) {
        setRequests((prev) => {
          const next = prev.map((r) => (r.id === id ? { ...r, status: "rejected", rejection_reason: rejectionReason } : r))
          onCountChange?.(next.filter((r) => r.status === "pending").length)
          return next
        })
        if (selectedRequest?.id === id) setSelectedRequest((prev) => prev ? { ...prev, status: "rejected" } : null)
        setRejectionReason("")
      }
    } finally {
      setActionLoading(null)
    }
  }

  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter)

  const statusCounts = requests.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-muted/50 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <>
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total pedidos", value: requests.length, color: "text-[#1877F2]" },
          { label: "Pendentes", value: statusCounts.pending || 0, color: "text-amber-500" },
          { label: "Aprovados", value: (statusCounts.approved || 0) + (statusCounts.active || 0), color: "text-emerald-500" },
          { label: "Investimento", value: formatCurrency(requests.reduce((sum, r) => sum + Number(r.total_cost || 0), 0)), color: "text-foreground", isText: true },
        ].map((stat) => (
          <div
            key={stat.label}
            className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/60 backdrop-blur-md p-4 shadow-sm dark:bg-white/5 dark:border-white/10"
          >
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{stat.label}</p>
            <p className={cn("text-2xl font-bold mt-1", stat.color)}>
              {typeof stat.value === "number" ? stat.value : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { key: "all", label: "Todos" },
          { key: "pending", label: "Pendentes" },
          { key: "approved", label: "Aprovados" },
          { key: "active", label: "Ativos" },
          { key: "rejected", label: "Rejeitados" },
          { key: "completed", label: "Concluídos" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
              filter === f.key
                ? "bg-[#1877F2] text-white shadow-sm"
                : "bg-white/60 backdrop-blur-sm border border-white/30 text-muted-foreground hover:text-foreground hover:bg-white/80 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10"
            )}
          >
            {f.label}
            {f.key !== "all" && statusCounts[f.key] ? (
              <span className="ml-1.5 opacity-70">({statusCounts[f.key]})</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Request list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1877F2]/10 mb-5">
            <ShoppingBagIcon className="h-7 w-7 text-[#1877F2]/50" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">Sem pedidos</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            {filter === "all"
              ? "Ainda não existem pedidos de campanha. Os consultores podem fazer pedidos através da Loja."
              : "Nenhum pedido com este estado."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req, i) => {
            const status = PEDIDO_STATUS_CONFIG[req.status] || PEDIDO_STATUS_CONFIG.pending
            const objectiveLabel = CAMPAIGN_OBJECTIVES[req.objective as keyof typeof CAMPAIGN_OBJECTIVES] || req.objective
            return (
              <button
                key={req.id}
                onClick={() => setSelectedRequest(req)}
                className={cn(
                  "w-full text-left group relative overflow-hidden rounded-2xl border border-white/20 bg-white/60 backdrop-blur-md p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.005] dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/8",
                  "animate-in fade-in slide-in-from-bottom-2"
                )}
                style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}
              >
                <div className="flex items-start gap-4">
                  {/* Agent avatar */}
                  <div className="shrink-0">
                    <Avatar className="h-10 w-10 ring-2 ring-white/50 dark:ring-white/10">
                      <AvatarFallback className="bg-[#1877F2]/10 text-[#1877F2] text-xs font-semibold">
                        {req.agent?.commercial_name?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "??"}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-foreground truncate">
                        {objectiveLabel}
                      </span>
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", status.bg, status.text)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                        {status.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{req.agent?.commercial_name || "—"}</span>
                      {req.property && (
                        <span className="flex items-center gap-1 truncate max-w-[200px]">
                          <BuildingIcon className="h-3 w-3 shrink-0" />
                          {req.property.title}
                        </span>
                      )}
                      {req.promote_url && (
                        <span className="flex items-center gap-1 truncate max-w-[200px]">
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          URL externa
                        </span>
                      )}
                      {req.target_zone && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {req.target_zone}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3 shrink-0" />
                        {req.duration_days} dias
                      </span>
                    </div>
                  </div>

                  {/* Right side — price + arrow */}
                  <div className="shrink-0 flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground">{formatCurrency(Number(req.total_cost || 0))}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {req.budget_type === "daily" ? `${formatCurrency(Number(req.budget_amount))}/dia` : "total"}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!selectedRequest} onOpenChange={(open) => { if (!open) setSelectedRequest(null) }}>
        <SheetContent className="sm:max-w-md overflow-y-auto p-0">
          {selectedRequest && (() => {
            const req = selectedRequest
            const status = PEDIDO_STATUS_CONFIG[req.status] || PEDIDO_STATUS_CONFIG.pending
            const objectiveLabel = CAMPAIGN_OBJECTIVES[req.objective as keyof typeof CAMPAIGN_OBJECTIVES] || req.objective
            return (
              <div className="flex flex-col h-full">
                {/* Hero header */}
                <div className="relative bg-gradient-to-br from-[#1877F2]/10 via-[#1877F2]/5 to-transparent px-6 pt-8 pb-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12 ring-2 ring-white/60 shadow-md dark:ring-white/10">
                      <AvatarFallback className="bg-[#1877F2]/15 text-[#1877F2] text-sm font-bold">
                        {req.agent?.commercial_name?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "??"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-foreground leading-tight">{objectiveLabel}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">{req.agent?.commercial_name || "—"}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold", status.bg, status.text)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                          {status.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(req.created_at).toLocaleDateString("pt-PT", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Cost hero */}
                  <div className="mt-5 rounded-2xl border border-white/30 bg-white/50 backdrop-blur-md p-4 text-center shadow-sm dark:bg-white/5 dark:border-white/10">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Investimento Total</p>
                    <p className="text-3xl font-extrabold text-foreground mt-1">{formatCurrency(Number(req.total_cost || 0))}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {req.budget_type === "daily" ? `${formatCurrency(Number(req.budget_amount))}/dia × ${req.duration_days} dias` : `Orçamento total · ${req.duration_days} dias`}
                    </p>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 px-6 py-5 space-y-4">
                  {/* Property or URL */}
                  {(req.property || req.promote_url) && (
                    <div className="rounded-xl bg-muted/40 p-4">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mb-2.5">
                        {req.property ? "Imóvel" : "URL de Promoção"}
                      </p>
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-[#1877F2]/10 flex items-center justify-center shrink-0">
                          {req.property ? <BuildingIcon className="h-4 w-4 text-[#1877F2]" /> : <ExternalLink className="h-4 w-4 text-[#1877F2]" />}
                        </div>
                        {req.property ? (
                          <Link
                            href={`/dashboard/imoveis/${req.property.slug || req.property.id}`}
                            className="text-sm font-medium text-foreground truncate hover:text-primary hover:underline transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {req.property.title}
                          </Link>
                        ) : (
                          <span className="text-sm font-medium text-foreground truncate">
                            {req.promote_url}
                          </span>
                        )}
                        {req.property && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-auto" />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Targeting */}
                  {(req.target_zone || req.target_age_min || req.target_interests) && (
                    <div className="rounded-xl bg-muted/40 p-4">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Segmentação</p>
                      <div className="flex flex-wrap gap-2">
                        {req.target_zone && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background border text-xs font-medium">
                            <MapPin className="h-3 w-3 text-[#1877F2]" />
                            {req.target_zone}
                          </span>
                        )}
                        {(req.target_age_min || req.target_age_max) && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background border text-xs font-medium">
                            <UsersIcon className="h-3 w-3 text-[#1877F2]" />
                            {req.target_age_min || 18}–{req.target_age_max || 65} anos
                          </span>
                        )}
                        {req.target_interests && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background border text-xs font-medium">
                            <TargetIcon className="h-3 w-3 text-[#1877F2]" />
                            {req.target_interests}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Creative notes */}
                  {req.creative_notes && (
                    <div className="rounded-xl bg-muted/40 p-4">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Notas Criativas</p>
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{req.creative_notes}</p>
                    </div>
                  )}

                  {/* Rejection reason */}
                  {req.rejection_reason && (
                    <div className="rounded-xl border border-red-200/60 bg-red-50/40 p-4 dark:bg-red-500/5 dark:border-red-500/20">
                      <p className="text-[9px] uppercase tracking-wider text-red-500 font-medium mb-2">Motivo de Rejeição</p>
                      <p className="text-sm text-red-700 dark:text-red-400 leading-relaxed">{req.rejection_reason}</p>
                    </div>
                  )}
                </div>

                {/* Sticky actions footer */}
                {req.status === "pending" && (
                  <div className="border-t bg-background/80 backdrop-blur-md px-6 py-4 space-y-3">
                    <Textarea
                      placeholder="Motivo de rejeição (opcional)"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="rounded-xl resize-none text-sm bg-muted/50 border-0 focus-visible:ring-1"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApprove(req.id)}
                        disabled={actionLoading === req.id}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full gap-2 h-10"
                      >
                        {actionLoading === req.id ? (
                          <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckIcon className="h-3.5 w-3.5" />
                        )}
                        Aprovar
                      </Button>
                      <Button
                        onClick={() => handleReject(req.id)}
                        disabled={actionLoading === req.id}
                        variant="outline"
                        className="flex-1 border-red-200 text-red-600 hover:bg-red-50 rounded-full gap-2 h-10 dark:border-red-500/30 dark:hover:bg-red-500/10"
                      >
                        {actionLoading === req.id ? (
                          <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <XIcon className="h-3.5 w-3.5" />
                        )}
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </SheetContent>
      </Sheet>
    </>
  )
}

// ─── Main Client ─────────────────────────────────────────────────────────────

type Tab = "pedidos" | "leads" | "campanhas"

export function MetaAdsClient({
  initialLeads,
  campaigns,
  adSets,
  ads,
  leadQuality = [],
  apiError,
  currentPeriod = "maximum",
  pages = [],
}: {
  initialLeads: Lead[]
  campaigns: MetaCampaign[]
  adSets: MetaAdSet[]
  ads: MetaAd[]
  leadQuality?: LeadQualityStats[]
  apiError: string | null
  currentPeriod?: MetaDatePreset
  pages?: MetaPage[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("pedidos")
  const [pendingCount, setPendingCount] = useState(0)

  // Fetch pending campaign count for badge
  useEffect(() => {
    fetch("/api/marketing/campaigns?status=pending")
      .then((r) => r.ok ? r.json() : [])
      .then((data: unknown[]) => setPendingCount(data.length))
      .catch(() => {})
  }, [])
  const [isSyncing, startSync] = useTransition()
  const [syncResult, setSyncResult] = useState<{ synced: number; skipped: number; error: string | null } | null>(null)

  // Auto-refresh when new meta leads are inserted (from cron, webhook, or form submission)
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("meta-leads-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads", filter: "source=eq.meta_ads" },
        () => router.refresh()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [router])

  const filteredLeads = filterLeadsByPeriod(initialLeads, currentPeriod)

  function handleSync() {
    setSyncResult(null)
    startSync(async () => {
      const result = await syncMetaLeads()
      setSyncResult(result)
      router.refresh()
    })
  }

  function handlePeriodChange(preset: MetaDatePreset) {
    const params = new URLSearchParams(window.location.search)
    if (preset === "maximum") params.delete("period")
    else params.set("period", preset)
    router.push(`/meta-ads${params.toString() ? `?${params}` : ""}`)
  }

  const tabs: { key: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: "pedidos", label: "Pedidos", icon: ShoppingBagIcon, badge: pendingCount },
    { key: "leads", label: "Leads", icon: UsersIcon },
    { key: "campanhas", label: "Campanhas", icon: FunnelSimpleIcon },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className="h-10 w-10 rounded-xl bg-[#1877F2]/10 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Meta Ads</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""} via Meta
              {campaigns.length > 0 && ` . ${campaigns.length} campanha${campaigns.length !== 1 ? "s" : ""}`}
              {adSets.length > 0 && ` . ${adSets.length} conjunto${adSets.length !== 1 ? "s" : ""}`}
              {ads.length > 0 && ` . ${ads.length} anuncio${ads.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className={cn(
              "rounded-full gap-2",
              !isSyncing && "border-[#1877F2]/30 text-[#1877F2] hover:bg-[#1877F2]/5 hover:text-[#1877F2]"
            )}
          >
            {isSyncing ? (
              <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowsClockwiseIcon className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{isSyncing ? "A sincronizar..." : "Sincronizar leads"}</span>
          </Button>

          {/* Tabs */}
          <div className="flex items-center rounded-lg border bg-muted p-0.5">
            {tabs.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
                    tab === t.key
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.25 w-3.25" />
                  <span className="hidden sm:inline">{t.label}</span>
                  {t.badge && t.badge > 0 ? (
                    <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1877F2] px-1 text-[10px] font-bold text-white leading-none">
                      {t.badge}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex items-center justify-between gap-3">
        <PeriodSelector current={currentPeriod} onChange={handlePeriodChange} />
        {currentPeriod !== "maximum" && (
          <span className="hidden sm:inline text-[11px] text-muted-foreground shrink-0">
            A mostrar dados de: {META_DATE_PRESETS.find((p) => p.key === currentPeriod)?.label}
          </span>
        )}
      </div>

      {/* Stats cards (only on leads tab) */}
      {tab === "leads" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total leads", value: filteredLeads.length, color: "text-[#1877F2]" },
            { label: "Novos", value: filteredLeads.filter((l) => l.status === "new").length, color: "text-blue-500" },
            { label: "Em progresso", value: filteredLeads.filter((l) => !["new", "won", "lost", "cancelled", "junk"].includes(l.status)).length, color: "text-amber-500" },
            { label: "Convertidos", value: filteredLeads.filter((l) => l.status === "won").length, color: "text-emerald-500" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Sync result banner */}
      {syncResult && (
        <div className={cn(
          "flex items-center gap-3 rounded-lg border px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300",
          syncResult.error
            ? "bg-red-500/10 border-red-500/20"
            : "bg-emerald-500/10 border-emerald-500/20"
        )}>
          {syncResult.error ? (
            <WarningCircleIcon className="h-4.5 w-4.5 text-red-500 shrink-0" />
          ) : (
            <CheckCircleIcon className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
          )}
          <p className="text-sm text-foreground">
            {syncResult.error
              ? `Erro: ${syncResult.error}`
              : `${syncResult.synced} lead${syncResult.synced !== 1 ? "s" : ""} sincronizado${syncResult.synced !== 1 ? "s" : ""}${syncResult.skipped > 0 ? `, ${syncResult.skipped} ja existente${syncResult.skipped !== 1 ? "s" : ""}` : ""}`}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSyncResult(null)}
            className="ml-auto text-xs"
          >
            Fechar
          </Button>
        </div>
      )}

      {/* API Error banner */}
      {apiError && tab === "campanhas" && (
        <div className="flex items-center gap-3 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 animate-in fade-in duration-200">
          <WarningCircleIcon className="h-4.5 w-4.5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Erro ao carregar dados do Meta</p>
            <p className="text-xs text-muted-foreground mt-0.5">{apiError}</p>
          </div>
          <Button variant="link" size="sm" className="ml-auto shrink-0 text-amber-600" asChild>
            <Link href="/settings/integrations/meta">
              Verificar configuracao
            </Link>
          </Button>
        </div>
      )}

      {/* Tab content: Leads */}
      {tab === "leads" && (
        filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in duration-500">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1877F2]/10 mb-5">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#1877F2" opacity="0.5">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              {currentPeriod !== "maximum" ? "Sem leads neste periodo" : "Sem leads Meta ainda"}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              {currentPeriod !== "maximum"
                ? "Experimenta um periodo de tempo mais alargado."
                : "Configura o webhook de Lead Ads ou cria formularios com origem \"Meta Ads\" para comecar a receber leads."}
            </p>
            {currentPeriod === "maximum" && (
              <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white rounded-full" asChild>
                <Link href="/settings/integrations/meta">
                  Configurar integracao
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <MetaLeadsTable leads={filteredLeads} showCampaign />
        )
      )}

      {/* Tab content: Campanhas (accordion + metrics) */}
      {tab === "campanhas" && (
        <CampanhasTab campaigns={campaigns} adSets={adSets} ads={ads} totalLeads={filteredLeads.length} leadQuality={leadQuality} />
      )}

      {/* Tab content: Pedidos (campaign requests from loja) */}
      {tab === "pedidos" && <PedidosTab onCountChange={setPendingCount} />}
    </div>
  )
}
