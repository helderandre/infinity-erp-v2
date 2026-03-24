'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'
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
  onComplete?: (dealId: string) => void
}

export function DealDialog({
  open,
  onOpenChange,
  draftId,
  propertyContext,
  onComplete,
}: DealDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[800px] w-full h-[90vh] p-0 gap-0 flex flex-col rounded-2xl overflow-hidden"
        showCloseButton={false}
        onInteractOutside={() => onOpenChange(false)}
        onEscapeKeyDown={() => onOpenChange(false)}
      >
        {open && (
          <DealForm
            draftId={draftId}
            propertyContext={propertyContext}
            onComplete={(id) => {
              onComplete?.(id)
              onOpenChange(false)
            }}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
