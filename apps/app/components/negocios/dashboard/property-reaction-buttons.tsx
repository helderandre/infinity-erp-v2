'use client'

import { useState } from 'react'
import { Heart, ThumbsDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export type ClientReaction = 'liked' | 'disliked' | null

interface PropertyReactionButtonsProps {
  negocioId: string
  /** id da row em negocio_properties (não confundir com property_id). */
  negocioPropertyId: string
  /** Reacção actual. */
  reaction: ClientReaction
  /** Callback após sucesso para o caller refrescar a lista. */
  onReactionChange?: (next: ClientReaction) => void
  /** Tamanho dos botões. */
  size?: 'sm' | 'md'
  className?: string
}

/**
 * 👍 / 👎 com toggle (clicar de novo no mesmo limpa). Optimistic update —
 * em caso de erro reverte e mostra toast.
 */
export function PropertyReactionButtons({
  negocioId,
  negocioPropertyId,
  reaction,
  onReactionChange,
  size = 'sm',
  className,
}: PropertyReactionButtonsProps) {
  const [pending, setPending] = useState<ClientReaction | 'clearing' | null>(null)

  const setReaction = async (next: ClientReaction) => {
    // Toggle: clicar no mesmo botão limpa a reacção.
    const target: ClientReaction = reaction === next ? null : next
    setPending(target ?? 'clearing')
    onReactionChange?.(target)

    try {
      const res = await fetch(`/api/negocios/${negocioId}/properties/${negocioPropertyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_reaction: target }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erro ao guardar reacção')
      }
      if (target === 'liked') toast.success('Marcado como gostou')
      else if (target === 'disliked') toast.success('Marcado como não gostou')
    } catch (err: any) {
      // Revert
      onReactionChange?.(reaction)
      toast.error(err?.message || 'Erro ao guardar reacção')
    } finally {
      setPending(null)
    }
  }

  const dim = size === 'md' ? 'h-9 w-9' : 'h-8 w-8'
  const icon = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <button
        type="button"
        aria-label="Gostou"
        title="Cliente gostou"
        disabled={pending !== null}
        onClick={(e) => {
          e.stopPropagation()
          setReaction('liked')
        }}
        className={cn(
          'inline-flex items-center justify-center rounded-full border transition-all',
          dim,
          reaction === 'liked'
            ? 'bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600'
            : 'bg-background border-border/60 text-muted-foreground hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30',
          pending !== null && 'opacity-60 cursor-wait',
        )}
      >
        {pending === 'liked' ? (
          <Loader2 className={cn(icon, 'animate-spin')} />
        ) : (
          <Heart
            className={cn(icon, reaction === 'liked' && 'fill-current')}
          />
        )}
      </button>

      <button
        type="button"
        aria-label="Não gostou"
        title="Cliente não gostou"
        disabled={pending !== null}
        onClick={(e) => {
          e.stopPropagation()
          setReaction('disliked')
        }}
        className={cn(
          'inline-flex items-center justify-center rounded-full border transition-all',
          dim,
          reaction === 'disliked'
            ? 'bg-slate-700 border-slate-700 text-white hover:bg-slate-800 dark:bg-slate-600 dark:border-slate-600'
            : 'bg-background border-border/60 text-muted-foreground hover:text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/30',
          pending !== null && 'opacity-60 cursor-wait',
        )}
      >
        {pending === 'disliked' ? (
          <Loader2 className={cn(icon, 'animate-spin')} />
        ) : (
          <ThumbsDown className={icon} />
        )}
      </button>
    </div>
  )
}
