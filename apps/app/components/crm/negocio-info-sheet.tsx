'use client'

import { useState } from 'react'
import { Info, Plus, Link2 } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { NegocioOrigemCard } from '@/components/crm/negocio-origem-card'
import { NegocioParticipants } from '@/components/crm/negocio-participants'
import { NegocioLinkControl } from '@/components/crm/negocio-link-control'

interface NegocioInfoSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientName: string
  negocio: any
  leadId: string | null
  readOnly?: boolean
  onReload?: () => void
  /** Abre o PropertyDetailSheet do imóvel de origem (vive no parent). */
  onPreviewProperty?: (propertyId: string) => void
}

/**
 * Sheet "Info" — agrega a origem do lead, as relações do negócio
 * (parceiros / participantes) e os negócios ligados, que antes viviam
 * inline na tab Início.
 */
export function NegocioInfoSheet({
  open, onOpenChange, clientName, negocio, leadId, readOnly, onReload, onPreviewProperty,
}: NegocioInfoSheetProps) {
  const isMobile = useIsMobile()
  const [addPersonOpen, setAddPersonOpen] = useState(false)
  const [linkDealOpen, setLinkDealOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0 border-border/40 shadow-2xl',
          isMobile
            ? 'data-[side=bottom]:max-h-[80dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[440px] sm:rounded-l-3xl',
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
            <Info className="h-5 w-5" />
            Info
          </SheetTitle>
          <SheetDescription className="text-[12px] truncate">{clientName}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-3">
          {/* Atribuição do lead (fonte + origem) — self-hides quando o negócio não veio de uma entry. */}
          <NegocioOrigemCard negocio={negocio} onPreviewProperty={onPreviewProperty} />

          {/* Associação — relações (parceiros/pessoas) + negócios ligados */}
          {negocio.id && !readOnly && (
            <div className="rounded-2xl border border-border/50 bg-muted/20 px-3.5 py-3 space-y-3">
              <h3 className="text-sm font-semibold tracking-tight">Associação</h3>
              <div className="flex items-center gap-2">
                <Button
                  type="button" variant="outline" size="sm"
                  className="h-8 flex-1 rounded-full text-xs gap-1.5"
                  onClick={() => setAddPersonOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Associar relação
                </Button>
                <Button
                  type="button" variant="outline" size="sm"
                  className="h-8 flex-1 rounded-full text-xs gap-1.5"
                  onClick={() => setLinkDealOpen(true)}
                >
                  <Link2 className="h-3.5 w-3.5" /> Ligar negócio
                </Button>
              </div>
              <NegocioParticipants
                embed
                negocioId={negocio.id}
                leadId={leadId}
                readOnly={readOnly}
                onPrimaryChanged={onReload}
                addOpen={addPersonOpen}
                onAddOpenChange={setAddPersonOpen}
              />
              <NegocioLinkControl
                embed
                negocioId={negocio.id}
                leadId={leadId}
                dealGroupId={(negocio.deal_group_id as string | null) ?? null}
                onChanged={onReload}
                pickerOpen={linkDealOpen}
                onPickerOpenChange={setLinkDealOpen}
              />
            </div>
          )}
          {/* Read-only (referrer view): keep the people list visible, no actions. */}
          {negocio.id && readOnly && (
            <NegocioParticipants
              negocioId={negocio.id}
              leadId={leadId}
              readOnly={readOnly}
              onPrimaryChanged={onReload}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
