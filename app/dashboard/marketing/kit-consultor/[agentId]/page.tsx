'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/empty-state'
import {
  ArrowLeft, Copy, Upload, Check, Download, Loader2,
  FileImage, Trash2, Package, ChevronLeft, ChevronRight, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface KitTemplate {
  id: string
  name: string
  category: string
  placeholders: string[]
  canva_design_id: string | null
}

interface MaterialPage {
  id: string
  file_path: string
  file_name: string
  file_url: string | null
  thumbnail_url: string | null
  page_index: number
  uploaded_by_user: { commercial_name: string } | null
  created_at: string
}

interface AgentMaterial {
  template: KitTemplate
  pages: MaterialPage[]
}

interface AgentInfo {
  id: string
  commercial_name: string
  professional_email: string
  role: string
  profile_photo_url: string | null
  profile_photo_nobg_url: string | null
  phone_commercial: string | null
  instagram_handle: string | null
  linkedin_url: string | null
}

const CATEGORY_LABELS: Record<string, string> = {
  cartao_visita: 'Cartão de Visita',
  cartao_digital: 'Cartão Digital',
  badge: 'Badge',
  placa_venda: 'Placa de Venda',
  placa_arrendamento: 'Placa de Arrendamento',
  assinatura_email: 'Assinatura de Email',
  relatorio_imovel: 'Relatório de Imóvel',
  estudo_mercado: 'Estudo de Mercado',
  outro: 'Outro',
}

async function downloadFile(url: string, filename: string) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  } catch {
    window.open(url, '_blank')
  }
}

