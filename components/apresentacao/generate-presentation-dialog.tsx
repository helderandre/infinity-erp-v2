'use client'

import { useEffect, useState } from 'react'
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
  RefreshCw,
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
  { key: 'descricao', label: 'Descrição (resumida por IA)' },
  { key: 'galeria', label: 'Galeria (até 6 fotos)' },
  { key: 'plantas', label: 'Plantas (página própria, com 3D)' },
  { key: 'staging', label: 'Virtual Staging (página própria)' },
  { key: 'localizacao', label: 'Localização + mapa' },
  { key: 'consultor', label: 'Consultor' },
]

interface Result {
  share_url: string
  ficha_url?: string
  presentation_url?: string
}

interface Existing {
  format: 'ficha' | 'presentation'
  pdf_url: string
  share_url: string | null
  generated_at: string
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
  const [existing, setExisting] = useState<Existing[]>([])
  const [existingLoading, setExistingLoading] = useState(false)
  const [mode, setMode] = useState<'view' | 'generate'>('view')

  useEffect(() => {
    if (!open) return
    setExistingLoading(true)
    fetch(`/api/properties/${propertyId}/presentation`)
      .then((r) => r.json())
      .then((d) => {
        const items = (d.items || []) as Existing[]
        setExisting(items)
        setMode(items.length > 0 ? 'view' : 'generate')
      })
      .catch(() => {
        setExisting([])
        setMode('generate')
      })
      .finally(() => setExistingLoading(false))
  }, [open, propertyId])

  const toggle = (key: string) =>
    setSections((prev) => ({ ...prev, [key]: !prev[key] }))

  const relevantSections =
    format === 'ficha'
      ? FICHA_SECTIONS
      : format === 'presentation'
        ? PRESENTATION_SECTIONS
        : PRESENTATION_SECTIONS

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

      // Refresh existing list silently
      fetch(`/api/properties/${propertyId}/presentation`)
        .then((r) => r.json())
        .then((d) => setExisting(d.items || []))
        .catch(() => {})
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

  const existingFicha = existing.find((e) => e.format === 'ficha')
  const existingPres = existing.find((e) => e.format === 'presentation')
  const shareUrl = existingPres?.share_url

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) {
          setResult(null)
          setLoading(false)
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Apresentação
          </DialogTitle>
          <DialogDescription>
            {mode === 'view' && existing.length > 0
              ? 'Apresentações guardadas para este imóvel. Pode regenerar para actualizar.'
              : 'Escolha o formato e as secções a incluir. A geração pode demorar alguns segundos.'}
          </DialogDescription>
        </DialogHeader>

        {/* Existing + new result share the same shape */}
        {mode === 'view' && !result && (
          <div className="space-y-3">
            {existingLoading ? (
              <div className="py-6 flex items-center justify-center text-sm text-muted-foreground gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> A carregar…
              </div>
            ) : (
              <>
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
                {existing.length === 0 && (
                  <div className="py-6 text-sm text-muted-foreground text-center">
                    Ainda não foi gerada nenhuma apresentação para este imóvel.
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {mode === 'generate' && !result && (
          <div className="space-y-5">
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
                  hint="PDF para visitas"
                />
                <FormatOption
                  active={format === 'presentation'}
                  onClick={() => setFormat('presentation')}
                  icon={Presentation}
                  title="Apresentação 16:9"
                  hint="PDF + link público"
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
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <ActionCard
              icon={ExternalLink}
              label="Link público (apresentação 16:9)"
              href={result.share_url}
              kind="share"
              copyLabel="Link"
              onCopy={copy}
            />
            {result.ficha_url && (
              <ActionCard
                icon={FileText}
                label="Ficha A4 (PDF)"
                href={result.ficha_url}
                kind="pdf"
                copyLabel="Link da ficha"
                onCopy={copy}
              />
            )}
            {result.presentation_url && (
              <ActionCard
                icon={Presentation}
                label="Apresentação 16:9 (PDF)"
                href={result.presentation_url}
                kind="pdf"
                copyLabel="Link da apresentação"
                onCopy={copy}
              />
            )}
          </div>
        )}

        <DialogFooter>
          {mode === 'view' && !result && (
            <>
              <Button
                type="button"
                variant="outline"
                className="rounded-full gap-1.5"
                onClick={() => setMode('generate')}
                disabled={existingLoading}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {existing.length > 0 ? 'Regenerar' : 'Gerar apresentação'}
              </Button>
              <Button
                type="button"
                className="rounded-full"
                onClick={() => setOpen(false)}
              >
                Fechar
              </Button>
            </>
          )}
          {mode === 'generate' && !result && (
            <>
              {existing.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => setMode('view')}
                  disabled={loading}
                >
                  Voltar
                </Button>
              )}
              <Button
                type="button"
                className="rounded-full gap-1.5"
                onClick={generate}
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />A gerar…</>
                ) : (
                  <><Sparkles className="h-4 w-4" />
                    {existing.length > 0 ? 'Regenerar' : 'Gerar apresentação'}
                  </>
                )}
              </Button>
            </>
          )}
          {result && (
            <>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  setResult(null)
                  setMode('view')
                }}
              >
                Voltar
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
    <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
      <div className="flex items-center justify-center h-9 w-9 rounded-full bg-muted shrink-0">
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
          className="inline-flex items-center justify-center h-8 w-8 rounded-full border hover:bg-muted transition-colors"
          title="Abrir"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        {kind === 'pdf' && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="inline-flex items-center justify-center h-8 w-8 rounded-full border hover:bg-muted transition-colors"
            title="Descarregar"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        )}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={() => onCopy(href, copyLabel)}
          title="Copiar link"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
