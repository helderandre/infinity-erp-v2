'use client'

import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[800px] w-[calc(100%-1rem)] sm:w-full h-[85dvh] sm:h-[90vh] p-0 gap-0 flex flex-col rounded-2xl overflow-hidden"
        showCloseButton={false}
        onInteractOutside={() => onOpenChange(false)}
        onEscapeKeyDown={() => onOpenChange(false)}
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
      </DialogContent>
    </Dialog>
  )
}
