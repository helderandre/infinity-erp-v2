'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface DashboardSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  eyebrow?: string
  /** Acções do header (ex.: Editar, Reset). Renderizadas à direita do título. */
  headerActions?: React.ReactNode
  /** Botões do footer. Quando ausente, footer é escondido. */
  footer?: React.ReactNode
  /** Largura do sheet em desktop. */
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

const SIZE_CLASS: Record<NonNullable<DashboardSheetProps['size']>, string> = {
  sm: 'data-[side=right]:sm:max-w-[480px]',
  md: 'data-[side=right]:sm:max-w-[620px]',
  lg: 'data-[side=right]:sm:max-w-[760px]',
}

export function DashboardSheet({
  open,
  onOpenChange,
  title,
  description,
  eyebrow,
  headerActions,
  footer,
  size = 'md',
  children,
}: DashboardSheetProps) {
  const isMobile = useIsMobile()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl gap-0',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[85dvh] rounded-t-3xl'
            : cn('w-full sm:rounded-l-3xl', SIZE_CLASS[size]),
        )}
      >
        {isMobile && (
          <div
            className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25"
            aria-hidden
          />
        )}

        <div className="shrink-0 px-6 pt-8 pb-4 sm:pt-10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {eyebrow && (
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-1.5">
                  {eyebrow}
                </p>
              )}
              <SheetHeader className="p-0 gap-0">
                <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight pr-2">
                  {title}
                </SheetTitle>
                {description ? (
                  <SheetDescription className="text-sm text-muted-foreground mt-1">
                    {description}
                  </SheetDescription>
                ) : (
                  <SheetDescription className="sr-only">{title}</SheetDescription>
                )}
              </SheetHeader>
            </div>
            {headerActions ? (
              <div className="flex items-center gap-1.5 shrink-0">{headerActions}</div>
            ) : null}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">{children}</div>

        {footer ? (
          <div className="px-6 py-4 flex flex-row items-center gap-2 shrink-0 border-t border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md">
            {footer}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 640px)')
    const update = () => setIsMobile(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])
  return isMobile
}

/** Botão "X" para o header de sheets que não usem o close default. */
export function DashboardSheetCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="h-8 w-8 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      aria-label="Fechar"
    >
      <X className="h-4 w-4" />
    </button>
  )
}
