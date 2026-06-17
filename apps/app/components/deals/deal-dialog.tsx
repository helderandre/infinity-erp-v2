'use client'

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { DealForm } from './deal-form'

interface DealDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Resume an existing draft */
  draftId?: string | null
  /** When opened from a property page, pass the property data to prefill and lock */
  propertyContext?: {
    id: string
    title: string
    external_ref?: string | null
    business_type?: string | null
    listing_price?: number | null
    city?: string | null
    commission_agreed?: number | null
  }
  /** When opened from a negocio (proposal accept), pre-fill clients from the lead. */
  negocioContext?: {
    id: string
    leadName?: string | null
    leadEmail?: string | null
    leadPhone?: string | null
    participants?: Array<{ name: string; email?: string | null; phone?: string | null }>
  }
  onComplete?: (dealId: string) => void
}

export function DealDialog({
  open,
  onOpenChange,
  draftId,
  propertyContext,
  negocioContext,
  onComplete,
}: DealDialogProps) {
  const isMobile = useIsMobile()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        showCloseButton={false}
        className={cn(
          'p-0 gap-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[90dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[760px] sm:rounded-l-3xl',
        )}
        onInteractOutside={() => onOpenChange(false)}
        onEscapeKeyDown={() => onOpenChange(false)}
      >
        <VisuallyHidden>
          <SheetTitle>Novo Negócio</SheetTitle>
        </VisuallyHidden>
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}
        {open && (
          <DealForm
            draftId={draftId}
            propertyContext={propertyContext}
            negocioContext={negocioContext}
            onComplete={(id) => {
              onComplete?.(id)
              onOpenChange(false)
            }}
            onClose={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
