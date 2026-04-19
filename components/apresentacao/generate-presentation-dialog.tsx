'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import {
  FileText,
  Presentation,
  Download,
  Copy,
  ExternalLink,
  Loader2,
  Check,
  Sparkles,
} from 'lucide-react'

type Format = 'ficha' | 'presentation' | 'both'

const PRESENTATION_SECTIONS: Array<{ key: string; label: string; hint?: string }> = [
  { key: 'cover', label: 'Capa' },
  { key: 'resumo', label: 'Resumo (preço + especificações)' },
  { key: 'descricao', label: 'Descrição' },
  { key: 'galeria', label: 'Galeria de fotos' },
  { key: 'plantas', label: 'Plantas + Renders 3D' },
  { key: 'staging', label: 'Virtual Staging' },
  { key: 'localizacao', label: 'Localização + mapa' },
  { key: 'consultor', label: 'Consultor' },
  { key: 'closing', label: 'Encerramento' },
]

const FICHA_SECTIONS: Array<{ key: string; label: string }> = [
  { key: 'cover', label: 'Imagem principal' },
  { key: 'resumo', label: 'Especificações' },
  { key: 'descricao', label: 'Descrição' },
  { key: 'galeria', label: 'Galeria (até 6 fotos)' },
  { key: 'plantas', label: 'Plantas' },
  { key: 'localizacao', label: 'Localização + mapa' },
  { key: 'consultor', label: 'Consultor' },
]

interface Result {
  share_url: string
  ficha_url?: string
  presentation_url?: string
}

interface Props {
  propertyId: string
  trigger: React.ReactNode
}

export function GeneratePresentationDialog({ propertyId, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<Format>('both')
  const [sections, setSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      [...PRESENTATION_SECTIONS, ...FICHA_SECTIONS].map((s) => [s.key, true]),
    ),
  )
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const toggle = (key: string) =>
    setSections((prev) => ({ ...prev, [key]: !prev[key] }))

  const relevantSections =
    format === 'ficha'
      ? FICHA_SECTIONS
      : format === 'presentation'
        ? PRESENTATION_SECTIONS
        : // both — show the union (presentation already includes everything ficha does)
          PRESENTATION_SECTIONS

  const generate = async () => {
    setLoading(true)
    setResult(null)
    try {
      const activeSections = relevantSections
        .filter((s) => sections[s.key])
        .map((s) => s.key)

      const res = await fetch(`/api/properties/${propertyId}/presentation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, sections: activeSections }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar apresentação')
      setResult(data)
      toast.success('Apresentação gerada com sucesso')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao gerar apresentação')
    } finally {
      setLoading(false)
    }
  }

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copiado`)
    } catch {
      toast.error('Não foi possível copiar')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setResult(null)
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Gerar apresentação
          </DialogTitle>
          <DialogDescription>
            Escolha o formato e as secções a incluir. A geração pode demorar alguns segundos.
          </DialogDescription>
        </DialogHeader>

        {!result && (
          <div className="space-y-5">
            {/* Format selector */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Formato
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <FormatOption
                  active={format === 'ficha'}
                  onClick={() => setFormat('ficha')}
                  icon={FileText}
                  title="Ficha A4"
                  hint="2 páginas para visitas"
                />
                <FormatOption
                  active={format === 'presentation'}
                  onClick={() => setFormat('presentation')}
                  icon={Presentation}
                  title="Apresentação 16:9"
                  hint="Slides + link público"
                />
                <FormatOption
                  active={format === 'both'}
                  onClick={() => setFormat('both')}
                  icon={Sparkles}
                  title="Ambos"
                  hint="Ficha + apresentação"
                />
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Secções a incluir
              </Label>
              <div className="rounded-xl border bg-muted/20 p-3 space-y-2 max-h-[260px] overflow-y-auto">
                {relevantSections.map((s) => (
                  <div key={s.key} className="flex items-start gap-2">
                    <Checkbox
                      id={`section-${s.key}`}
                      checked={!!sections[s.key]}
                      onCheckedChange={() => toggle(s.key)}
                      className="mt-0.5"
                    />
                    <label
                      htmlFor={`section-${s.key}`}
                      className="text-sm leading-tight cursor-pointer select-none flex-1"
                    >
                      {s.label}
                      {(s as any).hint && (
                        <div className="text-[11px] text-muted-foreground">{(s as any).hint}</div>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            {/* Share link */}
            <div className="rounded-xl border bg-card p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ExternalLink className="h-3.5 w-3.5" /> Link público (apresentação 16:9)
              </div>
              <div className="flex items-center gap-1.5">
                <code className="flex-1 text-[11px] bg-muted px-2 py-1.5 rounded truncate">
                  {result.share_url}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-full shrink-0"
                  onClick={() => copy(result.share_url, 'Link')}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <a
                  href={result.share_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-full border hover:bg-muted transition-colors shrink-0"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {result.ficha_url && (
              <DownloadRow
                icon={FileText}
                label="Ficha A4 (PDF)"
                url={result.ficha_url}
                onCopy={() => copy(result.ficha_url!, 'Link da ficha')}
              />
            )}
            {result.presentation_url && (
              <DownloadRow
                icon={Presentation}
                label="Apresentação 16:9 (PDF)"
                url={result.presentation_url}
                onCopy={() => copy(result.presentation_url!, 'Link da apresentação')}
              />
            )}
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <Button
              type="button"
              className="rounded-full gap-1.5"
              onClick={generate}
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />A gerar…</>
              ) : (
                <><Sparkles className="h-4 w-4" />Gerar apresentação</>
              )}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => setResult(null)}
              >
                Gerar outra
              </Button>
              <Button type="button" className="rounded-full" onClick={() => setOpen(false)}>
                Fechar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FormatOption({
  active,
  onClick,
  icon: Icon,
  title,
  hint,
}: {
  active: boolean
  onClick: () => void
  icon: React.ElementType
  title: string
  hint: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl border px-3 py-3 text-left transition-all',
        active
          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
          : 'border-border hover:bg-muted/50',
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        {active && <Check className="h-3 w-3 ml-auto text-primary" />}
      </div>
      <div className="text-[13px] font-medium mt-1">{title}</div>
      <div className="text-[10px] text-muted-foreground">{hint}</div>
    </button>
  )
}

function DownloadRow({
  icon: Icon,
  label,
  url,
  onCopy,
}: {
  icon: React.ElementType
  label: string
  url: string
  onCopy: () => void
}) {
  return (
    <div className="rounded-xl border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="flex items-center gap-1.5">
        <code className="flex-1 text-[11px] bg-muted px-2 py-1.5 rounded truncate">{url}</code>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-full shrink-0"
          onClick={onCopy}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="inline-flex items-center justify-center h-8 w-8 rounded-full border hover:bg-muted transition-colors shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  )
}
