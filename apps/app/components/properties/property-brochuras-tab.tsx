'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Copy, ExternalLink, FileText, Loader2, Pencil, Sparkles, Presentation, RefreshCw, Download,
} from 'lucide-react'
import { GeneratePresentationDialog } from '@/components/apresentacao/generate-presentation-dialog'
import { PresentationOverridesSheet } from '@/components/properties/presentation-overrides-sheet'
import { cn } from '@/lib/utils'
import type { PropertyMedia } from '@/types/property'

interface BrochuraRow {
  id: string
  format: 'ficha' | 'presentation'
  pdf_url: string
  share_url: string | null
  generated_at: string
}

interface Props {
  propertyId: string
  propertySlug: string | null
  media: PropertyMedia[]
  initialOverrides?: any
}

/**
 * Tab Brochuras — espelha exactamente o conteúdo do `<GeneratePresentationDialog>`
 * em modo "view" (apresentações guardadas) directamente como um painel da
 * página de detalhe / edit-sheet.
 *
 * Itens mostrados (até 3, dependendo do que já foi gerado):
 *   • Link público (apresentação 16:9) — share_url da row format='presentation'
 *   • Ficha A4 (PDF) — pdf_url da row format='ficha'
 *   • Apresentação 16:9 (PDF) — pdf_url da row format='presentation'
 *
 * Editar conteúdo abre o `<PresentationOverridesSheet>` (mesmo que sheet existente).
 * Gerar/Regenerar abre o `<GeneratePresentationDialog>` (sheet existente em modo
 * "generate") — fica como botão secundário no header da tab.
 */
export function PropertyBrochurasTab({ propertyId, media, initialOverrides }: Props) {
  const [items, setItems] = useState<BrochuraRow[]>([])
  const [loading, setLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [overrides, setOverrides] = useState<any>(initialOverrides ?? null)

  const refetch = () => {
    setLoading(true)
    fetch(`/api/properties/${propertyId}/presentation`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setItems(Array.isArray(d.items) ? d.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId])

  const existingFicha = items.find((e) => e.format === 'ficha')
  const existingPres = items.find((e) => e.format === 'presentation')
  const shareUrl = existingPres?.share_url ?? null
  const hasAny = !!(shareUrl || existingFicha || existingPres)

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copiado`)
    } catch {
      toast.error('Não foi possível copiar')
    }
  }

  const generateButton = (
    <GeneratePresentationDialog
      propertyId={propertyId}
      onEditClick={() => setEditOpen(true)}
      trigger={
        <Button size="sm" variant="outline" className="rounded-full h-8 text-xs gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          {hasAny ? 'Regenerar' : 'Gerar apresentação'}
        </Button>
      }
    />
  )

  return (
    <div className="space-y-4">
      {/* Header — título + acções */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-foreground" />
          <h3 className="text-base font-semibold">Apresentação</h3>
          {hasAny && (
            <span className="text-xs text-muted-foreground">
              guardada{[existingFicha, existingPres].filter(Boolean).length > 1 ? 's' : ''} para este imóvel
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {generateButton}
          <Button
            size="sm"
            variant="outline"
            className="rounded-full h-8 text-xs gap-1.5"
            onClick={() => setEditOpen(true)}
            title="Editar conteúdo da apresentação"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar conteúdo
          </Button>
        </div>
      </div>

      {/* Body — lista de itens (link público + 2 PDFs), igual ao sheet existente */}
      {loading ? (
        <div className="py-8 flex items-center justify-center text-sm text-muted-foreground gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> A carregar…
        </div>
      ) : !hasAny ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <FileText className="h-7 w-7 opacity-40" />
          <p className="text-sm font-medium text-foreground/80">Ainda sem apresentação</p>
          <p className="text-xs">Carregue em "Gerar apresentação" para criar a primeira.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {shareUrl && (
            <ActionCard
              icon={ExternalLink}
              label="Link público (apresentação 16:9)"
              href={shareUrl}
              kind="share"
              copyLabel="Link"
              onCopy={copy}
            />
          )}
          {existingFicha && (
            <ActionCard
              icon={FileText}
              label="Ficha A4 (PDF)"
              href={existingFicha.pdf_url}
              kind="pdf"
              copyLabel="Link da ficha"
              onCopy={copy}
              generatedAt={existingFicha.generated_at}
            />
          )}
          {existingPres && (
            <ActionCard
              icon={Presentation}
              label="Apresentação 16:9 (PDF)"
              href={existingPres.pdf_url}
              kind="pdf"
              copyLabel="Link da apresentação"
              onCopy={copy}
              generatedAt={existingPres.generated_at}
            />
          )}
        </div>
      )}

      {/* Editor sheet — re-usa o existente */}
      <PresentationOverridesSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        propertyId={propertyId}
        media={media}
        initial={overrides}
        onSaved={(next) => setOverrides(next)}
      />
    </div>
  )
}

/** ActionCard idêntico ao do `<GeneratePresentationDialog>` — abrir, copiar
 *  link, descarregar (só para PDFs). Mantido inline para não criar uma
 *  dependência cruzada com o ficheiro de apresentações. */
function ActionCard({
  icon: Icon,
  label,
  href,
  kind,
  copyLabel,
  onCopy,
  generatedAt,
}: {
  icon: React.ElementType
  label: string
  href: string
  kind: 'share' | 'pdf'
  copyLabel: string
  onCopy: (text: string, label: string) => Promise<void> | void
  generatedAt?: string
}) {
  const formatted = generatedAt
    ? new Intl.DateTimeFormat('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(generatedAt))
    : null

  return (
    <div className="rounded-2xl border border-border/40 bg-background/40 p-3 flex items-center gap-3">
      <div className={cn(
        'flex items-center justify-center h-9 w-9 rounded-full shrink-0',
        kind === 'share' ? 'bg-primary/10 text-primary' : 'bg-muted/60',
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{label}</div>
        {formatted && (
          <div className="text-[10px] text-muted-foreground tracking-wider uppercase mt-0.5">
            gerada {formatted}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-border/50 bg-background/60 hover:bg-muted transition-colors"
          title="Abrir"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        {kind === 'pdf' && (
          <a
            href={href}
            download
            className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-border/50 bg-background/60 hover:bg-muted transition-colors"
            title="Descarregar"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        )}
        <button
          type="button"
          onClick={() => onCopy(href, copyLabel)}
          className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-border/50 bg-background/60 hover:bg-muted transition-colors"
          title="Copiar link"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
