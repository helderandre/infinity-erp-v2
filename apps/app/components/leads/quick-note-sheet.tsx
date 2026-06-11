'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { StickyNote } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { ObservationComposer } from './observation-composer'

interface QuickNoteSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  /** When the note is taken in the context of a specific deal, pass its id so
   *  the resulting activity is also linked to that negocio (otherwise it only
   *  surfaces in the contact timeline, never in the deal timeline). */
  negocioId?: string | null
  /** Called after a save so the parent can refresh activities + AI profile cache */
  onSaved?: () => void
  /** Mostra o selector de tipo (Nota / Chamada / Visita / …) dentro do sheet. */
  showTypePicker?: boolean
  /** Título do sheet (default "Nota rápida"). */
  title?: string
}

/**
 * Quick "Nota rápida" sheet — embeds the same `<ObservationComposer>` used in
 * the Notas tab. Opens on click of the amber Nota quick action so the user
 * can capture a thought without switching tabs.
 */
export function QuickNoteSheet({ open, onOpenChange, contactId, negocioId, onSaved, showTypePicker = false, title = 'Nota rápida' }: QuickNoteSheetProps) {
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
            <StickyNote className="h-5 w-5" />
            {title}
          </SheetTitle>
          <SheetDescription className="text-[12px]">
            Regista uma observação ou interacção com este contacto
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          <ObservationComposer
            contactId={contactId}
            negocioId={negocioId ?? undefined}
            hideTypePicker={!showTypePicker}
            hidePin
            onSaved={() => {
              onSaved?.()
              onOpenChange(false)
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
