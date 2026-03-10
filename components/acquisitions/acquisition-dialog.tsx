'use client'

import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet'
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
  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="!max-w-[800px] w-full p-0 gap-0 flex flex-col"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
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
