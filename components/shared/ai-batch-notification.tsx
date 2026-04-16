'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAiBatchStore } from '@/stores/ai-batch-store'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { CheckSquare, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AiBatchNotification() {
  const router = useRouter()
  const { job, showPreview, dismiss, setShowPreview } = useAiBatchStore()

  if (!job) return null

  const handleCardClick = () => {
    if (job.finished) {
      // Navigate to the property's media tab with the right display mode
      const tab = job.type === 'stage' ? 'staged' : 'enhanced'
      router.push(`/dashboard/imoveis/${job.propertyId}?tab=media&display=${tab}`)
      dismiss()
    } else {
      setShowPreview(true)
    }
  }

  return (
    <>
      {/* Floating notification card — fixed to viewport */}
      <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div
          className={cn(
            'w-80 rounded-lg border shadow-lg p-4 cursor-pointer transition-colors',
            job.finished
              ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950 dark:border-emerald-800'
              : 'bg-card border-border hover:bg-accent/50'
          )}
          onClick={handleCardClick}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              {job.finished ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900 shrink-0">
                  <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900 shrink-0">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-600 dark:text-violet-400" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium">
                  {job.finished
                    ? job.type === 'stage'
                      ? `${job.succeeded} imagens decoradas`
                      : `${job.succeeded} imagens melhoradas`
                    : job.type === 'stage'
                      ? 'A decorar imagens…'
                      : 'A melhorar imagens…'
                  }
                </p>
                <p className="text-xs text-muted-foreground">
                  {job.finished
                    ? 'Clique para ver resultados'
                    : `${job.done} de ${job.total} — Clique para pré-visualizar`
                  }
                  {job.style && <span className="capitalize"> · {job.style}</span>}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={(e) => { e.stopPropagation(); dismiss() }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Progress bar */}
          {!job.finished && (
            <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-500 transition-all duration-500"
                style={{ width: `${job.total > 0 ? (job.done / job.total) * 100 : 0}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Preview dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {job.finished ? (
                <CheckSquare className="h-4 w-4 text-emerald-500" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {job.type === 'stage' ? 'Decoração Virtual' : 'Melhoria de Imagens'}
              <span className="text-sm font-normal text-muted-foreground">
                — {job.done}/{job.total}
              </span>
            </DialogTitle>
            <DialogDescription>
              {job.finished
                ? `${job.succeeded} imagens processadas com sucesso.`
                : 'As imagens estão a ser processadas. Pode fechar esta janela — o processamento continua em segundo plano.'
              }
            </DialogDescription>
          </DialogHeader>
          {job.completedUrls.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
              {job.completedUrls.map((url, i) => (
                <div key={i} className="relative aspect-[16/10] rounded-lg overflow-hidden bg-muted">
                  <Image
                    src={url}
                    alt={`Resultado IA ${i + 1}`}
                    fill
                    className="object-cover"
                    sizes="200px"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-3" />
              <p className="text-sm">A processar primeira imagem…</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
