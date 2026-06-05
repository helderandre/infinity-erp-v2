"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  getAgents,
  getAgentMetrics,
  upsertMetric,
} from "@/app/dashboard/marketing/redes-sociais/actions"
import type {
  MarketingAgentMetric,
  SocialPlatform,
} from "@/types/marketing-social"
import { SOCIAL_PLATFORMS } from "@/types/marketing-social"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
  Plus,
  Pencil,
  ArrowUp,
  ArrowDown,
  Search,
  Instagram,
  Facebook,
  Linkedin,
  LayoutList,
  LayoutGrid,
  Loader2,
  Heart,
  Eye,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  return n.toLocaleString("pt-PT")
}

function formatPercent(n: number): string {
  return n.toFixed(2).replace(".", ",") + "%"
}

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.length <= 7 ? "-01" : ""))
  return d.toLocaleDateString("pt-PT", { month: "long", year: "numeric" })
}

function formatMonthShort(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.length <= 7 ? "-01" : ""))
  return d.toLocaleDateString("pt-PT", { month: "short" })
}

function platformIcon(platform: SocialPlatform) {
  switch (platform) {
    case "instagram":
      return <Instagram className="h-3.5 w-3.5" />
    case "facebook":
      return <Facebook className="h-3.5 w-3.5" />
    case "linkedin":
      return <Linkedin className="h-3.5 w-3.5" />
    default:
      return null
  }
}

function platformColor(platform: SocialPlatform): string {
  switch (platform) {
    case "instagram":
      return "bg-pink-100 text-pink-700"
    case "facebook":
      return "bg-blue-100 text-blue-700"
    case "linkedin":
      return "bg-sky-100 text-sky-700"
    case "tiktok":
      return "bg-slate-100 text-slate-700"
    default:
      return "bg-gray-100 text-gray-700"
  }
}

