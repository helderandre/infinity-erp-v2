'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale/pt'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import {
  getAgentProfiles,
  getAgentAssets,
  getCalendarEntries,
  getPublications,
  getContentRequests,
  getAgentMetrics,
  upsertAgentProfile,
  createAsset,
  deleteAsset,
} from '@/app/dashboard/marketing/redes-sociais/actions'
import { fetchCompetitorProfile } from '@/app/dashboard/competitors/actions'
import type { CompetitorProfile } from '@/app/dashboard/competitors/actions'
import type {
  MarketingAgentProfile,
  MarketingAgentAsset,
  MarketingContentCalendar,
  MarketingPublication,
  MarketingContentRequest,
  MarketingAgentMetric,
  AssetCategory,
} from '@/types/marketing-social'
import {
  SOCIAL_PLATFORMS,
  CONTENT_TYPES,
  CALENDAR_STATUS,
  REQUEST_STATUS,
  ASSET_CATEGORIES,
} from '@/types/marketing-social'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FormSheet } from '@/components/shared/form-sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Instagram,
  Facebook,
  Linkedin,
  ExternalLink,
  Palette,
  FolderOpen,
  Globe,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  Calendar,
  Clock,
  Plus,
  RefreshCw,
  Loader2,
  FileText,
  Image,
  TrendingUp,
  TrendingDown,
  Pencil,
  User,
  Trash2,
  BarChart3,
  Newspaper,
  MessageSquareText,
} from 'lucide-react'

// ─── TikTok Icon ──────────────────────────────────────────────────────────────

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function extractInstagramHandle(profile: MarketingAgentProfile): string | null {
  const url = profile.instagram_url?.trim()
  if (url) {
    // Full URL: https://www.instagram.com/username/ or instagram.com/username?hl=pt
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9_.]+)/)
    if (match) return match[1]
    // Bare handle: @username or username
    const bare = url.replace(/^@/, '').trim()
    if (bare && /^[A-Za-z0-9_.]+$/.test(bare)) return bare
  }
  // Fallback to consultant profile handle
  const handle = profile.agent_profile?.instagram_handle?.trim()
  if (handle) return handle.replace(/^@/, '')
  return null
}

function getCategoryColor(category: AssetCategory): string {
  switch (category) {
    case 'logo': return 'bg-blue-100 text-blue-700'
    case 'headshot': return 'bg-purple-100 text-purple-700'
    case 'template': return 'bg-amber-100 text-amber-700'
    case 'brand_guideline': return 'bg-emerald-100 text-emerald-700'
    case 'photo': return 'bg-sky-100 text-sky-700'
    case 'video': return 'bg-red-100 text-red-700'
    default: return 'bg-slate-100 text-slate-700'
  }
}

