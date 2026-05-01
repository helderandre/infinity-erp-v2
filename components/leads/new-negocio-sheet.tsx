'use client'

import { useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/kibo-ui/spinner'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import {
  NEGOCIO_BUSINESS_TYPES,
  NEGOCIO_PERSPECTIVAS_BY_BUSINESS_TYPE,
  type NegocioBusinessType,
} from '@/lib/constants'

const TIPOLOGIAS = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5+'] as const
type Tipologia = (typeof TIPOLOGIAS)[number]

interface NewNegocioSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessType: NegocioBusinessType | ''
  onBusinessTypeChange: (bt: NegocioBusinessType | '') => void
  tipo: string
  onTipoChange: (tipo: string) => void
  tipologia: Tipologia | null
  onTipologiaChange: (tipologia: Tipologia | null) => void
  valor: string
  onValorChange: (valor: string) => void
  onSubmit: () => void
  submitting: boolean
}

/**
 * "Nova Oportunidade" sheet — replaces the previous Dialog popup so the
 * creation step lives in the same visual language as the other sheets.
 *
 * Two-step picker:
 *   1. Business type — Venda / Arrendamento / Trespasse (mandatory)
 *   2. Perspectiva  — Comprador|Vendedor (Venda/Trespasse) or
 *                     Arrendatário|Senhorio (Arrendamento)
 *
 * Plus quick-qualification: tipologia (T0..T5+) and valor (€) — adaptive
 * label based on tipo.
 */
export function NewNegocioSheet({
  open,
  onOpenChange,
  businessType,
  onBusinessTypeChange,
  tipo,
  onTipoChange,
  tipologia,
  onTipologiaChange,
  valor,
  onValorChange,
  onSubmit,
  submitting,
}: NewNegocioSheetProps) {
  const isMobile = useIsMobile()

  // When business_type changes and the current `tipo` is no longer valid for
  // this business_type, reset it.
  useEffect(() => {
    if (!businessType) return
    const allowed = NEGOCIO_PERSPECTIVAS_BY_BUSINESS_TYPE[businessType]
    if (tipo && !allowed.includes(tipo)) {
      onTipoChange('')
    }
  }, [businessType, tipo, onTipoChange])

  const perspectivaOptions = businessType
    ? NEGOCIO_PERSPECTIVAS_BY_BUSINESS_TYPE[businessType]
    : []

  // Adaptive label: budget when buyer/tenant; target price when seller/landlord.
  const valorLabel = (() => {
    switch (tipo) {
      case 'Comprador':
        return businessType === 'Trespasse' ? 'Orçamento máximo (€)' : 'Orçamento máximo (€)'
      case 'Arrendatário':
        return 'Renda máxima mensal (€)'
      case 'Vendedor':
        return businessType === 'Trespasse' ? 'Preço pretendido (€)' : 'Preço pretendido (€)'
      case 'Senhorio':
        return 'Renda pretendida mensal (€)'
      default:
        return 'Valor (€)'
    }
  })()

  const canSubmit = !!businessType && !!tipo && !submitting

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0',
          isMobile
            ? 'data-[side=bottom]:h-[85dvh] rounded-t-3xl'
            : 'w-full sm:max-w-[520px] sm:rounded-l-3xl',
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
            <Briefcase className="h-5 w-5" />
            Nova Oportunidade
          </SheetTitle>
          <SheetDescription className="text-[12px]">
            Cria uma oportunidade ligada a este contacto. Podes editar mais detalhes depois.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-3">
          <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-4 space-y-4">
            {/* Step 1 — Business type */}
            <div className="space-y-2">
              <Label>Tipo de negócio *</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {NEGOCIO_BUSINESS_TYPES.map((bt) => {
                  const active = businessType === bt
                  return (
                    <button
                      key={bt}
                      type="button"
                      onClick={() => onBusinessTypeChange(active ? '' : bt)}
                      className={cn(
                        'inline-flex items-center justify-center h-9 rounded-full text-xs font-medium transition-all border',
                        active
                          ? 'bg-foreground text-background border-foreground'
                          : 'border-border/40 bg-background/40 text-muted-foreground hover:text-foreground hover:border-border/70',
                      )}
                    >
                      {bt}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Step 2 — Perspectiva (only when business_type is set) */}
            {businessType && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                <Label>Perspectiva *</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {perspectivaOptions.map((p) => {
                    const active = tipo === p
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => onTipoChange(active ? '' : p)}
                        className={cn(
                          'inline-flex items-center justify-center h-9 rounded-full text-xs font-medium transition-all border',
                          active
                            ? 'bg-foreground text-background border-foreground'
                            : 'border-border/40 bg-background/40 text-muted-foreground hover:text-foreground hover:border-border/70',
                        )}
                      >
                        {p}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tipologia — buttons row T0..T5+. Optional. */}
            <div className="space-y-2">
              <Label>Tipologia</Label>
              <div className="grid grid-cols-6 gap-1">
                {TIPOLOGIAS.map((t) => {
                  const active = tipologia === t
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onTipologiaChange(active ? null : t)}
                      className={cn(
                        'inline-flex items-center justify-center h-8 rounded-full text-xs font-medium transition-all border',
                        active
                          ? 'bg-foreground text-background border-foreground'
                          : 'border-border/40 bg-background/40 text-muted-foreground hover:text-foreground hover:border-border/70',
                      )}
                    >
                      {t}
                    </button>
                  )
                })}
              </div>
              <p className="text-[10px] text-muted-foreground/80">
                Opcional — número de quartos.
              </p>
            </div>

            {/* Valor — adaptive label */}
            <div className="space-y-2">
              <Label htmlFor="negocio-valor">{valorLabel}</Label>
              <Input
                id="negocio-valor"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Opcional"
                value={valor}
                onChange={(e) => onValorChange(e.target.value)}
                disabled={!tipo}
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md px-6 py-3 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="min-w-[120px]"
          >
            {submitting && <Spinner variant="infinite" size={16} className="mr-2" />}
            Criar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
