'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { EmptyState } from '@/components/shared/empty-state'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Download, Check, FileImage, Package, X, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface KitTemplate {
  id: string
  name: string
  category: string
  description: string | null
}

interface MaterialPage {
  id: string
  file_url: string | null
  thumbnail_url: string | null
  file_name: string
  page_index: number
  created_at: string
  uploaded_by_user: { commercial_name: string } | null
}

interface AgentMaterial {
  template: KitTemplate
  pages: MaterialPage[]
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

interface KitMarketingTabProps {
  consultantId: string
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
    // Fallback: open in new tab
    window.open(url, '_blank')
  }
}

export function KitMarketingTab({ consultantId }: KitMarketingTabProps) {
  const [items, setItems] = useState<AgentMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [previewItem, setPreviewItem] = useState<AgentMaterial | null>(null)
  const [previewPageIdx, setPreviewPageIdx] = useState(0)

  const fetchMaterials = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/consultants/${consultantId}/materials`)
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [consultantId])

  useEffect(() => { fetchMaterials() }, [fetchMaterials])

  const readyCount = items.filter(i => i.pages.length > 0).length
  const totalCount = items.length
  const progressPct = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0

  const handleDownloadAll = () => {
    const allPages = items.flatMap(i => i.pages.filter(p => p.file_url))
    if (allPages.length === 0) {
      toast.error('Nenhum material disponível para descarregar')
      return
    }
    for (const page of allPages) {
      if (page.file_url) downloadFile(page.file_url, page.file_name)
    }
    toast.success(`A descarregar ${allPages.length} ficheiro${allPages.length !== 1 ? 's' : ''}`)
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

  const openPreview = (item: AgentMaterial) => {
    if (item.pages.length === 0) return
    setPreviewItem(item)
    setPreviewPageIdx(0)
  }

  const previewPage = previewItem?.pages[previewPageIdx] || null
  const previewTotalPages = previewItem?.pages.length || 0

  // Group by category
  const grouped = items.reduce<Record<string, AgentMaterial[]>>((acc, item) => {
    const cat = item.template.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-16 rounded-2xl" />
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="Sem templates configurados"
        description="Ainda não foram configurados templates de kit marketing."
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* Progress Card */}
      <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-sm">Kit Marketing</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {readyCount} de {totalCount} materiais prontos
            </p>
          </div>
          {readyCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-2 text-xs"
              onClick={handleDownloadAll}
            >
              <Download className="h-3.5 w-3.5" />
              Descarregar Todos
            </Button>
          )}
        </div>
        <Progress value={progressPct} className="h-2" />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-muted-foreground">{progressPct}% completo</span>
          {readyCount === totalCount && totalCount > 0 && (
            <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
              <Check className="h-3 w-3 mr-1" />Kit Completo
            </Badge>
          )}
        </div>
      </div>

      {/* Materials by Category */}
      {Object.entries(grouped).map(([category, categoryItems]) => (
        <div key={category} className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {CATEGORY_LABELS[category] || category}
          </h4>

          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {categoryItems.map(({ template, pages }) => {
              const hasPages = pages.length > 0
              const coverPage = pages[0]

              return (
                <div
                  key={template.id}
                  className={cn(
                    'rounded-lg border p-2 space-y-1.5 transition-all',
                    hasPages
                      ? 'bg-card/50 border-border hover:shadow-sm cursor-pointer'
                      : 'bg-muted/10 border-dashed opacity-60'
                  )}
                  onClick={() => hasPages && openPreview({ template, pages })}
                >
                  {/* Cover thumbnail (first page) */}
                  {hasPages && coverPage ? (
                    <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-muted">
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
                    </div>
                  ) : (
                    <div className="aspect-[4/3] rounded-lg bg-muted/30 flex items-center justify-center">
                      <FileImage className="h-8 w-8 text-muted-foreground/20" />
                    </div>
                  )}

                  {/* Info */}
                  <div>
                    <p className="text-xs font-medium truncate">{template.name}</p>
                    {hasPages ? (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(coverPage.created_at).toLocaleDateString('pt-PT')}
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground mt-0.5">A aguardar...</p>
                    )}
                  </div>

                  {/* Download button */}
                  {hasPages ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full rounded-full text-[10px] h-7 gap-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownloadTemplate(pages, template.name)
                      }}
                    >
                      <Download className="h-3 w-3" />
                      Descarregar{pages.length > 1 ? ` (${pages.length})` : ''}
                    </Button>
                  ) : (
                    <div className="h-7 flex items-center justify-center">
                      <span className="text-[10px] text-muted-foreground italic">Pendente</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Preview Dialog */}
      <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-3xl rounded-2xl p-0 overflow-hidden gap-0">
          <DialogTitle className="sr-only">{previewItem?.template.name || 'Pré-visualização'}</DialogTitle>
          {previewItem && previewPage && (
            <>
              {/* Content — PDF or Image */}
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

                {/* Page navigation arrows */}
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

              {/* Footer */}
              <div className="p-4 border-t flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{previewItem.template.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORY_LABELS[previewItem.template.category] || previewItem.template.category}
                    {previewTotalPages > 1 && ` · Página ${previewPageIdx + 1} de ${previewTotalPages}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Page dots */}
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
