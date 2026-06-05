'use client'

import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface WidgetCardProps {
  /** Ícone à esquerda (componente Lucide). */
  icon: React.ComponentType<{ className?: string }>
  /** Etiqueta curta no topo. */
  label: string
  /** Valor principal — número ou texto curto. */
  value: React.ReactNode
  /** Linha auxiliar abaixo do valor. */
  hint?: React.ReactNode
  /** Linha de "destaque" colorida (ex.: liked count, falhas). */
  badge?: React.ReactNode
  /** Conteúdo adicional (thumbnails, mini-lista). */
  preview?: React.ReactNode
  /** Estado loading. */
  isLoading?: boolean
  /** Click abre o sheet. */
  onClick?: () => void
  className?: string
}

export function WidgetCard({
  icon: Icon,
  label,
  value,
  hint,
  badge,
  preview,
  isLoading,
  onClick,
  className,
}: WidgetCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/70 supports-[backdrop-filter]:bg-card/50 backdrop-blur-xl p-5 space-y-3 shadow-sm">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-12" />
        <Skeleton className="h-3 w-32" />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'group relative w-full text-left rounded-2xl border border-border/40 bg-card/70 supports-[backdrop-filter]:bg-card/50 backdrop-blur-xl p-5 shadow-sm',
        'transition-all duration-200',
        onClick && 'hover:border-border hover:bg-card/90 hover:shadow-md cursor-pointer',
        !onClick && 'cursor-default',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-muted/70 flex items-center justify-center">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        {onClick && (
          <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        {badge}
      </div>

      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      {preview && <div className="mt-3">{preview}</div>}
    </button>
  )
}
