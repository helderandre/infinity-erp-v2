'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Plus, Trash2, Loader2, FileText, Download, Maximize2, Layers, Sparkles, RefreshCw,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PropertyImagePreviewSheet, type PreviewItem } from './property-image-preview-sheet'
import { useAiBatchStore } from '@/stores/ai-batch-store'

interface PlantaMedia {
  id: string
  url: string
  media_type: string | null
  order_index: number | null
  source_media_id?: string | null
}

interface PropertyPlantasSectionProps {
  propertyId: string
  plantas: PlantaMedia[]
  renders3d?: PlantaMedia[]
  onMediaChange: () => void
}

export function PropertyPlantasSection({
  propertyId,
  plantas,
  renders3d = [],
  onMediaChange,
}: PropertyPlantasSectionProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [generateForPlantaId, setGenerateForPlantaId] = useState<string | null>(null)
  const [generationNotes, setGenerationNotes] = useState('')
  const [variantsCount, setVariantsCount] = useState<1 | 2>(1)
  const inputRef = useRef<HTMLInputElement>(null)
  const { job: batchJob, startJob, updateJob, finishJob } = useAiBatchStore()
  // While a planta_3d batch is running, we show a loader on the source planta
  // (only when the running batch belongs to this property). The endpoint
  // generates all variants in one call so we don't track per-planta beyond
  // the batch flag.
  const isAnyGenerating = !!batchJob && batchJob.propertyId === propertyId && batchJob.type === 'planta_3d' && !batchJob.finished

  const rendersByPlanta = useMemo(() => {
    const map = new Map<string, PlantaMedia[]>()
    for (const r of renders3d) {
      if (!r.source_media_id) continue
      const list = map.get(r.source_media_id) || []
      list.push(r)
      map.set(r.source_media_id, list)
    }
    return map
  }, [renders3d])

  /** Flat list of previewable items (plantas + their renders) used by the
   *  Sheet preview to support next/prev navigation. PDFs are skipped — they
   *  open in a new tab via the Download icon. */
  const previewItems = useMemo<PreviewItem[]>(() => {
    const items: PreviewItem[] = []
    plantas.forEach((p, idx) => {
      if (!p.url.toLowerCase().endsWith('.pdf')) {
        items.push({ id: p.id, url: p.url, caption: `Planta ${idx + 1}` })
      }
      const list = rendersByPlanta.get(p.id) || []
      list.forEach((r, ri) => {
        items.push({ id: r.id, url: r.url, caption: `Render 3D — Planta ${idx + 1} (${ri + 1})` })
      })
    })
    return items
  }, [plantas, rendersByPlanta])

  const openPreviewById = useCallback((id: string) => {
    const idx = previewItems.findIndex((x) => x.id === id)
    if (idx !== -1) setPreviewIndex(idx)
  }, [previewItems])

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setIsUploading(true)
    let uploaded = 0

    for (const file of Array.from(files)) {
      const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
      if (!allowed.includes(file.type)) {
        toast.error(`Ficheiro "${file.name}" não suportado. Use PDF, PNG ou JPG.`)
        continue
      }
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('propertyId', propertyId)
        formData.append('media_type', 'planta')

        const res = await fetch(`/api/properties/${propertyId}/media`, {
          method: 'POST',
          body: formData,
        })

        if (res.ok) {
          uploaded++
        } else {
          const err = await res.json()
          toast.error(`Erro ao carregar "${file.name}": ${err.error || 'desconhecido'}`)
        }
      } catch {
        toast.error(`Erro ao carregar "${file.name}"`)
      }
    }

    if (uploaded > 0) {
      toast.success(`${uploaded} planta${uploaded > 1 ? 's' : ''} carregada${uploaded > 1 ? 's' : ''}`)
      onMediaChange()
    }
    setIsUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }, [propertyId, onMediaChange])

  const handleDelete = useCallback(async (mediaId: string) => {
    setDeletingId(mediaId)
    try {
      const res = await fetch(`/api/properties/${propertyId}/media/${mediaId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Eliminado')
        onMediaChange()
      } else {
        toast.error('Erro ao eliminar')
      }
    } catch {
      toast.error('Erro ao eliminar')
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }, [propertyId, onMediaChange])

  /** Generate 3D renders in the background using the global ai-batch-store.
   *  The user gets a floating progress card and can navigate elsewhere; on
   *  finish a click on the card returns to this section. */
  const generateRenders = useCallback(
    async (plantaId: string, variants: 1 | 2, notes: string) => {
      const style = variants === 2 ? '2 variantes' : '1 render'
      startJob(propertyId, 'planta_3d', variants, style)
      try {
        const res = await fetch(
          `/api/properties/${propertyId}/media/${plantaId}/generate-3d`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              notes: notes.trim() || undefined,
              variants,
            }),
          }
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          updateJob({ done: variants, succeeded: 0, failed: variants })
          finishJob()
          toast.error(data.error || 'Erro ao gerar render')
          return
        }
        const succeeded = data.generated ?? 1
        const failed = Math.max(0, (data.requested ?? variants) - succeeded)
        const completedUrls: string[] = Array.isArray(data.urls) ? data.urls : []
        updateJob({ done: variants, succeeded, failed, completedUrls })
        finishJob()
        if (failed > 0) {
          toast.warning(`Geradas ${succeeded}/${variants} variantes`)
        } else {
          toast.success(succeeded > 1 ? `${succeeded} renders gerados` : 'Render gerado')
        }
        onMediaChange()
      } catch (error) {
        updateJob({ done: variants, succeeded: 0, failed: variants })
        finishJob()
        toast.error(error instanceof Error ? error.message : 'Erro ao gerar render')
      }
    },
    [propertyId, onMediaChange, startJob, updateJob, finishJob]
  )

  const handleGenerate3D = useCallback(async () => {
    if (!generateForPlantaId) return
    const plantaId = generateForPlantaId
    const notes = generationNotes
    const variants = variantsCount
    setGenerateForPlantaId(null)
    setGenerationNotes('')
    await generateRenders(plantaId, variants, notes)
  }, [generateForPlantaId, generationNotes, variantsCount, generateRenders])

  const handleRegenerate = useCallback(
    (plantaId: string) => generateRenders(plantaId, 1, ''),
    [generateRenders]
  )

  const isPdf = (url: string) => url.toLowerCase().endsWith('.pdf')

  return (
    <div className="space-y-3 pt-4 border-t">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-base font-semibold">Plantas</h3>
          {plantas.length > 0 && (
            <span className="text-xs text-muted-foreground">({plantas.length})</span>
          )}
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full text-xs"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
            {isUploading ? 'A carregar...' : 'Adicionar'}
          </Button>
        </div>
      </div>

      {plantas.length === 0 ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 cursor-pointer hover:bg-muted/30 transition-colors"
        >
          <Layers className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma planta adicionada</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">Clique para adicionar PDF ou imagem</p>
        </div>
      ) : (
        <div className="space-y-6">
          {plantas.map((planta, idx) => {
            const renders = rendersByPlanta.get(planta.id) || []
            const isGenerating = isAnyGenerating
            const isPlantaPdf = isPdf(planta.url)

            return (
              <div
                key={planta.id}
                className="rounded-xl border bg-card overflow-hidden animate-in fade-in slide-in-from-bottom-1"
                style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'backwards' }}
              >
                {/* Planta + Renders side by side */}
                <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-0">
                  {/* Planta original */}
                  <div className="group relative border-r">
                    {isPlantaPdf ? (
                      <div
                        className="aspect-[3/4] bg-muted/30 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => window.open(planta.url, '_blank')}
                      >
                        <FileText className="h-10 w-10 text-red-400 mb-2" />
                        <span className="text-[10px] text-muted-foreground font-medium">PDF</span>
                      </div>
                    ) : (
                      <div
                        className="aspect-[3/4] bg-muted/30 cursor-pointer"
                        onClick={() => openPreviewById(planta.id)}
                      >
                        <img
                          src={planta.url}
                          alt={`Planta ${idx + 1}`}
                          className="w-full h-full object-contain p-2"
                        />
                      </div>
                    )}

                    {/* Actions overlay */}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isPlantaPdf ? (
                        <a
                          href={planta.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-7 w-7 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <button
                          onClick={() => openPreviewById(planta.id)}
                          className="h-7 w-7 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                          title="Ampliar"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmDeleteId(planta.id)}
                        className="h-7 w-7 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-red-500/80 transition-colors"
                        title="Eliminar"
                      >
                        {deletingId === planta.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>

                    <div className="px-2.5 py-2 text-center border-t">
                      <span className="text-[11px] text-muted-foreground">Planta {idx + 1}</span>
                    </div>
                  </div>

                  {/* Renders 3D column */}
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-semibold">Renders 3D</span>
                        {renders.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">({renders.length})</span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant={renders.length === 0 ? 'default' : 'outline'}
                        size="sm"
                        className="rounded-full text-[11px] h-7 px-3"
                        disabled={isGenerating || isPlantaPdf}
                        onClick={() => {
                          setGenerationNotes('')
                          setVariantsCount(1)
                          setGenerateForPlantaId(planta.id)
                        }}
                        title={isPlantaPdf ? 'Plantas em PDF não são suportadas — carregue como imagem' : 'Gerar render 3D desta planta'}
                      >
                        {isGenerating ? (
                          <><Loader2 className="h-3 w-3 animate-spin mr-1" />A gerar...</>
                        ) : (
                          <><Sparkles className="h-3 w-3 mr-1" />Gerar 3D</>
                        )}
                      </Button>
                    </div>

                    {renders.length === 0 ? (
                      <div className="flex items-center justify-center rounded-lg border border-dashed py-8">
                        <p className="text-xs text-muted-foreground">
                          {isPlantaPdf
                            ? 'Plantas PDF não suportadas — use imagem'
                            : 'Sem renders gerados ainda'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {renders.map((render) => (
                          <div key={render.id} className="group relative rounded-lg border bg-muted/20 overflow-hidden">
                            <div
                              className="aspect-square cursor-pointer"
                              onClick={() => openPreviewById(render.id)}
                            >
                              <img
                                src={render.url}
                                alt="Render 3D"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            {isAnyGenerating && (
                              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                                <Loader2 className="h-6 w-6 text-white animate-spin" />
                              </div>
                            )}
                            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openPreviewById(render.id)}
                                className="h-6 w-6 rounded-full bg-black/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                                title="Ampliar"
                              >
                                <Maximize2 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleRegenerate(planta.id)}
                                disabled={isAnyGenerating}
                                className="h-6 w-6 rounded-full bg-black/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/80 transition-colors disabled:opacity-50"
                                title="Regenerar (gera um novo render alternativo)"
                              >
                                <RefreshCw className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(render.id)}
                                className="h-6 w-6 rounded-full bg-black/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-red-500/80 transition-colors"
                                title="Eliminar"
                              >
                                {deletingId === render.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Image preview Sheet — modern design, supports next/prev across
          plantas + 3D renders. */}
      <PropertyImagePreviewSheet
        open={previewIndex !== null}
        onOpenChange={(o) => { if (!o) setPreviewIndex(null) }}
        items={previewItems}
        index={previewIndex ?? 0}
        onIndexChange={setPreviewIndex}
      />

      {/* Generate 3D dialog */}
      <Dialog open={!!generateForPlantaId} onOpenChange={(o) => !o && setGenerateForPlantaId(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Gerar render 3D
            </DialogTitle>
            <DialogDescription>
              Escolhe quantas variantes pretendes gerar. Demora alguns segundos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Quantidade</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVariantsCount(1)}
                  className={`rounded-xl border px-3 py-3 text-left transition-all ${
                    variantsCount === 1
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="text-sm font-medium">1 render</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">~15 cêntimos · ~10s</div>
                </button>
                <button
                  type="button"
                  onClick={() => setVariantsCount(2)}
                  className={`rounded-xl border px-3 py-3 text-left transition-all ${
                    variantsCount === 2
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="text-sm font-medium">2 variantes</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">~30 cêntimos · ~10s</div>
                </button>
              </div>
              {variantsCount === 2 && (
                <p className="text-[10px] text-muted-foreground">
                  Gera 2 prompts diferentes (mobilada, design moderno) em paralelo. Mantém os que gostares e elimina os outros.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="generation-notes" className="text-xs">
                Instruções adicionais (opcional)
              </Label>
              <Textarea
                id="generation-notes"
                value={generationNotes}
                onChange={(e) => setGenerationNotes(e.target.value)}
                placeholder="Ex: estilo moderno, paleta clara, mobília minimalista..."
                className="rounded-xl text-sm min-h-[70px] resize-none"
                maxLength={300}
              />
              <p className="text-[10px] text-muted-foreground text-right">
                {generationNotes.length}/300
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setGenerateForPlantaId(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="rounded-full"
              onClick={handleGenerate3D}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Gerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar? Esta acção é irreversível.
              {(() => {
                const target = confirmDeleteId
                  ? plantas.find((p) => p.id === confirmDeleteId)
                  : null
                const rendersForTarget = target ? rendersByPlanta.get(target.id) || [] : []
                if (rendersForTarget.length > 0) {
                  return ` Serão também eliminados ${rendersForTarget.length} render${rendersForTarget.length > 1 ? 's' : ''} 3D associado${rendersForTarget.length > 1 ? 's' : ''}.`
                }
                return ''
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
