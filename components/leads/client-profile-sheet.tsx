'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Sparkles } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { ClientProfileCard } from './client-profile-card'

interface ClientProfileSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  invalidateKey?: number
}

export function ClientProfileSheet({
  open,
  onOpenChange,
  contactId,
  invalidateKey,
}: ClientProfileSheetProps) {
  const isMobile = useIsMobile()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0',
          isMobile
            ? 'data-[side=bottom]:h-[85dvh] rounded-t-3xl'
            : 'w-full sm:max-w-[560px] sm:rounded-l-3xl',
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
            <Sparkles className="h-5 w-5" />
            Perfil do cliente
          </SheetTitle>
          <SheetDescription className="text-[12px]">
            Síntese IA das observações, interacções e negócios deste contacto
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          <ClientProfileCard contactId={contactId} invalidateKey={invalidateKey} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
