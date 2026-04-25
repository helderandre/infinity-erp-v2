'use client'

import { useState, useEffect } from 'react'
import { Rss, Copy, Check, RefreshCw, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/**
 * Lets the consultant copy their personal `.ics` feed URL and subscribe from
 * Google Calendar, Apple Calendar, etc. Also exposes a "regenerate" action
 * that rotates the token (invalidates any previously shared URL).
 */
export function CalendarSubscribePopover() {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const [rotating, setRotating] = useState(false)

  // Lazy-load the URL the first time the popover opens.
  useEffect(() => {
    if (!open || url) return
    let cancelled = false
    setLoading(true)
    fetch('/api/calendar/feed/token')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.url) return
        setUrl(data.url)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, url])

  async function handleCopy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('URL copiado')
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Não foi possível copiar')
    }
  }

  async function handleRotate() {
    setRotating(true)
    try {
      const res = await fetch('/api/calendar/feed/token', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao regenerar')
      setUrl(data.url)
      setConfirmRotate(false)
      toast.success('Novo URL gerado — actualize as subscrições existentes')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao regenerar URL')
    } finally {
      setRotating(false)
    }
  }

  // One-click subscribe via Google Calendar's URL handler. Google parses the
  // `cid` param from a `webcal://` or `https://` URL on the public form below.
  const googleAddUrl = url
    ? `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(url)}`
    : null

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="hidden sm:inline-flex h-8 w-8 sm:h-9 sm:w-9"
            aria-label="Sincronizar com Google Calendar"
            title="Sincronizar com Google Calendar"
          >
            <Rss className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[360px] p-4">
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold">Sincronizar com Google Calendar</h4>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Os seus eventos do ERP aparecem no Google Calendar e atualizam-se
                automaticamente. A sincronização é só de leitura.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                URL do calendário
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={loading ? 'A carregar...' : url ?? ''}
                  className="flex-1 h-8 px-2.5 text-xs rounded-md border bg-muted/30 font-mono truncate focus:outline-none focus:ring-1 focus:ring-primary/40"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 shrink-0"
                  onClick={handleCopy}
                  disabled={!url}
                  aria-label="Copiar"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>

            <Button
              size="sm"
              className="w-full rounded-full"
              asChild
              disabled={!googleAddUrl}
            >
              <a
                href={googleAddUrl ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Abrir no Google Calendar
              </a>
            </Button>

            <details className="group">
              <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground transition-colors select-none list-none">
                <span className="inline-flex items-center gap-1">
                  Como subscrever manualmente
                  <span className="opacity-50 group-open:rotate-90 transition-transform">▸</span>
                </span>
              </summary>
              <ol className="mt-2 space-y-1 text-[11px] text-muted-foreground leading-relaxed list-decimal list-inside">
                <li>Abra o Google Calendar</li>
                <li>
                  Na barra lateral, clique <strong>+</strong> ao lado de "Outros calendários"
                </li>
                <li>Escolha <strong>"De URL"</strong></li>
                <li>Cole o URL acima e clique <strong>"Adicionar calendário"</strong></li>
              </ol>
            </details>

            <div className="pt-2 border-t flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">
                Mantenha este URL privado.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmRotate(true)}
                disabled={!url}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Regenerar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <AlertDialog open={confirmRotate} onOpenChange={setConfirmRotate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerar URL de calendário?</AlertDialogTitle>
            <AlertDialogDescription>
              O URL actual deixa de funcionar. Subscrições existentes no Google
              Calendar (ou outras apps) deixam de receber actualizações até serem
              actualizadas com o novo URL.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rotating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleRotate()
              }}
              disabled={rotating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rotating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : null}
              Regenerar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
