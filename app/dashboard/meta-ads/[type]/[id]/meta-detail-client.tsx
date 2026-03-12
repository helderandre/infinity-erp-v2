"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  PauseCircle,
  Circle,
  Euro,
  Eye,
  MousePointerClick,
  Target,
  User,
  Building2,
  Mail,
  Phone,
  Clock,
  Flag,
  Play,
  Pause,
  ExternalLink,
  Megaphone,
  Loader2,
  AlertCircle,
  Film,
  BarChart3,
  Layers,
  Image as ImageIcon,
  Filter,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Lead, LeadStatus } from "@/types/meta-lead"
import type { MetaCampaign, MetaAdSet, MetaAd, MetaAdCreative, MetaInsights } from "../../actions"
import { toggleCampaignStatus } from "../../actions"
import type { MetaDatePreset } from "../../constants"
import { META_DATE_PRESETS } from "../../constants"

// ─── Shared helpers ─────────────────────────────────────────────────────────

const STATUS_MAP: Record<LeadStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  new:           { label: "Novo",        variant: "secondary", className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" },
  contacted:     { label: "Contactado",  variant: "secondary", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  qualified:     { label: "Qualificado", variant: "secondary", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  proposal_sent: { label: "Proposta",    variant: "secondary", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  negotiation:   { label: "Negociação",  variant: "secondary", className: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" },
  won:           { label: "Ganho",       variant: "secondary", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  lost:          { label: "Perdido",     variant: "destructive", className: "" },
  cancelled:     { label: "Cancelado",   variant: "secondary", className: "bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400" },
  junk:          { label: "Engano",      variant: "secondary", className: "bg-stone-100 text-stone-600 dark:bg-stone-800/40 dark:text-stone-400" },
}

const AD_STATUS: Record<string, { label: string; icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  ACTIVE:   { label: "Ativa",     icon: CheckCircle2, variant: "secondary", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  PAUSED:   { label: "Pausada",   icon: PauseCircle,  variant: "secondary", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  ARCHIVED: { label: "Arquivada", icon: Circle,        variant: "secondary", className: "bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400" },
  DELETED:  { label: "Eliminada", icon: Circle,        variant: "destructive", className: "" },
}

function fmt(n: number) { return new Intl.NumberFormat("pt-PT").format(n) }
function fmtCur(n: number) { return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n) }
function fmtPct(n: number) { return `${n.toFixed(2)}%` }
function fmtBudget(c: string | null) { return c ? fmtCur(parseInt(c, 10) / 100) : null }
function fmtDate(d: string) { return new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" }) }

function StatusBadge({ status }: { status: string }) {
  const cfg = AD_STATUS[status] ?? AD_STATUS.PAUSED
  const Icon = cfg.icon
  return (
    <Badge variant={cfg.variant} className={cn("gap-1.5", cfg.className)}>
      <Icon className="size-3" />
      {cfg.label}
    </Badge>
  )
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
      <div className="flex items-center gap-1 rounded-full border p-0.5 bg-muted w-fit">
        <Calendar className="size-3.5 text-muted-foreground ml-2 mr-0.5 shrink-0" />
        {META_DATE_PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => onChange(p.key)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-150 whitespace-nowrap",
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

// ─── Metric row ─────────────────────────────────────────────────────────────

function MetricGrid({ insights, leadCount, costPerLead }: { insights?: MetaInsights; leadCount: number; costPerLead?: number }) {
  if (!insights) return <p className="text-sm text-muted-foreground italic">Sem dados de desempenho</p>

  const metrics = [
    { icon: Euro, label: "Gasto", value: fmtCur(insights.spend), color: "text-destructive" },
    { icon: Target, label: "CPL", value: costPerLead ? fmtCur(costPerLead) : "\u2014", color: "text-[#1877F2]" },
    { icon: Eye, label: "Impressões", value: fmt(insights.impressions) },
    { icon: Eye, label: "Alcance", value: fmt(insights.reach) },
    { icon: MousePointerClick, label: "Cliques", value: fmt(insights.clicks) },
    { icon: MousePointerClick, label: "CTR", value: fmtPct(insights.ctr) },
    { icon: Euro, label: "CPC", value: fmtCur(insights.cpc) },
    { icon: Euro, label: "CPM", value: fmtCur(insights.cpm) },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {metrics.map((m) => (
        <Card key={m.label} className="py-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <m.icon className={cn("size-3.5", m.color ?? "text-muted-foreground")} />
              <span className="text-[11px] text-muted-foreground">{m.label}</span>
            </div>
            <p className={cn("text-lg font-bold", m.color ?? "text-foreground")}>{m.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Leads mini table ───────────────────────────────────────────────────────

function LeadsMiniTable({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <User className="size-6 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">Sem leads associados</p>
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Lead</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Contacto</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Estado</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Criado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => {
              const sc = STATUS_MAP[lead.status]
              return (
                <TableRow key={lead.id}>
                  <TableCell>
                    <Link href={`/leads/${lead.id}`} className="text-sm font-medium text-foreground hover:underline">
                      {lead.full_name}
                    </Link>
                    {lead.company_name && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Building2 className="size-2.5 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground">{lead.company_name}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      {lead.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="size-2.5 text-muted-foreground" />
                          <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">{lead.email}</span>
                        </div>
                      )}
                      {lead.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="size-2.5 text-muted-foreground" />
                          <span className="text-[11px] text-muted-foreground">{lead.phone}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={sc.variant} className={cn("text-[11px]", sc.className)}>{sc.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="size-2.5" />
                      {fmtDate(lead.created_at)}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ─── Detail info rows ───────────────────────────────────────────────────────

function InfoRow({ label, value, icon: Icon }: { label: string; value: string | null | undefined; icon?: React.ElementType }) {
  if (!value) return null
  return (
    <div className="flex justify-between items-center py-2 border-b last:border-0">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="size-3.5 text-muted-foreground" />}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="text-xs font-medium text-foreground max-w-[200px] truncate text-right">{value}</span>
    </div>
  )
}

// ─── Sub-items table (ad sets under campaign, ads under adset) ──────────────

function SubItemsTable({
  type,
  adSets,
  ads,
}: {
  type: "campaign" | "adset"
  adSets?: MetaAdSet[]
  ads?: MetaAd[]
}) {
  if (type === "campaign" && adSets && adSets.length > 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Layers className="size-3.5 text-muted-foreground" />
          Conjuntos de Anúncios ({adSets.length})
        </h3>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Conjunto</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">Gasto</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">Leads</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">CPL</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {adSets.map((as_) => (
                  <TableRow key={as_.id}>
                    <TableCell>
                      <p className="text-xs font-medium text-foreground truncate max-w-[200px]">{as_.name}</p>
                      <StatusBadge status={as_.status} />
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{as_.insights ? fmtCur(as_.insights.spend) : "\u2014"}</TableCell>
                    <TableCell className="text-right">
                      <span className={cn("text-xs font-bold", as_.leadCount > 0 ? "text-[#1877F2]" : "text-muted-foreground")}>{as_.leadCount}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn("text-xs font-semibold", as_.costPerLead ? "text-[#1877F2]" : "text-muted-foreground")}>
                        {as_.costPerLead ? fmtCur(as_.costPerLead) : "\u2014"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="icon" className="h-7 w-7" asChild>
                        <Link href={`/meta-ads/adsets/${as_.id}`}>
                          <Eye className="size-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (ads && ads.length > 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ImageIcon className="size-3.5 text-muted-foreground" />
          Anúncios ({ads.length})
        </h3>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Anúncio</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">Gasto</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">Leads</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">CPL</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ads.map((ad) => (
                  <TableRow key={ad.id}>
                    <TableCell>
                      <p className="text-xs font-medium text-foreground truncate max-w-[200px]">{ad.name}</p>
                      <StatusBadge status={ad.status} />
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{ad.insights ? fmtCur(ad.insights.spend) : "\u2014"}</TableCell>
                    <TableCell className="text-right">
                      <span className={cn("text-xs font-bold", ad.leadCount > 0 ? "text-[#1877F2]" : "text-muted-foreground")}>{ad.leadCount}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn("text-xs font-semibold", ad.costPerLead ? "text-[#1877F2]" : "text-muted-foreground")}>
                        {ad.costPerLead ? fmtCur(ad.costPerLead) : "\u2014"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="icon" className="h-7 w-7" asChild>
                        <Link href={`/meta-ads/ads/${ad.id}`}>
                          <Eye className="size-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}

// ─── CTA label map ──────────────────────────────────────────────────────────

const CTA_LABELS: Record<string, string> = {
  LEARN_MORE: "Saber mais",
  SIGN_UP: "Inscrever-se",
  DOWNLOAD: "Descarregar",
  SHOP_NOW: "Comprar agora",
  BOOK_TRAVEL: "Reservar",
  CONTACT_US: "Contactar-nos",
  SUBSCRIBE: "Subscrever",
  GET_OFFER: "Obter oferta",
  GET_QUOTE: "Pedir orçamento",
  APPLY_NOW: "Candidatar-se",
  SEND_MESSAGE: "Enviar mensagem",
  WHATSAPP_MESSAGE: "WhatsApp",
  CALL_NOW: "Ligar agora",
  OPEN_LINK: "Abrir link",
}

// ─── Ad Creative Preview (Facebook-style mockup) ────────────────────────────

function CreativePreview({ creative }: { creative: MetaAdCreative }) {
  const hasVideo = !!creative.video_source_url
  const hasImage = creative.image_url || creative.thumbnail_url
  const ctaLabel = creative.call_to_action_type
    ? CTA_LABELS[creative.call_to_action_type] ?? creative.call_to_action_type.replace(/_/g, " ")
    : null
  const domain = creative.link_url?.replace(/^https?:\/\//, "").split("/")[0] ?? null

  return (
    <div>
      {/* Facebook Ad mockup — constrained width, mimics feed card */}
      <div className="max-w-sm">
        <Card className="overflow-hidden shadow-sm">
          {/* Post header (page name) */}
          <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-2">
            <div className="h-9 w-9 rounded-full bg-[#1877F2]/10 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-foreground leading-tight">Anúncio Meta</p>
              <p className="text-[11px] text-muted-foreground">Patrocinado</p>
            </div>
          </div>

          {/* Post body text */}
          {creative.body && (
            <div className="px-3.5 pb-2">
              <p className="text-[13px] text-foreground leading-[1.4] whitespace-pre-wrap line-clamp-4">
                {creative.body}
              </p>
            </div>
          )}

          {/* Media — video player or image */}
          {hasVideo ? (
            <div className="relative aspect-square bg-black overflow-hidden">
              <video
                src={creative.video_source_url!}
                poster={creative.image_url ?? creative.thumbnail_url ?? undefined}
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-contain"
              />
            </div>
          ) : hasImage ? (
            <div className="relative aspect-square bg-muted overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={creative.image_url ?? creative.thumbnail_url!}
                alt="Ad creative"
                className="w-full h-full object-cover"
              />
            </div>
          ) : null}

          {/* Link preview bar + CTA */}
          {(creative.title || ctaLabel || domain) && (
            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-muted border-t">
              <div className="min-w-0 flex-1">
                {domain && (
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide truncate">{domain}</p>
                )}
                {creative.title && (
                  <p className="text-[13px] font-semibold text-foreground leading-tight truncate">{creative.title}</p>
                )}
              </div>
              {ctaLabel && (
                <Button variant="secondary" size="sm" className="shrink-0 text-[13px] font-semibold" asChild>
                  <a
                    href={creative.link_url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {ctaLabel}
                  </a>
                </Button>
              )}
            </div>
          )}
        </Card>

        {/* Link underneath the mockup */}
        {creative.link_url && (
          <a
            href={creative.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="size-3" />
            <span className="truncate max-w-[250px]">{creative.link_url}</span>
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Campaign Pause/Resume Button ───────────────────────────────────────────

function CampaignToggleButton({ campaignId, currentStatus }: { campaignId: string; currentStatus: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const canToggle = currentStatus === "ACTIVE" || currentStatus === "PAUSED"
  if (!canToggle) return null

  const isActive = currentStatus === "ACTIVE"

  function handleToggle() {
    setError(null)
    startTransition(async () => {
      const result = await toggleCampaignStatus(campaignId, isActive ? "PAUSED" : "ACTIVE")
      if (result.success) {
        toast.success(isActive ? "Campanha pausada" : "Campanha ativada")
        router.refresh()
      } else {
        setError(result.error)
        toast.error(result.error ?? "Erro ao alterar estado da campanha")
      }
    })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        onClick={handleToggle}
        disabled={isPending}
        variant="outline"
        size="sm"
        className={cn(
          "gap-2",
          isActive
            ? "text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-950/30"
            : "text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
        )}
      >
        {isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : isActive ? (
          <Pause className="size-3.5" />
        ) : (
          <Play className="size-3.5" />
        )}
        {isPending ? "A processar..." : isActive ? "Pausar campanha" : "Ativar campanha"}
      </Button>
      {error && (
        <div className="flex items-center gap-1.5 text-[10px] text-destructive">
          <AlertCircle className="size-3" />
          {error}
        </div>
      )}
    </div>
  )
}

// ─── Main Detail Client ─────────────────────────────────────────────────────

type DetailProps = (
  | { type: "campaign"; campaign: MetaCampaign; adSets: MetaAdSet[]; ads: MetaAd[]; leads: Lead[]; adSet?: never; ad?: never }
  | { type: "adset"; adSet: MetaAdSet; ads: MetaAd[]; leads: Lead[]; campaign?: never; adSets?: never; ad?: never }
  | { type: "ad"; ad: MetaAd; leads: Lead[]; campaign?: never; adSets?: never; adSet?: never; ads?: never }
) & { currentPeriod?: MetaDatePreset }

// ─── Detail Tabs ─────────────────────────────────────────────────────────────

type DetailTab = "desempenho" | "criativo" | "leads"

export function MetaDetailClient(props: DetailProps) {
  const router = useRouter()
  const currentPeriod = props.currentPeriod ?? "maximum"
  const [activeTab, setActiveTab] = useState<DetailTab>("desempenho")

  function handlePeriodChange(preset: MetaDatePreset) {
    const params = new URLSearchParams(window.location.search)
    if (preset === "maximum") params.delete("period")
    else params.set("period", preset)
    const qs = params.toString()
    router.push(`${window.location.pathname}${qs ? `?${qs}` : ""}`)
  }

  // Determine header info
  let title = ""
  let subtitle = ""
  let status = ""
  let icon: React.ElementType = Filter
  let iconColor = "text-[#1877F2]"
  let iconBg = "bg-[#1877F2]/10"
  let insights: MetaInsights | undefined
  let leadCount = 0
  let costPerLead: number | undefined
  let typeLabel = ""

  if (props.type === "campaign") {
    const c = props.campaign
    title = c.name
    subtitle = c.objective
    status = c.status
    icon = Filter
    insights = c.insights
    leadCount = c.leadCount
    costPerLead = c.costPerLead
    typeLabel = "Campanha"
  } else if (props.type === "adset") {
    const as_ = props.adSet
    title = as_.name
    subtitle = as_.campaign_name
    status = as_.status
    icon = Layers
    iconColor = "text-muted-foreground"
    iconBg = "bg-muted"
    insights = as_.insights
    leadCount = as_.leadCount
    costPerLead = as_.costPerLead
    typeLabel = "Conjunto de Anúncios"
  } else {
    const a = props.ad
    title = a.name
    subtitle = `${a.campaign_name} \u203A ${a.adset_name}`
    status = a.status
    icon = ImageIcon
    iconColor = "text-purple-500"
    iconBg = "bg-purple-500/10"
    insights = a.insights
    leadCount = a.leadCount
    costPerLead = a.costPerLead
    typeLabel = "Anúncio"
  }

  const Icon = icon

  // Build available tabs — only show "Criativo" for ads with a creative
  const hasCreative = props.type === "ad" && !!props.ad.creative

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Back button + period selector */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/meta-ads")}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Voltar a Meta Ads
        </Button>
        <PeriodSelector current={currentPeriod} onChange={handlePeriodChange} />
      </div>

      {/* Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
              <Icon className={cn("size-5", iconColor)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{typeLabel}</p>
              <h1 className="text-lg font-semibold text-foreground truncate">{title}</h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {props.type === "campaign" && (
                <CampaignToggleButton campaignId={props.campaign.id} currentStatus={props.campaign.status} />
              )}
              <StatusBadge status={status} />
            </div>
          </div>

          {/* Info rows */}
          <div className="mt-5 pt-4 border-t">
            {props.type === "campaign" && (
              <>
                <InfoRow label="Objetivo" value={props.campaign.objective} icon={Flag} />
                <InfoRow label="Orçamento diário" value={fmtBudget(props.campaign.daily_budget)} icon={Euro} />
                <InfoRow label="Orçamento total" value={fmtBudget(props.campaign.lifetime_budget)} icon={Euro} />
                <InfoRow label="Criada em" value={fmtDate(props.campaign.created_time)} icon={Calendar} />
                <InfoRow label="Última atualização" value={fmtDate(props.campaign.updated_time)} icon={Clock} />
              </>
            )}
            {props.type === "adset" && (
              <>
                <InfoRow label="Campanha" value={props.adSet.campaign_name} icon={Filter} />
                <InfoRow label="Orçamento diário" value={fmtBudget(props.adSet.daily_budget)} icon={Euro} />
                <InfoRow label="Orçamento total" value={fmtBudget(props.adSet.lifetime_budget)} icon={Euro} />
                <InfoRow label="Segmentação" value={props.adSet.targeting_summary} icon={Target} />
              </>
            )}
            {props.type === "ad" && (
              <>
                <InfoRow label="Campanha" value={props.ad.campaign_name} icon={Filter} />
                <InfoRow label="Conjunto" value={props.ad.adset_name} icon={Layers} />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tab bar */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DetailTab)}>
        <TabsList>
          <TabsTrigger value="desempenho" className="gap-1.5">
            <BarChart3 className="size-3.5" />
            Desempenho
          </TabsTrigger>
          {hasCreative && (
            <TabsTrigger value="criativo" className="gap-1.5">
              <Megaphone className="size-3.5" />
              Criativo
            </TabsTrigger>
          )}
          <TabsTrigger value="leads" className="gap-1.5">
            <User className="size-3.5" />
            Leads
            {props.leads.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {props.leads.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="desempenho" className="mt-4">
          <div className="space-y-6">
            <MetricGrid insights={insights} leadCount={leadCount} costPerLead={costPerLead} />

            {/* Sub-items (ad sets under campaign, ads under adset) */}
            {props.type === "campaign" && (
              <SubItemsTable type="campaign" adSets={props.adSets} ads={props.ads} />
            )}
            {props.type === "adset" && (
              <SubItemsTable type="adset" ads={props.ads} />
            )}
          </div>
        </TabsContent>

        {hasCreative && (
          <TabsContent value="criativo" className="mt-4">
            <CreativePreview creative={props.ad.creative!} />
          </TabsContent>
        )}

        <TabsContent value="leads" className="mt-4">
          <LeadsMiniTable leads={props.leads} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
