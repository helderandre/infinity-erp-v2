'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

interface FinanceiroSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Optional subline rendered under the title (e.g. category · date). */
  subtitle?: React.ReactNode
  /** Optional accent dot/icon left of the subtitle. */
  accent?: React.ReactNode
  children: React.ReactNode
  /** Footer area — usually Edit / Delete / Close buttons. */
  footer?: React.ReactNode
  /** Desktop max width. Default 540px (form-like); use 'wide' for content-heavy sheets. */
  size?: 'default' | 'wide'
}

// Sheet base com o mesmo styling do <CalendarEventForm>:
//   - desktop: side='right', sm:max-w-[540px], rounded-l-3xl
//   - mobile : side='bottom', h-[80dvh], rounded-t-3xl
//   - backdrop translúcido com backdrop-blur-2xl
//   - grabber em mobile
export function FinanceiroSheet({
  open, onOpenChange, title, subtitle, accent, children, footer, size = 'default',
}: FinanceiroSheetProps) {
  const isMobile = useIsMobile()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[80dvh] rounded-t-3xl'
            : cn(
                'w-full sm:rounded-l-3xl',
                size === 'wide'
                  ? 'data-[side=right]:sm:max-w-[680px]'
                  : 'data-[side=right]:sm:max-w-[540px]',
              ),
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Header */}
          <div className="shrink-0 px-6 pt-8 pb-4 sm:pt-10">
            <SheetHeader className="p-0 gap-0">
              <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight pr-10">
                {title}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Detalhes da entrada financeira.
              </SheetDescription>
            </SheetHeader>

            {(subtitle || accent) && (
              <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                {accent}
                {subtitle && <span>{subtitle}</span>}
              </div>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 pb-6 space-y-4">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="shrink-0 border-t border-border/40 px-6 py-4 bg-background/60 backdrop-blur-sm">
              <div className="flex items-center justify-end gap-2">{footer}</div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