type Agent = {
  id: string
  commercial_name: string
  professional_email: string
  is_active: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SocialMetricasTab() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [metrics, setMetrics] = useState<MarketingAgentMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Filters
  const [filterAgent, setFilterAgent] = useState<string>("all")
  const [filterPlatform, setFilterPlatform] = useState<string>("all")

  // View toggle
  const [view, setView] = useState<"cards" | "table">("cards")

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMetric, setEditingMetric] = useState<MarketingAgentMetric | null>(null)

  // Form state
  const [formAgentId, setFormAgentId] = useState("")
  const [formMonth, setFormMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })
  const [formPlatform, setFormPlatform] = useState<SocialPlatform>("instagram")
  const [formFollowers, setFormFollowers] = useState("")
  const [formPosts, setFormPosts] = useState("")
  const [formEngagement, setFormEngagement] = useState("")
  const [formReach, setFormReach] = useState("")
  const [formNotes, setFormNotes] = useState("")

  // ─── Load data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [agentsRes, metricsRes] = await Promise.all([
        getAgents(),
        getAgentMetrics(
          filterAgent !== "all" ? filterAgent : undefined,
          filterPlatform !== "all" ? (filterPlatform as SocialPlatform) : undefined
        ),
      ])
      if (agentsRes.error) toast.error("Erro ao carregar agentes: " + agentsRes.error)
      if (metricsRes.error) toast.error("Erro ao carregar metricas: " + metricsRes.error)
      setAgents((agentsRes.agents ?? []) as Agent[])
      setMetrics(metricsRes.metrics ?? [])
    } catch {
      toast.error("Erro ao carregar dados")
    } finally {
      setLoading(false)
    }
  }, [filterAgent, filterPlatform])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ─── Computed data ──────────────────────────────────────────────────────────

  const currentMonth = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  }, [])

  // Group metrics by agent
  const metricsByAgent = useMemo(() => {
    const map = new Map<string, MarketingAgentMetric[]>()
    for (const m of metrics) {
      const key = m.agent_id
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(m)
    }
    return map
  }, [metrics])

  // Unique agents that have metrics
  const trackedAgentIds = useMemo(() => {
    return new Set(metrics.map((m) => m.agent_id))
  }, [metrics])

  // Summary cards
  const summary = useMemo(() => {
    const currentMetrics = metrics.filter((m) => m.month.startsWith(currentMonth))
    const uniqueAgents = new Set(metrics.map((m) => m.agent_id))

    // Average followers: latest metric per agent per platform
    const latestByAgentPlatform = new Map<string, MarketingAgentMetric>()
    for (const m of metrics) {
      const key = `${m.agent_id}-${m.platform}`
      const existing = latestByAgentPlatform.get(key)
      if (!existing || m.month > existing.month) {
        latestByAgentPlatform.set(key, m)
      }
    }
    const latestMetrics = Array.from(latestByAgentPlatform.values())
    const avgFollowers = latestMetrics.length > 0
      ? Math.round(latestMetrics.reduce((s, m) => s + m.followers_count, 0) / latestMetrics.length)
      : 0
    const avgEngagement = latestMetrics.length > 0
      ? latestMetrics.reduce((s, m) => s + m.avg_engagement, 0) / latestMetrics.length
      : 0
    const totalPostsThisMonth = currentMetrics.reduce((s, m) => s + m.posts_count, 0)

    return {
      totalAgents: uniqueAgents.size,
      avgFollowers,
      avgEngagement,
      totalPostsThisMonth,
    }
  }, [metrics, currentMonth])

  // ─── Dialog handlers ────────────────────────────────────────────────────────

  function openAddDialog() {
    setEditingMetric(null)
    setFormAgentId(agents[0]?.id ?? "")
    setFormMonth(currentMonth)
    setFormPlatform("instagram")
    setFormFollowers("")
    setFormPosts("")
    setFormEngagement("")
    setFormReach("")
    setFormNotes("")
    setDialogOpen(true)
  }

  function openEditDialog(metric: MarketingAgentMetric) {
    setEditingMetric(metric)
    setFormAgentId(metric.agent_id)
    setFormMonth(metric.month.substring(0, 7))
    setFormPlatform(metric.platform)
    setFormFollowers(String(metric.followers_count))
    setFormPosts(String(metric.posts_count))
    setFormEngagement(String(metric.avg_engagement))
    setFormReach(String(metric.avg_reach))
    setFormNotes(metric.notes ?? "")
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formAgentId || !formMonth || !formPlatform) {
      toast.error("Preencha todos os campos obrigatorios")
      return
    }

    setSaving(true)
    try {
      const result = await upsertMetric({
        ...(editingMetric?.id ? { id: editingMetric.id } : {}),
        agent_id: formAgentId,
        month: formMonth + "-01",
        platform: formPlatform,
        followers_count: parseInt(formFollowers) || 0,
        posts_count: parseInt(formPosts) || 0,
        avg_engagement: parseFloat(formEngagement) || 0,
        avg_reach: parseInt(formReach) || 0,
        notes: formNotes || null,
      })

      if (result.error) {
        toast.error("Erro ao guardar: " + result.error)
      } else {
        toast.success(editingMetric ? "Metrica actualizada" : "Metrica adicionada")
        setDialogOpen(false)
        loadData()
      }
    } catch {
      toast.error("Erro ao guardar metrica")
    } finally {
      setSaving(false)
    }
  }

  // ─── Trend calculation ──────────────────────────────────────────────────────

  function getTrend(agentId: string, platform: SocialPlatform, field: keyof MarketingAgentMetric): { change: number; direction: "up" | "down" | "flat" } {
    const agentMetrics = (metricsByAgent.get(agentId) ?? [])
      .filter((m) => m.platform === platform)
      .sort((a, b) => b.month.localeCompare(a.month))

    if (agentMetrics.length < 2) return { change: 0, direction: "flat" }

    const current = agentMetrics[0][field] as number
    const previous = agentMetrics[1][field] as number

    if (previous === 0) return { change: 0, direction: "flat" }
    const change = ((current - previous) / previous) * 100

    return {
      change: Math.abs(change),
      direction: change > 0.5 ? "up" : change < -0.5 ? "down" : "flat",
    }
  }

  // ─── Mini bar chart (last 6 months) ─────────────────────────────────────────

  function MiniBarChart({ agentId, platform }: { agentId: string; platform: SocialPlatform }) {
    const agentMetrics = (metricsByAgent.get(agentId) ?? [])
      .filter((m) => m.platform === platform)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6)

    if (agentMetrics.length === 0) return null

    const maxFollowers = Math.max(...agentMetrics.map((m) => m.followers_count), 1)

    return (
      <div className="flex items-end gap-1 h-10">
        {agentMetrics.map((m) => {
          const height = Math.max((m.followers_count / maxFollowers) * 100, 5)
          return (
            <div key={m.month} className="flex flex-col items-center gap-0.5 flex-1">
              <div
                className="w-full rounded-sm bg-primary/70 transition-all duration-300"
                style={{ height: `${height}%` }}
                title={`${formatMonthShort(m.month)}: ${formatNumber(m.followers_count)}`}
              />
              <span className="text-[9px] text-muted-foreground leading-none">
                {formatMonthShort(m.month)}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  // ─── Trend badge ────────────────────────────────────────────────────────────

  function TrendBadge({ agentId, platform, field }: { agentId: string; platform: SocialPlatform; field: keyof MarketingAgentMetric }) {
    const { change, direction } = getTrend(agentId, platform, field)
    if (direction === "flat") return <span className="text-xs text-muted-foreground">--</span>

    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 text-xs font-medium",
          direction === "up" ? "text-emerald-600" : "text-red-600"
        )}
      >
        {direction === "up" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )}
        {change.toFixed(1)}%
      </span>
    )
  }

  // ─── Agent name helper ──────────────────────────────────────────────────────

  function getAgentName(agentId: string, metric?: MarketingAgentMetric): string {
    if (metric?.agent?.commercial_name) return metric.agent.commercial_name
    const agent = agents.find((a) => a.id === agentId)
    return agent?.commercial_name ?? "Desconhecido"
  }

  // ─── Latest metric per agent+platform ───────────────────────────────────────

  const latestMetricsByAgent = useMemo(() => {
    const map = new Map<string, Map<SocialPlatform, MarketingAgentMetric>>()
    for (const m of metrics) {
      if (!map.has(m.agent_id)) map.set(m.agent_id, new Map())
      const platformMap = map.get(m.agent_id)!
      const existing = platformMap.get(m.platform)
      if (!existing || m.month > existing.month) {
        platformMap.set(m.platform, m)
      }
    }
    return map
  }, [metrics])

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <Select value={filterAgent} onValueChange={setFilterAgent}>
            <SelectTrigger className="w-[200px] rounded-full bg-muted/50 border-0">
              <SelectValue placeholder="Todos os agentes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os agentes</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.commercial_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterPlatform} onValueChange={setFilterPlatform}>
            <SelectTrigger className="w-[180px] rounded-full bg-muted/50 border-0">
              <SelectValue placeholder="Todas as plataformas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as plataformas</SelectItem>
              {Object.entries(SOCIAL_PLATFORMS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border overflow-hidden">
            <Button
              variant={view === "cards" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2 rounded-full"
              onClick={() => setView("cards")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "table" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2 rounded-full"
              onClick={() => setView("table")}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
          </div>

          <Button onClick={openAddDialog} size="sm" className="rounded-full">
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Metricas
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-xl transition-all duration-300 hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Agentes Monitorizados
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalAgents}</div>
          </CardContent>
        </Card>

        <Card className="rounded-xl transition-all duration-300 hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Media de Seguidores
            </CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary.avgFollowers)}</div>
          </CardContent>
        </Card>

        <Card className="rounded-xl transition-all duration-300 hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Engagement Medio
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(summary.avgEngagement)}</div>
          </CardContent>
        </Card>

        <Card className="rounded-xl transition-all duration-300 hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Posts Este Mes
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary.totalPostsThisMonth)}</div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Empty state */}
      {metrics.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium mb-1">Sem metricas registadas</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Comece por adicionar metricas mensais para os agentes.
          </p>
          <Button onClick={openAddDialog} size="sm" className="rounded-full">
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Metricas
          </Button>
        </div>
      )}

      {/* Cards view */}
      {metrics.length > 0 && view === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from(latestMetricsByAgent.entries()).map(([agentId, platformMap]) => (
            <Card key={agentId} className="overflow-hidden rounded-xl transition-all duration-300 hover:shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">
                    {getAgentName(agentId, Array.from(platformMap.values())[0])}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    {Array.from(platformMap.keys()).map((p) => (
                      <span
                        key={p}
                        className={cn("rounded-full text-[11px] px-2 py-0.5 font-medium inline-flex items-center gap-1", platformColor(p))}
                      >
                        {platformIcon(p)}
                        {SOCIAL_PLATFORMS[p]}
                      </span>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.from(platformMap.entries()).map(([platform, metric]) => (
                  <div key={platform} className="space-y-3">
                    {platformMap.size > 1 && (
                      <div className="flex items-center gap-1.5">
                        {platformIcon(platform)}
                        <span className="text-xs font-medium text-muted-foreground">
                          {SOCIAL_PLATFORMS[platform]}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">Seguidores</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg font-bold">
                            {formatNumber(metric.followers_count)}
                          </span>
                          <TrendBadge agentId={agentId} platform={platform} field="followers_count" />
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">Publicacoes</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg font-bold">
                            {formatNumber(metric.posts_count)}
                          </span>
                          <TrendBadge agentId={agentId} platform={platform} field="posts_count" />
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">Engagement</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg font-bold">
                            {formatPercent(metric.avg_engagement)}
                          </span>
                          <TrendBadge agentId={agentId} platform={platform} field="avg_engagement" />
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">Alcance</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg font-bold">
                            {formatNumber(metric.avg_reach)}
                          </span>
                          <TrendBadge agentId={agentId} platform={platform} field="avg_reach" />
                        </div>
                      </div>
                    </div>

                    {/* Mini bar chart */}
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">
                        Seguidores (ultimos 6 meses)
                      </p>
                      <MiniBarChart agentId={agentId} platform={platform} />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground">
                        Dados de {formatMonth(metric.month)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs rounded-full"
                        onClick={() => openEditDialog(metric)}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                    </div>

                    {platformMap.size > 1 && platform !== Array.from(platformMap.keys()).pop() && (
                      <Separator />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Table view */}
      {metrics.length > 0 && view === "table" && (
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Agente</TableHead>
                <TableHead>Mes</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead className="text-right">Seguidores</TableHead>
                <TableHead className="text-right">Posts</TableHead>
                <TableHead className="text-right">Engagement</TableHead>
                <TableHead className="text-right">Alcance</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.map((m) => (
                <TableRow key={m.id} className="transition-colors hover:bg-muted/50">
                  <TableCell className="font-medium">
                    {getAgentName(m.agent_id, m)}
                  </TableCell>
                  <TableCell>{formatMonth(m.month)}</TableCell>
                  <TableCell>
                    <span
                      className={cn("rounded-full text-[11px] px-2 py-0.5 font-medium inline-flex items-center gap-1", platformColor(m.platform))}
                    >
                      {platformIcon(m.platform)}
                      {SOCIAL_PLATFORMS[m.platform]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber(m.followers_count)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber(m.posts_count)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatPercent(m.avg_engagement)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber(m.avg_reach)}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                    {m.notes ?? "--"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full"
                      onClick={() => openEditDialog(m)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editingMetric ? "Editar Metricas" : "Adicionar Metricas"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Agente *</Label>
              <Select value={formAgentId} onValueChange={setFormAgentId}>
                <SelectTrigger className="rounded-full bg-muted/50 border-0">
                  <SelectValue placeholder="Seleccionar agente" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.commercial_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mes *</Label>
                <Input
                  type="month"
                  value={formMonth}
                  onChange={(e) => setFormMonth(e.target.value)}
                  className="rounded-full bg-muted/50 border-0"
                />
              </div>

              <div className="space-y-2">
                <Label>Plataforma *</Label>
                <Select
                  value={formPlatform}
                  onValueChange={(v) => setFormPlatform(v as SocialPlatform)}
                >
                  <SelectTrigger className="rounded-full bg-muted/50 border-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SOCIAL_PLATFORMS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Seguidores</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={formFollowers}
                  onChange={(e) => setFormFollowers(e.target.value)}
                  className="rounded-full bg-muted/50 border-0"
                />
              </div>

              <div className="space-y-2">
                <Label>Publicacoes</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={formPosts}
                  onChange={(e) => setFormPosts(e.target.value)}
                  className="rounded-full bg-muted/50 border-0"
                />
              </div>

              <div className="space-y-2">
                <Label>Engagement (%)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={formEngagement}
                  onChange={(e) => setFormEngagement(e.target.value)}
                  className="rounded-full bg-muted/50 border-0"
                />
              </div>

              <div className="space-y-2">
                <Label>Alcance</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={formReach}
                  onChange={(e) => setFormReach(e.target.value)}
                  className="rounded-full bg-muted/50 border-0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                placeholder="Observacoes opcionais..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="rounded-full" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button className="rounded-full" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {editingMetric ? "Guardar" : "Adicionar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
