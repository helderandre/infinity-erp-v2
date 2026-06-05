'use client'

import type { ReactNode } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'

interface FormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /**
   * Optional extra classes for the SheetContent (e.g. override max width or height).
   * Use static Tailwind classes — e.g. `data-[side=right]:sm:max-w-[640px]`.
   */
  contentClassName?: string
  bodyClassName?: string
}

/**
 * Sheet shell mirroring the calendar event sheet:
 * - Bottom on mobile with rounded-top and grabber, right side on desktop.
 * - Translucent background with backdrop blur.
 * - Sticky header, scrollable body, optional sticky footer.
 */
export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  contentClassName,
  bodyClassName,
}: FormSheetProps) {
  const isMobile = useIsMobile()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background supports-[backdrop-filter]:bg-background/90 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[90dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[540px] sm:rounded-l-3xl',
          contentClassName,
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}

        <div className="shrink-0 px-6 pt-8 pb-4 sm:pt-10">
          <SheetHeader className="p-0 gap-1">
            <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight pr-10">
              {title}
            </SheetTitle>
            {description && (
              <SheetDescription className="text-xs text-muted-foreground">
                {description}
              </SheetDescription>
            )}
          </SheetHeader>
        </div>

        <div className={cn('flex-1 min-h-0 overflow-y-auto px-6 pb-6', bodyClassName)}>
          {children}
        </div>

        {footer && (
          <div className="shrink-0 px-6 py-4 border-t border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md flex flex-row gap-2 justify-end">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
