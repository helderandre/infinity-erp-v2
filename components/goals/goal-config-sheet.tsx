'use client'

import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { GoalConfigForm } from './goal-config-form'

interface GoalConfigSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (id: string) => void
}

export function GoalConfigSheet({ open, onOpenChange, onSuccess }: GoalConfigSheetProps) {
  const isMobile = useIsMobile()
  const [consultants, setConsultants] = useState<{ id: string; commercial_name: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setIsLoading(true)
    fetch('/api/users/consultants')
      .then((res) => (res.ok ? res.json() : []))
      .then((json) => {
        if (cancelled) return
        setConsultants(json.data || json || [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[90dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[640px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}

        <div className="shrink-0 px-6 pt-8 pb-4 sm:pt-10">
          <SheetHeader className="p-0 gap-1">
            <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight pr-10">
              Novo Objetivo
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Definir objetivo anual e parâmetros de funil para um consultor
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-[280px] w-full rounded-xl" />
              <Skeleton className="h-[180px] w-full rounded-xl" />
            </div>
          ) : (
            <GoalConfigForm
              consultants={consultants}
              enableQuickFill
              onCancel={() => onOpenChange(false)}
              onSuccess={(id) => {
                onOpenChange(false)
                onSuccess?.(id)
              }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
