'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getAgents,
  getPublications,
  upsertPublication,
  deletePublication,
} from '@/app/dashboard/marketing/redes-sociais/actions'
import type { MarketingPublication, SocialPlatform, ContentType } from '@/types/marketing-social'
import { SOCIAL_PLATFORMS, CONTENT_TYPES } from '@/types/marketing-social'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/empty-state'
import {
  Heart,
  MessageCircle,
  Share2,
  Eye,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Search,
  Newspaper,
  TrendingUp,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────

type Agent = { id: string; commercial_name: string }

interface FormData {
  agent_id: string
  platform: SocialPlatform
  content_type: ContentType
  title: string
  description: string
  published_at: string
  post_url: string
  thumbnail_url: string
  likes: number
  comments: number
  shares: number
  reach: number
  impressions: number
  performance_notes: string
}

const emptyForm: FormData = {
  agent_id: '',
  platform: 'instagram',
  content_type: 'post',
  title: '',
  description: '',
  published_at: new Date().toISOString().split('T')[0],
  post_url: '',
  thumbnail_url: '',
  likes: 0,
  comments: 0,
  shares: 0,
  reach: 0,
  impressions: 0,
  performance_notes: '',
}

// ─── Platform Colors ────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  facebook: 'bg-blue-100 text-blue-700',
  linkedin: 'bg-sky-100 text-sky-700',
  tiktok: 'bg-slate-100 text-slate-700',
  other: 'bg-gray-100 text-gray-700',
}

// ─── Component ─────────────────────────────────────────────────────────────

