'use client'

import { useEffect, useRef } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Inbox } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { LeadsEntryCards } from './leads-entry-cards'

interface LeadEntriesSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  entries: any[]
  loading: boolean
  pendingCount: number
  onQualified?: () => void
  onMarkedSeen?: () => void
}

export function LeadEntriesSheet({
  open,
  onOpenChange,
  contactId,
  entries,
  loading,
  pendingCount,
  onQualified,
  onMarkedSeen,
}: LeadEntriesSheetProps) {
  const isMobile = useIsMobile()
  const markedRef = useRef(false)

  useEffect(() => {
    if (!open) {
      markedRef.current = false
      return
    }
    if (markedRef.current || pendingCount <= 0) return

    markedRef.current = true
    fetch(`/api/leads/${contactId}/entries/mark-seen`, { method: 'POST' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.updated) onMarkedSeen?.()
      })
      .catch(() => {
        markedRef.current = false
      })
  }, [open, pendingCount, contactId, onMarkedSeen])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0',
          isMobile
            ? 'data-[side=bottom]:h-[90dvh] rounded-t-3xl'
            : 'w-full sm:max-w-[640px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        <SheetHeader
          className={cn(
            'px-6 pb-4 border-b border-border/40 shrink-0',
            isMobile ? 'pt-8' : 'pt-6',
          )}
        >
          <SheetTitle className="flex items-center gap-2 text-base">
            <Inbox className="h-5 w-5" />
            Leads
            {entries.length > 0 && (
              <Badge variant="secondary" className="text-[10px] rounded-full">
                {entries.length}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription className="text-[12px]">
            Histórico de vezes que o contacto demonstrou interesse
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          <LeadsEntryCards
            entries={entries}
            loading={loading}
            contactId={contactId}
            onQualified={onQualified}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
