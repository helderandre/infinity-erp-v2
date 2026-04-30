'use client'

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { AcquisitionFormV2 } from './acquisition-form-v2'
import type { AcquisitionFormData } from '@/lib/validations/acquisition'

interface AcquisitionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  draftId?: string
  negocioId?: string
  prefillData?: Partial<AcquisitionFormData>
  onComplete?: (procInstanceId: string) => void
}

export function AcquisitionDialog({
  open,
  onOpenChange,
  draftId,
  negocioId,
  prefillData,
  onComplete,
}: AcquisitionDialogProps) {
  const isMobile = useIsMobile()
  const handleClose = () => onOpenChange(false)

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
          <SheetTitle>Nova Angariação</SheetTitle>
        </VisuallyHidden>
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}
        {open && (
          <AcquisitionFormV2
            mode="dialog"
            draftId={draftId}
            negocioId={negocioId}
            prefillData={prefillData}
            onComplete={(procInstanceId) => {
              onComplete?.(procInstanceId)
              handleClose()
            }}
            onClose={handleClose}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