function isImageType(fileType: string | null): boolean {
  return !!fileType && fileType.startsWith('image/')
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab({
  profile,
  igData,
  igLoading,
  onFetchInstagram,
}: {
  profile: MarketingAgentProfile
  igData: CompetitorProfile | null
  igLoading: boolean
  onFetchInstagram: () => void
}) {
  const socials = [
    { label: 'Instagram', url: profile.instagram_url, icon: <Instagram className="h-4 w-4" /> },
    { label: 'Facebook', url: profile.facebook_url, icon: <Facebook className="h-4 w-4" /> },
    { label: 'LinkedIn', url: profile.linkedin_url, icon: <Linkedin className="h-4 w-4" /> },
    { label: 'TikTok', url: profile.tiktok_url, icon: <TikTokIcon className="h-4 w-4" /> },
  ].filter((s) => s.url)

  const handle = extractInstagramHandle(profile)

  return (
    <div className="space-y-6">
      {/* Social Links */}
      {socials.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Redes Sociais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.url!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {s.icon}
                <span>{s.label}</span>
                <ExternalLink className="h-3 w-3 ml-auto" />
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Workspace Links */}
      {(profile.canva_workspace_url || profile.google_drive_url) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ferramentas de Trabalho</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {profile.canva_workspace_url && (
              <a
                href={profile.canva_workspace_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Palette className="h-4 w-4 text-purple-500" />
                <span>Canva Workspace</span>
                <ExternalLink className="h-3 w-3 ml-auto" />
              </a>
            )}
            {profile.google_drive_url && (
              <a
                href={profile.google_drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <FolderOpen className="h-4 w-4 text-yellow-600" />
                <span>Google Drive</span>
                <ExternalLink className="h-3 w-3 ml-auto" />
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {/* Other Links */}
      {profile.other_links?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Outros Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {profile.other_links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Globe className="h-4 w-4" />
                <span>{link.label}</span>
                <ExternalLink className="h-3 w-3 ml-auto" />
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {profile.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{profile.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Brand Voice */}
      {profile.brand_voice_notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Voz da Marca</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{profile.brand_voice_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Instagram Live Data */}
      {(profile.instagram_url || handle) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Instagram className="h-4 w-4" />
              Instagram ao Vivo {handle && <span className="text-muted-foreground font-normal">@{handle.replace(/^@/, '')}</span>}
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={onFetchInstagram}
              disabled={igLoading}
            >
              {igLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Actualizar
            </Button>
          </CardHeader>
          <CardContent>
            {!igData && !igLoading && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum dado do Instagram disponível. Clique em actualizar para tentar novamente.
              </p>
            )}

            {igLoading && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-lg" />
                  ))}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-md" />
                  ))}
                </div>
              </div>
            )}

            {igData && !igLoading && (
              <div className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold">{formatNumber(igData.followers_count)}</p>
                    <p className="text-xs text-muted-foreground">Seguidores</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold">{formatNumber(igData.media_count)}</p>
                    <p className="text-xs text-muted-foreground">Publicacoes</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold">
                      {igData.recent_media.length > 0
                        ? formatNumber(
                            Math.round(
                              igData.recent_media.reduce((sum, m) => sum + m.like_count, 0) /
                                igData.recent_media.length
                            )
                          )
                        : '0'}
                    </p>
                    <p className="text-xs text-muted-foreground">Media de Likes</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold">{formatNumber(igData.follows_count)}</p>
                    <p className="text-xs text-muted-foreground">Seguindo</p>
                  </div>
                </div>

                {/* Recent Posts Grid */}
                {igData.recent_media.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Publicacoes Recentes</h4>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {igData.recent_media.slice(0, 12).map((media) => (
                        <a
                          key={media.id}
                          href={`https://instagram.com/p/${media.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative aspect-square overflow-hidden rounded-md bg-muted"
                        >
                          {(media.media_url || media.thumbnail_url) && (
                            <img
                              src={media.thumbnail_url || media.media_url || ''}
                              alt={media.caption?.slice(0, 50) || 'Post'}
                              className="h-full w-full object-cover transition-transform group-hover:scale-105"
                            />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/50 group-hover:opacity-100">
                            <span className="flex items-center gap-1 text-white text-xs font-medium">
                              <Heart className="h-3 w-3" />
                              {formatNumber(media.like_count)}
                            </span>
                            <span className="flex items-center gap-1 text-white text-xs font-medium">
                              <MessageCircle className="h-3 w-3" />
                              {formatNumber(media.comments_count)}
                            </span>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Assets Tab ───────────────────────────────────────────────────────────────

function AssetsTab({
  assets,
  agentId,
  onRefresh,
}: {
  assets: MarketingAgentAsset[]
  agentId: string
  onRefresh: () => void
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    category: '' as AssetCategory | '',
    file_url: '',
    file_name: '',
    file_type: '',
    description: '',
  })

  const resetForm = () => {
    setForm({ category: '', file_url: '', file_name: '', file_type: '', description: '' })
  }

  const handleCreate = async () => {
    if (!form.category || !form.file_url || !form.file_name) {
      toast.error('Preencha todos os campos obrigatorios')
      return
    }
    setSubmitting(true)
    try {
      const res = await createAsset({
        agent_id: agentId,
        category: form.category as AssetCategory,
        file_url: form.file_url,
        file_name: form.file_name,
        file_type: form.file_type || undefined,
        description: form.description || undefined,
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Asset adicionado com sucesso')
        setCreateOpen(false)
        resetForm()
        onRefresh()
      }
    } catch {
      toast.error('Erro ao criar asset')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await deleteAsset(id)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Asset eliminado')
        onRefresh()
      }
    } catch {
      toast.error('Erro ao eliminar asset')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {assets.length} {assets.length === 1 ? 'asset' : 'assets'}
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Asset
        </Button>
      </div>

      {assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-medium text-muted-foreground">Nenhum asset</h3>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Adicione assets para este consultor.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => {
            const isImage = isImageType(asset.file_type)
            return (
              <Card key={asset.id} className="group overflow-hidden transition-shadow hover:shadow-md">
                <CardContent className="p-0">
                  <div className="relative flex h-36 items-center justify-center bg-muted/50">
                    {isImage ? (
                      <img src={asset.file_url} alt={asset.file_name} className="h-full w-full object-cover" />
                    ) : (
                      <FileText className="h-12 w-12 text-muted-foreground/40" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                      <Button size="icon" variant="secondary" className="h-8 w-8" asChild>
                        <a href={asset.file_url} target="_blank" rel="noopener noreferrer" title="Abrir">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="destructive" className="h-8 w-8" title="Eliminar">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminar asset</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem a certeza de que pretende eliminar &quot;{asset.file_name}&quot;? Esta accao e irreversivel.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(asset.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <div className="space-y-1.5 p-3">
                    <p className="truncate text-sm font-medium" title={asset.file_name}>
                      {asset.file_name}
                    </p>
                    <Badge variant="secondary" className={cn('text-xs', getCategoryColor(asset.category))}>
                      {ASSET_CATEGORIES[asset.category]}
                    </Badge>
                    {asset.description && (
                      <p className="line-clamp-2 text-xs text-muted-foreground/70">{asset.description}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Sheet */}
      <FormSheet
        open={createOpen}
        onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm() }}
        title="Adicionar Asset"
        footer={
          <>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm() }}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? 'A guardar...' : 'Adicionar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Categoria *</Label>
            <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as AssetCategory }))}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar categoria" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(ASSET_CATEGORIES) as [AssetCategory, string][]).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>URL do Ficheiro *</Label>
            <Input placeholder="https://..." value={form.file_url} onChange={(e) => setForm((f) => ({ ...f, file_url: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Nome do Ficheiro *</Label>
            <Input placeholder="ficheiro.png" value={form.file_name} onChange={(e) => setForm((f) => ({ ...f, file_name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Tipo MIME</Label>
            <Input placeholder="image/png" value={form.file_type} onChange={(e) => setForm((f) => ({ ...f, file_type: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Descricao</Label>
            <Input placeholder="Descricao do asset..." value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
      </FormSheet>
    </div>
  )
}

// ─── Calendar Tab ─────────────────────────────────────────────────────────────

function CalendarioTab({ entries }: { entries: MarketingContentCalendar[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {entries.length} {entries.length === 1 ? 'entrada' : 'entradas'}
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Calendar className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-medium text-muted-foreground">Sem entradas no calendario</h3>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Nenhuma entrada agendada para este consultor.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Titulo</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const statusInfo = CALENDAR_STATUS[entry.status]
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm">
                      {format(new Date(entry.scheduled_date), 'dd MMM yyyy', { locale: pt })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.scheduled_time || '--'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {SOCIAL_PLATFORMS[entry.platform]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {CONTENT_TYPES[entry.content_type]}
                    </TableCell>
                    <TableCell className="text-sm font-medium max-w-[200px] truncate">
                      {entry.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn('text-xs', statusInfo.color)}>
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ─── Publications Tab ─────────────────────────────────────────────────────────

function PublicacoesTab({ publications }: { publications: MarketingPublication[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {publications.length} {publications.length === 1 ? 'publicacao' : 'publicacoes'}
        </p>
      </div>

      {publications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Newspaper className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-medium text-muted-foreground">Sem publicacoes</h3>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Nenhuma publicacao registada para este consultor.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {publications.map((pub) => (
            <Card key={pub.id} className="overflow-hidden transition-shadow hover:shadow-md">
              <CardContent className="p-0">
                {pub.thumbnail_url && (
                  <div className="h-40 bg-muted">
                    <img
                      src={pub.thumbnail_url}
                      alt={pub.title || 'Publicacao'}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="p-4 space-y-2">
                  {pub.title && (
                    <p className="text-sm font-medium truncate">{pub.title}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {SOCIAL_PLATFORMS[pub.platform]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(pub.published_at), 'dd MMM yyyy', { locale: pt })}
                    </span>
                  </div>

                  {/* Engagement Metrics */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {formatNumber(pub.likes)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      {formatNumber(pub.comments)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Share2 className="h-3 w-3" />
                      {formatNumber(pub.shares)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {formatNumber(pub.reach)}
                    </span>
                  </div>

                  {pub.post_url && (
                    <a
                      href={pub.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline pt-1"
                    >
                      Ver publicacao
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Requests Tab ─────────────────────────────────────────────────────────────

function PedidosTab({ requests }: { requests: MarketingContentRequest[] }) {
  const now = new Date()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {requests.length} {requests.length === 1 ? 'pedido' : 'pedidos'}
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <MessageSquareText className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-medium text-muted-foreground">Sem pedidos</h3>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Nenhum pedido de conteudo para este consultor.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titulo</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => {
                const statusInfo = REQUEST_STATUS[req.status]
                const isPastDue = req.deadline && new Date(req.deadline) < now && req.status !== 'completed' && req.status !== 'cancelled'

                return (
                  <TableRow key={req.id}>
                    <TableCell className="text-sm font-medium max-w-[250px] truncate">
                      {req.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {SOCIAL_PLATFORMS[req.platform]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {CONTENT_TYPES[req.content_type]}
                    </TableCell>
                    <TableCell>
                      {req.deadline ? (
                        <span className={cn('text-sm', isPastDue && 'text-red-600 font-medium')}>
                          {format(new Date(req.deadline), 'dd MMM yyyy', { locale: pt })}
                          {isPastDue && ' (atrasado)'}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn('text-xs', statusInfo.color)}>
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ─── Metrics Tab ──────────────────────────────────────────────────────────────

function MetricasTab({ metrics }: { metrics: MarketingAgentMetric[] }) {
  // Summary from latest metrics
  const latestByPlatform = new Map<string, MarketingAgentMetric>()
  for (const m of metrics) {
    const existing = latestByPlatform.get(m.platform)
    if (!existing || m.month > existing.month) {
      latestByPlatform.set(m.platform, m)
    }
  }
  const latestMetrics = Array.from(latestByPlatform.values())

  const totalFollowers = latestMetrics.reduce((sum, m) => sum + m.followers_count, 0)
  const avgEngagement = latestMetrics.length > 0
    ? latestMetrics.reduce((sum, m) => sum + m.avg_engagement, 0) / latestMetrics.length
    : 0
  const totalPostsThisMonth = latestMetrics.reduce((sum, m) => sum + m.posts_count, 0)

  // Build trend indicators: compare latest with previous month
  const getTrend = (metric: MarketingAgentMetric, field: 'followers_count' | 'avg_engagement'): 'up' | 'down' | 'neutral' => {
    const prev = metrics.find(
      (m) => m.platform === metric.platform && m.month < metric.month
    )
    if (!prev) return 'neutral'
    return metric[field] > prev[field] ? 'up' : metric[field] < prev[field] ? 'down' : 'neutral'
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{formatNumber(totalFollowers)}</p>
            <p className="text-xs text-muted-foreground">Total de Seguidores</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{avgEngagement.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Engagement Medio</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalPostsThisMonth}</p>
            <p className="text-xs text-muted-foreground">Posts (ultimo mes)</p>
          </CardContent>
        </Card>
      </div>

      {/* Metrics Table */}
      {metrics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-medium text-muted-foreground">Sem metricas</h3>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Nenhuma metrica registada para este consultor.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead className="text-right">Seguidores</TableHead>
                <TableHead className="text-right">Posts</TableHead>
                <TableHead className="text-right">Engagement</TableHead>
                <TableHead className="text-right">Alcance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.map((m) => {
                const followersTrend = getTrend(m, 'followers_count')
                const engagementTrend = getTrend(m, 'avg_engagement')

                return (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm font-medium">
                      {format(new Date(m.month + '-01'), 'MMM yyyy', { locale: pt })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {SOCIAL_PLATFORMS[m.platform]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      <span className="inline-flex items-center gap-1">
                        {formatNumber(m.followers_count)}
                        {followersTrend === 'up' && <TrendingUp className="h-3 w-3 text-emerald-500" />}
                        {followersTrend === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm">{m.posts_count}</TableCell>
                    <TableCell className="text-right text-sm">
                      <span className="inline-flex items-center gap-1">
                        {m.avg_engagement.toFixed(1)}%
                        {engagementTrend === 'up' && <TrendingUp className="h-3 w-3 text-emerald-500" />}
                        {engagementTrend === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm">{formatNumber(m.avg_reach)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ─── Edit Profile Dialog ──────────────────────────────────────────────────────

function EditProfileDialog({
  open,
  onOpenChange,
  profile,
  onSave,
  saving,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: MarketingAgentProfile
  onSave: (data: Record<string, unknown>) => void
  saving: boolean
}) {
  const [form, setForm] = useState({
    instagram_url: profile.instagram_url ?? '',
    facebook_url: profile.facebook_url ?? '',
    linkedin_url: profile.linkedin_url ?? '',
    tiktok_url: profile.tiktok_url ?? '',
    canva_workspace_url: profile.canva_workspace_url ?? '',
    google_drive_url: profile.google_drive_url ?? '',
    notes: profile.notes ?? '',
    brand_voice_notes: profile.brand_voice_notes ?? '',
  })

  useEffect(() => {
    if (open) {
      setForm({
        instagram_url: profile.instagram_url ?? '',
        facebook_url: profile.facebook_url ?? '',
        linkedin_url: profile.linkedin_url ?? '',
        tiktok_url: profile.tiktok_url ?? '',
        canva_workspace_url: profile.canva_workspace_url ?? '',
        google_drive_url: profile.google_drive_url ?? '',
        notes: profile.notes ?? '',
        brand_voice_notes: profile.brand_voice_notes ?? '',
      })
    }
  }, [open, profile])

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Editar Perfil"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button
            onClick={() => onSave({
              instagram_url: form.instagram_url.trim() || null,
              facebook_url: form.facebook_url.trim() || null,
              linkedin_url: form.linkedin_url.trim() || null,
              tiktok_url: form.tiktok_url.trim() || null,
              canva_workspace_url: form.canva_workspace_url.trim() || null,
              google_drive_url: form.google_drive_url.trim() || null,
              other_links: profile.other_links ?? [],
              notes: form.notes.trim() || null,
              brand_voice_notes: form.brand_voice_notes.trim() || null,
            })}
            disabled={saving}
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />A guardar...</>
            ) : (
              'Guardar'
            )}
          </Button>
        </>
      }
    >
        <div className="space-y-4">
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Redes Sociais</h4>
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><Instagram className="h-3.5 w-3.5" /> Instagram</Label>
                <Input placeholder="https://instagram.com/..." value={form.instagram_url} onChange={(e) => setForm((f) => ({ ...f, instagram_url: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><Facebook className="h-3.5 w-3.5" /> Facebook</Label>
                <Input placeholder="https://facebook.com/..." value={form.facebook_url} onChange={(e) => setForm((f) => ({ ...f, facebook_url: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><Linkedin className="h-3.5 w-3.5" /> LinkedIn</Label>
                <Input placeholder="https://linkedin.com/in/..." value={form.linkedin_url} onChange={(e) => setForm((f) => ({ ...f, linkedin_url: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><TikTokIcon className="h-3.5 w-3.5" /> TikTok</Label>
                <Input placeholder="https://tiktok.com/@..." value={form.tiktok_url} onChange={(e) => setForm((f) => ({ ...f, tiktok_url: e.target.value }))} />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-medium">Ferramentas de Trabalho</h4>
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><Palette className="h-3.5 w-3.5 text-purple-500" /> Canva Workspace</Label>
                <Input placeholder="https://canva.com/..." value={form.canva_workspace_url} onChange={(e) => setForm((f) => ({ ...f, canva_workspace_url: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><FolderOpen className="h-3.5 w-3.5 text-yellow-600" /> Google Drive</Label>
                <Input placeholder="https://drive.google.com/..." value={form.google_drive_url} onChange={(e) => setForm((f) => ({ ...f, google_drive_url: e.target.value }))} />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Notas</Label>
              <Textarea placeholder="Notas internas..." value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Voz da Marca</Label>
              <Textarea placeholder="Tom de comunicacao, estilo preferido..." value={form.brand_voice_notes} onChange={(e) => setForm((f) => ({ ...f, brand_voice_notes: e.target.value }))} rows={3} />
            </div>
          </div>

        </div>
    </FormSheet>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const agentId = params.agentId as string

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<MarketingAgentProfile | null>(null)
  const [assets, setAssets] = useState<MarketingAgentAsset[]>([])
  const [calendarEntries, setCalendarEntries] = useState<MarketingContentCalendar[]>([])
  const [publications, setPublications] = useState<MarketingPublication[]>([])
  const [requests, setRequests] = useState<MarketingContentRequest[]>([])
  const [metrics, setMetrics] = useState<MarketingAgentMetric[]>([])

  // Instagram live data
  const [igData, setIgData] = useState<CompetitorProfile | null>(null)
  const [igLoading, setIgLoading] = useState(false)

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [profilesRes, assetsRes, calendarRes, pubsRes, requestsRes, metricsRes] = await Promise.all([
        getAgentProfiles(),
        getAgentAssets(agentId),
        getCalendarEntries(undefined, agentId),
        getPublications(agentId),
        getContentRequests(undefined, agentId),
        getAgentMetrics(agentId),
      ])

      const foundProfile = profilesRes.profiles.find((p) => p.agent_id === agentId) ?? null
      setProfile(foundProfile)
      setAssets(assetsRes.assets)
      setCalendarEntries(calendarRes.entries)
      setPublications(pubsRes.publications)
      setRequests(requestsRes.requests)
      setMetrics(metricsRes.metrics)
    } catch {
      toast.error('Erro ao carregar dados do consultor')
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-fetch Instagram data when profile loads and has a handle
  useEffect(() => {
    if (!profile || igData || igLoading) return
    const handle = extractInstagramHandle(profile)
    if (handle) {
      handleFetchInstagram()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  const handleFetchInstagram = useCallback(async () => {
    if (!profile) return
    const handle = extractInstagramHandle(profile)
    if (!handle) {
      toast.error('Handle do Instagram não encontrado')
      return
    }
    setIgLoading(true)
    try {
      // fetchCompetitorProfile expects username without @
      const result = await fetchCompetitorProfile(handle.replace(/^@/, ''))
      if (result.error) {
        toast.error(`Erro Instagram: ${result.error}`)
      } else if (result.profile) {
        setIgData(result.profile)
        toast.success('Dados do Instagram actualizados')
      }
    } catch {
      toast.error('Erro ao carregar dados do Instagram')
    } finally {
      setIgLoading(false)
    }
  }, [profile])

  const handleSaveProfile = useCallback(async (data: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await upsertAgentProfile(agentId, data as Partial<MarketingAgentProfile>)
      if (res.error) {
        toast.error(`Erro ao guardar: ${res.error}`)
      } else {
        toast.success('Perfil actualizado com sucesso')
        setEditOpen(false)
        fetchData()
      }
    } catch {
      toast.error('Erro ao guardar perfil')
    } finally {
      setSaving(false)
    }
  }, [agentId, fetchData])

  // ─── Loading State ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-10 w-full max-w-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    )
  }

  // ─── Profile Not Found ──────────────────────────────────────────────────

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <User className="mb-4 h-16 w-16 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold text-muted-foreground">Perfil nao encontrado</h2>
        <p className="mt-2 text-sm text-muted-foreground/70">
          Este consultor ainda nao tem um perfil de redes sociais configurado.
        </p>
        <Button className="mt-6" variant="outline" asChild>
          <Link href="/dashboard/marketing/redes-sociais">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar a Redes Sociais
          </Link>
        </Button>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  const name = profile.agent?.commercial_name ?? 'Consultor'
  const email = profile.agent?.professional_email
  const photoUrl = profile.agent_profile?.profile_photo_url
  const specializations = profile.agent_profile?.specializations

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" className="h-9 w-9 mt-1" asChild>
            <Link href="/dashboard/marketing/redes-sociais">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>

          <Avatar className="h-14 w-14">
            {photoUrl && <AvatarImage src={photoUrl} alt={name} />}
            <AvatarFallback className="text-lg">{getInitials(name)}</AvatarFallback>
          </Avatar>

          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight">{name}</h1>
            {email && <p className="text-sm text-muted-foreground">{email}</p>}

            {/* Social & Quick Links */}
            <div className="flex items-center gap-1 pt-1">
              {profile.instagram_url && (
                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                  <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" title="Instagram">
                    <Instagram className="h-4 w-4" />
                  </a>
                </Button>
              )}
              {profile.facebook_url && (
                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                  <a href={profile.facebook_url} target="_blank" rel="noopener noreferrer" title="Facebook">
                    <Facebook className="h-4 w-4" />
                  </a>
                </Button>
              )}
              {profile.linkedin_url && (
                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                  <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" title="LinkedIn">
                    <Linkedin className="h-4 w-4" />
                  </a>
                </Button>
              )}
              {profile.tiktok_url && (
                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                  <a href={profile.tiktok_url} target="_blank" rel="noopener noreferrer" title="TikTok">
                    <TikTokIcon className="h-4 w-4" />
                  </a>
                </Button>
              )}

              {(profile.canva_workspace_url || profile.google_drive_url) && (
                <>
                  <Separator orientation="vertical" className="h-5 mx-1" />
                  {profile.canva_workspace_url && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a href={profile.canva_workspace_url} target="_blank" rel="noopener noreferrer" title="Canva">
                        <Palette className="h-4 w-4 text-purple-500" />
                      </a>
                    </Button>
                  )}
                  {profile.google_drive_url && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a href={profile.google_drive_url} target="_blank" rel="noopener noreferrer" title="Google Drive">
                        <FolderOpen className="h-4 w-4 text-yellow-600" />
                      </a>
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4 mr-2" />
          Editar Perfil
        </Button>
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="perfil" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="perfil" className="gap-1.5">
            <User className="h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-1.5">
            <Image className="h-4 w-4" />
            Assets
          </TabsTrigger>
          <TabsTrigger value="calendario" className="gap-1.5">
            <Calendar className="h-4 w-4" />
            Calendario
          </TabsTrigger>
          <TabsTrigger value="publicacoes" className="gap-1.5">
            <Newspaper className="h-4 w-4" />
            Publicacoes
          </TabsTrigger>
          <TabsTrigger value="pedidos" className="gap-1.5">
            <MessageSquareText className="h-4 w-4" />
            Pedidos
          </TabsTrigger>
          <TabsTrigger value="metricas" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Metricas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perfil">
          <ProfileTab
            profile={profile}
            igData={igData}
            igLoading={igLoading}
            onFetchInstagram={handleFetchInstagram}
          />
        </TabsContent>

        <TabsContent value="assets">
          <AssetsTab assets={assets} agentId={agentId} onRefresh={fetchData} />
        </TabsContent>

        <TabsContent value="calendario">
          <CalendarioTab entries={calendarEntries} />
        </TabsContent>

        <TabsContent value="publicacoes">
          <PublicacoesTab publications={publications} />
        </TabsContent>

        <TabsContent value="pedidos">
          <PedidosTab requests={requests} />
        </TabsContent>

        <TabsContent value="metricas">
          <MetricasTab metrics={metrics} />
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <EditProfileDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        profile={profile}
        onSave={handleSaveProfile}
        saving={saving}
      />
    </div>
  )
}
