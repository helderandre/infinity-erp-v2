'use client'

import { useState } from 'react'
import type { MarketingSubscription } from '@/types/marketing'
import { formatDate } from '@/lib/constants'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { AlertTriangle } from 'lucide-react'

interface CancelSubscriptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subscription: MarketingSubscription | null
  onConfirm: (immediate: boolean) => void
}

export function CancelSubscriptionDialog({
  open,
  onOpenChange,
  subscription,
  onConfirm,
}: CancelSubscriptionDialogProps) {
  const [immediate, setImmediate] = useState(false)

  if (!subscription) return null

  const name = subscription.catalog_item?.name || 'esta subscricao'
  const periodEnd = formatDate(subscription.current_period_end)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[440px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar Subscricao</AlertDialogTitle>
          <AlertDialogDescription>
            A subscricao de <span className="font-medium text-foreground">{name}</span> permanecera
            activa ate {periodEnd}.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-3 space-y-3">
          <div className="flex items-start gap-3 rounded-xl border p-3">
            <Checkbox
              id="immediate-cancel"
              checked={immediate}
              onCheckedChange={(checked) => setImmediate(checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="immediate-cancel" className="text-sm font-medium cursor-pointer">
                Cancelar imediatamente
              </Label>
              {immediate && (
                <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-lg p-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    O servico sera cancelado agora e nao podera ser utilizado ate ao final do
                    periodo actual.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">Manter</AlertDialogCancel>
          <AlertDialogAction
            className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => onConfirm(immediate)}
          >
            Cancelar Subscricao
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