export default function KitConsultorAgentPage() {
  const { agentId } = useParams<{ agentId: string }>()
  const router = useRouter()
  const [agent, setAgent] = useState<AgentInfo | null>(null)
  const [materials, setMaterials] = useState<AgentMaterial[]>([])
  const [templates, setTemplates] = useState<KitTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadDialog, setUploadDialog] = useState<{ templateId: string; templateName: string; pageIndex: number } | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewItem, setPreviewItem] = useState<AgentMaterial | null>(null)
  const [previewPageIdx, setPreviewPageIdx] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [queueRes, materialsRes, templatesRes] = await Promise.all([
        fetch(`/api/marketing/kit-queue?filter=all&search=`),
        fetch(`/api/consultants/${agentId}/materials`),
        fetch('/api/marketing/kit-templates'),
      ])

      const queueData = await queueRes.json()
      const agentData = (queueData.agents || []).find((a: any) => a.id === agentId)
      if (agentData) setAgent(agentData)

      const matData = await materialsRes.json()
      setMaterials(Array.isArray(matData) ? matData : [])

      const tplData = await templatesRes.json()
      setTemplates(Array.isArray(tplData) ? tplData : [])
    } catch {
      setMaterials([])
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => { fetchData() }, [fetchData])

  const readyCount = materials.filter(m => m.pages.length > 0).length
  const totalCount = materials.length
  const progressPct = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0

  const generatePrompt = () => {
    if (!agent) return
    const designId = templates.find(t => t.canva_design_id)?.canva_design_id

    const photoLine = agent.profile_photo_url
      ? `Foto original (com fundo): ${agent.profile_photo_url}`
      : 'Foto: [NÃO TEM FOTO - pedir ao consultor]'

    const nobgLine = agent.profile_photo_nobg_url
      ? `Foto sem fundo (PNG transparente): ${agent.profile_photo_nobg_url}`
      : ''

    const designLine = designId || '[inserir Design ID ou link do Canva]'

    const prompt = `Preciso de personalizar o kit de marketing Convictus para um novo consultor.
Design a editar: ${designLine}
Dados do consultor:

Nome: ${agent.commercial_name}
Email: ${agent.professional_email}
Telefone: ${agent.phone_commercial || '[sem telefone]'}
${agent.instagram_handle ? `Instagram: ${agent.instagram_handle}` : ''}
Website: www.infinitygroup.pt
${photoLine}${nobgLine ? `\n${nobgLine}` : ''}

Segue o skill convictus-marketing-kit para personalizar.`

    navigator.clipboard.writeText(prompt)
    toast.success('Prompt copiado para a área de transferência')
  }

  const handleUpload = async (files: File[]) => {
    if (!uploadDialog || files.length === 0) return
    setUploading(true)
    try {
      let startPage = uploadDialog.pageIndex
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData()
        formData.append('file', files[i])
        formData.append('template_id', uploadDialog.templateId)
        formData.append('page_index', String(startPage + i))

        const res = await fetch(`/api/marketing/kit-queue/${agentId}/upload`, {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || `Erro ao carregar página ${startPage + i}`)
        }
      }

      toast.success(files.length > 1
        ? `${files.length} páginas carregadas com sucesso`
        : 'Material carregado com sucesso'
      )
      setUploadDialog(null)
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar ficheiro')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteMaterial = async (materialId: string) => {
    try {
      const res = await fetch(`/api/consultants/${agentId}/materials/${materialId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao eliminar')
      toast.success('Material eliminado')
      fetchData()
    } catch {
      toast.error('Erro ao eliminar material')
    }
  }

  const handleDownloadTemplate = async (pages: MaterialPage[], templateName: string) => {
    const available = pages.filter(p => p.file_url)
    if (available.length === 0) return
    if (available.length > 1) {
      toast.success(`A descarregar ${available.length} páginas...`)
    }
    for (let i = 0; i < available.length; i++) {
      if (available[i].file_url) {
        await downloadFile(available[i].file_url!, available[i].file_name || `${templateName}-p${available[i].page_index}.png`)
      }
    }
  }

  const previewPage = previewItem?.pages[previewPageIdx] || null
  const previewTotalPages = previewItem?.pages.length || 0

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard/marketing/kit-consultor')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
      </div>

      {/* Agent info + progress */}
      {agent && (
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={agent.profile_photo_url || undefined} />
              <AvatarFallback>
                {agent.commercial_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold truncate">{agent.commercial_name}</h1>
                <Badge variant="outline" className="text-[10px]">{agent.role}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{agent.professional_email}</p>
            </div>
            <Button
              variant="outline"
              className="rounded-full gap-2 text-xs shrink-0"
              onClick={generatePrompt}
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar Prompt
            </Button>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">{readyCount} de {totalCount} materiais</span>
              <span className="text-xs font-medium">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </div>
        </div>
      )}

      {/* Materials Grid */}
      {materials.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Sem templates configurados"
          description="Ainda não foram configurados templates de kit marketing."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {materials.map(({ template, pages }) => {
            const hasPages = pages.length > 0
            const coverPage = pages[0]
            const nextPage = pages.length + 1

            return (
              <div
                key={template.id}
                className={cn(
                  'rounded-xl border p-3 space-y-2 transition-all',
                  hasPages ? 'bg-card/50 border-border' : 'bg-muted/10 border-dashed'
                )}
              >
                {/* Thumbnail — clickable for preview */}
                {hasPages && coverPage ? (
                  <div className="group relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-muted cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                    onClick={() => { setPreviewItem({ template, pages }); setPreviewPageIdx(0) }}
                  >
                    <img
                      src={coverPage.thumbnail_url || coverPage.file_url || ''}
                      alt={template.name}
                      className="w-full h-full object-cover"
                    />
                    {pages.length > 1 && (
                      <span className="absolute bottom-1 right-1 text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded-full">
                        {pages.length} pág.
                      </span>
                    )}
                    {/* Delete button on hover */}
                    <button
                      className="absolute top-1 right-1 p-1.5 rounded-full bg-red-500/90 text-white hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        // Delete all pages for this template
                        if (confirm(`Eliminar ${pages.length > 1 ? `todas as ${pages.length} páginas` : 'este material'}?`)) {
                          Promise.all(pages.map(p => handleDeleteMaterial(p.id)))
                        }
                      }}
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="aspect-[4/3] rounded-lg bg-muted/40 flex items-center justify-center">
                    <FileImage className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                )}

                {/* Info */}
                <div>
                  <p className="text-xs font-medium truncate">{template.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {CATEGORY_LABELS[template.category] || template.category}
                    {hasPages && pages.length > 1 && ` · ${pages.length} pág.`}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-1">
                  <Button
                    variant={hasPages ? 'ghost' : 'outline'}
                    size="sm"
                    className="flex-1 rounded-full text-[10px] h-7 gap-1"
                    onClick={() => setUploadDialog({
                      templateId: template.id,
                      templateName: template.name,
                      pageIndex: nextPage,
                    })}
                  >
                    <Upload className="h-3 w-3" />
                    {hasPages ? 'Página' : 'Carregar'}
                  </Button>
                  {hasPages && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full text-[10px] h-7 gap-1"
                      onClick={() => handleDownloadTemplate(pages, template.name)}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={!!uploadDialog} onOpenChange={(open) => !open && setUploadDialog(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Carregar Material</DialogTitle>
            <DialogDescription>{uploadDialog?.templateName}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files
                if (files && files.length > 0) {
                  // Copy FileList before resetting input
                  const fileArray = Array.from(files)
                  e.target.value = ''
                  handleUpload(fileArray)
                }
              }}
            />

            <button
              className="w-full flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-8 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mb-2" />
                  <p className="text-sm font-medium">A carregar...</p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-medium">Clique para seleccionar ficheiros</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPEG, WebP ou PDF · Pode seleccionar vários</p>
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-3xl rounded-2xl p-0 overflow-hidden gap-0">
          <DialogTitle className="sr-only">{previewItem?.template.name || 'Pré-visualização'}</DialogTitle>
          {previewItem && previewPage && (
            <>
              <div className="relative bg-muted/30">
                {previewPage.file_name?.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={previewPage.file_url || ''}
                    className="w-full h-[70vh]"
                    title={`${previewItem.template.name} - Pág. ${previewPage.page_index}`}
                  />
                ) : (
                  <img
                    src={previewPage.file_url || previewPage.thumbnail_url || ''}
                    alt={`${previewItem.template.name} - Pág. ${previewPage.page_index}`}
                    className="w-full h-auto max-h-[70vh] object-contain"
                  />
                )}

                {previewTotalPages > 1 && (
                  <>
                    <button
                      className={cn(
                        'absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors',
                        previewPageIdx === 0 && 'opacity-30 pointer-events-none'
                      )}
                      onClick={() => setPreviewPageIdx((i) => Math.max(0, i - 1))}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      className={cn(
                        'absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors',
                        previewPageIdx >= previewTotalPages - 1 && 'opacity-30 pointer-events-none'
                      )}
                      onClick={() => setPreviewPageIdx((i) => Math.min(previewTotalPages - 1, i + 1))}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>

              <div className="p-4 border-t flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{previewItem.template.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORY_LABELS[previewItem.template.category] || previewItem.template.category}
                    {previewTotalPages > 1 && ` · Página ${previewPageIdx + 1} de ${previewTotalPages}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {previewTotalPages > 1 && (
                    <div className="flex items-center gap-1 mr-2">
                      {previewItem.pages.map((_, i) => (
                        <button
                          key={i}
                          className={cn(
                            'h-1.5 rounded-full transition-all',
                            i === previewPageIdx ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                          )}
                          onClick={() => setPreviewPageIdx(i)}
                        />
                      ))}
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full gap-2 text-xs text-destructive hover:text-destructive"
                    onClick={async () => {
                      await handleDeleteMaterial(previewPage.id)
                      if (previewTotalPages <= 1) {
                        setPreviewItem(null)
                      } else {
                        setPreviewPageIdx((i) => Math.min(i, previewTotalPages - 2))
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar{previewTotalPages > 1 ? ' página' : ''}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full gap-2 text-xs"
                    onClick={() => handleDownloadTemplate(previewItem.pages, previewItem.template.name)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Descarregar{previewTotalPages > 1 ? ` Todos (${previewTotalPages})` : ''}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