export function SocialPublicacoesTab() {
  const [publications, setPublications] = useState<MarketingPublication[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Filters
  const [filterAgent, setFilterAgent] = useState<string>('all')
  const [filterPlatform, setFilterPlatform] = useState<string>('all')
  const [search, setSearch] = useState('')

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ─── Load Data ──────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [agentsRes, pubsRes] = await Promise.all([
        getAgents(),
        getPublications(),
      ])
      if (agentsRes.error) toast.error(agentsRes.error)
      if (pubsRes.error) toast.error(pubsRes.error)
      setAgents(
        (agentsRes.agents ?? []).map((a: any) => ({
          id: a.id,
          commercial_name: a.commercial_name,
        }))
      )
      setPublications(pubsRes.publications ?? [])
    } catch {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ─── Filtered Publications ──────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = publications
    if (filterAgent !== 'all') {
      list = list.filter((p) => p.agent_id === filterAgent)
    }
    if (filterPlatform !== 'all') {
      list = list.filter((p) => p.platform === filterPlatform)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (p) =>
          (p.title?.toLowerCase().includes(q)) ||
          (p.description?.toLowerCase().includes(q)) ||
          (p.agent?.commercial_name?.toLowerCase().includes(q))
      )
    }
    return list
  }, [publications, filterAgent, filterPlatform, search])

  // ─── Summary Stats ─────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = filtered.length
    const totalEngagement = filtered.reduce(
      (acc, p) => acc + p.likes + p.comments + p.shares,
      0
    )
    const avgReach =
      total > 0
        ? Math.round(filtered.reduce((acc, p) => acc + p.reach, 0) / total)
        : 0
    return { total, totalEngagement, avgReach }
  }, [filtered])

  // ─── Form Handlers ─────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (pub: MarketingPublication) => {
    setEditingId(pub.id)
    setForm({
      agent_id: pub.agent_id,
      platform: pub.platform,
      content_type: pub.content_type,
      title: pub.title ?? '',
      description: pub.description ?? '',
      published_at: pub.published_at ? pub.published_at.split('T')[0] : '',
      post_url: pub.post_url ?? '',
      thumbnail_url: pub.thumbnail_url ?? '',
      likes: pub.likes,
      comments: pub.comments,
      shares: pub.shares,
      reach: pub.reach,
      impressions: pub.impressions,
      performance_notes: pub.performance_notes ?? '',
    })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.agent_id) {
      toast.error('Seleccione um consultor')
      return
    }
    if (!form.title.trim()) {
      toast.error('O titulo e obrigatorio')
      return
    }

    setSubmitting(true)
    try {
      const payload: any = {
        agent_id: form.agent_id,
        platform: form.platform,
        content_type: form.content_type,
        title: form.title || null,
        description: form.description || null,
        published_at: form.published_at
          ? new Date(form.published_at).toISOString()
          : new Date().toISOString(),
        post_url: form.post_url || null,
        thumbnail_url: form.thumbnail_url || null,
        likes: Number(form.likes) || 0,
        comments: Number(form.comments) || 0,
        shares: Number(form.shares) || 0,
        reach: Number(form.reach) || 0,
        impressions: Number(form.impressions) || 0,
        performance_notes: form.performance_notes || null,
      }
      if (editingId) payload.id = editingId

      const { error } = await upsertPublication(payload)
      if (error) {
        toast.error(error)
        return
      }
      toast.success(editingId ? 'Publicacao actualizada' : 'Publicacao criada')
      setDialogOpen(false)
      loadData()
    } catch {
      toast.error('Erro ao guardar')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const { error } = await deletePublication(deleteId)
      if (error) {
        toast.error(error)
        return
      }
      toast.success('Publicacao eliminada')
      setDeleteId(null)
      loadData()
    } catch {
      toast.error('Erro ao eliminar')
    } finally {
      setDeleting(false)
    }
  }

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return String(n)
  }

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return d
    }
  }

  // ─── Loading Skeleton ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-48 rounded-full" />
          <Skeleton className="h-10 w-40 rounded-full" />
          <Skeleton className="h-10 flex-1 rounded-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-xl transition-all duration-300 hover:shadow-lg">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-full bg-blue-50 p-3">
              <Newspaper className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Publicacoes</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl transition-all duration-300 hover:shadow-lg">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-full bg-pink-50 p-3">
              <Heart className="h-5 w-5 text-pink-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Engagement Total</p>
              <p className="text-2xl font-bold">
                {formatNumber(stats.totalEngagement)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl transition-all duration-300 hover:shadow-lg">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-full bg-emerald-50 p-3">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Alcance Medio</p>
              <p className="text-2xl font-bold">
                {formatNumber(stats.avgReach)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterAgent} onValueChange={setFilterAgent}>
          <SelectTrigger className="w-48 rounded-full bg-muted/50 border-0">
            <SelectValue placeholder="Consultor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Consultores</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.commercial_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterPlatform} onValueChange={setFilterPlatform}>
          <SelectTrigger className="w-40 rounded-full bg-muted/50 border-0">
            <SelectValue placeholder="Plataforma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Plataformas</SelectItem>
            {Object.entries(SOCIAL_PLATFORMS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar publicacoes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-full bg-muted/50 border-0"
          />
        </div>

        <Button className="rounded-full" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Publicacao
        </Button>
      </div>

      {/* Publications Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="Nenhuma publicacao encontrada"
          description="Registe as publicacoes dos consultores para acompanhar o desempenho nas redes sociais."
          action={{ label: 'Nova Publicacao', onClick: openCreate }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((pub) => (
            <Card
              key={pub.id}
              className="group overflow-hidden rounded-xl transition-all duration-300 hover:shadow-lg"
            >
              {/* Thumbnail */}
              {pub.thumbnail_url ? (
                <div className="relative aspect-video w-full overflow-hidden bg-muted">
                  <img
                    src={pub.thumbnail_url}
                    alt={pub.title ?? 'Publicacao'}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-muted/50">
                  <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                </div>
              )}

              <CardContent className="space-y-3 p-4">
                {/* Title & Agent */}
                <div>
                  <h3 className="font-semibold leading-tight line-clamp-2">
                    {pub.title || 'Sem titulo'}
                  </h3>
                  {pub.agent?.commercial_name && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {pub.agent.commercial_name}
                    </p>
                  )}
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5">
                  <span
                    className={cn(
                      'rounded-full text-[11px] px-2 py-0.5 font-medium',
                      PLATFORM_COLORS[pub.platform] ?? PLATFORM_COLORS.other
                    )}
                  >
                    {SOCIAL_PLATFORMS[pub.platform] ?? pub.platform}
                  </span>
                  <span className="rounded-full bg-muted text-[11px] px-2 py-0.5 font-medium">
                    {CONTENT_TYPES[pub.content_type] ?? pub.content_type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(pub.published_at)}
                  </span>
                </div>

                <Separator />

                {/* Engagement Row */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1" title="Gostos">
                    <Heart className="h-3.5 w-3.5 text-pink-500" />
                    {formatNumber(pub.likes)}
                  </span>
                  <span className="flex items-center gap-1" title="Comentarios">
                    <MessageCircle className="h-3.5 w-3.5 text-blue-500" />
                    {formatNumber(pub.comments)}
                  </span>
                  <span className="flex items-center gap-1" title="Partilhas">
                    <Share2 className="h-3.5 w-3.5 text-emerald-500" />
                    {formatNumber(pub.shares)}
                  </span>
                  <span className="flex items-center gap-1" title="Alcance">
                    <Eye className="h-3.5 w-3.5 text-amber-500" />
                    {formatNumber(pub.reach)}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  {pub.post_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="flex-1 rounded-full"
                    >
                      <a
                        href={pub.post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Ver post
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => openEdit(pub)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(pub.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar Publicacao' : 'Nova Publicacao'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Agent */}
            <div className="space-y-2">
              <Label>Consultor *</Label>
              <Select
                value={form.agent_id}
                onValueChange={(v) => setField('agent_id', v)}
              >
                <SelectTrigger className="rounded-full bg-muted/50 border-0">
                  <SelectValue placeholder="Seleccionar consultor" />
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

            {/* Platform & Content Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Plataforma</Label>
                <Select
                  value={form.platform}
                  onValueChange={(v) =>
                    setField('platform', v as SocialPlatform)
                  }
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
              <div className="space-y-2">
                <Label>Tipo de Conteudo</Label>
                <Select
                  value={form.content_type}
                  onValueChange={(v) =>
                    setField('content_type', v as ContentType)
                  }
                >
                  <SelectTrigger className="rounded-full bg-muted/50 border-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTENT_TYPES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label>Titulo *</Label>
              <Input
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="Titulo da publicacao"
                className="rounded-full bg-muted/50 border-0"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Descricao</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Descricao ou caption da publicacao..."
                rows={3}
              />
            </div>

            {/* Published Date */}
            <div className="space-y-2">
              <Label>Data de Publicacao</Label>
              <Input
                type="date"
                value={form.published_at}
                onChange={(e) => setField('published_at', e.target.value)}
                className="rounded-full bg-muted/50 border-0"
              />
            </div>

            {/* Post URL */}
            <div className="space-y-2">
              <Label>URL do Post</Label>
              <Input
                value={form.post_url}
                onChange={(e) => setField('post_url', e.target.value)}
                placeholder="https://..."
                className="rounded-full bg-muted/50 border-0"
              />
            </div>

            {/* Thumbnail URL */}
            <div className="space-y-2">
              <Label>URL da Miniatura</Label>
              <Input
                value={form.thumbnail_url}
                onChange={(e) => setField('thumbnail_url', e.target.value)}
                placeholder="https://..."
                className="rounded-full bg-muted/50 border-0"
              />
            </div>

            <Separator />

            {/* Engagement Metrics */}
            <p className="text-sm font-medium text-muted-foreground">
              Metricas de Engagement
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5 text-pink-500" />
                  Gostos
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={form.likes}
                  onChange={(e) => setField('likes', Number(e.target.value))}
                  className="rounded-full bg-muted/50 border-0"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-blue-500" />
                  Comentarios
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={form.comments}
                  onChange={(e) => setField('comments', Number(e.target.value))}
                  className="rounded-full bg-muted/50 border-0"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Share2 className="h-3.5 w-3.5 text-emerald-500" />
                  Partilhas
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={form.shares}
                  onChange={(e) => setField('shares', Number(e.target.value))}
                  className="rounded-full bg-muted/50 border-0"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-amber-500" />
                  Alcance
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={form.reach}
                  onChange={(e) => setField('reach', Number(e.target.value))}
                  className="rounded-full bg-muted/50 border-0"
                />
              </div>
              <div className="space-y-2">
                <Label>Impressoes</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.impressions}
                  onChange={(e) =>
                    setField('impressions', Number(e.target.value))
                  }
                  className="rounded-full bg-muted/50 border-0"
                />
              </div>
            </div>

            {/* Performance Notes */}
            <div className="space-y-2">
              <Label>Notas de Desempenho</Label>
              <Textarea
                value={form.performance_notes}
                onChange={(e) =>
                  setField('performance_notes', e.target.value)
                }
                placeholder="Observacoes sobre o desempenho desta publicacao..."
                rows={2}
              />
            </div>
          </div>

          {/* Dialog Footer */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button className="rounded-full" onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? 'Guardar' : 'Criar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar Publicacao</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem a certeza de que pretende eliminar esta publicacao? Esta accao e
            irreversivel.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setDeleteId(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
