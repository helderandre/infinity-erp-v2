'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Spinner } from '@/components/kibo-ui/spinner'
import { Check, AlertCircle, X, Languages } from 'lucide-react'
import { cn } from '@/lib/utils'

export type FinalizeStatus = 'idle' | 'loading' | 'success' | 'error'

interface DescriptionFinalizeCardProps {
  status: FinalizeStatus
  /** Idiomas que o servidor confirmou ter traduzido. */
  translated?: string[]
  /** Idiomas que foram saltados (ex.: edições manuais). */
  skipped?: Array<{ lang: string; reason: string }>
  /** Mensagem de erro, se status='error'. */
  errorMessage?: string | null
  onDismiss: () => void
}

/**
 * Cartão flutuante bottom-right que mostra o progresso/conclusão da
 * tradução automática. Não bloqueia o canvas — o utilizador pode
 * continuar a interagir com a app enquanto a chamada corre.
 *
 * Auto-dismiss em sucesso (4s); erros ficam até o utilizador fechar.
 * Mounted via portal em document.body para escapar a clipping de
 * containers com overflow:hidden.
 */
export function DescriptionFinalizeCard({
  status,
  translated = [],
  skipped = [],
  errorMessage = null,
  onDismiss,
}: DescriptionFinalizeCardProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-dismiss em sucesso
  useEffect(() => {
    if (status !== 'success') return
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [status, onDismiss])

  if (!mounted || status === 'idle') return null

  const visibleSkipped = skipped.filter((s) => s.lang !== 'pt')

  const card = (
    <div
      className={cn(
        'fixed z-[60] right-4 bottom-4 sm:right-6 sm:bottom-6',
        'w-[min(360px,calc(100vw-2rem))]',
        'rounded-2xl border shadow-2xl bg-card overflow-hidden',
        'animate-in slide-in-from-bottom-4 fade-in duration-200',
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 p-4">
        <div
          className={cn(
            'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
            status === 'loading' && 'bg-primary/10 ring-1 ring-primary/20',
            status === 'success' && 'bg-emerald-500/10 ring-1 ring-emerald-500/20',
            status === 'error' && 'bg-destructive/10 ring-1 ring-destructive/20',
          )}
        >
          {status === 'loading' && <Spinner className="h-4 w-4 text-primary" />}
          {status === 'success' && <Check className="h-4 w-4 text-emerald-600" />}
          {status === 'error' && <AlertCircle className="h-4 w-4 text-destructive" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Languages className="h-3 w-3 text-muted-foreground" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Descrição
            </p>
          </div>
          <p className="text-sm font-semibold mt-0.5 leading-tight">
            {status === 'loading' && 'A traduzir para EN, FR e ES…'}
            {status === 'success' &&
              (translated.length > 0
                ? `Traduzido para ${translated.map((l) => l.toUpperCase()).join(', ')}`
                : 'Descrição guardada')}
            {status === 'error' && 'Erro na tradução'}
          </p>
          {status === 'loading' && (
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
              Podes continuar a usar a app — avisamos-te quando estiver pronto.
            </p>
          )}
          {status === 'success' && visibleSkipped.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
              {visibleSkipped.length === 1
                ? `${visibleSkipped[0].lang.toUpperCase()} foi mantido (edição manual)`
                : `${visibleSkipped.map((s) => s.lang.toUpperCase()).join(', ')} mantidos (edições manuais)`}
            </p>
          )}
          {status === 'error' && (
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
              {errorMessage || 'Tenta novamente.'}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 -m-1 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40"
          aria-label="Fechar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Indeterminate progress bar enquanto loading */}
      {status === 'loading' && (
        <div className="h-1 bg-muted/40 overflow-hidden">
          <div className="h-full w-1/3 bg-primary/70 animate-[finalize-progress_1.4s_ease-in-out_infinite]" />
        </div>
      )}

      <style jsx>{`
        @keyframes finalize-progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(150%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  )

  return createPortal(card, document.body)
}
