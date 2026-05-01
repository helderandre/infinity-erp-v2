'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Zap } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { ContactAutomationsList } from '@/components/crm/contact-automations-list'

interface LeadAutomationsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  contactBirthday: string | null
  hasDeals: boolean
}

export function LeadAutomationsSheet({
  open,
  onOpenChange,
  contactId,
  contactBirthday,
  hasDeals,
}: LeadAutomationsSheetProps) {
  const isMobile = useIsMobile()

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
            <Zap className="h-5 w-5" />
            Automatismos
          </SheetTitle>
          <SheetDescription className="text-[12px]">
            Eventos fixos e mensagens agendadas para este contacto
          </SheetDescription>
        </SheetHeader>

        <div className="@container flex-1 min-h-0 overflow-y-auto px-6 py-5">
          <ContactAutomationsList
            contactId={contactId}
            contactBirthday={contactBirthday}
            hasDeals={hasDeals}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
