'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getAgents,
  getAgentAssets,
  createAsset,
  deleteAsset,
} from '@/app/dashboard/marketing/redes-sociais/actions'
import type { MarketingAgentAsset, AssetCategory } from '@/types/marketing-social'
import { ASSET_CATEGORIES } from '@/types/marketing-social'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import {
  File,
  Image,
  Video,
  FileText,
  Trash2,
  Plus,
  Search,
  ExternalLink,
  Download,
  FolderOpen,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function isImageType(fileType: string | null): boolean {
  return !!fileType && fileType.startsWith('image/')
}

function isVideoType(fileType: string | null): boolean {
  return !!fileType && fileType.startsWith('video/')
}

function getFileIcon(fileType: string | null) {
  if (isImageType(fileType)) return Image
  if (isVideoType(fileType)) return Video
  if (fileType?.includes('pdf')) return FileText
  return File
}

function getCategoryColor(category: AssetCategory): string {
  switch (category) {
    case 'logo':
      return 'bg-blue-100 text-blue-700'
    case 'headshot':
      return 'bg-purple-100 text-purple-700'
    case 'template':
      return 'bg-amber-100 text-amber-700'
    case 'brand_guideline':
      return 'bg-emerald-100 text-emerald-700'
    case 'photo':
      return 'bg-sky-100 text-sky-700'
    case 'video':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Agent {
  id: string
  commercial_name: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SocialAssetsTab() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [assets, setAssets] = useState<MarketingAgentAsset[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterAgent, setFilterAgent] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    agent_id: '',
    category: '' as AssetCategory | '',
    file_url: '',
    file_name: '',
    file_type: '',
    description: '',
  })

  // ─── Data Loading ─────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [agentsRes, assetsRes] = await Promise.all([
        getAgents(),
        getAgentAssets(filterAgent !== 'all' ? filterAgent : undefined),
      ])
      if (agentsRes.agents) setAgents(agentsRes.agents)
      if (assetsRes.assets) setAssets(assetsRes.assets)
    } catch {
      toast.error('Erro ao carregar assets')
    } finally {
      setLoading(false)
    }
  }, [filterAgent])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ─── Filtered Assets ─────────────────────────────────────────────────────

  const filteredAssets = assets.filter((asset) => {
    if (filterCategory !== 'all' && asset.category !== filterCategory) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchName = asset.file_name?.toLowerCase().includes(q)
      const matchDesc = asset.description?.toLowerCase().includes(q)
      if (!matchName && !matchDesc) return false
    }
    return true
  })

  // ─── Agent Name Lookup ────────────────────────────────────────────────────

  const agentNameMap = new Map(agents.map((a) => [a.id, a.commercial_name]))

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!form.agent_id || !form.category || !form.file_url || !form.file_name) {
      toast.error('Preencha todos os campos obrigatorios')
      return
    }
    setSubmitting(true)
    try {
      const res = await createAsset({
        agent_id: form.agent_id,
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
        loadData()
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
        setAssets((prev) => prev.filter((a) => a.id !== id))
      }
    } catch {
      toast.error('Erro ao eliminar asset')
    }
  }

  const resetForm = () => {
    setForm({
      agent_id: '',
      category: '',
      file_url: '',
      file_name: '',
      file_type: '',
      description: '',
    })
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={filterAgent} onValueChange={setFilterAgent}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filtrar por consultor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os consultores</SelectItem>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.commercial_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {(Object.entries(ASSET_CATEGORIES) as [AssetCategory, string][]).map(
                ([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>

          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Asset
        </Button>
      </div>

      <Separator />

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="mb-3 h-32 rounded-md bg-muted" />
                <div className="mb-2 h-4 w-3/4 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-medium text-muted-foreground">
            Nenhum asset encontrado
          </h3>
          <p className="mt-1 text-sm text-muted-foreground/70">
            {searchQuery || filterCategory !== 'all' || filterAgent !== 'all'
              ? 'Tente ajustar os filtros de pesquisa.'
              : 'Comece por adicionar o primeiro asset.'}
          </p>
          {!searchQuery && filterCategory === 'all' && filterAgent === 'all' && (
            <Button className="mt-4" variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Asset
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAssets.map((asset) => {
            const FileIcon = getFileIcon(asset.file_type)
            const isImage = isImageType(asset.file_type)

            return (
              <Card
                key={asset.id}
                className="group overflow-hidden transition-shadow hover:shadow-md"
              >
                <CardContent className="p-0">
                  {/* Thumbnail / Icon Area */}
                  <div className="relative flex h-36 items-center justify-center bg-muted/50">
                    {isImage ? (
                      <img
                        src={asset.file_url}
                        alt={asset.file_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <FileIcon className="h-12 w-12 text-muted-foreground/40" />
                    )}

                    {/* Overlay actions */}
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8"
                        asChild
                      >
                        <a
                          href={asset.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8"
                        asChild
                      >
                        <a
                          href={asset.file_url}
                          download={asset.file_name}
                          title="Descarregar"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="destructive"
                            className="h-8 w-8"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminar asset</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem a certeza de que pretende eliminar &quot;{asset.file_name}
                              &quot;? Esta accao e irreversivel.
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

                  {/* Info */}
                  <div className="space-y-2 p-3">
                    <p
                      className="truncate text-sm font-medium"
                      title={asset.file_name}
                    >
                      {asset.file_name}
                    </p>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-xs',
                          getCategoryColor(asset.category)
                        )}
                      >
                        {ASSET_CATEGORIES[asset.category]}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{agentNameMap.get(asset.agent_id) || '--'}</span>
                      <span>{formatFileSize(asset.file_size)}</span>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {formatDate(asset.created_at)}
                    </p>

                    {asset.description && (
                      <p
                        className="line-clamp-2 text-xs text-muted-foreground/70"
                        title={asset.description}
                      >
                        {asset.description}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Asset</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Consultor *</Label>
              <Select
                value={form.agent_id}
                onValueChange={(v) => setForm((f) => ({ ...f, agent_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar consultor" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.commercial_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, category: v as AssetCategory }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoria" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(ASSET_CATEGORIES) as [AssetCategory, string][]).map(
                    ([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>URL do Ficheiro *</Label>
              <Input
                placeholder="https://pub-xxx.r2.dev/..."
                value={form.file_url}
                onChange={(e) => setForm((f) => ({ ...f, file_url: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Nome do Ficheiro *</Label>
              <Input
                placeholder="logo-infinity.png"
                value={form.file_name}
                onChange={(e) => setForm((f) => ({ ...f, file_name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo MIME</Label>
              <Input
                placeholder="image/png"
                value={form.file_type}
                onChange={(e) => setForm((f) => ({ ...f, file_type: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Descricao</Label>
              <Input
                placeholder="Descricao do asset..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false)
                resetForm()
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? 'A guardar...' : 'Adicionar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
