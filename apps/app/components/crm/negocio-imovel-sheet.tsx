'use client'

import { Home, Pencil } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { NegocioDataCard } from '@/components/negocios/negocio-data-card'

interface NegocioImovelSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientName: string
  tipo: string
  negocioId: string
  form: Record<string, unknown>
  onOpenFullEdit?: () => void
}

/**
 * Sheet "Imóvel" — vista read-only do que o cliente procura / está a vender.
 * Reusa o <NegocioDataCard> (o mesmo componente do sheet "Editar
 * oportunidade") em modo de visualização, para que ambos mostrem sempre
 * exactamente os mesmos campos.
 */
export function NegocioImovelSheet({
  open, onOpenChange, clientName, tipo, negocioId, form, onOpenFullEdit,
}: NegocioImovelSheetProps) {
  const isMobile = useIsMobile()

  const isSeller =
    tipo === 'Vendedor' || tipo === 'Venda' || tipo === 'Senhorio' || tipo === 'Arrendador'
  const sectionLabel = isSeller ? 'Imóvel' : 'O que procura'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0 border-border/40 shadow-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[90dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[540px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}
        <SheetHeader
          className={cn(
            'px-6 pb-4 border-b border-border/40 shrink-0 flex-row items-start justify-between gap-3',
            isMobile ? 'pt-8' : 'pt-6',
          )}
        >
          <div className="min-w-0 flex-1">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Home className="h-5 w-5" />
              {sectionLabel}
            </SheetTitle>
            <SheetDescription className="text-[12px] truncate">{clientName}</SheetDescription>
          </div>
          {onOpenFullEdit && (
            <button
              type="button"
              onClick={onOpenFullEdit}
              className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border/60 bg-background hover:bg-muted/50 active:scale-[0.97] transition-colors text-[11px] font-medium tracking-tight text-foreground/85 mr-10"
            >
              <Pencil className="h-3 w-3 text-muted-foreground" />
              Editar
            </button>
          )}
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          <NegocioDataCard
            tipo={tipo}
            negocioId={negocioId}
            form={form}
            onFieldChange={() => {}}
            onSave={async () => {}}
            isSaving={false}
            hideEditButton
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
